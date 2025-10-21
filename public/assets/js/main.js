// assets/js/main.js — Controller + Renderer (final)
// Cocok dengan engine v3 (Chess, ChessUI). Aman kalau elemen tombol belum ada.

document.addEventListener('DOMContentLoaded', () => {
  // ---- Grab DOM (optional / aman kalau belum ada) ----
  const $ = (id) => document.getElementById(id);
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

  // Kalau belum ada container board, bikin darurat (biar bisa test cepat)
  if (!boardEl) {
    boardEl = document.createElement('div');
    boardEl.id = 'board';
    boardEl.className = 'board';
    document.body.appendChild(boardEl);
  }

  // ---- Game state ----
  const game = new Chess();               // dari engine v3
  const ui   = new ChessUI(boardEl, onSquare); // helper renderer dari engine v3
  let mode   = 'human';                   // 'human' | 'ai'
  let selected = null;                    // algebraic ex: "e2"
  let lastMove = null;                    // {from,to}

  // ---- Hook tombol (kalau ada) ----
  if (modeHuman) modeHuman.addEventListener('click', () => setMode('human'));
  if (modeAI)    modeAI.addEventListener('click',    () => setMode('ai'));
  if (btnReset)  btnReset.addEventListener('click',  () => { game.reset(); selected=null; lastMove=null; sync(); });
  if (btnUndo)   btnUndo.addEventListener('click',   () => { game.undo();  selected=null; lastMove=null; sync(); });
  if (btnRedo)   btnRedo.addEventListener('click',   () => { game.redo();  selected=null; lastMove=null; sync(); });
  if (btnFlip)   btnFlip.addEventListener('click',   () => { ui.toggleFlip(); sync(); });

  // Board Only (opsional, butuh tombol & CSS body.board-only dari azbry.css)
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

  function setMode(m) {
    mode = m;
    if (modeHuman) modeHuman.classList.toggle('active', m==='human');
    if (modeAI)    modeAI.classList.toggle('active',   m==='ai');
    selected = null;
    lastMove = null;
    sync();
  }

  // ---- Click papan ----
  function onSquare(squareAlg) {
    // Kalau mode AI: pemain = Putih, AI = Hitam
    if (mode === 'ai' && game.turn() === 'b') return;

    const movesFromSel = selected ? game.moves({ square: selected }) : [];
    // Apakah klik ini target legal dari selected?
    if (selected && movesFromSel.some(m => m.to === squareAlg)) {
      const promo = needsPromotion(selected, squareAlg) ? 'Q' : null;
      const note = game.move({ from: selected, to: squareAlg, promotion: promo });
      if (note) {
        lastMove = { from: selected, to: squareAlg };
        selected = null;
        sync();
        // AI jalan
        if (mode === 'ai') setTimeout(aiMove, 140);
      }
      return;
    }

    // Kalau klik bidak milik side yg jalan → select
    const idx = toIdx(squareAlg);
    const P = game.board()[idx];
    if (P && P.color === game.turn()) {
      selected = squareAlg;
    } else {
      selected = null;
    }
    sync();
  }

  // ---- Helper promotion ----
  function needsPromotion(fromAlg, toAlg) {
    const fromR = 8 - parseInt(fromAlg[1], 10);
    const toR   = 8 - parseInt(toAlg[1], 10);
    const piece = game.board()[toIdx(fromAlg)];
    if (!piece || piece.piece !== 'P') return false;
    // Putih promosi di rank 0, Hitam di rank 7
    return (piece.color === 'w' && toR === 0) || (piece.color === 'b' && toR === 7);
  }

  // ---- AI ringan (greedy capture > random) ----
  function aiMove() {
    if (mode !== 'ai' || game.turn() !== 'b') return;

    const legal = game.moves();
    if (!legal.length) { sync(); return; }

    // Skor material sederhana
    const value = { P:1, N:3, B:3, R:5, Q:9, K:100 };
    let best = null, bestScore = -1;

    // Cari capture terbaik
    for (const m of legal) {
      // Simulasikan quick score: lihat target square saat ini
      const targetPiece = game.board()[toIdx(m.to)];
      const s = targetPiece ? value[targetPiece.piece] : 0;
      if (s > bestScore) { best = m; bestScore = s; }
    }

    // Jika tidak ada capture, pilih random
    const pick = bestScore > 0 ? best : legal[Math.floor(Math.random() * legal.length)];
    // Tangani promosi kalau perlu
    const promo = needsPromotion(pick.from, pick.to) ? 'Q' : null;
    const note = game.move({ from: pick.from, to: pick.to, promotion: promo });
    if (note) { lastMove = { from: pick.from, to: pick.to }; }
    sync();
  }

  // ---- Sink UI ----
  function sync() {
    // Highlight langkah legal dari selected
    const legalTargets = selected ? game.moves({ square: selected }).map(m => m.to) : [];
    ui.render(game.board(), { lastMove, legal: legalTargets });

    // Update move history (kalau elemennya ada)
    if (moveLog) {
      const h = game.history();
      moveLog.textContent = h.length ? h.map((x,i)=>`${i+1}. ${x}`).join('\n') : '_';
    }

    // Game status
    const status = game.gameStatus(); // 'ok'|'check'|'checkmate'|'stalemate'
    if (status === 'checkmate') {
      // Tampilkan kecil aja; UI overlay bisa ditambah di HTML nanti
      console.log('CHECKMATE');
    } else if (status === 'stalemate') {
      console.log('STALEMATE');
    } else if (status === 'check') {
      console.log('CHECK');
    }
  }

  // ---- Util ----
  function toIdx(a) { return (8 - parseInt(a[1],10)) * 8 + 'abcdefgh'.indexOf(a[0]); }

  // ---- Boot ----
  setMode('human'); // default
  window._azchess = { game, ui }; // debug helper
});
