/* =========================================================
   Azbry Chess — main.js (Tanpa Animasi, Stabil, Delay AI 2s)
   ========================================================= */
(function () {
  // ---------- DOM ----------
  const $board     = document.getElementById('board');
  const $hist      = document.getElementById('moveHistory');
  const $btnReset  = document.getElementById('btnReset');
  const $btnFlip   = document.getElementById('btnFlip');
  const $modeHuman = document.getElementById('modeHuman');
  const $modeAI    = document.getElementById('modeAI');
  const $capBlack  = document.getElementById('capBlack');
  const $capWhite  = document.getElementById('capWhite');

  if (!$board) return;

  // ---------- Engine & UI ----------
  const G  = new Chess();               // from chess-engine.js
  const UI = new ChessUI($board, onSquareClick);

  // ---------- State ----------
  let mode = 'human';                   // 'human' | 'ai'
  let selected = null;                  // 'e2'
  let legalForSelected = [];
  let lastMove = null;
  let aiThinking = false;               // AI sedang berpikir
  let inputLocked = false;              // kunci input (termasuk saat AI turn)

  // ---------- Helpers ----------
  const FILES = "abcdefgh";
  const idx = (a) => (8 - +a[1]) * 8 + FILES.indexOf(a[0]);
  const alg = (i) => FILES[i % 8] + (8 - ((i / 8) | 0));
  const pieceAt = (a) => G.get(idx(a));
  const glyph = (p) => {
    const W={P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'};
    const B={P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'};
    return p.color==='w'? W[p.piece] : B[p.piece];
  };

  function stampCoordinates(){
    for (let i=0;i<64;i++){
      const cell = UI.cells[i];
      const file = i%8, rank=(i/8)|0;
      const visFile = UI.flip ? (7-file) : file;
      const visRank = UI.flip ? rank : (7-rank);
      cell.dataset.file = FILES[visFile];
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

  function kingIndex(color){
    for (let i=0;i<64;i++){ const p=G.get(i); if (p && p.color===color && p.piece==='K') return i; }
    return -1;
  }
  function highlightCheck(){
    UI.cells.forEach(c=>c.classList.remove('check'));
    if (G.inCheck('w')) { const k=kingIndex('w'); if (k>=0) markCheck(k); }
    if (G.inCheck('b')) { const k=kingIndex('b'); if (k>=0) markCheck(k); }
  }
  function markCheck(iBoard){
    for (let v=0; v<64; v++){
      const mapped = UI.flip ? (63 - v) : v;
      if (mapped===iBoard){ UI.cells[v].classList.add('check'); break; }
    }
  }

  function renderHistory(){
    const H = G.history();
    if (!H.length){ $hist.textContent='_'; return; }
    let out='';
    for (let i=0;i<H.length;i+=2){
      const turn = (i/2|0)+1;
      out += `${turn}.  ${H[i]||''}\n    ${H[i+1]||''}\n`;
    }
    $hist.textContent = out.trim();
  }

  // Rebuild captured pieces dari histori (anti duplikat)
  function rebuildCaptures(){
    const deadB=[], deadW=[];
    for (const h of G.hist){
      const cap = h.snap && h.snap.cap;
      if (!cap) continue;
      (cap.color==='w'? deadW : deadB).push(cap);
    }
    if ($capBlack){
      $capBlack.innerHTML='';
      deadB.forEach(p=>{
        const s=document.createElement('span');
        s.className='cap-piece black';
        s.textContent=glyph(p);
        $capBlack.appendChild(s);
      });
    }
    if ($capWhite){
      $capWhite.innerHTML='';
      deadW.forEach(p=>{
        const s=document.createElement('span');
        s.className='cap-piece white';
        s.textContent=glyph(p);
        $capWhite.appendChild(s);
      });
    }
  }

  // ---------- Input ----------
  function onSquareClick(a){
    if (inputLocked || aiThinking) return;

    // Saat mode AI, pemain = PUTIH; tolak klik saat giliran hitam
    if (mode==='ai' && G.turn()==='b') return;

    const side = G.turn();
    const p = pieceAt(a);

    if (!selected){
      if (!p || p.color!==side) return;
      selected = a;
      legalForSelected = G.moves({square:a});
      render({legalSquares: legalForSelected.map(m=>m.to)});
      markSrc(a);
      return;
    }

    // ganti seleksi ke buah sendiri lain
    if (p && p.color===side && a!==selected){
      selected = a;
      legalForSelected = G.moves({square:a});
      render({legalSquares: legalForSelected.map(m=>m.to)});
      markSrc(a);
      return;
    }

    // eksekusi
    const mv = legalForSelected.find(m=>m.to===a);
    if (!mv){ clearSelection(); render(); return; }
    doMove(mv);
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

  function doMove(m){
    // Kunci input saat proses move
    inputLocked = true;

    const from = typeof m.from==='string'? m.from : alg(m.from);
    const to   = typeof m.to  ==='string'? m.to   : alg(m.to);

    const did = G.move({from,to,promotion:m.promotion||null});
    if (!did){ inputLocked=false; render(); return; }

    lastMove = {from,to};
    clearSelection();
    render();

    const status = G.gameStatus();
    if (status==='checkmate' || status==='stalemate'){
      showResult(status);
      inputLocked=false;
      return;
    }

    // Jika mode AI dan gilirannya HITAM -> AI jalan setelah delay
    if (mode==='ai' && G.turn()==='b'){
      aiTurn();
    }else{
      inputLocked=false; // kembali buka input untuk human-vs-human
    }
  }

  // ---------- Result ----------
  function showResult(status){
    const winner = (status==='checkmate')
      ? (G.turn()==='w' ? 'Hitam' : 'Putih')
      : null;
    const text = status==='checkmate' ? `${winner} Menang!` : 'Stalemate';
    const sub  = status==='checkmate'
      ? `Skakmat setelah ${G.history().length} langkah.`
      : `Tidak ada langkah legal tersisa.`;
    window.__azbrySetResult && window.__azbrySetResult({text, subText:sub});
  }

  // ---------- AI Turn (delay 2s, anti dobel) ----------
  async function aiTurn(){
    if (aiThinking) return;
    aiThinking = true;
    inputLocked = true;

    try{
      const move = await AZBRY_AI.findBestMove(G, { timeMs: 2000, maxDepth: 10 });
      if (move && G.turn()==='b' && G.gameStatus()==='playing'){
        const did = G.move(move);
        if (did){
          lastMove = {from: move.from, to: move.to};
          render();
        }
      }

      const status = G.gameStatus();
      if (status==='checkmate' || status==='stalemate'){
        showResult(status);
      }
    }catch(_e){/* diam */}
    finally{
      aiThinking = false;
      if (G.turn()==='w') inputLocked=false;
    }
  }

  // ---------- Controls ----------
  $btnReset && $btnReset.addEventListener('click', ()=>{
    if (aiThinking) return;
    G.reset();
    lastMove=null;
    clearSelection();
    render();
    if (mode==='ai' && G.turn()==='b') aiTurn();
  });

  $btnFlip && $btnFlip.addEventListener('click', ()=>{
    if (aiThinking) return;
    UI.toggleFlip();
    render();
  });

  $modeHuman && $modeHuman.addEventListener('click', ()=>{
    if (aiThinking) return;
    mode='human';
    inputLocked=false;
    $modeHuman.classList.add('accent');
    $modeAI && $modeAI.classList.remove('accent');
  });

  $modeAI && $modeAI.addEventListener('click', ()=>{
    if (aiThinking) return;
    mode='ai';
    $modeAI.classList.add('accent');
    $modeHuman && $modeHuman.classList.remove('accent');
    if (G.turn()==='b') aiTurn();
  });

  // ---------- Boot ----------
  render();
})();
