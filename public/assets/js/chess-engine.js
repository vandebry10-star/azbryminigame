/* =====================================================
   Azbry Chess — Chess Engine
   Mengatur logika catur, giliran, langkah, undo/redo,
   check & checkmate dasar.
   ===================================================== */

window.ChessEngine = (function () {
  let board = [];
  let history = [];
  let future = [];
  let currentTurn = "w";
  let mode = "human";
  let gameOver = false;

  // posisi awal
  const START_FEN =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

  function reset() {
    board = parseFEN(START_FEN);
    history = [];
    future = [];
    currentTurn = "w";
    gameOver = false;
  }

  function parseFEN(fen) {
    const rows = fen.split("/");
    const arr = [];
    for (const row of rows) {
      for (const c of row) {
        if (!isNaN(c)) {
          for (let i = 0; i < parseInt(c); i++) arr.push(null);
        } else {
          const color = c === c.toUpperCase() ? "w" : "b";
          arr.push(color + c.toLowerCase());
        }
      }
    }
    return arr;
  }

  function getState() {
    return {
      board: [...board],
      history: [...history],
      turn: currentTurn,
      mode,
      gameOver,
    };
  }

  function setMode(m) {
    mode = m;
  }

  // fungsi legal move basic
  function movesFrom(index) {
    if (gameOver) return [];
    const piece = board[index];
    if (!piece || piece[0] !== currentTurn) return [];
    const type = piece[1];
    const moves = [];

    const dirs = {
      p: currentTurn === "w" ? -8 : 8,
      n: [-17, -15, -10, -6, 6, 10, 15, 17],
      b: [-9, -7, 7, 9],
      r: [-8, -1, 1, 8],
      q: [-9, -8, -7, -1, 1, 7, 8, 9],
      k: [-9, -8, -7, -1, 1, 7, 8, 9],
    };

    const isInside = (i) => i >= 0 && i < 64;

    const file = index % 8;
    const rank = Math.floor(index / 8);

    const pushIfValid = (target) => {
      if (!isInside(target)) return;
      const diffFile = Math.abs((target % 8) - file);
      const diffRank = Math.abs(Math.floor(target / 8) - rank);
      if (diffFile > 2 || diffRank > 2) return;
      const t = board[target];
      if (!t || t[0] !== currentTurn) moves.push(target);
    };

    if (type === "p") {
      const dir = dirs.p;
      const oneStep = index + dir;
      if (isInside(oneStep) && !board[oneStep]) moves.push(oneStep);
      const startRank = currentTurn === "w" ? 6 : 1;
      const twoStep = index + dir * 2;
      if (rank === startRank && !board[oneStep] && !board[twoStep])
        moves.push(twoStep);
      const attacks = [dir - 1, dir + 1];
      for (const atk of attacks) {
        const target = index + atk;
        if (isInside(target) && board[target] && board[target][0] !== currentTurn)
          moves.push(target);
      }
    } else if (type === "n") {
      for (const d of dirs.n) {
        const t = index + d;
        if (isInside(t)) {
          const p = board[t];
          if (!p || p[0] !== currentTurn) moves.push(t);
        }
      }
    } else if (type === "b" || type === "r" || type === "q") {
      const checkDirs =
        type === "b" ? dirs.b : type === "r" ? dirs.r : dirs.q;
      for (const d of checkDirs) {
        let t = index + d;
        while (isInside(t)) {
          const diffF = Math.abs((t % 8) - file);
          if (diffF > 7) break;
          const p = board[t];
          if (!p) moves.push(t);
          else {
            if (p[0] !== currentTurn) moves.push(t);
            break;
          }
          if (Math.abs(d) === 1 && Math.floor(t / 8) !== rank)
            break; // horizontal batas
          t += d;
        }
      }
    } else if (type === "k") {
      for (const d of dirs.k) {
        const t = index + d;
        if (isInside(t)) {
          const p = board[t];
          if (!p || p[0] !== currentTurn) moves.push(t);
        }
      }
    }

    return moves;
  }

  function move(from, to) {
    if (gameOver) return false;
    const moves = movesFrom(from);
    if (!moves.includes(to)) return false;

    history.push({ from, to, piece: board[from], capture: board[to] });
    future = [];

    board[to] = board[from];
    board[from] = null;

    // ganti giliran
    currentTurn = currentTurn === "w" ? "b" : "w";

    checkEndGame();
    return true;
  }

  function undo() {
    const last = history.pop();
    if (!last) return;
    board[last.from] = last.piece;
    board[last.to] = last.capture || null;
    future.push(last);
    currentTurn = last.piece[0];
    gameOver = false;
  }

  function redo() {
    const next = future.pop();
    if (!next) return;
    board[next.to] = next.piece;
    board[next.from] = null;
    history.push(next);
    currentTurn = next.piece[0] === "w" ? "b" : "w";
  }

  function aiMoveIfNeeded() {
    if (mode !== "ai" || currentTurn !== "b" || gameOver) return;
    // langkah random AI sederhana
    const allMoves = [];
    for (let i = 0; i < 64; i++) {
      const piece = board[i];
      if (piece && piece[0] === "b") {
        const mv = movesFrom(i);
        mv.forEach((m) => allMoves.push({ from: i, to: m }));
      }
    }
    if (allMoves.length === 0) {
      checkEndGame();
      return;
    }
    const randomMove = allMoves[Math.floor(Math.random() * allMoves.length)];
    move(randomMove.from, randomMove.to);
  }

  function checkEndGame() {
    // checkmate basic
    const movesAvailable = [];
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (p && p[0] === currentTurn) {
        if (movesFrom(i).length > 0) movesAvailable.push(true);
      }
    }
    if (movesAvailable.length === 0) gameOver = true;
  }

  function isCheckmate() {
    return gameOver;
  }

  function isStalemate() {
    return false;
  }

  // inisialisasi awal
  reset();

  return {
    getState,
    movesFrom,
    move,
    reset,
    undo,
    redo,
    setMode,
    getMode: () => mode,
    aiMoveIfNeeded,
    isCheckmate,
    isStalemate,
  };
})();
