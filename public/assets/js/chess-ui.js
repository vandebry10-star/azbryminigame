/* Azbry Chess UI – simple, fast, no framework */
(function () {
  const state = {
    engine: null,
    selected: null, // {x,y}
    mode: "human",  // "human" | "ai"
    flipped: false,
  };

  // ---- helpers DOM
  const $ = (sel) => document.querySelector(sel);
  const boardEl = $("#board");
  const histEl  = $("#moveHistory");
  const btnHuman = $("#modeHuman");
  const btnAI    = $("#modeAI");
  const btnReset = $("#btnReset");
  const btnUndo  = $("#btnUndo");
  const btnRedo  = $("#btnRedo");
  const btnFlip  = $("#btnFlip");

  // glyph piece (bisa ganti SVG kalau mau)
  const PIECE_GLYPH = {
    "K": "♔","Q": "♕","R": "♖","B": "♗","N": "♘","P": "♙",
    "k": "♚","q": "♛","r": "♜","b": "♝","n": "♞","p": "♟"
  };

  function init() {
    if (!window.ChessEngine) {
      console.error("ChessEngine tidak ditemukan. Pastikan chess-engine.js sudah expose ke global.");
      return;
    }
    state.engine = new window.ChessEngine();
    wireButtons();
    renderAll();
  }

  function wireButtons() {
    btnHuman.addEventListener("click", () => {
      state.mode = "human";
      btnHuman.classList.add("active");
      btnAI.classList.remove("active");
      // tidak reset game: tetap lanjut
    });

    btnAI.addEventListener("click", () => {
      state.mode = "ai";
      btnAI.classList.add("active");
      btnHuman.classList.remove("active");
      // kalau ganti ke AI dan giliran hitam, langsung jalan
      maybeAIMove();
    });

    btnReset.addEventListener("click", () => {
      state.engine.reset();
      state.selected = null;
      renderAll();
    });

    btnUndo.addEventListener("click", () => {
      if (state.engine.undo()) {
        // kalau mode AI dan yang di-undo giliran AI, undo sekali lagi biar kembali ke kamu
        if (state.mode === "ai" && state.engine.turn === "black") {
          state.engine.undo();
        }
        state.selected = null;
        renderAll();
      }
    });

    btnRedo.addEventListener("click", () => {
      if (state.engine.redo()) {
        // kalau mode AI, setelah redo dan gilirannya AI, jalankan AI
        renderAll();
        maybeAIMove();
      }
    });

    btnFlip.addEventListener("click", () => {
      state.flipped = !state.flipped;
      boardEl.classList.toggle("flip", state.flipped);
      renderBoardOnly();
    });
  }

  // koordinat papan dengan dukungan flip
  function toScreenXY(x, y) {
    return state.flipped ? { x: 7 - x, y: 7 - y } : { x, y };
  }
  function fromScreenXY(ix, iy) {
    return state.flipped ? { x: 7 - ix, y: 7 - iy } : { x: ix, y: iy };
  }

  // ---- RENDER
  function renderAll() {
    renderBoardOnly();
    renderHistory();
  }

  function renderBoardOnly() {
    boardEl.innerHTML = "";
    boardEl.setAttribute("aria-label", "Papan Catur");
    const legalFromSel = new Set();
    const legalToSel   = new Set();
    let legalMoves = [];

    if (state.selected) {
      legalMoves = state.engine.getAllMoves(state.engine.turn)
        .filter(m => m.fromX === state.selected.x && m.fromY === state.selected.y);
      for (const m of legalMoves) {
        legalToSel.add(`${m.toX},${m.toY}`);
      }
      legalFromSel.add(`${state.selected.x},${state.selected.y}`);
    }

    // grid 8×8
    for (let sy = 7; sy >= 0; sy--) {       // render rank atas ke bawah biar visual standar
      for (let sx = 0; sx < 8; sx++) {
        const { x, y } = fromScreenXY(sx, sy);
        const p = state.engine.get(x, y);
        const sq = document.createElement("div");
        sq.className = "sq";
        sq.dataset.x = x;
        sq.dataset.y = y;

        // warna kotak
        const isDark = (sx + sy) % 2 === 1;
        sq.classList.add(isDark ? "dark" : "light");

        // highlight selected & legal
        if (legalFromSel.has(`${x},${y}`)) sq.classList.add("selected");
        if (legalToSel.has(`${x},${y}`)) {
          sq.classList.add("legal");
          const dot = document.createElement("span");
          dot.className = "legal-dot";
          sq.appendChild(dot);
        }

        // piece
        if (p) {
          const span = document.createElement("span");
          span.className = `piece ${/[A-Z]/.test(p) ? "white" : "black"}`;
          span.textContent = PIECE_GLYPH[p] || "?";
          sq.appendChild(span);
        }

        // click handler
        sq.addEventListener("click", onSquareClick);
        boardEl.appendChild(sq);
      }
    }

    // status game: check / mate / stalemate (opsional log)
    if (state.engine.isCheckmate()) {
      toast("Checkmate! " + (state.engine.turn === "white" ? "Hitam" : "Putih") + " menang.");
    } else if (state.engine.isStalemate()) {
      toast("Stalemate (seri).");
    } else if (state.engine.isCheck()) {
      // hanya info kecil biar tidak ganggu
      // console.log("Check!");
    }
  }

  function renderHistory() {
    const all = []; // bikin PGN sederhana: e2-e4
    // kita nggak simpan SAN, jadi tampilkan placeholder garis.
    // (Kalau mau lengkap, bisa simpan notasi saat move dilakukan)
    if (!state.engine.history.length) {
      histEl.textContent = "—";
      return;
    }
    // tampilkan panjang langkah saja biar ada feedback
    histEl.textContent = state.engine.history.length + " langkah.";
  }

  // ---- interaction
  function onSquareClick(e) {
    const x = +e.currentTarget.dataset.x;
    const y = +e.currentTarget.dataset.y;
    const p = state.engine.get(x, y);

    // kalau belum pilih bidak
    if (!state.selected) {
      if (!p) return;
      const color = /[A-Z]/.test(p) ? "white" : "black";
      if (color !== state.engine.turn) return;
      state.selected = { x, y };
      renderBoardOnly();
      return;
    }

    // kalau klik bidak sendiri yang sama → ganti pilihan
    if (p) {
      const color = /[A-Z]/.test(p) ? "white" : "black";
      if (color === state.engine.turn) {
        state.selected = { x, y };
        renderBoardOnly();
        return;
      }
    }

    // coba jalan
    const moved = state.engine.move(state.selected.x, state.selected.y, x, y);
    if (moved) {
      state.selected = null;
      renderAll();
      // jika mode AI dan belum checkmate/stalemate, giliran AI → jalan
      maybeAIMove();
    } else {
      // klik tempat ilegal → clear selection
      state.selected = null;
      renderBoardOnly();
    }
  }

  function maybeAIMove() {
    if (state.mode !== "ai") return;
    if (state.engine.isCheckmate() || state.engine.isStalemate()) return;
    if (state.engine.turn !== "black") return;

    // kecilkan delay biar terasa responsif
    setTimeout(() => {
      const ok = state.engine.aiMove();
      if (ok) {
        renderAll();
      }
    }, 120);
  }

  // mini toast
  let toastTimer = null;
  function toast(msg) {
    let el = $("#resultModal");
    if (!el) {
      el = document.createElement("div");
      el.id = "resultModal";
      el.className = "az-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> el.classList.remove("show"), 2200);
  }

  // start
  init();
})();
