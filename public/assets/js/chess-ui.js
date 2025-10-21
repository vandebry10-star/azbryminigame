/* =====================================================
   Azbry Chess Engine (Singleton)
   - Legal move + check / checkmate / stalemate
   - Undo / Redo
   - Pawn promotion → Queen (otomatis)
   - AI (hitam) random legal (ringan untuk HP)
   - API kompatibel dgn chess-ui.js (FIX):
     reset, getState, getBoard, movesFrom, move, undo, redo,
     isCheck, isCheckmate, isStalemate, setMode, getMode, aiMoveIfNeeded
   ===================================================== */
(function () {
  const W = 'w', B = 'b';
  const EMPTY = '';

  // ---- state internal
  const S = {
    board: [],           // 8x8, y=0 top (a8) … y=7 bottom (a1)
    turn: W,             // 'w' | 'b'
    history: [],         // stack snapshot {board, turn, last}
    future: [],          // redo stack
    moveLog: [],         // {from, to} index 0..63
    mode: 'human',       // 'human' | 'ai' (AI = hitam)
  };

  // ---- util
  const cloneBoard = (b) => b.map(r => r.slice());
  const inBounds = (x,y) => x>=0 && x<8 && y>=0 && y<8;
  const isWhiteStr = (s) => !!s && s[0]==='w';
  const isBlackStr = (s) => !!s && s[0]==='b';
  const opp = (c) => c===W?B:W;

  // letter map: internal keep 'wP','bq' etc (lowercase type)
  const toStr = (color, type) => color + type;        // 'w','p' -> 'wp'
  const typeOf = (cell) => cell ? cell.slice(1,2) : null;     // 'wp' -> 'p'
  const colorOf = (cell) => cell ? cell.slice(0,1) : null;    // 'wp' -> 'w'

  // xy <-> index
  const idx = (x,y)=> y*8 + x;
  const xyFromIdx = (i)=> ({x: i%8, y: Math.floor(i/8)});

  // ---- setup awal (black di atas, white di bawah)
  function startPosition() {
    const r0 = ['r','n','b','q','k','b','n','r'].map(t=>toStr(B,t));
    const r1 = Array(8).fill(toStr(B,'p'));
    const r6 = Array(8).fill(toStr(W,'p'));
    const r7 = ['r','n','b','q','k','b','n','r'].map(t=>toStr(W,t));
    return [
      r0.slice(), r1.slice(),
      Array(8).fill(EMPTY), Array(8).fill(EMPTY),
      Array(8).fill(EMPTY), Array(8).fill(EMPTY),
      r6.slice(), r7.slice()
    ];
  }

  // ---- akses papan
  function get(x,y){ return S.board[y][x]; }
  function setc(x,y,v){ S.board[y][x]=v; }

  // ---- API: reset
  function reset(){
    S.board = startPosition();
    S.turn = W;
    S.history = [];
    S.future  = [];
    S.moveLog = [];
  }

  // ---- API: getBoard (flat 64)
  function getBoard(){
    const out = new Array(64);
    for(let y=0;y<8;y++){
      for(let x=0;x<8;x++){
        out[idx(x,y)] = get(x,y) || EMPTY;
      }
    }
    return out;
  }

  // ---- API: getState
  function getState(){
    return {
      board: getBoard(),        // flat 64 'wP','bq',''
      turn: S.turn,             // 'w' | 'b'
      history: S.moveLog.slice()
    };
  }

  // ---- generator pseudo moves untuk piece di (x,y)
  function genPseudoFor(x,y){
    const cell = get(x,y);
    if(!cell) return [];
    const color = colorOf(cell);
    const t = typeOf(cell); // 'p','n','b','r','q','k'
    const res = [];
    const push = (nx,ny)=>{
      if(!inBounds(nx,ny)) return false;
      const tcell = get(nx,ny);
      if(!tcell){ res.push({fromX:x,fromY:y,toX:nx,toY:ny}); return true; }
      if(colorOf(tcell)!==color){ res.push({fromX:x,fromY:y,toX:nx,toY:ny}); }
      return false;
    };

    if(t==='p'){
      const dir = (color===W)? -1 : 1;         // white ke atas (y-1), black ke bawah (y+1)
      const startRank = (color===W)? 6 : 1;
      // maju 1
      const y1 = y+dir;
      if(inBounds(x,y1) && !get(x,y1)){
        res.push({fromX:x,fromY:y,toX:x,toY:y1});
        // maju 2
        const y2 = y+2*dir;
        if(y===startRank && !get(x,y2)) res.push({fromX:x,fromY:y,toX:x,toY:y2});
      }
      // capture diag
      for(const dx of [-1,1]){
        const nx=x+dx, ny=y+dir;
        if(!inBounds(nx,ny)) continue;
        const tcell=get(nx,ny);
        if(tcell && colorOf(tcell)!==color){
          res.push({fromX:x,fromY:y,toX:nx,toY:ny});
        }
      }
      return res;
    }

    if(t==='n'){
      [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].forEach(([dx,dy])=>{
        if(inBounds(x+dx,y+dy)){
          const tcell = get(x+dx,y+dy);
          if(!tcell || colorOf(tcell)!==color){
            res.push({fromX:x,fromY:y,toX:x+dx,toY:y+dy});
          }
        }
      });
      return res;
    }

    const slide = (dx,dy)=>{
      let nx=x+dx, ny=y+dy;
      while(inBounds(nx,ny)){
        const more = push(nx,ny);
        if(!more) break;
        nx+=dx; ny+=dy;
      }
    };

    if(t==='b' || t==='q'){
      slide(1,1); slide(1,-1); slide(-1,1); slide(-1,-1);
      if(t==='b') return res;
    }
    if(t==='r' || t==='q'){
      slide(1,0); slide(-1,0); slide(0,1); slide(0,-1);
      return res;
    }
    if(t==='k'){
      for(let dx=-1;dx<=1;dx++){
        for(let dy=-1;dy<=1;dy++){
          if(!dx && !dy) continue;
          const nx=x+dx, ny=y+dy;
          if(!inBounds(nx,ny)) continue;
          const tcell=get(nx,ny);
          if(!tcell || colorOf(tcell)!==color){
            res.push({fromX:x,fromY:y,toX:nx,toY:ny});
          }
        }
      }
      // castling: belum diaktifkan (versi stabil)
      return res;
    }

    return res;
  }

  // ---- posisi raja
  function kingPos(color){
    for(let y=0;y<8;y++){
      for(let x=0;x<8;x++){
        const c=get(x,y);
        if(c && typeOf(c)==='k' && colorOf(c)===color) return {x,y};
      }
    }
    return null;
  }

  // ---- serangan petak oleh warna attacker
  function squareAttacked(x,y, attacker){
    for(let j=0;j<8;j++){
      for(let i=0;i<8;i++){
        const c = get(i,j);
        if(!c || colorOf(c)!==attacker) continue;
        const t = typeOf(c);

        // pion: serang diagonal 1 langkah
        if(t==='p'){
          const dir = (attacker===W)? -1 : 1;
          if(i-1===x && j+dir===y) return true;
          if(i+1===x && j+dir===y) return true;
          continue;
        }

        // kuda
        if(t==='n'){
          const d = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
          for(const [dx,dy] of d){ if(i+dx===x && j+dy===y) return true; }
          continue;
        }

        // raja
        if(t==='k'){
          for(let dx=-1;dx<=1;dx++){
            for(let dy=-1;dy<=1;dy++){
              if(!dx && !dy) continue;
              if(i+dx===x && j+dy===y) return true;
            }
          }
          continue;
        }

        // gajah/menteri: diagonal slide
        if(t==='b' || t==='q'){
          if(Math.abs(i-x)===Math.abs(j-y)){
            const sdx = x>i?1:-1;
            const sdy = y>j?1:-1;
            let nx=i+sdx, ny=j+sdy, ok=true;
            while(nx!==x || ny!==y){
              if(get(nx,ny)){ ok=false; break; }
              nx+=sdx; ny+=sdy;
            }
            if(ok) return true;
          }
          if(t!=='q') continue; // kalau bishop saja, lanjut
        }

        // benteng/menteri: ortho slide
        if(t==='r' || t==='q'){
          if(i===x || j===y){
            const sdx = (x===i)?0:(x>i?1:-1);
            const sdy = (y===j)?0:(y>j?1:-1);
            let nx=i+sdx, ny=j+sdy, ok=true;
            while(nx!==x || ny!==y){
              if(get(nx,ny)){ ok=false; break; }
              nx+=sdx; ny+=sdy;
            }
            if(ok) return true;
          }
        }
      }
    }
    return false;
  }

  function inCheck(color){
    const k = kingPos(color);
    if(!k) return true; // raja hilang (aneh), anggap check
    return squareAttacked(k.x, k.y, opp(color));
  }

  // ---- filter legal (raja sendiri tidak boleh terserang setelah langkah)
  function legalMovesFor(x,y){
    const cell = get(x,y);
    if(!cell) return [];
    if(colorOf(cell)!==S.turn) return [];
    const pseudo = genPseudoFor(x,y);
    const legal = [];
    for(const m of pseudo){
      const snap = cloneBoard(S.board);
      const piece = get(x,y);
      const target = get(m.toX,m.toY);

      // lakukan
      setc(m.toX,m.toY,piece);
      setc(x,y,EMPTY);

      // promosi simulasi
      let doProm = false;
      if(typeOf(piece)==='p'){
        if(colorOf(piece)===W && m.toY===0) doProm = true;
        if(colorOf(piece)===B && m.toY===7) doProm = true;
        if(doProm) setc(m.toX,m.toY, toStr(colorOf(piece),'q'));
      }

      if(!inCheck(S.turn)) legal.push(m);

      // revert
      S.board = snap;
    }
    return legal;
  }

  // ---- API: movesFrom(index) → array of target index
  function movesFrom(fromIdx){
    const {x,y} = xyFromIdx(fromIdx);
    const ms = legalMovesFor(x,y);
    return ms.map(m => idx(m.toX,m.toY));
  }

  // ---- API: move (index arg atau object {from,to})
  function move(a,b){
    let fromIdx, toIdx;
    if(typeof a === 'object' && a && typeof a.from === 'number' && typeof a.to === 'number'){
      fromIdx = a.from; toIdx = a.to;
    } else {
      fromIdx = a; toIdx = b;
    }
    const from = xyFromIdx(fromIdx);
    const to   = xyFromIdx(toIdx);

    // legal?
    const legalTargets = new Set(movesFrom(fromIdx));
    if(!legalTargets.has(toIdx)) return false;

    // snapshot
    S.history.push({ board: cloneBoard(S.board), turn: S.turn });
    S.future.length = 0;

    const piece = get(from.x, from.y);
    setc(to.x, to.y, piece);
    setc(from.x, from.y, EMPTY);

    // promosi → Queen
    if(typeOf(piece)==='p'){
      if(colorOf(piece)===W && to.y===0) setc(to.x,to.y,toStr(W,'q'));
      if(colorOf(piece)===B && to.y===7) setc(to.x,to.y,toStr(B,'q'));
    }

    // log sederhana
    S.moveLog.push({ from: fromIdx, to: toIdx });

    // ganti giliran
    S.turn = opp(S.turn);
    return true;
  }

  // ---- API: undo / redo
  function undo(){
    if(!S.history.length) return false;
    const prev = S.history.pop();
    S.future.push({ board: cloneBoard(S.board), turn: S.turn });
    S.board = cloneBoard(prev.board);
    S.turn = prev.turn;
    S.moveLog.pop();
    return true;
  }
  function redo(){
    if(!S.future.length) return false;
    const nxt = S.future.pop();
    S.history.push({ board: cloneBoard(S.board), turn: S.turn });
    S.board = cloneBoard(nxt.board);
    S.turn = nxt.turn;
    // moveLog tidak kita rebuild (cukup untuk UI sekarang)
    return true;
  }

  // ---- API: status
  function isCheck(){ return inCheck(S.turn); }
  function isCheckmate(){
    if(!inCheck(S.turn)) return false;
    // ada legal move?
    for(let y=0;y<8;y++){
      for(let x=0;x<8;x++){
        if(get(x,y) && colorOf(get(x,y))===S.turn){
          if(legalMovesFor(x,y).length) return false;
        }
      }
    }
    return true;
  }
  function isStalemate(){
    if(inCheck(S.turn)) return false;
    for(let y=0;y<8;y++){
      for(let x=0;x<8;x++){
        if(get(x,y) && colorOf(get(x,y))===S.turn){
          if(legalMovesFor(x,y).length) return false;
        }
      }
    }
    return true;
  }

  // ---- AI: simple random legal (hitam)
  function aiMoveIfNeeded(){
    if(S.mode!=='ai') return false;
    if(S.turn!==B) return false;
    // kumpulkan semua legal hitam
    const moves = [];
    for(let y=0;y<8;y++){
      for(let x=0;x<8;x++){
        const c=get(x,y);
        if(!c || colorOf(c)!==B) continue;
        const ls = legalMovesFor(x,y);
        for(const m of ls) moves.push(m);
      }
    }
    if(!moves.length) return false;
    const mv = moves[Math.floor(Math.random()*moves.length)];
    return move(idx(mv.fromX,mv.fromY), idx(mv.toX,mv.toY));
  }

  // ---- mode
  function setMode(m){ S.mode = (m==='ai' ? 'ai' : 'human'); }
  function getMode(){ return S.mode; }

  // expose
  window.ChessEngine = {
    // core
    reset, getState, getBoard,
    movesFrom, move, undo, redo,
    isCheck, isCheckmate, isStalemate,
    // mode & AI
    setMode, getMode, aiMoveIfNeeded,
  };

  // init default
  reset();
})();
