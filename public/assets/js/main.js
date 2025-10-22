// assets/js/main.js — Azbry Chess (FEN-First Fix)
// Fokus: bidak PASTI muncul (render via FEN), koordinat, main jalan, optional AI.

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // Elemen dasar
  let boardEl = $('board');
  const btnFlip    = $('btnFlip');
  const btnReset   = $('btnReset');
  const btnUndo    = $('btnUndo');
  const btnRedo    = $('btnRedo');
  const modeHuman  = $('modeHuman');
  const modeAI     = $('modeAI');
  const moveLog    = $('moveHistory');

  // Overlay (opsional)
  const startMenu     = $('startMenu');
  const btnStartHuman = $('btnStartHuman');
  const btnStartAI    = $('btnStartAI');
  const resultPopup   = $('resultPopup');
  const resultText    = $('resultText');
  const btnRestart    = $('btnRestart');

  // Pastikan #board ada
  if (!boardEl) {
    boardEl = document.createElement('div');
    boardEl.id = 'board';
    boardEl.className = 'board';
    document.body.prepend(boardEl);
  }

  // Engine & UI
  const game = new Chess();
  const ui   = new ChessUI(boardEl, onSquare);

  // Build grid kalau belum
  if (!ui.squares || ui.squares.length !== 64) ui._buildGrid();

  // FEN fallback (jaga-jaga)
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // State
  let mode     = 'human';         // 'human' | 'ai'
  let selected = null;
  let lastMove = null;

  // === Controls =================================================================
  if (btnFlip)  btnFlip.addEventListener('click', () => { ui.toggleFlip(); sync(); });
  if (btnReset) btnReset.addEventListener('click', () => { if (game.reset) game.reset(); selected=null; lastMove=null; sync(); });
  if (btnUndo)  btnUndo.addEventListener('click',  () => { game.undo?.(); selected=null; lastMove=null; sync(); });
  if (btnRedo)  btnRedo.addEventListener('click',  () => { game.redo?.(); selected=null; lastMove=null; sync(); });

  if (modeHuman) modeHuman.addEventListener('click', () => setMode('human'));
  if (modeAI)    modeAI.addEventListener('click',    () => setMode('ai'));

  if (btnStartHuman) btnStartHuman.addEventListener('click', () => startGame('human'));
  if (btnStartAI)    btnStartAI.addEventListener('click',    () => startGame('ai'));
  if (btnRestart)    btnRestart.addEventListener('click', () => { hideResult(); startMenu?.classList.add('show'); if (game.reset) game.reset(); selected=null; lastMove=null; sync(); });

  function startGame(m) { setMode(m); startMenu?.classList.remove('show'); }
  function setMode(m)   { mode = m; modeHuman?.classList.toggle('active', m==='human'); modeAI?.classList.toggle('active', m==='ai'); selected=null; lastMove=null; sync(); }

  // === Interaksi papan ==========================================================
  function onSquare(sq) {
    // Kalau mode AI, player = putih
    if (mode === 'ai' && (game.turn?.() === 'b')) return;

    const movesFromSel = selected ? (game.moves?.({ square: selected }) || []) : [];

    // Klik tujuan legal
    if (selected && movesFromSel.some(m => m.to === sq)) {
      const promo = needsPromotion(selected, sq) ? 'Q' : null;
      const note = game.move?.({ from: selected, to: sq, promotion: promo });
      if (note) {
        lastMove = { from: selected, to: sq };
        selected = null;
        sync();
        if (mode === 'ai') setTimeout(aiMove, 140);
      }
      return;
    }

    // Pilih bidak warna yang jalan
    const P = safeBoardCell(sq);
    selected = (P && P.color === (game.turn?.() || 'w')) ? sq : null;
    sync();
  }

  function needsPromotion(fromAlg, toAlg) {
    const toR   = 8 - parseInt(toAlg[1], 10);
    const piece = safeBoardCell(fromAlg);
    if (!piece || piece.piece !== 'P') return false;
    return (piece.color === 'w' && toR === 0) || (piece.color === 'b' && toR === 7);
  }

  function safeBoardCell(sq) {
    try {
      const arr = game.board?.();
      if (!Array.isArray(arr) || arr.length !== 64) return null;
      const idx = (8 - parseInt(sq[1],10)) * 8 + 'abcdefgh'.indexOf(sq[0]);
      return arr[idx] || null;
    } catch { return null; }
  }

  // === AI (greedy sederhana) ====================================================
  function aiMove() {
    if (mode !== 'ai' || (game.turn?.() !== 'b')) return;
    const legal = game.moves?.() || [];
    if (!legal.length) { sync(); return; }

    const value = { P:1, N:3, B:3, R:5, Q:9, K:100 };
    let best = null, bestScore = -1;
    for (const m of legal) {
      const t = safeBoardCell(m.to);
      const s = t ? value[t.piece] : 0;
      if (s > bestScore) { best = m; bestScore = s; }
    }
    const pick  = bestScore > 0 ? best : legal[(Math.random()*legal.length)|0];
    const promo = needsPromotion(pick.from, pick.to) ? 'Q' : null;
    const note  = game.move?.({ from: pick.from, to: pick.to, promotion: promo });
    if (note) lastMove = { from: pick.from, to: pick.to };
    sync();
  }

  // === Status game ==============================================================
  function getStatus() {
    // Deteksi universal (buat check/checkmate/stalemate)
    let hasMoves = true;
    try { hasMoves = (game.moves?.().length > 0); } catch {}
    let inCheck = false;
    try {
      if (typeof game.inCheck === 'function') inCheck = !!game.inCheck();
      else if (typeof game.in_check === 'function') inCheck = !!game.in_check();
    } catch {}
    let isMate = false;
    try {
      if (typeof game.inCheckmate === 'function') isMate = !!game.inCheckmate();
      else if (typeof game.in_checkmate === 'function') isMate = !!game.in_checkmate();
      else if (!hasMoves && inCheck) isMate = true;
    } catch {}
    let isStale = false;
    try {
      if (typeof game.inStalemate === 'function') isStale = !!game.inStalemate();
      else if (typeof game.in_stalemate === 'function') isStale = !!game.in_stalemate();
      else if (!hasMoves && !inCheck) isStale = true;
    } catch {}
    let status = 'ok';
    if (isMate) status = 'checkmate';
    else if (isStale) status = 'stalemate';
    else if (inCheck) status = 'check';
    return { status, inCheck };
  }

  // === Koordinat overlay (a–h & 1–8) ===========================================
  function injectBoardLabels(){
    if (!boardEl.querySelector('.files')){
      const files = document.createElement('div'); files.className = 'files';
      'abcdefgh'.split('').forEach(ch => { const s=document.createElement('span'); s.textContent=ch; files.appendChild(s); });
      boardEl.appendChild(files);
    }
    if (!boardEl.querySelector('.ranks')){
      const ranks = document.createElement('div'); ranks.className = 'ranks';
      for (let i=8;i>=1;i--){ const s=document.createElement('span'); s.textContent=i; ranks.appendChild(s); }
      boardEl.appendChild(ranks);
    }
  }

  // === Mirror class check → in-check (biar CSS merah kamu nyala) ================
  function mirrorCheckClass(){
    boardEl.querySelectorAll('.sq.in-check').forEach(el => el.classList.remove('in-check'));
    boardEl.querySelectorAll('.sq.check').forEach(el => el.classList.add('in-check'));
  }

  // === Overlay result ===========================================================
  function showResult(text){ if (!resultPopup || !resultText) return; resultText.textContent = text; resultPopup.classList.add('show'); }
  function hideResult(){ if (!resultPopup) return; resultPopup.classList.remove('show'); }

  // === Sinkronisasi (RENDER FEN DULUAN) ========================================
  function sync() {
    // Legal targets (buat titik biru)
    const legalTargets = selected ? (game.moves?.({ square: selected }) || []).map(m => m.to) : [];

    // Render via FEN → BIDAK PASTI MUNCUL
    const fenOk = typeof game.fen === 'function';
    const fen = fenOk ? game.fen() : START_FEN;
    const { status, inCheck } = getStatus();
    const sideToMove = game.turn?.() || 'w';
    const inCheckOpt = inCheck ? sideToMove : undefined;

    ui.renderFEN(fen, { lastMove, legal: legalTargets, inCheck: inCheckOpt });

    // CSS merah untuk check
    mirrorCheckClass();

    // Tambah label koordinat
    injectBoardLabels();

    // Log langkah
    if (moveLog) {
      try {
        const h = game.history?.() || game.history || [];
        moveLog.textContent = (h.length ? h.map((x,i)=>`${i+1}. ${x}`).join('\n') : '_');
      } catch { moveLog.textContent = '_'; }
    }

    // Popup hasil
    if (status === 'checkmate') {
      const winner = (sideToMove === 'w') ? 'Hitam' : 'Putih';
      showResult(`${winner} Menang!`);
    } else if (status === 'stalemate') {
      showResult('Seri 🤝');
    }
  }

  // === Boot ====================================================================
  if (game.reset) game.reset();       // pastikan posisi awal ke-load
  if (startMenu) startMenu.classList.add('show'); // kalau ada start menu
  sync();
});
