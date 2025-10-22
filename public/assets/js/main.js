/* =========================================================
   Azbry Chess — main.js (Full Fix Stable)
   ========================================================= */
(function () {
  // ---------- DOM ----------
  const $board    = document.getElementById('board');
  const $hist     = document.getElementById('moveHistory');
  const $btnUndo  = document.getElementById('btnUndo');
  const $btnRedo  = document.getElementById('btnRedo');
  const $btnReset = document.getElementById('btnReset');
  const $btnFlip  = document.getElementById('btnFlip');
  const $modeHuman= document.getElementById('modeHuman');
  const $modeAI   = document.getElementById('modeAI');
  const $capBlack = document.getElementById('capBlack'); // tray atas (bidak hitam mati)
  const $capWhite = document.getElementById('capWhite'); // tray bawah (bidak putih mati)
  if (!$board) return;

  // ---------- Engine & UI ----------
  const G  = new Chess();                // from chess-engine.js
  const UI = new ChessUI($board, onSquareClick);

  // ---------- State ----------
  let mode = 'human';                    // 'human' | 'ai'
  let selected = null;                   // algebraic: 'e2'
  let legalForSelected = [];             // legal moves for selected square
  let lastMove = null;                   // {from,to}
  let animLock = false;
  let aiThinking = false;

  // ---------- Helpers ----------
  const FILES = "abcdefgh";
  function idx(a){ return (8 - parseInt(a.charAt(1),10)) * 8 + FILES.indexOf(a.charAt(0)); }
  function alg(i){ return FILES.charAt(i%8) + (8 - ((i/8)|0)); }
  function pieceAtAlg(a){ return G.get(idx(a)); }
  function glyph(p){
    const W={P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'};
    const B={P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'};
    return p.color==='w'? W[p.piece] : B[p.piece];
  }

  // ---------- Coordinates (ikut flip) ----------
  function stampCoordinates(){
    for (let i=0;i<64;i++){
      const cell = UI.cells[i];
      const file = i%8, rank=(i/8)|0; // 0..7 (atas ke bawah)
      const visFile = UI.flip ? (7-file) : file;
      const visRank = UI.flip ? rank : (7-rank);
      cell.dataset.file = FILES.charAt(visFile);
      cell.dataset.rank = (visRank+1)+'';
    }
  }

  // ---------- Render ----------
  function render(opt){
    const legalSquares = (opt && opt.legalSquares) || [];
    UI.render(G.board(), {legal: legalSquares, lastMove});
    highlightCheck();
    stampCoordinates();
    renderHistory();
    rebuildCaptures();
  }

  function highlightCheck(){
    UI.cells.forEach(c=>c.classList.remove('check'));
    if (G.inCheck('w')) { const k = kingIndex('w'); if (k>=0) markCheck(k); }
    if (G.inCheck('b')) { const k = kingIndex('b'); if (k>=0) markCheck(k); }
  }
  function kingIndex(color){
    for (let i=0;i<64;i++){ const p=G.get(i); if (p && p.color===color && p.piece==='K') return i; }
    return -1;
  }
  function markCheck(iBoard){
    for (let v=0; v<64; v++){
      const mapped = UI.flip ? (63 - v) : v;
      if (mapped===iBoard){ UI.cells[v].classList.add('check'); break; }
    }
  }

  function renderHistory(){
    const H = G.history(); // ["e2 → e4", ...]
    if (!H.length){ $hist.textContent = '_'; return; }
    let out = '';
    for (let i=0;i<H.length;i+=2){
      const t = Math.floor(i/2)+1;
      out += `${t}.  ${H[i]||''}\n    ${H[i+1]||''}\n`;
    }
    $hist.textContent = out.trim();
  }

  // ---------- Captured (anti-duplikat: rebuild dari history) ----------
  function rebuildCaptures(){
    const deadB = []; // bidak hitam dimakan
    const deadW = []; // bidak putih dimakan
    for (const h of G.hist){
      const cap = h.snap && h.snap.cap;
      if (!cap) continue;
      if (cap.color==='w') deadW.push(cap); else deadB.push(cap);
    }
    if ($capBlack){
      $capBlack.innerHTML='';
      for (const p of deadB){
        const s=document.createElement('span');
        s.className='cap-piece black';
        s.textContent=glyph(p);
        $capBlack.appendChild(s);
      }
    }
    if ($capWhite){
      $capWhite.innerHTML='';
      for (const p of deadW){
        const s=document.createElement('span');
        s.className='cap-piece white';
        s.textContent=glyph(p);
        $capWhite.appendChild(s);
      }
    }
  }

  // ---------- Input ----------
  function onSquareClick(a){ // algebraic 'e2'
    if (animLock || aiThinking) return;

    // player = putih saat mode AI
    if (mode==='ai' && G.turn()==='b') return;

    const side = G.turn();
    const p = pieceAtAlg(a);

    if (!selected){
      if (!p || p.color!==side) return;
      selected = a;
      legalForSelected = G.moves({square:a});
      render({legalSquares: legalForSelected.map(m=>m.to)});
      markSrc(a);
      return;
    }

    // ganti seleksi ke bidak sendiri lain
    if (p && p.color===side && a!==selected){
      selected = a;
      legalForSelected = G.moves({square:a});
      render({legalSquares: legalForSelected.map(m=>m.to)});
      markSrc(a);
      return;
    }

    // eksekusi jika a tujuan legal
    const mv = legalForSelected.find(m=>m.to===a);
    if (!mv){ // batal seleksi
      clearSelection();
      render();
      return;
    }

    playMove(mv);
  }

  function markSrc(a){
    UI.cells.forEach(c=>c.classList.remove('src'));
    const i = idx(a);
    for (let v=0;v<64;v++){
      const mapped = UI.flip ? (63 - v) : v;
      if (mapped===i){ UI.cells[v].classList.add('src'); break; }
    }
  }
  function clearSelection(){
    selected=null; legalForSelected=[];
    UI.cells.forEach(c=>c.classList.remove('src'));
  }

  // ---------- Animasi + Move ----------
  function playMove(m){
    const from = typeof m.from==='string'? m.from : alg(m.from);
    const to   = typeof m.to  ==='string'? m.to   : alg(m.to);

    animateMove(from,to, ()=>{
      const did = G.move({from,to,promotion:m.promotion||null});
      if (!did){ render(); return; }
      lastMove = {from,to};
      clearSelection();
      render();

      const status = G.gameStatus();
      if (status==='checkmate' || status==='stalemate'){ showResult(status); return; }

      if (mode==='ai' && G.turn()==='b'){
        setTimeout(aiPlay, 20);
      }
    });
  }

  function cellByAlg(a){
    const i = idx(a);
    for (let v=0; v<64; v++){
      const mapped = UI.flip ? (63 - v) : v;
      if (mapped===i) return UI.cells[v];
    }
    return null;
  }

  function animateMove(fromAlg,toAlg,done){
    try{
      const fromCell = cellByAlg(fromAlg);
      const toCell   = cellByAlg(toAlg);
      if (!fromCell || !toCell){ done(); return; }
      const piece = pieceAtAlg(fromAlg);
      if (!piece){ done(); return; }

      const ghost = document.createElement('span');
      ghost.className = 'anim-piece ' + (piece.color==='w'?'white':'black');
      ghost.textContent = glyph(piece);

      const br = $board.getBoundingClientRect();
      const fr = fromCell.getBoundingClientRect();
      const tr = toCell.getBoundingClientRect();

      const sx = fr.left - br.left + fr.width/2;
      const sy = fr.top  - br.top  + fr.height/2;
      const ex = tr.left - br.left + tr.width/2;
      const ey = tr.top  - br.top  + tr.height/2;

      ghost.style.transform = `translate(${sx}px, ${sy}px)`;
      $board.appendChild(ghost);
      animLock = true;

      // fallback jika transitionend gak kebaca
      let cleared = false;
      const clear = () => {
        if (cleared) return;
        cleared = true;
        try { ghost.remove(); } catch(_) {}
        animLock = false;
        done();
      };

      requestAnimationFrame(()=>{
        ghost.style.transform = `translate(${ex}px, ${ey}px)`;
        const tId = setTimeout(clear, 450); // fallback 450ms
        ghost.addEventListener('transitionend', ()=>{
          clearTimeout(tId);
          clear();
        }, {once:true});
      });
    }catch(e){
      animLock=false; done();
    }
  }

  // ---------- Result ----------
  function showResult(status){
    const winner = (status==='checkmate')
      ? (G.turn()==='w' ? 'Hitam' : 'Putih') // side to move tidak punya langkah
      : null;
    const text = status==='checkmate' ? `${winner} Menang!` : 'Stalemate';
    const sub  = status==='checkmate'
      ? `Skakmat setelah ${G.history().length} langkah.`
      : `Tidak ada langkah legal tersisa.`;
    window.__azbrySetResult && window.__azbrySetResult({text, subText:sub});
  }

  // ---------- Controls ----------
  $btnUndo && $btnUndo.addEventListener('click', ()=>{
    if (animLock || aiThinking) return;
    if (mode==='ai'){
      const a=G.undo(); const b=G.undo(); if(!a && !b) return;
    }else{ if(!G.undo()) return; }
    lastMove=null; clearSelection(); render();
  });

  $btnRedo && $btnRedo.addEventListener('click', ()=>{
    if (animLock || aiThinking) return;
    if (!G.redo()) return;
    lastMove=null; clearSelection(); render();
  });

  $btnReset && $btnReset.addEventListener('click', ()=>{
    if (animLock || aiThinking) return;
    G.reset(); lastMove=null; clearSelection(); render();
    // jika sudah di mode AI dan sekarang gilirannya hitam, biarkan AI jalan dulu
    if (mode==='ai' && G.turn()==='b') setTimeout(aiPlay, 20);
  });

  $btnFlip && $btnFlip.addEventListener('click', ()=>{
    if (animLock || aiThinking) return;
    UI.toggleFlip(); render();
  });

  $modeHuman && $modeHuman.addEventListener('click', ()=>{
    if (animLock || aiThinking) return;
    mode='human';
    $modeHuman.classList.add('accent');
    $modeAI && $modeAI.classList.remove('accent');
  });

  $modeAI && $modeAI.addEventListener('click', ()=>{
    if (animLock || aiThinking) return;
    mode='ai';
    $modeAI.classList.add('accent');
    $modeHuman && $modeHuman.classList.remove('accent');
    if (G.turn()==='b') setTimeout(aiPlay, 20);
  });

  // ========================================================
  //                      A I   “G A H A R”
  // ========================================================
  const AI_SETTINGS = {
    timeMs: 1500,   // naikin ke 2500–3000 buat makin keras
    qDepth: 8,
    nullMove: false,   // <-- DIMATIKAN untuk stabilitas (pernah bikin giliran “skip”)
    useTT: true
  };

  // Zobrist-lite (hash posisi) untuk TT
  const Z_KEYS = (() => {
    const rnd = () => (Math.random() * 2 ** 32) | 0;
    const m = {};
    ['w','b'].forEach(c=>{
      ['P','N','B','R','Q','K'].forEach(p=>{
        for(let i=0;i<64;i++) m[`${c}${p}${i}`]=rnd();
      });
    });
    m.turn=rnd();
    return m;
  })();

  function positionHash(){
    let h=0|0;
    for (let i=0;i<64;i++){
      const p=G.get(i); if(!p) continue;
      h ^= Z_KEYS[`${p.color}${p.piece}${i}`]||0;
    }
    if (G.turn()==='w') h ^= Z_KEYS.turn;
    return h>>>0;
  }

  // nilai buah + PST ringan
  const VAL = {P:100,N:305,B:325,R:500,Q:900,K:0};
  const PST = {
    P:[ 0,5,5,0,0,5,5,0,  0,10,10,5,5,10,10,0,  0,10,20,20,20,20,10,0,  5,10,10,25,25,10,10,5,  5,10,10,20,20,10,10,5,  0,10,10,0,0,10,10,0,  0,5,5,-10,-10,5,5,0,  0,0,0,0,0,0,0,0 ],
    N:[-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,5,5,0,-20,-40, -30,5,15,10,10,15,5,-30, -30,0,15,15,15,15,0,-30, -30,5,10,15,15,10,5,-30, -30,0,10,15,15,10,0,-30, -40,-20,0,0,0,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    B:[-20,-10,-10,-10,-10,-10,-10,-20, -10,5,0,0,0,0,5,-10, -10,10,10,10,10,10,10,-10, -10,0,10,10,10,10,0,-10, -10,5,5,10,10,5,5,-10, -10,0,5,10,10,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    R:[0,0,0,5,5,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 5,5,5,10,10,5,5,5, 0,0,0,0,0,0,0,0],
    Q:[-20,-10,-10,-5,-5,-10,-10,-20, -10,0,5,0,0,0,0,-10, -10,5,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,0,5,5,5,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    K:[-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-30,-30,-40,-40,-30,-30,-30, -20,-20,-20,-20,-20,-20,-20,-20, -10,-10,-10,-10,-10,-10,-10,-10, 5,5,0,0,0,0,5,5, 10,10,10,10,10,10,10,10, 20,20,20,20,20,20,20,20]
  };

  function evalBoard(){
    let s=0;
    for (let i=0;i<64;i++){
      const p=G.get(i); if(!p) continue;
      const k=(p.color==='w'?1:-1);
      s += k*VAL[p.piece];
      s += k*((PST[p.piece]&&PST[p.piece][i])||0);
    }
    return (G.turn()==='w'? s : -s);
  }

  // TT
  const TT = new Map();
  function ttGet(key, depth, alpha, beta){
    const t=TT.get(key); if(!t || t.depth<depth) return null;
    if (t.flag===0) return t.score;
    if (t.flag===-1 && t.score<=alpha) return alpha;
    if (t.flag=== 1 && t.score>=beta ) return beta;
    return t.score;
  }
  function ttPut(key, depth, score, flag){ TT.set(key,{depth,score,flag}); }

  // ordering
  const MVV={P:1,N:3,B:3,R:5,Q:9,K:100};
  function captureScore(m){
    const to=idx(m.to); const cap=G.get(to); if(!cap) return 0;
    const from=idx(m.from); const pc=G.get(from)||m.piece; // fallback
    return 10*MVV[cap.piece] - MVV[pc.piece||'P'];
  }
  function orderedMoves(){
    const ms=G.moves();
    ms.forEach(m=>{
      const f=idx(m.from), t=idx(m.to);
      const P=G.get(f);
      let sc=0;
      const cap=G.get(t);
      if (cap) sc+=1000+captureScore(m);
      if (m.promotion) sc+=900;
      sc+= ((PST[P.piece]?.[t]||0)-(PST[P.piece]?.[f]||0));
      m.__s=sc;
    });
    ms.sort((a,b)=>b.__s-a.__s);
    return ms;
  }

  // quiescence
  function qsearch(alpha,beta,depth){
    const stand = evalBoard();
    if (stand>=beta) return beta;
    if (alpha<stand) alpha=stand;
    if (depth<=0) return stand;

    const caps = G.moves().filter(m=>{
      const to=idx(m.to); return !!G.get(to) || m.promotion;
    }).sort((a,b)=> (captureScore(b)+(b.promotion?900:0)) - (captureScore(a)+(a.promotion?900:0)));

    for (const m of caps){
      const ok=G.move(m); if(!ok) continue;
      const sc = -qsearch(-beta,-alpha,depth-1);
      G.undo();
      if (sc>=beta) return beta;
      if (sc>alpha) alpha=sc;
    }
    return alpha;
  }

  // alpha-beta (tanpa null-move default -> stabil)
  function alphabeta(depth,alpha,beta,allowNull,deadline){
    if (performance.now()>deadline) throw new Error('TIME');

    const key = AI_SETTINGS.useTT ? positionHash() : 0;
    const tt  = AI_SETTINGS.useTT ? ttGet(key,depth,alpha,beta) : null;
    if (tt!=null && depth>0) return tt;

    if (depth===0) return qsearch(alpha,beta,AI_SETTINGS.qDepth);

    // null-move pruning optional (dimatikan via AI_SETTINGS.nullMove=false)
    if (allowNull && AI_SETTINGS.nullMove && depth>=3 && !G.inCheck()){
      // catatan: DIHILANGKAN demi stabilitas posisi
    }

    let best=-Infinity, flag=1;
    const moves=orderedMoves();
    if (!moves.length){
      const st=G.gameStatus();
      if (st==='checkmate') return -99999+(50-depth);
      return 0; // stalemate
    }

    for (const m of moves){
      const ok=G.move(m); if(!ok) continue;
      let sc;
      try{
        sc = -alphabeta(depth-1,-beta,-alpha,true,deadline);
      }catch(e){ G.undo(); if(e.message==='TIME') throw e; throw e; }
      G.undo();

      if (sc>best) best=sc;
      if (sc>alpha){ alpha=sc; flag=0; }
      if (alpha>=beta){ flag=-1; break; }
    }
    if (AI_SETTINGS.useTT) ttPut(key,depth,best,flag);
    return best;
  }

  // iterative deepening
  async function aiPlay(){
    if (aiThinking) return;
    aiThinking=true;

    const start=performance.now();
    const deadline=start+AI_SETTINGS.timeMs;

    let best=null, bestScore=-Infinity, depth=1;
    try{
      // deepen until time up
      while(true){
        const res = searchDepth(depth, deadline);
        if (res && res.move){ best=res.move; bestScore=res.score; }
        depth++;
      }
    }catch(e){ /* TIME */ }

    if (best) playMove(best);
    aiThinking=false;
  }

  function searchDepth(depth, deadline){
    let best=null, bestScore=-Infinity;
    const ms=orderedMoves();
    for (const m of ms){
      const ok=G.move(m); if(!ok) continue;
      let sc;
      try{
        sc = -alphabeta(depth-1,-Infinity,Infinity,true,deadline);
      }catch(e){ G.undo(); if(e.message==='TIME') throw e; throw e; }
      G.undo();
      if (sc>bestScore){ bestScore=sc; best=m; }
    }
    return {move:best, score:bestScore};
  }

  // ---------- Boot ----------
  render();
})();
