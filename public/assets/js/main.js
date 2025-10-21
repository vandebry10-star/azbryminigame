/* ===== Azbry Chess Main (final) =====
   Glue antara engine & UI.
   Butuh chess-engine.js expose object ChessEngine dengan:
   - initialPosition() -> array 64 ("", "wP", ...)
   - generateMoves(pos, side) -> array {from, to}
   - legalMoves(pos, side, from) -> array toIndex (optional; fallback filter)
   - makeMove(pos, move) -> { next, captured?:string, promo?:string }
   - isCheck(pos, side) -> bool
   - isCheckmate(pos, side) -> bool
   - isStalemate(pos, side) -> bool
   - bestMove(pos, side, depth) -> {from,to}  (AI)
*/

(function () {
  const $ = (s) => document.querySelector(s);
  const boardEl = $("#board");
  const btnHuman = $("#modeHuman");
  const btnAI    = $("#modeAI");
  const btnReset = $("#btnReset");
  const btnUndo  = $("#btnUndo");
  const btnRedo  = $("#btnRedo");
  const btnFlip  = $("#btnFlip");
  const moveLog  = $("#moveHistory");

  // Safety engine object
  const E = (window.ChessEngine || window.Engine || {});
  const have = (k) => typeof E[k] === "function";

  // State
  let pos = have("initialPosition") ? E.initialPosition() : new Array(64).fill("");
  let whiteToMove = true;
  let mode = "human"; // 'human' | 'ai'
  let selected = null;
  let legalTargets = [];
  let lastMove = null;
  const undoStack = [];
  const redoStack = [];

  // UI
  const UI = new window.AzChessUI({
    boardEl,
    onSquareClick: handleSquareClick,
  });

  // ===== INIT =====
  render();

  // ===== EVENTS =====
  if (btnHuman) btnHuman.onclick = () => setMode("human");
  if (btnAI)    btnAI.onclick    = () => setMode("ai");
  if (btnReset) btnReset.onclick = () => resetGame();
  if (btnUndo)  btnUndo.onclick  = () => doUndo();
  if (btnRedo)  btnRedo.onclick  = () => doRedo();
  if (btnFlip)  btnFlip.onclick  = () => { UI.flip(); render(); };

  function setMode(m) {
    mode = m;
    btnHuman?.classList.toggle("active", mode === "human");
    btnAI?.classList.toggle("active", mode === "ai");
    resetGame();
  }

  function resetGame() {
    pos = have("initialPosition") ? E.initialPosition() : new Array(64).fill("");
    whiteToMove = true;
    selected = null;
    legalTargets = [];
    lastMove = null;
    undoStack.length = 0;
    redoStack.length = 0;
    moveLog.textContent = "_";
    render();
  }

  function render() {
    UI.render(pos, { lastMove, legal: legalTargets });
    if (selected != null) UI.markSource(selected);
    updateButtons();
  }

  function updateButtons() {
    btnUndo && (btnUndo.disabled = undoStack.length === 0);
    btnRedo && (btnRedo.disabled = redoStack.length === 0);
  }

  function sideStr() { return whiteToMove ? "w" : "b"; }

  function handleSquareClick(idxDom) {
    // Map balik index jika papan di-flip
    const idx = UI.flipped ? 63 - idxDom : idxDom;
    const piece = pos[idx];

    // Jika sedang memilih sumber
    if (selected == null) {
      if (!piece || piece[0] !== sideStr()) return; // hanya bidak sisi aktif
      selected = idx;
      legalTargets = getLegalTargets(idx);
      render();
      return;
    }

    // Klik kotak yang sama: batal
    if (idx === selected) {
      selected = null;
      legalTargets = [];
      render();
      return;
    }

    // Jika klik target legal -> lakukan langkah
    if (legalTargets.includes(idx)) {
      makeMove({ from: selected, to: idx });
      selected = null;
      legalTargets = [];
      render();
      // Jika mode AI dan game belum selesai -> giliran AI
      if (mode === "ai") {
        setTimeout(aiMove, 250);
      }
      return;
    }

    // Kalau klik piece sisi aktif lain -> ganti selection
    if (piece && piece[0] === sideStr()) {
      selected = idx;
      legalTargets = getLegalTargets(idx);
      render();
      return;
    }

    // Selain itu, reset selection
    selected = null;
    legalTargets = [];
    render();
  }

  function getLegalTargets(from) {
    if (have("legalMoves")) {
      return E.legalMoves(pos, sideStr(), from) || [];
    }
    // Fallback: generateMoves lalu filter from
    if (have("generateMoves")) {
      const gen = E.generateMoves(pos, sideStr()) || [];
      return gen.filter(m => m.from === from).map(m => m.to);
    }
    return [];
  }

  function makeMove(m) {
    // Simpan untuk undo
    undoStack.push({ pos: pos.slice(), white: whiteToMove, lastMove });
    redoStack.length = 0;

    const res = have("makeMove") ? E.makeMove(pos, m) : null;
    if (res && res.next) pos = res.next;
    else {
      // fallback manual (sederhana)
      pos[m.to] = pos[m.from];
      pos[m.from] = "";
    }

    whiteToMove = !whiteToMove;
    lastMove = { from: m.from, to: m.to };
    appendMoveLog(m);

    // Cek endgame
    if (have("isCheckmate") && E.isCheckmate(pos, sideStr())) {
      UI.toast(`${whiteToMove ? "Hitam" : "Putih"} skakmat!`);
    } else if (have("isStalemate") && E.isStalemate(pos, sideStr())) {
      UI.toast("Seri (Stalemate)");
    }
  }

  function doUndo() {
    if (!undoStack.length) return;
    const s = undoStack.pop();
    redoStack.push({ pos: pos.slice(), white: whiteToMove, lastMove });
    pos = s.pos.slice();
    whiteToMove = s.white;
    lastMove = s.lastMove || null;
    selected = null;
    legalTargets = [];
    render();
    trimLastPlyFromLog();
  }

  function doRedo() {
    if (!redoStack.length) return;
    const s = redoStack.pop();
    undoStack.push({ pos: pos.slice(), white: whiteToMove, lastMove });
    pos = s.pos.slice();
    whiteToMove = s.white;
    lastMove = s.lastMove || null;
    render();
  }

  function aiMove() {
    // Kalau sudah selesai, jangan gerak
    if (have("isCheckmate") && E.isCheckmate(pos, sideStr())) return;
    if (have("isStalemate") && E.isStalemate(pos, sideStr())) return;

    let mv = null;
    if (have("bestMove")) {
      mv = E.bestMove(pos, sideStr(), 2);
    } else if (have("generateMoves")) {
      const moves = E.generateMoves(pos, sideStr());
      if (moves && moves.length) mv = moves[Math.floor(Math.random() * moves.length)];
    }
    if (!mv) {
      UI.toast("Seri");
      return;
    }
    makeMove(mv);
  }

  function squareName(i) {
    const file = "abcdefgh"[i % 8];
    const rank = 8 - Math.floor(i / 8);
    return file + rank;
  }

  function appendMoveLog(m) {
    const s = `${squareName(m.from)} → ${squareName(m.to)}`;
    if (moveLog.textContent.trim() === "_" || moveLog.textContent.trim() === "") {
      moveLog.textContent = s;
    } else {
      moveLog.textContent += "\n" + s;
    }
  }

  function trimLastPlyFromLog() {
    const lines = moveLog.textContent.split("\n").filter(Boolean);
    lines.pop();
    moveLog.textContent = lines.length ? lines.join("\n") : "_";
  }

  // Ekspor buat debug
  window.__AZ_CHESS__ = {
    get pos() { return pos.slice(); },
    render, resetGame, setMode
  };
})();
