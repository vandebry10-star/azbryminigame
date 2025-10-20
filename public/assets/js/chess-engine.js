/* Azbry Chess — Engine (FIDE rules, fixed attack detection)
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
    return {
      board,
      turn: (turn==='b'?'b':'w'),
      cast: { K:cast.includes('K'), Q:cast.includes('Q'), k:cast.includes('k'), q:cast.includes('q') },
      ep: ep==='-'? null : algToRC(ep),
      halfmove: parseInt(half||'0',10),
      fullmove: parseInt(full||'1',10),
    };
  }
  function toFEN(S){
    const rows=[];
    for(let r=0;r<8;r++){
      let run=0, out='';
      for(let c=0;c<8;c++){
        const p=S.board[r][c];
        if(p==='.') run++; else { if(run){out+=run; run=0} out+=p; }
      }
      if(run) out+=run;
      rows.push(out);
    }
    const castStr = (S.cast.K?'K':'')+(S.cast.Q?'Q':'')+(S.cast.k?'k':'')+(S.cast.q?'q':'') || '-';
    const epStr = S.ep ? rcToAlg(S.ep.r, S.ep.c) : '-';
    return `${rows.join('/')} ${S.turn} ${castStr} ${epStr} ${S.halfmove|0} ${S.fullmove|0}`;
  }
  function rcToAlg(r,c){ return 'abcdefgh'[c] + (8-r); }
  function algToRC(s){ return {r: 8-parseInt(s[1],10), c: s.charCodeAt(0)-97}; }

  function kingPos(board, side){
    const k = side==='w' ? 'K' : 'k';
    for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c]===k) return {r,c};
    return null;
  }

  // === PSEUDO LEGAL (tanpa filter self-check). Penting: JANGAN saring "capture king".
  function genPseudo(S, r, c){
    const B=S.board, p=B[r][c]; if(p==='.') return [];
    const side=sideOf(p); const mv=[];
    const slide=(dirs)=>{ for(const[dr,dc] of dirs){ let rr=r+dr, cc=c+dc;
      while(inb(rr,cc)){ const t=B[rr][cc]; if(t==='.') mv.push({r:rr,c:cc,cap:false});
        else { if(sideOf(t)!==side) mv.push({r:rr,c:cc,cap:true}); break; }
        rr+=dr; cc+=dc; } } };
    switch(p.toLowerCase()){
      case 'p': {
        const dir=isW(p)?-1:1, start=isW(p)?6:1;
        if(inb(r+dir,c)&&B[r+dir][c]==='.') mv.push({r:r+dir,c,cap:false});
        if(r===start&&B[r+dir][c]==='.'&&B[r+2*dir][c]==='.') mv.push({r:r+2*dir,c,cap:false,double:true});
        for(const dc of[-1,1]){ const rr=r+dir, cc=c+dc;
          if(inb(rr,cc)){
            if(B[rr][cc]!=='.' && sideOf(B[rr][cc])!==side) mv.push({r:rr,c:cc,cap:true});
            if(S.ep && S.ep.r===rr && S.ep.c===cc) mv.push({r:rr,c:cc,cap:true,ep:true});
          }
        }
        break;
      }
      case 'n': { const d=[[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
        for(const[dr,dc] of d){ const rr=r+dr, cc=c+dc;
          if(!inb(rr,cc)) continue; const t=B[rr][cc];
          if(t==='.' || sideOf(t)!==side) mv.push({r:rr,c:cc,cap:(t!=='.')}); }
        break; }
      case 'b': slide([[1,1],[1,-1],[-1,1],[-1,-1]]); break;
      case 'r': slide([[1,0],[-1,0],[0,1],[0,-1]]); break;
      case 'q': slide([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]); break;
      case 'k': {
        for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
          if(!dr&&!dc) continue; const rr=r+dr, cc=c+dc;
          if(!inb(rr,cc)) continue; const t=B[rr][cc];
          if(t==='.' || sideOf(t)!==side) mv.push({r:rr,c:cc,cap:(t!=='.')});
        }
        // castling
        if((side==='w' && r===7 && c===4) || (side==='b' && r===0 && c===4)){
          const R=S.cast;
          if(side==='w'){
            if(R.K && B[7][5]==='.' && B[7][6]==='.' &&
               !isSquareAttacked(S,7,4,'b') && !isSquareAttacked(S,7,5,'b') && !isSquareAttacked(S,7,6,'b')){
              mv.push({r:7,c:6,castle:'K'});
            }
            if(R.Q && B[7][1]==='.' && B[7][2]==='.' && B[7][3]==='.' &&
               !isSquareAttacked(S,7,4,'b') && !isSquareAttacked(S,7,3,'b') && !isSquareAttacked(S,7,2,'b')){
              mv.push({r:7,c:2,castle:'Q'});
            }
          }else{
            if(R.k && B[0][5]==='.' && B[0][6]==='.' &&
               !isSquareAttacked(S,0,4,'w') && !isSquareAttacked(S,0,5,'w') && !isSquareAttacked(S,0,6,'w')){
              mv.push({r:0,c:6,castle:'k'});
            }
            if(R.q && B[0][1]==='.' && B[0][2]==='.' && B[0][3]==='.' &&
               !isSquareAttacked(S,0,4,'w') && !isSquareAttacked(S,0,3,'w') && !isSquareAttacked(S,0,2,'w')){
              mv.push({r:0,c:2,castle:'q'});
            }
          }
        }
        break;
      }
    }
    return mv; // << TIDAK menyaring capture-king di sini!
  }

  // === Attack detector (benar2 lihat semua pseudo lawan)
  function isSquareAttacked(S, r, c, bySide){
    const B=S.board;
    for(let rr=0; rr<8; rr++) for(let cc=0; cc<8; cc++){
      const p=B[rr][cc]; if(p==='.') continue;
      if(bySide==='w' && !isW(p)) continue;
      if(bySide==='b' && !isB(p)) continue;
      const lst = genPseudo(S, rr, cc); // includes king-captures
      if(lst.some(m => m.r===r && m.c===c)) return true;
    }
    return false;
  }

  // === Apply / Unapply ===
  function applyMove(S, move){
    const B=S.board, {from,to,promo}=move;
    const p=B[from.r][from.c], target=B[to.r][to.c];
    const rec={ captured:target, moved:p, from:{...from}, to:{...to},
      cast:{...S.cast}, ep:S.ep?{...S.ep}:null, halfmove:S.halfmove, fullmove:S.fullmove };

    S.ep=null; // reset EP

    // en passant capture
    if(move.ep){
      const sq = isW(p) ? {r:to.r+1,c:to.c} : {r:to.r-1,c:to.c};
      rec.captured = B[sq.r][sq.c];
      B[sq.r][sq.c]='.';
    }

    // castling rook
    if(move.cast){
      if(move.cast==='K'){ B[7][5]='R'; B[7][7]='.'; }
      if(move.cast==='Q'){ B[7][3]='R'; B[7][0]='.'; }
      if(move.cast==='k'){ B[0][5]='r'; B[0][7]='.'; }
      if(move.cast==='q'){ B[0][3]='r'; B[0][0]='.'; }
    }

    // move piece + promotion
    B[to.r][to.c] = promo ? (isW(p)? promo.toUpperCase(): promo.toLowerCase()) : p;
    B[from.r][from.c]='.';

    // set EP (double pawn)
    if((p==='P' && from.r===6 && to.r===4 && from.c===to.c) ||
       (p==='p' && from.r===1 && to.r===3 && from.c===to.c)){
      S.ep = {r:(from.r+to.r)/2, c:from.c};
    }

    // castling rights
    if(p==='K'){ S.cast.K=false; S.cast.Q=false; }
    if(p==='k'){ S.cast.k=false; S.cast.q=false; }
    if(p==='R' && from.r===7 && from.c===7) S.cast.K=false;
    if(p==='R' && from.r===7 && from.c===0) S.cast.Q=false;
    if(p==='r' && from.r===0 && from.c===7) S.cast.k=false;
    if(p==='r' && from.r===0 && from.c===0) S.cast.q=false;
    if(rec.captured==='R' && to.r===7 && to.c===7) S.cast.K=false;
    if(rec.captured==='R' && to.r===7 && to.c===0) S.cast.Q=false;
    if(rec.captured==='r' && to.r===0 && to.c===7) S.cast.k=false;
    if(rec.captured==='r' && to.r===0 && to.c===0) S.cast.q=false;

    // clocks
    if(p.toLowerCase()==='p' || rec.captured!=='.') S.halfmove=0; else S.halfmove++;
    if(S.turn==='b') S.fullmove++;

    S.turn = (S.turn==='w')?'b':'w';
    move._rec = rec;
    return rec;
  }
  function unapplyMove(S, move){
    const B=S.board, rec=move._rec, {from,to}=move;
    S.turn = (S.turn==='w')?'b':'w';

    if(move.cast){
      if(move.cast==='K'){ B[7][7]='R'; B[7][5]='.'; }
      if(move.cast==='Q'){ B[7][0]='R'; B[7][3]='.'; }
      if(move.cast==='k'){ B[0][7]='r'; B[0][5]='.'; }
      if(move.cast==='q'){ B[0][0]='r'; B[0][3]='.'; }
    }

    B[from.r][from.c] = rec.moved;
    B[to.r][to.c]     = rec.captured || '.';

    if(move.ep){
      const p=rec.moved;
      if(isW(p)) { B[to.r+1][to.c]='p'; B[to.r][to.c]='.'; }
      else       { B[to.r-1][to.c]='P'; B[to.r][to.c]='.'; }
    }

    S.cast=rec.cast; S.ep=rec.ep; S.halfmove=rec.halfmove; S.fullmove=rec.fullmove;
  }

  // === Legal (filter self-check + BAN capture-king di sini) ===
  function legalFrom(S, r, c){
    const p=S.board[r][c]; if(p==='.') return [];
    const side=sideOf(p); if(side!==S.turn) return [];
    const enemyK = side==='w' ? 'k' : 'K';

    const list = genPseudo(S, r, c)
      .filter(m => S.board[m.r][m.c] !== enemyK) // ← BAN capture-king
      .map(m => ({from:{r,c}, to:{r:m.r,c:m.c}, cap:!!m.cap, ep:!!m.ep, castle:m.cast||null, promo:m.promo||null}));

    const out=[];
    for(const m of list){
      applyMove(S,m);
      const kp=kingPos(S.board, side);
      const inC = kp? isSquareAttacked(S, kp.r, kp.c, (side==='w'?'b':'w')) : true;
      unapplyMove(S,m);
      if(!inC) out.push(m);
    }
    return out;
  }
  function allLegal(S, side=S.turn){
    const acc=[];
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const p=S.board[r][c]; if(p==='.') continue;
      if(side==='w' && !isW(p)) continue;
      if(side==='b' && !isB(p)) continue;
      acc.push(...legalFrom(S,r,c));
    }
    return acc;
  }
  function inCheck(S, side=S.turn){
    const kp=kingPos(S.board, side); if(!kp) return false;
    return isSquareAttacked(S, kp.r, kp.c, side==='w'?'b':'w');
  }
  function status(S){
    const moves=allLegal(S,S.turn);
    if(moves.length===0){
      if(inCheck(S,S.turn)) return {end:true, type:'checkmate', winner:(S.turn==='w'?'b':'w')};
      return {end:true, type:'stalemate'};
    }
    return {end:false};
  }

  // eval & AI
  const VALM = VAL;
  function materialEval(S){
    let s=0;
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const p=S.board[r][c]; if(p==='.') continue;
      s += (isW(p)? VALM[p] : -VALM[p]);
    }
    const wm=allLegal(S,'w').length, bm=allLegal(S,'b').length;
    s += 0.02*(wm-bm);
    if(inCheck(S,'b')) s += 0.3; if(inCheck(S,'w')) s -= 0.3;
    return s;
  }
  function minimax(S, depth, alpha, beta, side){
    const legal=allLegal(S,side);
    if(depth===0 || legal.length===0){
      if(legal.length===0){
        if(inCheck(S,side)) return {score: (side==='w')?-999:999};
        return {score:0};
      }
      return {score:materialEval(S)};
    }
    // captures first
    legal.sort((a,b)=>{
      const ta=S.board[a.to.r][a.to.c], tb=S.board[b.to.r][b.to.c];
      const av=(ta==='.')?0:Math.abs(VALM[ta]||0), bv=(tb==='.')?0:Math.abs(VALM[tb]||0);
      return bv-av;
    });
    if(side==='w'){
      let best={score:-Infinity, move:null};
      for(const mv of legal){
        applyMove(S,mv);
        const res=minimax(S,depth-1,alpha,beta,'b');
        unapplyMove(S,mv);
        if(res.score>best.score) best={score:res.score, move:mv};
        alpha=Math.max(alpha,res.score); if(beta<=alpha) break;
      }
      return best;
    }else{
      let best={score:Infinity, move:null};
      for(const mv of legal){
        applyMove(S,mv);
        const res=minimax(S,depth-1,alpha,beta,'w');
        unapplyMove(S,mv);
        if(res.score<best.score) best={score:res.score, move:mv};
        beta=Math.min(beta,res.score); if(beta<=alpha) break;
      }
      return best;
    }
  }

  function createChessEngine(fen=START){
    let S=parseFEN(fen);
    const undoStack=[], redoStack=[];

    function reset(f=START){ S=parseFEN(f); undoStack.length=0; redoStack.length=0; }
    function getState(){ return S; }
    function getBoard(){ return S.board; }
    function getTurn(){ return S.turn; }
    function getFEN(){ return toFEN(S); }

    function legalMovesAt(r,c){ return legalFrom(S,r,c); }
    function allMoves(side=S.turn){ return allLegal(S,side); }

    function makeMove(from,to,promo){
      const list=legalFrom(S,from.r,from.c);
      const m=list.find(x=>x.to.r===to.r && x.to.c===to.c);
      if(!m) return null;
      if(promo) m.promo=promo;
      else{
        const p=S.board[from.r][from.c];
        if(p==='P' && to.r===0) m.promo='Q';
        if(p==='p' && to.r===7) m.promo='q';
      }
      applyMove(S,m); undoStack.push(m); redoStack.length=0; return m;
    }
    function undo(){ const m=undoStack.pop(); if(!m) return null; unapplyMove(S,m); redoStack.push(m); return m; }
    function redo(){ const m=redoStack.pop(); if(!m) return null; applyMove(S,m); undoStack.push(m); return m; }

    function isCheck(side=S.turn){ return inCheck(S,side); }
    function statusInfo(){ return status(S); }
    function historySAN(){ return undoStack.map(m=>`${rcToAlg(m.from.r,m.from.c)}-${rcToAlg(m.to.r,m.to.c)}`); }

    function think(depth=2, side=S.turn){ return minimax(S,depth,-Infinity,Infinity,side).move||null; }

    return { reset,getState,getBoard,getTurn,getFEN, legalMovesAt,allMoves, makeMove,undo,redo, isCheck,statusInfo,historySAN, think, ICON };
  }

  global.createChessEngine=createChessEngine;
})(window);
