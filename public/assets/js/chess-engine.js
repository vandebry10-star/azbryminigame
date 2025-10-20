/* Azbry Chess — Engine (FIDE rules)
 * Supports: legal move gen, check, checkmate, stalemate,
 * castling, en passant, promotion (default = queen),
 * undo/redo, simple AI (minimax depth-2, alpha-beta).
 */
(function(global){
  "use strict";

  const ICON = {P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔',p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'};
  const VAL  = {P:1,N:3,B:3,R:5,Q:9,K:0, p:1,n:3,b:3,r:5,q:9,k:0};

  const isW = p => /[PNBRQK]/.test(p);
  const isB = p => /[pnbrqk]/.test(p);
  const sideOf = p => isW(p) ? 'w' : isB(p) ? 'b' : '.';
  const inb = (r,c) => r>=0 && r<8 && c>=0 && c<8;

  // FEN start
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  function parseFEN(fen){
    const [pos, turn, cast, ep, half, full] = fen.split(' ');
    const rows = pos.split('/');
    const board = Array.from({length:8}, ()=> Array(8).fill('.'));
    for(let r=0;r<8;r++){
      let c=0;
      for(const ch of rows[r]){
        if(/[1-8]/.test(ch)) c += Number(ch);
        else { board[r][c] = ch; c++; }
      }
    }
    const state = {
      board,
      turn: (turn==='b'?'b':'w'),
      cast: {
        K: cast.includes('K'), Q: cast.includes('Q'),
        k: cast.includes('k'), q: cast.includes('q')
      },
      ep: (ep==='-'? null : algToRC(ep)),
      halfmove: parseInt(half||'0',10),
      fullmove: parseInt(full||'1',10),
    };
    return state;
  }

  function toFEN(state){
    const {board, turn, cast, ep, halfmove, fullmove} = state;
    const rows=[];
    for(let r=0;r<8;r++){
      let run=0, out='';
      for(let c=0;c<8;c++){
        const p=board[r][c];
        if(p==='.') run++;
        else{ if(run){out+=String(run); run=0} out+=p; }
      }
      if(run) out+=String(run);
      rows.push(out);
    }
    const castStr = (cast.K?'K':'')+(cast.Q?'Q':'')+(cast.k?'k':'')+(cast.q?'q':'') || '-';
    const epStr = ep ? rcToAlg(ep.r, ep.c) : '-';
    return `${rows.join('/')}` +
           ` ${turn} ${castStr} ${epStr} ${halfmove|0} ${fullmove|0}`;
  }

  function rcToAlg(r,c){ return 'abcdefgh'[c] + (8-r); }
  function algToRC(s){ const file = s.charCodeAt(0)-97; const rank = 8-parseInt(s[1],10); return {r:rank, c:file}; }

  function cloneBoard(b){
    return b.map(row => row.slice());
  }

  function kingPos(board, side){
    const k = side==='w' ? 'K' : 'k';
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){ if(board[r][c]===k) return {r,c}; }
    return null;
  }

  // generate pseudo-legal (no self-check filter yet)
  function genPseudo(state, r, c){
    const B = state.board, p = B[r][c];
    if(p==='.') return [];
    const side = sideOf(p);
    const mv = [];
    const slide = (dirs)=>{
      for(const [dr,dc] of dirs){
        let rr=r+dr, cc=c+dc;
        while(inb(rr,cc)){
          const t=B[rr][cc];
          if(t==='.') mv.push({r:rr,c:cc, cap:false});
          else { if(sideOf(t)!==side) mv.push({r:rr,c:cc, cap:true}); break; }
          rr+=dr; cc+=dc;
        }
      }
    };
    switch(p.toLowerCase()){
      case 'p':{
        const dir = isW(p)? -1: 1;
        const start = isW(p)? 6: 1;
        // single push
        if(inb(r+dir,c) && B[r+dir][c]==='.') mv.push({r:r+dir,c,cap:false});
        // double push
        if(r===start && B[r+dir][c]==='.' && B[r+2*dir][c]==='.') mv.push({r:r+2*dir,c,cap:false,double:true});
        // captures
        for(const dc of [-1,1]){
          const rr=r+dir, cc=c+dc;
          if(inb(rr,cc)){
            if(B[rr][cc]!=='.' && sideOf(B[rr][cc])!==side) mv.push({r:rr,c:cc,cap:true});
            // en passant
            if(state.ep && state.ep.r===rr && state.ep.c===cc){
              mv.push({r:rr,c:cc,cap:true,ep:true});
            }
          }
        }
        break;
      }
      case 'n':{
        const d = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
        for(const [dr,dc] of d){
          const rr=r+dr, cc=c+dc;
          if(!inb(rr,cc)) continue;
          const t=B[rr][cc];
          if(t==='.' || sideOf(t)!==side) mv.push({r:rr,c:cc, cap:(t!=='.')});
        }
        break;
      }
      case 'b': slide([[1,1],[1,-1],[-1,1],[-1,-1]]); break;
      case 'r': slide([[1,0],[-1,0],[0,1],[0,-1]]); break;
      case 'q': slide([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]); break;
      case 'k': {
        for(let dr=-1; dr<=1; dr++) for(let dc=-1; dc<=1; dc++){
          if(!dr && !dc) continue;
          const rr=r+dr, cc=c+dc;
          if(!inb(rr,cc)) continue;
          const t=B[rr][cc];
          if(t==='.' || sideOf(t)!==side) mv.push({r:rr,c:cc, cap:(t!=='.')});
        }
        // castling
        if((side==='w' && r===7 && c===4) || (side==='b' && r===0 && c===4)){
          const rights = state.cast;
          if(side==='w'){
            // short castle
            if(rights.K && B[7][5]==='.' && B[7][6]==='.' &&
               !isSquareAttacked(state,7,4,'b') &&
               !isSquareAttacked(state,7,5,'b') &&
               !isSquareAttacked(state,7,6,'b')){
              mv.push({r:7,c:6, castle:'K'});
            }
            // long castle
            if(rights.Q && B[7][1]==='.' && B[7][2]==='.' && B[7][3]==='.' &&
               !isSquareAttacked(state,7,4,'b') &&
               !isSquareAttacked(state,7,3,'b') &&
               !isSquareAttacked(state,7,2,'b')){
              mv.push({r:7,c:2, castle:'Q'});
            }
          }else{
            if(rights.k && B[0][5]==='.' && B[0][6]==='.' &&
               !isSquareAttacked(state,0,4,'w') &&
               !isSquareAttacked(state,0,5,'w') &&
               !isSquareAttacked(state,0,6,'w')){
              mv.push({r:0,c:6, castle:'k'});
            }
            if(rights.q && B[0][1]==='.' && B[0][2]==='.' && B[0][3]==='.' &&
               !isSquareAttacked(state,0,4,'w') &&
               !isSquareAttacked(state,0,3,'w') &&
               !isSquareAttacked(state,0,2,'w')){
              mv.push({r:0,c:2, castle:'q'});
            }
          }
        }
        break;
      }
    }
    // disallow capturing enemy king square in pseudo stage
    const enemyK = side==='w' ? 'k':'K';
    return mv.filter(m => state.board[m.r][m.c] !== enemyK);
  }

  function isSquareAttacked(state, r, c, bySide){
    // bruce-force: generate all pseudo from bySide and see hits
    const B = state.board;
    for(let rr=0; rr<8; rr++) for(let cc=0; cc<8; cc++){
      const p = B[rr][cc];
      if(p==='.') continue;
      if(bySide==='w' && !isW(p)) continue;
      if(bySide==='b' && !isB(p)) continue;
      const lst = genPseudo(state, rr, cc);
      if(lst.some(m => m.r===r && m.c===c)) return true;
    }
    return false;
  }

  // apply / unapply for simulation
  function applyMove(state, move){
    const S = state;
    const B = S.board;
    const {from,to,promo} = move;
    const p = B[from.r][from.c];
    const target = B[to.r][to.c];
    const rec = {
      captured: target,
      moved: p,
      from: {...from}, to: {...to},
      cast: {...S.cast},
      ep: S.ep ? {...S.ep} : null,
      halfmove: S.halfmove,
      fullmove: S.fullmove
    };

    // reset EP by default
    S.ep = null;

    // en passant capture
    let epCaptureSquare = null;
    if(move.ep){
      if(isW(p)) epCaptureSquare = {r:to.r+1, c:to.c};
      else       epCaptureSquare = {r:to.r-1, c:to.c};
      rec.captured = B[epCaptureSquare.r][epCaptureSquare.c];
      B[epCaptureSquare.r][epCaptureSquare.c] = '.';
    }

    // castling rook move
    if(move.cast){
      if(move.cast==='K'){ B[7][5] = 'R'; B[7][7]='.'; }
      if(move.cast==='Q'){ B[7][3] = 'R'; B[7][0]='.'; }
      if(move.cast==='k'){ B[0][5] = 'r'; B[0][7]='.'; }
      if(move.cast==='q'){ B[0][3] = 'r'; B[0][0]='.'; }
    }

    // move piece
    B[to.r][to.c] = promo ? (isW(p)? promo.toUpperCase(): promo.toLowerCase()) : p;
    B[from.r][from.c] = '.';

    // set EP square if double pawn push
    if((p==='P' && from.r===6 && to.r===4 && from.c===to.c) ||
       (p==='p' && from.r===1 && to.r===3 && from.c===to.c)){
      S.ep = { r:(from.r+to.r)/2, c:from.c };
    }

    // update castling rights
    if(p==='K'){ S.cast.K=false; S.cast.Q=false; }
    if(p==='k'){ S.cast.k=false; S.cast.q=false; }
    if(p==='R' && from.r===7 && from.c===7) S.cast.K=false;
    if(p==='R' && from.r===7 && from.c===0) S.cast.Q=false;
    if(p==='r' && from.r===0 && from.c===7) S.cast.k=false;
    if(p==='r' && from.r===0 && from.c===0) S.cast.q=false;
    // captured rook also affects castling rights
    if(rec.captured==='R' && to.r===7 && to.c===7) S.cast.K=false;
    if(rec.captured==='R' && to.r===7 && to.c===0) S.cast.Q=false;
    if(rec.captured==='r' && to.r===0 && to.c===7) S.cast.k=false;
    if(rec.captured==='r' && to.r===0 && to.c===0) S.cast.q=false;

    // halfmove clock
    if(p.toLowerCase()==='p' || rec.captured!=='.') S.halfmove = 0; else S.halfmove++;
    if(S.turn==='b') S.fullmove++;

    // flip turn
    S.turn = (S.turn==='w')?'b':'w';

    // store rec on move
    move._rec = rec;
    return rec;
  }

  function unapplyMove(state, move){
    const S = state;
    const B = S.board;
    const {from,to} = move;
    const rec = move._rec;

    // flip turn back
    S.turn = (S.turn==='w')?'b':'w';

    // undo castling rook
    if(move.cast){
      if(move.cast==='K'){ B[7][7] = 'R'; B[7][5]='.'; }
      if(move.cast==='Q'){ B[7][0] = 'R'; B[7][3]='.'; }
      if(move.cast==='k'){ B[0][7] = 'r'; B[0][5]='.'; }
      if(move.cast==='q'){ B[0][0] = 'r'; B[0][3]='.'; }
    }

    // move piece back
    B[from.r][from.c] = rec.moved;
    B[to.r][to.c] = rec.captured || '.';

    // undo EP capture
    if(move.ep){
      const p = rec.moved;
      if(isW(p)) B[to.r+1][to.c] = 'p';
      else       B[to.r-1][to.c] = 'P';
      B[to.r][to.c] = '.'; // square target becomes empty because EP capture place was adjacent
    }

    // restore meta
    S.cast = rec.cast;
    S.ep = rec.ep;
    S.halfmove = rec.halfmove;
    S.fullmove = rec.fullmove;
  }

  // Filter legal: ensure king not in check after
  function legalFrom(state, r, c){
    const side = sideOf(state.board[r][c]);
    if(side!==state.turn) return [];
    const list = genPseudo(state, r, c).map(m => ({from:{r,c}, to:{r:m.r,c:m.c}, cap:!!m.cap, ep:!!m.ep, castle:m.cast||null}));
    const out = [];
    for(const m of list){
      applyMove(state, m);
      const kp = kingPos(state.board, side);
      const inC = kp ? isSquareAttacked(state, kp.r, kp.c, (side==='w'?'b':'w')) : true;
      unapplyMove(state, m);
      if(!inC) out.push(m);
    }
    return out;
  }

  function allLegal(state, side=state.turn){
    const acc=[];
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const p = state.board[r][c];
      if(p==='.') continue;
      if(side==='w' && !isW(p)) continue;
      if(side==='b' && !isB(p)) continue;
      acc.push(...legalFrom(state, r, c));
    }
    return acc;
  }

  function inCheck(state, side=state.turn){
    const kp = kingPos(state.board, side);
    if(!kp) return false;
    return isSquareAttacked(state, kp.r, kp.c, side==='w'?'b':'w');
  }

  function status(state){
    const moves = allLegal(state, state.turn);
    if(moves.length===0){
      if(inCheck(state, state.turn)) return {end:true, type:'checkmate', winner: (state.turn==='w'?'b':'w')};
      return {end:true, type:'stalemate'};
    }
    return {end:false};
  }

  function materialEval(state){
    const B = state.board;
    let s=0;
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const p=B[r][c]; if(p==='.') continue;
      s += (isW(p)? VAL[p] : -VAL[p]);
    }
    // mobility
    const wm = allLegal(state,'w').length, bm = allLegal(state,'b').length;
    s += 0.02*(wm-bm);
    // check bonus
    if(inCheck(state,'b')) s += 0.3;
    if(inCheck(state,'w')) s -= 0.3;
    return s;
  }

  function minimax(state, depth, alpha, beta, side){
    const legal = allLegal(state, side);
    if(depth===0 || legal.length===0){
      if(legal.length===0){
        if(inCheck(state, side)){
          return {score: (side==='w') ? -999 : 999};
        }
        return {score: 0};
      }
      return {score: materialEval(state)};
    }
    // simple ordering: captures first
    legal.sort((a,b)=>{
      const ta = state.board[a.to.r][a.to.c];
      const tb = state.board[b.to.r][b.to.c];
      const av = (ta==='.')?0:Math.abs(VAL[ta]||0);
      const bv = (tb==='.')?0:Math.abs(VAL[tb]||0);
      return bv-av;
    });

    if(side==='w'){
      let best = {score: -Infinity, move: null};
      for(const mv of legal){
        applyMove(state, mv);
        const res = minimax(state, depth-1, alpha, beta, 'b');
        unapplyMove(state, mv);
        if(res.score > best.score){ best = {score: res.score, move: mv}; }
        alpha = Math.max(alpha, res.score);
        if(beta<=alpha) break;
      }
      return best;
    } else {
      let best = {score: Infinity, move: null};
      for(const mv of legal){
        applyMove(state, mv);
        const res = minimax(state, depth-1, alpha, beta, 'w');
        unapplyMove(state, mv);
        if(res.score < best.score){ best = {score: res.score, move: mv}; }
        beta = Math.min(beta, res.score);
        if(beta<=alpha) break;
      }
      return best;
    }
  }

  // Engine factory
  function createChessEngine(fen=START){
    let S = parseFEN(fen);
    const undoStack = [];
    const redoStack = [];

    function reset(fenStr=START){
      S = parseFEN(fenStr);
      undoStack.length=0; redoStack.length=0;
    }

    function getState(){ return S; }
    function getBoard(){ return S.board; }
    function getTurn(){ return S.turn; }
    function getFEN(){ return toFEN(S); }

    function legalMovesAt(r,c){ return legalFrom(S, r, c); }
    function allMoves(side=S.turn){ return allLegal(S, side); }

    function makeMove(from, to, promo){
      // find among legal to ensure flags (ep/cast)
      const list = legalFrom(S, from.r, from.c);
      const move = list.find(m => m.to.r===to.r && m.to.c===to.c);
      if(!move) return null;

      // promotion default Q (if not supplied)
      if(promo){
        move.promo = promo;
      }else{
        const p = S.board[from.r][from.c];
        if(p==='P' && to.r===0) move.promo = 'Q';
        if(p==='p' && to.r===7) move.promo = 'q';
      }

      // apply and push undo
      applyMove(S, move);
      undoStack.push(move);
      // new move invalidates redo
      redoStack.length=0;
      return move;
    }

    function undo(){
      const mv = undoStack.pop();
      if(!mv) return null;
      unapplyMove(S, mv);
      redoStack.push(mv);
      return mv;
    }
    function redo(){
      const mv = redoStack.pop();
      if(!mv) return null;
      applyMove(S, mv);
      undoStack.push(mv);
      return mv;
    }

    function isCheck(side=S.turn){ return inCheck(S, side); }
    function statusInfo(){ return status(S); }

    function historySAN(){
      // simple pseudo log "e2-e4" (not true SAN)
      const res=[];
      for(const mv of undoStack){
        res.push(`${rcToAlg(mv.from.r,mv.from.c)}-${rcToAlg(mv.to.r,mv.to.c)}`);
      }
      return res;
    }

    // AI: Black by default (minimax depth-2)
    function think(depth=2, side=S.turn){
      return minimax(S, depth, -Infinity, Infinity, side).move || null;
    }

    return {
      reset, getState, getBoard, getTurn, getFEN,
      legalMovesAt, allMoves, makeMove, undo, redo,
      isCheck, statusInfo, historySAN,
      think, ICON
    };
  }

  global.createChessEngine = createChessEngine;

})(window);
