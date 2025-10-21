/* AZBRY CHESS MAIN.JS (Final Stable)
   Glue antara engine dan UI — 100% kompatibel dengan tema Azbry
   © 2025 FebryWesker
*/

(() => {
  const $ = (id) => document.getElementById(id);

  const boardEl = $('board');
  const btnReset = $('btnReset');
  const btnUndo = $('btnUndo');
  const btnRedo = $('btnRedo');
  const btnFlip = $('btnFlip');
  const btnHuman = $('modeHuman');
  const btnAI = $('modeAI');
  const moveHistory = $('moveHistory');

  // === State ===
  let vsAI = false;
  let selected = null;
  let legalMoves = [];
  const moveList = [];

  // === Engine & UI ===
  const engine = new ChessEngine();
  const ui = new ChessUI(boardEl, onSquareClick);

  // === Render ===
  function render() {
    const board = engine.board();
    const last = engine.lastMove || null;
    ui.render(board, { legal: legalMoves, lastMove: last });
    moveHistory.textContent = moveList.length ? moveList.join('  ') : '—';
  }

  // === Square click ===
  function onSquareClick(idx) {
    const board = engine.board();
    const piece = board[idx];

    // Pilih bidak
    if (selected === null) {
      if (piece && piece[0] === engine.turn()) {
        selected = idx;
        legalMoves = engine.legalMovesFrom(idx);
        ui.markSource(idx);
      }
      render();
      return;
    }

    // Klik bidak sendiri → ganti seleksi
    if (piece && piece[0] === engine.turn()) {
      selected = idx;
      legalMoves = engine.legalMovesFrom(idx);
      ui.markSource(idx);
      render();
      return;
    }

    // Klik kotak tujuan
    if (legalMoves.includes(idx)) {
      const result = engine.move({ from: selected, to: idx });
      if (result?.ok) {
        moveList.push(result.san || toAlg(selected) + ' → ' + toAlg(idx));
        selected = null;
        legalMoves = [];
        render();

        // Cek status akhir
        if (engine.isCheckmate()) return showToast('Skakmat!');
        if (engine.isDraw()) return showToast('Seri!');
        if (engine.isCheck()) showToast('Skak!');

        // Jika AI
        if (vsAI) setTimeout(aiMove, 300);
      } else {
        selected = null;
        legalMoves = [];
        render();
      }
    } else {
      selected = null;
      legalMoves = [];
      render();
    }
  }

  // === Fungsi AI (Azbry-MD) ===
  function aiMove() {
    const move = engine.getBestMove?.(1) || engine.randomMove();
    if (!move) return;
    engine.move(move);
    moveList.push(move.san || toAlg(move.from) + ' → ' + toAlg(move.to));
    render();

    if (engine.isCheckmate()) return showToast('Kamu Kalah 😭');
    if (engine.isDraw()) return showToast('Seri 🤝');
    if (engine.isCheck()) showToast('Skak!');
  }

  // === Tombol kontrol ===
  btnReset?.addEventListener('click', () => {
    engine.reset();
    selected = null;
    legalMoves = [];
    moveList.length = 0;
    render();
  });

  btnUndo?.addEventListener('click', () => {
    engine.undo();
    moveList.pop();
    render();
  });

  btnRedo?.addEventListener('click', () => {
    engine.redo();
    render();
  });

  btnFlip?.addEventListener('click', () => {
    ui.setFlip(!ui.flipped);
    render();
  });

  // === Mode AI / Human ===
  btnHuman?.addEventListener('click', () => {
    vsAI = false;
    btnHuman.classList.add('active');
    btnAI.classList.remove('active');
    engine.reset();
    moveList.length = 0;
    render();
  });

  btnAI?.addEventListener('click', () => {
    vsAI = true;
    btnAI.classList.add('active');
    btnHuman.classList.remove('active');
    engine.reset();
    moveList.length = 0;
    render();
  });

  // === Helper ===
  function toAlg(i) {
    return 'abcdefgh'[i % 8] + (8 - Math.floor(i / 8));
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'az-toast show';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  }

  // === Init ===
  engine.reset();
  render();
})();
