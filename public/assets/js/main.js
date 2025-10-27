/* =========================================================
   Azbry Chess — main.js (Clean, No-Anim, No-UndoRedo, AI-safe)
   - Tidak ada animasi gerak
   - Tidak ada undo/redo
   - AI mikir 2 detik, tidak numpuk (single timer)
   - Tidak ada auto double-move / saling respon
   ========================================================= */
(function () {
  // ---------- DOM ----------
  const $board    = document.getElementById('board');
  const $hist     = document.getElementById('moveHistory');
  const $btnReset = document.getElementById('btnReset');
  const $btnFlip  = document.getElementById('btnFlip');
  const $modeHuman= document.getElementById('modeHuman');
  const $modeAI   = document.getElementById('modeAI');
  const $capBlack = document.getElementById('capBlack'); // tray atas (hitam mati)
  const $capWhite = document.getElementById('capWhite'); // tray bawah (putih mati)
  if (!$board) return;

  // ---------- Engine & UI ----------
  const G  = new Chess();                // from chess-engine.js
  const UI = new ChessUI($board, onSquareClick);

  // ---------- State ----------
  let mode = 'human';                    // 'human' | 'ai'
  let selected = null;                   // algebraic: 'e2'
  let legalForSelected = [];             // legal moves for selected square
  let lastMove = null;                   // {from,to}
  let aiTimer = null;                    // single timer untuk AI
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

  // ---------- Captured (rebuild dari history, anti-duplikat) ----------
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
    if (aiThinking) return;

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

    doMove(mv); // langsung jalan (no animation)
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

  // ---------- Move ----------
  function doMove(m){
    const from = typeof m.from==='string'? m.from : alg(m.from);
    const to   = typeof m.to  ==='string'? m.to   : alg(m.to);

    const did = G.move({from,to,promotion:m.promotion||null});
    if (!did){ render(); return; }

    lastMove = {from,to};
    clearSelection();
    render();

    const status = G.gameStatus();
    if (status==='checkmate' || status==='stalemate'){ showResult(status); return; }

    if (mode==='ai' && G.turn()==='b'){
      scheduleAI(); // panggil AI sekali, 2 detik delay
    }
  }

  // ---------- AI ----------
  function clearAITimer(){
    if (aiTimer){ clearTimeout(aiTimer); aiTimer=null; }
  }
  function scheduleAI(){
    clearAITimer();
    aiTimer = setTimeout(runAI, 2000); // pikir 2 detik
  }
  function runAI(){
    // guard: bisa saja user sudah switch mode / reset
    if (mode!=='ai' || G.turn()!=='b'){ clearAITimer(); return; }

    aiThinking = true;
    try{
      const best = (window.AzbryAI && window.AzbryAI.think)
        ? window.AzbryAI.think(G, { timeMs: 2000, maxDepth: 8 })
        : null;
      if (best){
        // pastikan masih gilirannya hitam
        if (G.turn()==='b') doMove(best);
      }
    } finally {
      aiThinking = false;
      clearAITimer();
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
  $btnReset && $btnReset.addEventListener('click', ()=>{
    if (aiThinking) return;
    clearAITimer();
    G.reset(); lastMove=null; clearSelection(); render();
    // jika mode AI dan giliran hitam, biarkan AI jalan dulu
    if (mode==='ai' && G.turn()==='b') scheduleAI();
  });

  $btnFlip && $btnFlip.addEventListener('click', ()=>{
    if (aiThinking) return;
    UI.toggleFlip(); render();
  });

  $modeHuman && $modeHuman.addEventListener('click', ()=>{
    if (aiThinking) return;
    mode='human';
    clearAITimer();
    // highlight tombol ditangani oleh HTML glue
  });

  $modeAI && $modeAI.addEventListener('click', ()=>{
    if (aiThinking) return;
    mode='ai';
    clearAITimer();
    if (G.turn()==='b') scheduleAI();
  });

  // ---------- Boot ----------
  render();
})();
