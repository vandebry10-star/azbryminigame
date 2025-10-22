// /assets/js/main.js — versi sinkron dengan chess.html kamu (IDs & flow)
(function () {
  // Pastikan engine + UI ada
  if (typeof window.Chess !== 'function' || typeof window.ChessUI !== 'function') {
    console.error('Chess atau ChessUI tidak ditemukan. Cek urutan script dan hapus chess-ui.js eksternal jika perlu.');
    return;
  }

  // ----- State utama -----
  const G = new Chess(); // engine
  const boardEl = document.getElementById('board');
  const ui = new ChessUI(boardEl, onSquareClick); // callback klik petak
  let selected = null;      // kotak asal (algebraic)
  let lastMove = null;      // {from,to}
  let vsAI = false;         // mode AI sederhana (random legal move)

  // ----- DOM hooks -----
  const $status       = document.getElementById('status') || document.createElement('div');
  const $moveHistory  = document.getElementById('moveHistory'); // <pre>
  const $btnReset     = document.getElementById('btnReset');
  const $btnUndo      = document.getElementById('btnUndo');
  const $btnRedo      = document.getElementById('btnRedo');
  const $btnFlip      = document.getElementById('btnFlip');
  const $btnBoardOnly = document.getElementById('btnBoardOnly');
  const $btnBack      = document.getElementById('btnBack');

  // Proxy tombol mode (dipicu dari overlay/segbar glue di HTML)
  const $modeHuman = document.getElementById('modeHuman');
  const $modeAI    = document.getElementById('modeAI');

  // ----- Util -----
  function legalTargetsFrom(squareAlg) {
    return G.moves({ square: squareAlg }).map(m => m.to); // array algebraic tujuan
  }

  function renderAll(highlights = []) {
    ui.render(G.board(), {
      legal: highlights,
      lastMove: lastMove
    });

    // Status
    const turnText = G.turn() === 'w' ? 'Giliran Putih' : 'Giliran Hitam';
    const st = G.gameStatus(); // 'ok' | 'check' | 'checkmate' | 'stalemate'
    let suffix = '';
    if (st === 'check') suffix = ' — Skak!';
    if (st === 'checkmate') suffix = ' — Skakmat!';
    if (st === 'stalemate') suffix = ' — Stalemate.';
    $status.textContent = turnText + suffix;

    // History ke <pre>
    const h = G.history(); // ["e2 → e4", "e7 → e5", ...]
    let txt = '';
    for (let i = 0; i < h.length; i += 2) {
      const w = h[i]   ?? '';
      const b = h[i+1] ?? '';
      txt += `${(i/2)+1}. ${w} ${b}\n`;
    }
    if ($moveHistory) $moveHistory.textContent = txt || '_';

    // Tampilkan modal hasil bila game selesai (optional)
    if (typeof window.__azbrySetResult === 'function') {
      if (st === 'checkmate') {
        const winner = (G.turn() === 'w') ? 'Hitam' : 'Putih'; // giliran side yg skakmat = side yg kalah
        window.__azbrySetResult({
          text: `${winner} Menang!`,
          subText: 'Skakmat.'
        });
      } else if (st === 'stalemate') {
        window.__azbrySetResult({
          text: 'Seri',
          subText: 'Stalemate.'
        });
      }
    }
  }

  function clearSelection() {
    selected = null;
    renderAll([]);
  }

  function tryMove(from, to) {
    // Coba jalankan, fallback promosi = Queen
    let note = G.move({ from, to });
    if (!note) note = G.move({ from, to, promotion: 'Q' });
    if (!note) return false;

    lastMove = { from, to };
    selected = null;
    renderAll([]);

    // Giliran AI
    const st = G.gameStatus();
    if (vsAI && st !== 'checkmate' && st !== 'stalemate') {
      setTimeout(aiMove, 120);
    }
    return true;
  }

  function aiMove() {
    const moves = G.moves();
    if (!moves.length) return;
    const m = moves[Math.floor(Math.random() * moves.length)];
    G.move(m);
    lastMove = { from: m.from, to: m.to };
    renderAll([]);
  }

  // ----- Events -----
  function onSquareClick(squareAlg) {
    if (!selected) {
      const targets = legalTargetsFrom(squareAlg);
      if (targets.length === 0) { renderAll([]); return; }
      selected = squareAlg;
      renderAll(targets);
      return;
    }

    if (squareAlg === selected) { clearSelection(); return; }

    // Coba gerak; kalau gagal dan kotak yg diklik punya langkah, jadikan seleksi baru
    const ok = tryMove(selected, squareAlg);
    if (!ok) {
      const maybe = legalTargetsFrom(squareAlg);
      if (maybe.length) { selected = squareAlg; renderAll(maybe); }
      else { clearSelection(); }
    }
  }

  // Toolbar
  $btnReset?.addEventListener('click', () => {
    G.reset(); lastMove = null; selected = null; renderAll([]);
  });
  $btnUndo?.addEventListener('click', () => {
    if (G.undo()) { lastMove = null; renderAll([]); }
  });
  $btnRedo?.addEventListener('click', () => {
    if (G.redo()) { lastMove = null; renderAll([]); }
  });
  $btnFlip?.addEventListener('click', () => {
    ui.toggleFlip();
    renderAll(selected ? legalTargetsFrom(selected) : []);
  });

  // Mode (dipicu oleh glue script di HTML melalui proxy tombol tersembunyi)
  $modeHuman?.addEventListener('click', () => {
    vsAI = false;
    G.reset(); lastMove = null; selected = null; renderAll([]);
  });
  $modeAI?.addEventListener('click', () => {
    vsAI = true;
    G.reset(); lastMove = null; selected = null; renderAll([]);
  });

  // Board-only & Back tombol (sudah di-wire di HTML glue; tidak perlu di-handle di sini)
  // Hanya render awal
  renderAll([]);
})();
