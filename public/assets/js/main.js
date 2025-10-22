// /assets/js/main.js — koordinat + graveyard + click-to-move
(function () {
  if (typeof window.Chess !== 'function' || typeof window.ChessUI !== 'function') {
    console.error('Chess / ChessUI tidak ditemukan.');
    return;
  }

  const G  = new Chess();                                    // engine
  const boardEl = document.getElementById('board');
  const ui = new ChessUI(boardEl, onSquareClick);            // UI + handler klik
  const $hist = document.getElementById('moveHistory');

  // trays
  const $capWhite = document.getElementById('capWhite');
  const $capBlack = document.getElementById('capBlack');

  // state
  let selected = null;          // algebraic: "e2"
  let lastMove = null;          // {from,to}
  let vsAI = false;

  // ===== Koordinat (a–h, 1–8) pada tiap cell =====
  // dipanggil sekali setelah ChessUI build 64 <div> .sq
  function stampCoordinates() {
    const files = 'abcdefgh';
    // Cell ke-i => index i-1 (karena NodeList mulai 0)
    const cells = boardEl.querySelectorAll('.sq');
    for (let i = 0; i < cells.length; i++) {
      // engine index: 0=a8, 63=h1
      const idx = i;                        // urutan pembuatan sama (0..63)
      const f = idx % 8;                    // file 0..7
      const r = (idx / 8) | 0;              // rank 0..7 (0=8, 7=1)
      const rankText = String(8 - r);
      const fileText = files[f];
      // simpan untuk CSS ::before/::after
      cells[i].setAttribute('data-rank', rankText);
      cells[i].setAttribute('data-file', fileText);
    }
  }
  // panggil setelah UI terbentuk
  stampCoordinates();

  // ===== Helpers =====
  function legalTargetsFrom(a) { return G.moves({ square: a }).map(m => m.to); }

  // deteksi bidak tertangkap via perbandingan papan sebelum & sesudah
  function detectCapture(prevBoard, nextBoard, fromAlg, toAlg) {
    // cari petak yang hilang (selain from->to)
    const fromIdx = algToIdx(fromAlg);
    const toIdx   = algToIdx(toAlg);
    for (let i = 0; i < 64; i++) {
      // skip asal yang memang dipindah & tujuan (karena akan diisi bidak pemindah)
      if (i === fromIdx || i === toIdx) continue;
      const before = prevBoard[i];
      const after  = nextBoard[i];
      if (before && !after) {
        return before; // {color:'w'|'b', piece:'P'|'N'|...}
      }
    }
    return null;
  }

  function algToIdx(a){ return (8 - parseInt(a[1], 10)) * 8 + 'abcdefgh'.indexOf(a[0]); }

  function render(highlights = []) {
    ui.render(G.board(), { legal: highlights, lastMove });
    // history -> <pre>
    const h = G.history();
    let out = '';
    for (let i = 0; i < h.length; i += 2) {
      out += `${(i/2)+1}. ${h[i] ?? ''} ${h[i+1] ?? ''}\n`;
    }
    if ($hist) $hist.textContent = out || '_';
  }

  // render captured trays ulang (dari array of piece objects)
  const capturedWhite = []; // bidak putih yang tertangkap (ditaruh di tray "Putih tertangkap")
  const capturedBlack = []; // bidak hitam yang tertangkap

  function glyph(p){ // tampilkan simbol unicode
    const W = {P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'};
    const B = {P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'};
    return p.color === 'w' ? W[p.piece] : B[p.piece];
  }
  function renderCaptures() {
    if ($capWhite) {
      $capWhite.innerHTML = '';
      for (const p of capturedWhite) {
        const span = document.createElement('span');
        span.className = 'cap-piece'; span.textContent = glyph(p);
        $capWhite.appendChild(span);
      }
    }
    if ($capBlack) {
      $capBlack.innerHTML = '';
      for (const p of capturedBlack) {
        const span = document.createElement('span');
        span.className = 'cap-piece'; span.textContent = glyph(p);
        $capBlack.appendChild(span);
      }
    }
  }

  // ===== Moves =====
  function tryMove(from, to) {
    const prevBoard = JSON.parse(JSON.stringify(G.board())); // snapshot sebelum jalan

    let ok = G.move({ from, to }) || G.move({ from, to, promotion: 'Q' });
    if (!ok) return false;

    // setelah sukses, cek ada capture
    const cap = detectCapture(prevBoard, G.board(), from, to);
    if (cap) {
      // kalau cap.color === 'w', maka bidak PUTIH tertangkap (masuk tray putih)
      if (cap.color === 'w') capturedWhite.push(cap);
      else capturedBlack.push(cap);
      renderCaptures();
    }

    lastMove = { from, to };
    selected = null;
    render([]);

    // AI sederhana (opsional)
    if (vsAI && !['checkmate','stalemate'].includes(G.gameStatus())) {
      const moves = G.moves();
      if (moves.length) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        const prev = JSON.parse(JSON.stringify(G.board()));
        G.move(m);
        const cap2 = detectCapture(prev, G.board(), m.from, m.to);
        if (cap2) { (cap2.color === 'w' ? capturedWhite : capturedBlack).push(cap2); renderCaptures(); }
        lastMove = { from: m.from, to: m.to };
        render([]);
      }
    }
    return true;
  }

  function onSquareClick(a) {
    if (!selected) {
      const targets = legalTargetsFrom(a);
      if (!targets.length) { render([]); return; }
      selected = a; render(targets); return;
    }
    if (a === selected) { selected = null; render([]); return; }
    const ok = tryMove(selected, a);
    if (!ok) {
      const maybe = legalTargetsFrom(a);
      if (maybe.length) { selected = a; render(maybe); }
      else { selected = null; render([]); }
    }
  }

  // ===== Toolbar (opsional, sesuai id yang ada di HTML kamu) =====
  document.getElementById('btnReset')?.addEventListener('click', () => {
    G.reset(); lastMove=null; selected=null;
    capturedWhite.length = 0; capturedBlack.length = 0;
    renderCaptures(); render([]);
  });
  document.getElementById('btnUndo')?.addEventListener('click',  () => {
    if (G.undo()) { lastMove=null; render([]); /* untuk kesederhanaan, tray tidak di-undo */ }
  });
  document.getElementById('btnRedo')?.addEventListener('click',  () => {
    if (G.redo()) { lastMove=null; render([]); }
  });
  document.getElementById('btnFlip')?.addEventListener('click',  () => {
    ui.toggleFlip(); render(selected ? legalTargetsFrom(selected) : []);
  });
  document.getElementById('modeHuman')?.addEventListener('click', () => {
    vsAI=false; G.reset(); lastMove=null; selected=null; capturedWhite.length=0; capturedBlack.length=0; renderCaptures(); render([]);
  });
  document.getElementById('modeAI')?.addEventListener('click',    () => {
    vsAI=true;  G.reset(); lastMove=null; selected=null; capturedWhite.length=0; capturedBlack.length=0; renderCaptures(); render([]);
  });

  // first paint
  render([]); renderCaptures();
})();
