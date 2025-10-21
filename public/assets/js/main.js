// ===================== AZBRY CHESS - MAIN FINAL FIX =====================
document.addEventListener("DOMContentLoaded", () => {
  const boardEl = document.getElementById("board");
  if (!boardEl) return console.error("Board element not found!");

  const moveList = document.getElementById("move-list");
  const btnFlip = document.getElementById("flip");
  const btnReload = document.getElementById("reload");

  // engine & UI
  const game = new Chess();
  const ui = new ChessUI(boardEl, (sq) => onSquareClick(sq));

  let selected = null;
  ui.render(game.board());

  // ======== UTILS ========
  function sync() {
    ui.render(game.board(), {
      lastMove: game.history().slice(-1)[0],
      legal: selected ? game.moves({ square: selected, verbose: true }).map(m => m.to) : [],
    });
    moveList.innerHTML =
      game.history().length > 0
        ? game.history().map((m, i) => `${i + 1}. ${m}`).join("<br>")
        : "_";
  }

  function reset() {
    game.reset();
    selected = null;
    sync();
  }

  function flipBoard() {
    ui.toggleFlip();
    sync();
  }

  // ======== EVENT HANDLERS ========
  function onSquareClick(sq) {
    const moves = game.moves({ square: sq, verbose: true });
    if (selected && moves.find(m => m.from === selected && m.to === sq)) {
      game.move({ from: selected, to: sq, promotion: "q" });
      selected = null;
      sync();
      return;
    }

    if (moves.length > 0) selected = sq;
    else selected = null;
    sync();
  }

  btnReload?.addEventListener("click", reset);
  btnFlip?.addEventListener("click", flipBoard);

  // ======== INIT ========
  sync();
  console.log("%cAzbry Chess Ready ✓", "color:#9f9;font-weight:700");
});
