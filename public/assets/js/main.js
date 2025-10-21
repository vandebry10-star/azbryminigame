/* AZBRY CHESS – MAIN FINAL FIX (2025)
   Perbaikan:
   - AI gak langsung stalemate
   - Deteksi checkmate & seri valid
   - Undo/Redo/BoardOnly tetap jalan
*/

(() => {
  window.currentTurnColor = "white";
  let mode = "human";
  const aiColor = "black";
  let gameOver = false;

  const H = [], R = [];
  const logEl = document.getElementById("moveHistory");
  const board = () => window.boardState;
  const clone = (b) => b.map((r) => r.map((p) => (p ? { ...p } : null)));
  const file = (i) => String.fromCharCode(97 + i);
  const rank = (j) => 8 - j;
  const alg = ([fx, fy], [tx, ty]) => `${file(fx)}${rank(fy)} → ${file(tx)}${rank(ty)}`;

  const renderLog = () => {
    if (!logEl) return;
    logEl.textContent = H.length
      ? H.map((h, i) => `${i + 1}. ${h.note}`).join("\n")
      : "—";
  };

  function toast(msg) {
    let el = document.getElementById("resultModal");
    if (!el) {
      el = document.createElement("div");
      el.id = "resultModal";
      el.style.cssText =
        "position:fixed;left:50%;transform:translateX(-50%);bottom:20px;background:#202225;color:#9BE27A;padding:10px 14px;border-radius:10px;z-index:9999";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = "block";
    setTimeout(() => (el.style.display = "none"), 1300);
  }

  function showResult(msg) {
    const wrap = document.createElement("div");
    wrap.className = "az-overlay";
    wrap.innerHTML = `
      <div class="az-box">
        <h3>${msg}</h3>
        <button id="azReload" class="btn accent">Main Lagi</button>
      </div>`;
    document.body.appendChild(wrap);
    document.getElementById("azReload").onclick = () => {
      wrap.remove();
      resetGame();
    };
  }

  const resetGame = () => {
    window.initBoard();
    window.currentTurnColor = "white";
    H.length = 0;
    R.length = 0;
    gameOver = false;
    window.UIChess?.rebuild();
    renderLog();
  };

  const inCheck = (color) =>
    window.isKingInCheck
      ? window.isKingInCheck(color)
      : !!window.getGameStatus?.(color)?.check;

  const allMoves = (color) => {
    const moves = [];
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const p = board()[y][x];
        if (p && p.color === color) {
          (window.getLegalMoves(x, y) || []).forEach(([tx, ty]) =>
            moves.push({ from: [x, y], to: [tx, ty] })
          );
        }
      }
    return moves;
  };

  const sideStatus = (color) => {
    const moves = allMoves(color);
    if (moves.length > 0) return "play";
    return inCheck(color) ? "mate" : "stalemate";
  };

  function onMove(from, to, prev) {
    const note = alg(from, to);
    H.push({ prev, next: clone(board()), note });
    R.length = 0;
    renderLog();

    const nextSide = window.currentTurnColor === "white" ? "black" : "white";
    const state = sideStatus(nextSide);

    if (state === "mate") {
      gameOver = true;
      const winner = nextSide === "white" ? "Hitam" : "Putih";
      showResult(`${winner} menang (Checkmate)!`);
      return;
    }
    if (state === "stalemate") {
      gameOver = true;
      showResult("Seri (Stalemate).");
      return;
    }
    if (inCheck(nextSide)) toast("Check!");

    window.currentTurnColor = nextSide;
    if (mode === "ai" && !gameOver && nextSide === aiColor) aiMove();
  }

  window.onMoveApplied = (from, to, prev) => onMove(from, to, prev);

  // ---- AI ----
  const val = { P: 100, N: 300, B: 320, R: 500, Q: 900, K: 9999 };
  const score = (b, c) => {
    let s = 0;
    b.forEach((r) =>
      r.forEach((p) => {
        if (!p) return;
        s += p.color === c ? val[p.type.toUpperCase()] : -val[p.type.toUpperCase()];
      })
    );
    return s;
  };

  const pickMove = (color) => {
    let best = null,
      bestS = -1e9;
    for (const mv of allMoves(color)) {
      const tmp = clone(board());
      const ok = window.makeMove(mv.from, mv.to, color);
      if (!ok) {
        window.boardState = tmp;
        continue;
      }
      const s = score(board(), color);
      if (s > bestS) (bestS = s), (best = mv);
      window.boardState = tmp;
    }
    return best;
  };

  const aiMove = () => {
    const mv = pickMove(aiColor);
    if (!mv) {
      const s = sideStatus(aiColor);
      if (s === "mate") showResult("Putih menang (Checkmate)");
      else showResult("Seri.");
      return;
    }
    const prev = clone(board());
    window.makeMove(mv.from, mv.to, aiColor);
    onMove(mv.from, mv.to, prev);
  };

  // ---- Tombol ----
  document.getElementById("btnReset")?.addEventListener("click", resetGame);
  document.getElementById("btnUndo")?.addEventListener("click", () => {
    if (!H.length) return;
    const last = H.pop();
    R.push({ prev: clone(board()), next: clone(last.next), note: last.note });
    window.boardState = clone(last.prev);
    window.currentTurnColor = window.currentTurnColor === "white" ? "black" : "white";
    window.UIChess?.render();
    renderLog();
  });
  document.getElementById("btnRedo")?.addEventListener("click", () => {
    if (!R.length) return;
    const step = R.pop();
    H.push(step);
    window.boardState = clone(step.next);
    window.currentTurnColor = window.currentTurnColor === "white" ? "black" : "white";
    window.UIChess?.render();
    renderLog();
  });
  document.getElementById("btnFlip")?.addEventListener("click", () =>
    document.getElementById("board")?.classList.toggle("flip")
  );
  document.getElementById("btnBoardOnly")?.addEventListener("click", () =>
    document.querySelector(".panel")?.classList.toggle("hidden")
  );
  document.getElementById("btnBack")?.addEventListener("click", resetGame);
  document.getElementById("modeHuman")?.addEventListener("click", () => {
    mode = "human";
    document.getElementById("modeAI")?.classList.remove("active");
    document.getElementById("modeHuman")?.classList.add("active");
  });
  document.getElementById("modeAI")?.addEventListener("click", () => {
    mode = "ai";
    document.getElementById("modeHuman")?.classList.remove("active");
    document.getElementById("modeAI")?.classList.add("active");
  });

  // ---- Init ----
  if (!window.boardState?.length) window.initBoard?.();
  window.UIChess?.rebuild();
  renderLog();
})();
