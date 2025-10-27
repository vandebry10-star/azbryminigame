/* =========================================================
   Azbry Chess — main.js (Strict, No-Anim, No-UndoRedo)
   - Input manusia hanya saat gilirannya
   - AI single timer + epoch token (anti-double, anti-late)
   - Move selalu diverifikasi legal saat eksekusi
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

  // ---------- Config ----------
  const HUMAN_COLOR = 'w';
  const AI_COLOR    = 'b';
  const AI_THINK_TIME_MS = 2000; // 2 detik

  // ---------- State ----------
  let mode = 'human';                    // 'human' | 'ai'
  let selected = null;                   // algebraic: 'e2'
  let legalForSelected = [];             // legal moves for selected square
  let lastMove = null;                   // {from,to}
  let aiTimer = null;                    // single timer untuk AI
  let aiThinking = false;
  let aiEpoch = 0;                       // token untuk membatalkan hasil AI yang usang

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
    // Hanya boleh input saat:
    // - MODE HUMAN, dan
    // - Giliran HUMAN_COLOR, dan
    // - AI tidak sedang berpikir
    if (mode !== 'human' && !(mode==='ai' && G.turn()===HUMAN_COLOR)) return;
    if (G.turn() !== HUMAN_COLOR) return;
    if (aiThinking) return;

    const p = pieceAtAlg(a);

    if (!selected){
      if (!p || p.color!==HUMAN_COLOR) return;
      selected = a;
      legalForSelected = G.moves({square:a});
      render({legalSquares: legalForSelected.map(m=>m.to)});
      markSrc(a);
      return;
    }

    // ganti seleksi ke bidak sendiri lain
    if (p && p.color===HUMAN_COLOR && a!==selected){
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

    // amankan: pastikan move legal TERKINI (bukan list lama)
    const fresh = G.moves().find(x => x.from===mv.from && x.to===mv.to && (!!x.promotion === !!mv.promotion));
    if (!fresh) { clearSelection(); render(); return; }

    doMove(fresh); // langsung jalan (no animation)
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
    // Guard: hanya boleh jalan jika memang gilirannya side sesuai m.from
    if (G.turn() !== (pieceAtAlg(typeof m.from==='string'?m.from:alg(m.from))?.color||G.turn())) {
      // kalau aneh, abort
      clearSelection(); render(); return;
    }

    const from = typeof m.from==='string'? m.from : alg(m.from);
    const to   = typeof m.to  ==='string'? m.to   : alg(m.to);

    const did = G.move({from,to,promotion:m.promotion||null});
    if (!did){ render(); return; }

    lastMove = {from,to};
    clearSelection();
    render();

    const status = G.gameStatus();
    if (status==='checkmate' || status==='stalemate'){ showResult(status); return; }

    // Jika mode AI dan sekarang gilirannya AI -> jadwalkan AI
    if (mode==='ai' && G.turn()===AI_COLOR){
      scheduleAI();
    }
  }

  // ---------- AI ----------
  function clearAITimer(){
    if (aiTimer){ clearTimeout(aiTimer); aiTimer=null; }
  }
  function scheduleAI(){
    clearAITimer();
    // bump epoch, sehingga hasil lama otomatis batal
    const myEpoch = ++aiEpoch;
    aiTimer = setTimeout(()=>runAI(myEpoch), AI_THINK_TIME_MS);
  }
  function runAI(epoch){
    // guard: bisa saja user sudah switch mode / reset
    if (epoch !== aiEpoch) return;               // stale
    if (mode!=='ai' || G.turn()!==AI_COLOR) return;

    aiThinking = true;
    try{
      const think = (window.AzbryAI && window.AzbryAI.think) ? window.AzbryAI.think : null;
      let best = null;
      if (think){
        // AI HARUS PURE: tidak boleh memodifikasi G secara permanen
        best = think(G, { timeMs: AI_THINK_TIME_MS, maxDepth: 10, safe:true });
      }
      // Pastikan masih match epoch & turn
      if (epoch !== aiEpoch) return;             // stale
      if (mode!=='ai' || G.turn()!==AI_COLOR) return;

      if (best){
        // Verifikasi lagi: move masih legal di posisi sekarang
        const legal = G.moves().find(x => x.from===best.from && x.to===best.to && (!!x.promotion === !!best.promotion));
        if (legal) doMove(legal);
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
    aiEpoch++; // batalkan semua hasil AI yang mungkin datang
    G.reset(); lastMove=null; clearSelection(); render();
    if (mode==='ai' && G.turn()===AI_COLOR) scheduleAI();
  });

  $btnFlip && $btnFlip.addEventListener('click', ()=>{
    if (aiThinking) return;
    UI.toggleFlip(); render();
  });

  $modeHuman && $modeHuman.addEventListener('click', ()=>{
    if (aiThinking) return;
    mode='human';
    clearAITimer();
    aiEpoch++; // invalidate pending AI
  });

  $modeAI && $modeAI.addEventListener('click', ()=>{
    if (aiThinking) return;
    mode='ai';
    clearAITimer();
    aiEpoch++; // start fresh epoch
    if (G.turn()===AI_COLOR) scheduleAI();
  });

  // ---------- Boot ----------
  render();
})();
