// ================================
//  AZBRY CHESS UI
// ================================

import { initializeGame, movePiece, getValidMoves, isCheckmate, resetGame } from "./chess-engine.js";

let boardEl;
let selectedSquare = null;
let gameState;

export function initUI() {
  boardEl = document.getElementById("board");
  createBoard();
  newGame();

  document.getElementById("btnReset").addEventListener("click", newGame);
  document.getElementById("btnUndo").addEventListener("click", undoMove);
  document.getElementById("btnRedo").addEventListener("click", redoMove);
}

function createBoard() {
  boardEl.innerHTML = "";
  const ranks = 8;
  const files = 8;

  for (let rank = ranks; rank >= 1; rank--) {
    for (let file = 0; file < files; file++) {
      const square = document.createElement("div");
      square.classList.add("square");
      const isDark = (rank + file) % 2 === 1;
      square.classList.add(isDark ? "dark" : "light");
      square.dataset.pos = String.fromCharCode(97 + file) + rank;
      square.addEventListener("click", onSquareClick);
      boardEl.appendChild(square);
    }
  }
}

function renderBoard() {
  const squares = document.querySelectorAll(".square");
  squares.forEach((sq) => {
    const piece = gameState.board[sq.dataset.pos];
    sq.innerHTML = piece ? `<span class="piece">${piece.symbol}</span>` : "";
  });
}

function onSquareClick(e) {
  const pos = e.currentTarget.dataset.pos;
  if (selectedSquare) {
    if (selectedSquare === pos) {
      selectedSquare = null;
      clearHighlights();
      return;
    }

    const moveResult = movePiece(gameState, selectedSquare, pos);
    if (moveResult.valid) {
      renderBoard();
      updateHistory();
      if (isCheckmate(gameState)) {
        showResult(`${gameState.turn === "w" ? "Hitam" : "Putih"} Menang!`);
      }
    }
    selectedSquare = null;
    clearHighlights();
  } else {
    const validMoves = getValidMoves(gameState, pos);
    if (validMoves.length > 0) {
      selectedSquare = pos;
      highlightSquares(validMoves);
    }
  }
}

function highlightSquares(moves) {
  clearHighlights();
  moves.forEach((m) => {
    const sq = document.querySelector(`[data-pos="${m}"]`);
    if (sq) sq.classList.add("highlight");
  });
}

function clearHighlights() {
  document.querySelectorAll(".square").forEach((sq) => sq.classList.remove("highlight"));
}

function updateHistory() {
  const moveText = gameState.history
    .map((m, i) => `${i + 1}. ${m.from} → ${m.to}`)
    .join("\n");
  document.getElementById("moveHistory").innerText = moveText || "-";
}

function showResult(text) {
  alert(text);
  newGame();
}

function newGame() {
  gameState = initializeGame();
  renderBoard();
  selectedSquare = null;
  updateHistory();
}

function undoMove() {
  if (gameState.undo()) {
    renderBoard();
    updateHistory();
  }
}

function redoMove() {
  if (gameState.redo()) {
    renderBoard();
    updateHistory();
  }
}

document.addEventListener("DOMContentLoaded", initUI);
