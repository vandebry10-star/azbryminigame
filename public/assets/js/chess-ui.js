/* ===========================
   Azbry Chess — UI (FIX)
   Tanggung jawab:
   - Render papan dan bidak
   - Interaksi klik & highlight legal moves
   - Kontrol tombol: reset, undo, redo, flip
   - Pilih mode: vs Human (Local) / vs Azbry-MD (AI)
   - Update riwayat & toast hasil
   Catatan: sengaja dibuat toleran dgn berbagai nama API engine.
   =========================== */

(function () {
  // ---------- Helper: cari API dari engine yang ada ----------
  const API = (() => {
    const E = window.ChessEngine || window.Game || window.Chess || {};
    const pick = (...names) => {
      for (const n of names) if (typeof E[n] === "function") return E[n].bind(E);
      return null;
    };
    const g = {
      // init / reset
      reset:
        pick("resetGame") ||
        pick("reset") ||
        pick("init") ||
        (() => console.warn("[UI] No reset/init on engine")),
      // state
      getState:
        pick("getState") ||
        (() => {
          // fallback bentuk umum
          return {
            board: E.getBoard ? E.getBoard() : E.board || [],
            turn: E.getTurn ? E.getTurn() : E.turn || "w",
            history:
              (E.getHistory && E.getHistory()) || E.history || [],
          };
        }),
      // generate legal moves dari kotak (index 0..63)
      movesFrom:
        pick("generateLegalMoves") ||
        pick("movesFrom") ||
        (() => []),
      // apply move
      move:
        pick("applyMove") ||
        pick("move") ||
        ((from, to, promo) => false),
      // undo/redo
      undo: pick("undoMove") || pick("undo") || (() => {}),
      redo: pick("redoMove") || pick("redo") || (() => {}),
      // status
      isCheck: pick("isCheck") || (() => false),
      isMate: pick("isCheckmate") || (() => false),
      isStale: pick("isStalemate") || (() => false),
      // mode AI
      setMode:
        pick("setMode") ||
        ((m) => {
          E.mode = m;
        }),
      getMode:
        pick("getMode") ||
        (() => E.mode || "human"),
      aiIfNeeded:
        pick("aiMoveIfNeeded") ||
        pick("ai") ||
        (() => {}),
      // SAN / riwayat tampilan
      getMoveListSAN:
        pick("getMoveListSAN") ||
        (() => {
          // fallback raw
          return (g.getState().history || []).map((h) => {
            if (typeof h === "string") return h;
            if (h && h.san) return h.san;
            if (h && h.from != null && h.to != null)
              return idxToAlg(h.from) + "–" + idxToAlg(h.to);
            return "?";
          });
        }),
    };
    return g;
  })();

  // ---------- Elemen DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const app = $("#chess-app");
  const boardWrap = app.querySelector(".board-wrap");
  const board = $("#board");
  const moveHistoryEl = $("#moveHistory");
  const resultToast = $("#resultModal");

  const btnReset = $("#btnReset");
  const btnUndo = $("#btnUndo");
  const btnRedo = $("#btnRedo");
  const btnFlip = $("#btnFlip");
  const btnHuman = $("#modeHuman");
  const btnAI = $("#modeAI");
  const btnBoardOnly = $("#btnBoardOnly");
  const btnBack = $("#btnBack");

  // ---------- State UI ----------
  let selected = null; // index 0..63
  let legalTargets = new Set();
  let flipped = false;

  // ---------- Util indeks <-> algebraic ----------
  const files = "abcdefgh".split("");
  function idxToRC(i) {
    return { r: Math.floor(i / 8), c: i % 8 };
  }
  function rcToIdx(r, c) {
    return r * 8 + c;
  }
  function idxToAlg(i) {
    const { r, c } = idxToRC(i);
    return files[c] + (8 - r);
  }

  // ---------- Unicode bidak ----------
  const PIECE_UNI = {
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
  };

  function parsePiece(cell) {
    // Terima bentuk umum: "wp", "bK", {color:'w',type:'k'}, null/"."
    if (!cell) return null;
    if (typeof cell === "string") {
      const s = cell.replace(/\s+/g, "");
      if (s === "." || s === "0") return null;
      // contoh: "wP" / "wp"
      const color = s[0].toLowerCase() === "w" ? "w" : "b";
      const t = s.slice(1, 2).toLowerCase();
      return { color, type: t };
    }
    if (typeof cell === "object" && cell.color && cell.type)
      return { color: cell.color[0], type: cell.type[0].toLowerCase() };
    return null;
  }

  function pieceGlyph(p) {
    if (!p) return "";
    const uni = PIECE_UNI[p.color] && PIECE_UNI[p.color][p.type];
    return uni || "";
  }

  // ---------- Render papan ----------
  function renderBoard() {
    const state = API.getState();
    const arr = state.board || [];
    // bangun 64 kotak
    board.innerHTML = "";
    board.classList.add("chess-board");

    for (let i = 0; i < 64; i++) {
      const { r, c } = idxToRC(i);
      const sq = document.createElement("div");
      sq.className = "sq " + ((r + c) % 2 === 0 ? "light" : "dark");
      sq.dataset.index = i;

      // legal highlight titik
      if (legalTargets.has(i)) {
        const dot = document.createElement("div");
        dot.className = "legal-dot";
        sq.classList.add("legal");
        sq.appendChild(dot);
      }

      // piece
      const piece = parsePiece(arr[i]);
      if (piece) {
        const span = document.createElement("span");
        span.className = "piece " + (piece.color === "w" ? "white" : "black");
        span.textContent = pieceGlyph(piece);
        sq.appendChild(span);
      }

      if (selected === i) sq.classList.add("selected");

      board.appendChild(sq);
    }
  }

  // ---------- Render riwayat ----------
  function renderHistory() {
    const list = API.getMoveListSAN();
    moveHistoryEl.textContent = list.length ? list.join("  ") : "—";
  }

  // ---------- Update status/hasil ----------
  function checkResultAndToast() {
    let txt = "";
    if (API.isMate && API.isMate()) {
      const turn = API.getState().turn || "w";
      // jika giliran yang tersisa itu MATI, pemenang kebalikannya
      txt = (turn === "w" ? "Hitam" : "Putih") + " menang (Checkmate)";
    } else if (API.isStale && API.isStale()) {
      txt = "Remis (Stalemate)";
    } else if (API.isCheck && API.isCheck()) {
      txt = "Skak!";
    }
    if (txt) showToast(txt);
  }

  function showToast(text) {
    if (!resultToast) return;
    resultToast.textContent = text;
    resultToast.classList.add("az-toast", "show");
    setTimeout(() => resultToast.classList.remove("show"), 1400);
  }

  // ---------- Interaksi klik ----------
  function clearSelection() {
    selected = null;
    legalTargets.clear();
  }

  function onSquareClick(e) {
    const el = e.target.closest(".sq");
    if (!el) return;
    const idx = +el.dataset.index;

    // jika klik target legal -> lakukan move
    if (legalTargets.has(idx) && selected != null) {
      const from = selected;
      const to = idx;
      const ok =
        API.move({ from, to }) ||
        API.move(from, to) ||
        false;

      clearSelection();
      renderBoard();
      renderHistory();
      checkResultAndToast();

      // jalankan AI bila mode AI dan game belum selesai
      if (API.getMode && API.getMode() === "ai") {
        setTimeout(() => {
          API.aiIfNeeded && API.aiIfNeeded();
          renderBoard();
          renderHistory();
          checkResultAndToast();
        }, 120);
      }
      return;
    }

    // kalau tidak sedang memilih, pilih kotak yang ada bidaknya & punya legal move
    const moves =
      API.movesFrom(idx) || [];
    // moves dapat berupa array of index, atau array of {to:idx}
    const normTargets = new Set(
      moves.map((m) => (typeof m === "number" ? m : m.to))
    );
    if (normTargets.size > 0) {
      selected = idx;
      legalTargets = normTargets;
    } else {
      clearSelection();
    }
    renderBoard();
  }

  // ---------- Tombol control ----------
  btnReset && btnReset.addEventListener("click", () => {
    API.reset();
    clearSelection();
    renderBoard();
    renderHistory();
    showToast("Papan di-reset");
  });

  btnUndo && btnUndo.addEventListener("click", () => {
    API.undo();
    clearSelection();
    renderBoard();
    renderHistory();
  });

  btnRedo && btnRedo.addEventListener("click", () => {
    API.redo();
    clearSelection();
    renderBoard();
    renderHistory();
  });

  btnFlip && btnFlip.addEventListener("click", () => {
    flipped = !flipped;
    board.classList.toggle("flip", flipped);
  });

  // Pilih mode
  function setModeUI(mode) {
    API.setMode && API.setMode(mode === "ai" ? "ai" : "human");
    if (btnHuman) btnHuman.classList.toggle("active", mode === "human");
    if (btnAI) btnAI.classList.toggle("active", mode === "ai");
    clearSelection();
    renderBoard();
    renderHistory();
    if (mode === "ai") {
      // biar AI jalan kalau gilirannya AI
      setTimeout(() => {
        API.aiIfNeeded && API.aiIfNeeded();
        renderBoard();
        renderHistory();
      }, 120);
    }
  }
  btnHuman && btnHuman.addEventListener("click", () => setModeUI("human"));
  btnAI && btnAI.addEventListener("click", () => setModeUI("ai"));

  // Board only / Back (opsional, tergantung kebutuhan halaman)
  btnBoardOnly &&
    btnBoardOnly.addEventListener("click", () => {
      app.classList.toggle("board-only");
    });
  btnBack &&
    btnBack.addEventListener("click", () => {
      if (history.length > 1) history.back();
    });

  // Klik di papan
  board.addEventListener("click", onSquareClick);

  // ---------- Init pertama ----------
  try {
    // beberapa engine butuh init dulu
    API.reset();
  } catch (e) {
    /* ignore */
  }
  clearSelection();
  renderBoard();
  renderHistory();
})();
