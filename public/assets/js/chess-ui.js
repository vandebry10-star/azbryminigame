/* =====================================================
   Azbry Chess UI Controller
   Menghubungkan HTML dengan ChessEngine.
   ===================================================== */

window.ChessUI = (function () {
  const board = document.getElementById("board");
  const moveHistory = document.getElementById("moveHistory");
  const btnReset = document.getElementById("btnReset");
  const btnUndo = document.getElementById("btnUndo");
  const btnRedo = document.getElementById("btnRedo");
  const btnFlip = document.getElementById("btnFlip");
  const btnBoardOnly = document.getElementById("btnBoardOnly");
  const btnBack = document.getElementById("btnBack");
  const modeHuman = document.getElementById("modeHuman");
  const modeAI = document.getElementById("modeAI");

  let flipped = false;
  let selected = null;

  // simbol catur (unicode)
  const PIECES = {
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟︎" },
  };

  // generate papan 8x8
  function drawBoard() {
    board.innerHTML = "";
    for (let i = 0; i < 64; i++) {
      const square = document.createElement("div");
      square.className = "square";
      square.dataset.index = i;
      const x = i % 8;
      const y = Math.floor(i / 8);
      square.classList.add((x + y) % 2 === 0 ? "light" : "dark");
      square.addEventListener("click", onSquareClick);
      board.appendChild(square);
    }
    render();
  }

  // render isi papan
  function render() {
    const state = ChessEngine.getState();
    const cells = board.querySelectorAll(".square");
    const grid = state.board;

    grid.forEach((piece, i) => {
      const sq = cells[flipped ? 63 - i : i];
      sq.innerHTML = "";
      sq.classList.remove("selected");
      if (piece) {
        const c = piece[0];
        const t = piece[1];
        sq.textContent = PIECES[c][t];
        sq.classList.add(c === "w" ? "white-piece" : "black-piece");
      }
    });

    // update move log
    if (moveHistory) {
      moveHistory.textContent =
        state.history.length > 0
          ? state.history
              .map(
                (m, idx) =>
                  `${idx + 1}. ${indexToSquare(m.from)} - ${indexToSquare(m.to)}`
              )
              .join("\n")
          : "—";
    }
  }

  // event klik petak
  function onSquareClick(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    const realIdx = flipped ? 63 - idx : idx;

    if (selected === null) {
      const moves = ChessEngine.movesFrom(realIdx);
      if (moves.length > 0) {
        selected = realIdx;
        highlightMoves(moves);
      }
    } else {
      const moved = ChessEngine.move(selected, realIdx);
      clearHighlights();
      selected = null;
      if (moved) {
        render();
        // cek status
        if (ChessEngine.isCheckmate()) showResult("Checkmate!");
        else if (ChessEngine.isStalemate()) showResult("Stalemate!");
        else if (ChessEngine.getMode() === "ai") {
          setTimeout(() => {
            ChessEngine.aiMoveIfNeeded();
            render();
            if (ChessEngine.isCheckmate()) showResult("Kalah! Checkmate!");
          }, 600);
        }
      }
    }
  }

  // highlight langkah
  function highlightMoves(list) {
    clearHighlights();
    const cells = board.querySelectorAll(".square");
    list.forEach((i) => {
      const sq = cells[flipped ? 63 - i : i];
      sq.classList.add("highlight");
    });
  }
  function clearHighlights() {
    board.querySelectorAll(".highlight").forEach((sq) => sq.classList.remove("highlight"));
  }

  // ubah index ke koordinat (mis. 0 -> a8)
  function indexToSquare(i) {
    const files = "abcdefgh";
    const rank = 8 - Math.floor(i / 8);
    const file = files[i % 8];
    return `${file}${rank}`;
  }

  // tombol event
  btnReset.addEventListener("click", () => {
    ChessEngine.reset();
    render();
  });
  btnUndo.addEventListener("click", () => {
    ChessEngine.undo();
    render();
  });
  btnRedo.addEventListener("click", () => {
    ChessEngine.redo();
    render();
  });
  btnFlip.addEventListener("click", () => {
    flipped = !flipped;
    render();
  });
  btnBoardOnly.addEventListener("click", () => {
    document.body.classList.toggle("board-only");
  });
  btnBack.addEventListener("click", () => {
    document.body.classList.remove("board-only");
  });

  // mode pilihan
  modeHuman.addEventListener("click", () => {
    ChessEngine.setMode("human");
    modeHuman.classList.add("active");
    modeAI.classList.remove("active");
    ChessEngine.reset();
    render();
  });
  modeAI.addEventListener("click", () => {
    ChessEngine.setMode("ai");
    modeAI.classList.add("active");
    modeHuman.classList.remove("active");
    ChessEngine.reset();
    render();
  });

  // tampilkan hasil checkmate / stalemate
  function showResult(msg) {
    const modal = document.getElementById("resultModal");
    if (!modal) return;
    modal.textContent = msg;
    modal.classList.add("show");
    setTimeout(() => modal.classList.remove("show"), 2500);
  }

  // public init
  function init() {
    drawBoard();
    render();
  }

  return { init, render };
})();

// auto init setelah DOM siap
window.addEventListener("DOMContentLoaded", () => {
  if (window.ChessUI) ChessUI.init();
});
