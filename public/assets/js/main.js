// assets/js/main.js — Controller + Renderer (final + menu & result overlay)
// Cocok dengan engine v3 (Chess, ChessUI).

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // Root UI
  let boardEl      = $('board');
  const modeHuman  = $('modeHuman');
  const modeAI     = $('modeAI');
  const btnReset   = $('btnReset');
  const btnUndo    = $('btnUndo');
  const btnRedo    = $('btnRedo');
  const btnFlip    = $('btnFlip');
  const btnOnly    = $('btnBoardOnly');
  const btnBack    = $('btnBack');
  const moveLog    = $('moveHistory');

  // Overlays
  const startMenu   = $('startMenu');
  const btnStartHuman = $('btnStartHuman');
  const btnStartAI    = $('btnStartAI');

  const resultPopup = $('resultPopup');
  const resultText  = $('resultText');
  const btnRestart  = $('btnRestart');

  // Board fallback if missing
  if (!boardEl) {
    boardEl = document.createElement('div');
    boardEl.id = 'board';
    boardEl.className = 'board';
    document.body.appendChild(boardEl);
  }

  // Game state
  const game = new Chess();                 // engine
  const ui   = new ChessUI(boardEl, onSquare);
  let mode   = 'human';                     // 'human' | 'ai'
  let selected = null;
  let lastMove = null;

  // Mode picker (in-page)
  if (modeHuman) modeHuman.addEventListener('click', () => setMode('human'));
  if (modeAI)    modeAI.addEventListener('click',    () => setMode('ai'));

  // Controls
  if (btnReset)  btnReset.addEventListener('click',  () => hardReset());
  if (btnUndo)   btnUndo.addEventListener('click',   () => { game.undo(); selected=null; lastMove=null; sync(); });
  if (btnRedo)   btnRedo.addEventListener('click',   () => { game.redo(); selected=null; lastMove=null; sync(); });
  if (btnFlip)   btnFlip.addEventListener('click',   () => { ui.toggleFlip(); sync(); });

  // Board Only mode
  if (btnOnly && btnBack) {
    btnOnly.addEventListener('click', () => {
      document.body.classList.add('board-only');
      btnOnly.style.display = 'none';
      btnBack.style.display = 'inline-block';
    });
    btnBack.addEventListener('click', () => {
      document.body.classList.remove('board-only');
      btnBack.style.display = 'none';
      btnOnly.style.display = 'inline-block';
    });
  }

  // Start menu
  if (btnStartHuman) btnStartHuman.addEventListener('click', () => startGame('human'));
  if (btnStartAI)    btnStartAI.addEventListener('click',    () => startGame('ai'));

  // Result popup
  if (btnRestart) btnRestart.addEventListener('click', () => {
    hideResult();
    if (startMenu) startMenu.classList.add('show');
    hardReset();
  });

  // --- Functions --------------------------------------------------------

  function startGame(m) {
    setMode(m);
    if (startMenu) startMenu.classList.remove('show');
  }

  function setMode(m) {
    mode = m;
    if (modeHuman) modeHuman.classList.toggle('active', m==='human');
    if (modeAI)    modeAI.classList.toggle('active',   m==='ai');
    selected = null;
    lastMove = null;
    sync();
  }

  function hardReset() {
    game.reset();
    selected = null;
    lastMove = null;
    sync();
  }

  // Klik papan
  function onSquare(squareAlg) {
    // kalau mode AI: player = putih, AI = hitam
    if (mode === 'ai' && game.turn() === 'b') return;

    const movesFromSel = selected ? game.moves({ square: selected }) : [];

    // klik langkah legal
    if (selected && movesFromSel.some(m => m.to === squareAlg)) {
      const promo = needsPromotion(selected, squareAlg) ? 'Q' : null;
      const note = game.move({ from: selected, to: squareAlg, promotion: promo });
      if (note) {
        lastMove = { from: selected, to: squareAlg };
        selected = null;
        sync();
        if (mode === 'ai') setTimeout(aiMove, 140);
      }
      return;
    }

    // pilih bidak
    const idx = toIdx(squareAlg);
    const P = game.board()[idx];
    if (P && P.color === game.turn()) {
      selected = squareAlg;
    } else {
      selected = null;
    }
    sync();
  }

  // Cek promosi
  function needsPromotion(fromAlg, toAlg) {
    const fromR = 8 - parseInt(fromAlg[1], 10);
    const toR   = 8 - parseInt(toAlg[1], 10);
    const piece = game.board()[toIdx(fromAlg)];
    if (!piece || piece.piece !== 'P') return false;
    return (piece.color === 'w' && toR === 0) || (piece.color === 'b' && toR === 7);
  }

  // AI move sederhana
  function aiMove() {
    if (mode !== 'ai' || game.turn() !== 'b') return;
    const legal = game.moves();
    if (!legal.length) { sync(); return; }

    const value = { P:1, N:3, B:3, R:5, Q:9, K:100 };
    let best = null, bestScore = -1;

    for (const m of legal) {
      const targetPiece = game.board()[toIdx(m.to)];
      const s = targetPiece ? value[targetPiece.piece] : 0;
      if (s > bestScore) { best = m; bestScore = s; }
    }

    const pick = bestScore > 0 ? best : legal[Math.floor(Math.random() * legal.length)];
    const promo = needsPromotion(pick.from, pick.to) ? 'Q' : null;
    const note = game.move({ from: pick.from, to: pick.to, promotion: promo });
    if (note) lastMove = { from: pick.from, to: pick.to };
    sync();
  }

  // Render ulang papan
  function sync() {
    const legalTargets = selected ? game.moves({ square: selected }).map(m => m.to) : [];
    ui.render(game.board(), { lastMove, legal: legalTargets });

    if (moveLog) {
      const h = game.history();
      moveLog.textContent = h.length ? h.map((x,i)=>`${i+1}. ${x}`).join('\n') : '_';
    }

    const status = game.gameStatus(); // 'ok'|'check'|'checkmate'|'stalemate'
    if (status === 'checkmate') {
      const winner = (game.turn() === 'w') ? 'Hitam Menang!' : 'Putih Menang!';
      showResult(`Checkmate — ${winner}`);
    } else if (status === 'stalemate') {
      showResult('Seri 🤝');
    }
  }

  function showResult(text) {
    if (!resultPopup || !resultText) return;
    resultText.textContent = text;
    resultPopup.classList.add('show');
  }
  function hideResult() {
    if (!resultPopup) return;
    resultPopup.classList.remove('show');
  }

  // utils
  function toIdx(a) { return (8 - parseInt(a[1],10)) * 8 + 'abcdefgh'.indexOf(a[0]); }

  // boot: tampilkan menu
  if (startMenu) startMenu.classList.add('show');
  setMode('human'); // default
});
