/* ==========================
 *  AZBRY CHESS – UI (FIX)
 *  – build board, render pieces, show legal-move hints
 *  ========================== */

(() => {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;

  // --- Inject minimal CSS buat hint & selected (aman kalau di-include berulang)
  if (!document.getElementById('az-chess-ui-style')) {
    const css = `
      #board{ display:grid; grid-template-columns:repeat(8,1fr); aspect-ratio:1/1; user-select:none; }
      #board.flip{ transform: rotate(180deg); }
      #board.flip .sq .pc{ transform: rotate(180deg); }
      .sq{ position:relative; display:flex; align-items:center; justify-content:center; border:0; background:transparent; font-size:clamp(18px,3.2vw,28px); }
      .sq.light{ background: var(--azSquareLight,#e6eaee); }
      .sq.dark{  background: var(--azSquareDark,#3c3f44); }
      .sq.selected{ outline: 3px solid #9BE27A; outline-offset:-3px; }
      .sq.hint::after{
        content:""; position:absolute; width:28%; height:28%; border-radius:50%;
        background:rgba(155,226,122,.9);
        box-shadow:0 0 0 6px rgba(155,226,122,.18) inset;
      }
      .sq.capture::after{
        width:70%; height:70%; border:4px solid rgba(155,226,122,.9); background:transparent;
      }
      .pc{ line-height:1; pointer-events:none; }
    `.trim();
    const st = document.createElement('style');
    st.id = 'az-chess-ui-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // --- state UI
  let selected = null;           // {x,y}
  let legalForSelected = [];     // [[x,y], ...]

  // warna yang jalan disediakan main.js (fallback white)
  function currentTurn() {
    return window.currentTurnColor || 'white';
  }

  function sqId(x,y){ return `sq-${x}-${y}`; }

  function buildBoardGrid() {
    boardEl.innerHTML = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `sq ${(x + y) % 2 ? 'dark' : 'light'}`;
        btn.dataset.x = x;
        btn.dataset.y = y;
        btn.id = sqId(x,y);
        btn.setAttribute('aria-label', `kotak ${String.fromCharCode(97+x)}${8-y}`);
        btn.addEventListener('click', onSquareClick);
        boardEl.appendChild(btn);
      }
    }
  }

  function renderPieces() {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const sq = document.getElementById(sqId(x,y));
        const p = window.boardState?.[y]?.[x] || null;
        sq.innerHTML = p ? `<span class="pc">${p.symbol}</span>` : '';
      }
    }
  }

  function clearHints() {
    legalForSelected = [];
    document.querySelectorAll('#board .sq.hint, #board .sq.capture, #board .sq.selected')
      .forEach(el => el.classList.remove('hint','capture','selected'));
  }

  function showHints(x,y) {
    clearHints();
    const sqSel = document.getElementById(sqId(x,y));
    sqSel?.classList.add('selected');

    legalForSelected = window.getLegalMoves(x,y) || [];
    for (const [tx,ty] of legalForSelected) {
      const target = document.getElementById(sqId(tx,ty));
      const targetPiece = window.boardState?.[ty]?.[tx] || null;
      if (targetPiece) {
        target.classList.add('capture');
      } else {
        target.classList.add('hint');
      }
    }
  }

  function onSquareClick(e) {
    const btn = e.currentTarget;
    const x = +btn.dataset.x, y = +btn.dataset.y;
    const piece = window.boardState?.[y]?.[x] || null;

    // kalau sedang memilih dan klik salah satu hint → eksekusi langkah
    const isTarget = legalForSelected.some(([tx,ty]) => tx===x && ty===y);
    if (selected && isTarget) {
      const ok = window.makeMove([selected.x,selected.y], [x,y], currentTurn());
      if (ok) {
        // kabari main.js kalau perlu (untuk pindah turn, history, AI, dll)
        window.onMoveApplied?.([selected.x,selected.y],[x,y]);
        selected = null;
        clearHints();
        renderPieces();
      }
      return;
    }

    // pilih buah kalau milik warna yang jalan
    if (piece && piece.color === currentTurn()) {
      selected = {x,y};
      showHints(x,y);
    } else {
      // klik tempat lain → bersihkan
      selected = null;
      clearHints();
    }
  }

  // API buat dipanggil main.js
  window.UIChess = {
    rebuild() {
      buildBoardGrid();
      renderPieces();
      selected = null;
      clearHints();
    },
    render: renderPieces,
    clearHints
  };

  // init pertama kali
  if (!window.boardState || !window.boardState.length) {
    window.initBoard?.();
  }
  UIChess.rebuild();
})();
