/* ==== AZBRY CHESS UI FIXED ==== */

// Elemen papan
const boardEl = document.getElementById("board");
const moveHistoryEl = document.getElementById("moveHistory");

let selectedSquare = null;
let currentPlayer = "white";
let movesHistory = [];

// Warna highlight langkah
const HIGHLIGHT_COLOR = "rgba(0,255,140,0.25)";

// Fungsi buat render papan dari state
function renderBoard(boardState) {
  boardEl.innerHTML = "";

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const square = document.createElement("div");
      square.classList.add("square");

      // warna kotak
      if ((x + y) % 2 === 0) square.classList.add("light");
      else square.classList.add("dark");

      const piece = boardState[y][x];
      if (piece) {
        square.textContent = piece.symbol;
        square.dataset.color = piece.color;
        square.dataset.type = piece.type;
      }

      square.dataset.x = x;
      square.dataset.y = y;
      boardEl.appendChild(square);
    }
  }
}

// Fungsi buat highlight kotak
function highlightSquare(square) {
  square.style.boxShadow = `inset 0 0 12px ${HIGHLIGHT_COLOR}`;
}

function clearHighlights() {
  document.querySelectorAll(".square").forEach((sq) => {
    sq.style.boxShadow = "";
  });
}

// Mendapatkan langkah valid dari engine
function getValidMoves(x, y) {
  if (typeof getLegalMoves === "function") {
    return getLegalMoves(x, y); // dari chess-engine.js
  }
  return [];
}

// Event klik di papan
boardEl.addEventListener("click", (e) => {
  const square = e.target.closest(".square");
  if (!square) return;

  const x = parseInt(square.dataset.x);
  const y = parseInt(square.dataset.y);

  const pieceColor = square.dataset.color;

  // Klik pertama: pilih bidak
  if (!selectedSquare && pieceColor === currentPlayer) {
    selectedSquare = square;
    clearHighlights();
    highlightSquare(square);

    // tampilkan langkah valid
    const moves = getValidMoves(x, y);
    moves.forEach(([mx, my]) => {
      const moveSq = document.querySelector(
        `.square[data-x="${mx}"][data-y="${my}"]`
      );
      if (moveSq) moveSq.classList.add("highlight");
    });
  }
  // Klik kedua: pindahkan
  else if (selectedSquare && square !== selectedSquare) {
    const from = [parseInt(selectedSquare.dataset.x), parseInt(selectedSquare.dataset.y)];
    const to = [x, y];

    if (typeof makeMove === "function" && makeMove(from, to, currentPlayer)) {
      movesHistory.push(`${selectedSquare.textContent} ${String.fromCharCode(97 + from[0])}${8 - from[1]} → ${String.fromCharCode(97 + to[0])}${8 - to[1]}`);
      updateHistory();
      currentPlayer = currentPlayer === "white" ? "black" : "white";
      renderBoard(boardState);
    }
    clearHighlights();
    selectedSquare = null;
  } else {
    clearHighlights();
    selectedSquare = null;
  }
});

// Update riwayat langkah
function updateHistory() {
  moveHistoryEl.textContent = movesHistory.join("\n");
}

// Inisialisasi awal
if (typeof initBoard === "function") {
  initBoard();
  renderBoard(boardState);
}
