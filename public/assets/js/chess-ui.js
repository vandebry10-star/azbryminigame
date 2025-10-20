/* Azbry Chess UI — render papan, kontrol, mode, riwayat, modal */
(function () {
  // ===== Helper DOM =====
  const $ = (id) => document.getElementById(id);

  const boardEl = $("board");
  const grid = $("grid") || (function () {
    const g = document.createElement("div");
    g.id = "grid";
    g.className = "grid";
    boardEl && boardEl.appendChild(g);
    return g;
  })();

  const btnHuman = $("modeHuman");
  const btnAI = $("modeAI");

  const btnReset = $("btnReset");
  const btnUndo = $("btnUndo");
  const btnRedo = $("btnRedo");
  const btnFlip = $("btnFlip");

  const btnBoardOnly = $("btnBoardOnly");
  const btnBack = $("btnBack");

  const histEl = $("moveHistory");

  // Modal (fallback jika belum ada di HTML)
  let modal = $("modal"),
      mTitle = $("mTitle"),
      mDesc = $("mDesc"),
      mRestart = $("mRestart"),
      mClose = $("mClose");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal";
    modal.style.cssText = "position:fixed;inset:0;display:none;place-items:center;background:rgba(0,0,0,.45);z-index:9999";
    modal.innerHTML =
      '<div class="card" style="background:#0f1418;border:1px solid rgba(255,255,255,.08);padding:16px 18px;border-radius:16px;min-width:260px;text-align:center">' +
      '<h3 id="mTitle" style="margin:.2rem 0 .4rem">Hasil</h3>' +
      '<p id="mDesc" style="opacity:.8;margin:.25rem 0 1rem">—</p>' +
      '<div style="display:flex;gap:10px;justify-content:center">' +
      '<button id="mRestart" class="btn accent">Mulai Ulang</button>' +
      '<button id="mClose" class="btn">Tutup</button>' +
      "</div></div>";
    document.body.appendChild(modal);
    mTitle = $("mTitle"); mDesc = $("mDesc"); mRestart = $("mRestart"); mClose = $("mClose");
  }

  // ===== Game state =====
  let game = new AzChess();      // dari chess-engine.js
  let vsAI = false;              // false: vs Human, true: vs Azbry-MD
  let selected = null;           // kotak terpilih, ex: "e2"

  const PIECE = {
    w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
    b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
  };

  // Algebra <-> Index (UI)
  const a2i = (a) => [8 - parseInt(a[1], 10), a.charCodeAt(0) - 97];
  const i2a = (r, c) => String.fromCharCode(97 + c) + (8 - r);
  function pieceAt(a){ const [r,c]=a2i(a); return game.s.b[r][c]; }

  // ===== Render papan =====
  function renderBoard() {
    if (!boardEl) return;
    grid.innerHTML = "";
    const s = game.s;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement("div");
        cell.className = "sq";
        const a = i2a(r, c);
        cell.dataset.square = a;

        const P = s.b[r][c];
        if (P) {
          cell.innerHTML = `<div>${PIECE[P.c][P.t]}</div>`;
          if (boardEl.classList.contains("flip")) {
            cell.firstChild.style.transform = "rotate(180deg)";
          }
        }
        grid.appendChild(cell);
      }
    }

    const end = game.isGameOver();
    if (end) {
      const winner = game.turn()==="w" ? "Hitam" : "Putih"; // side to move no legal -> lawan menang
      showResult(end==="checkmate" ? `Checkmate — ${winner} menang!` : "Stalemate — Seri.");
    }
    updateHistory();
  }

  // ===== Riwayat langkah =====
  function updateHistory() {
    if (!histEl) return;
    const mv = game.hist;
    if (!mv.length) { histEl.textContent = "_"; return; }
    let out = "", n = 1;
    for (let i = 0; i < mv.length; i += 2) {
      const w = mv[i] ? `${mv[i].from}→${mv[i].to}` : "";
      const b = mv[i+1] ? `${mv[i+1].from}→${mv[i+1].to}` : "";
      out += `${n}. ${w}  ${b}\n`; n++;
    }
    histEl.textContent = out.trim();
    histEl.scrollTop = histEl.scrollHeight;
  }

  // ===== Highlight legal =====
  function clearMarks() {
    grid.querySelectorAll(".dot,.cap").forEach(n=>n.remove());
    grid.querySelectorAll(".sq.sel").forEach(n=>n.classList.remove("sel"));
  }
  function highlightMoves(from) {
    clearMarks();
    const src = grid.querySelector(`[data-square="${from}"]`);
    if (src) src.classList.add("sel");
    const legal = game.legal().filter(m=>m.from===from);
    for (const mv of legal) {
      const el = grid.querySelector(`[data-square="${mv.to}"]`);
      if (!el) continue;
      const mark = document.createElement("div");
      if (mv.cap) {
        mark.className = "cap";
        mark.style.borderRadius = "12px";
        mark.style.inset = "6px";
        mark.style.position = "absolute";
        mark.style.border = "3px solid rgba(184,255,154,.65)";
      } else {
        mark.className = "dot";
        mark.style.width = "14px";
        mark.style.height = "14px";
        mark.style.borderRadius = "50%";
        mark.style.background = "rgba(184,255,154,.65)";
        mark.style.boxShadow = "0 0 16px rgba(184,255,154,.6)";
        mark.style.margin = "auto";
      }
      el.appendChild(mark);
    }
  }

  // ===== Interaksi papan =====
  grid.addEventListener("click", (e) => {
    const cell = e.target.closest(".sq"); if (!cell) return;
    const sq = cell.dataset.square;
    const P = pieceAt(sq);

    if (selected && sq !== selected) {
      const moved = game.move({ from: selected, to: sq });
      selected = null; clearMarks(); renderBoard();

      if (moved && vsAI && game.turn()==="b" && !game.isGameOver()) {
        setTimeout(() => {
          const mv = game.bestMove(2) || game.legal()[0];
          if (mv) { game.move(mv); renderBoard(); }
        }, 160);
      }
      return;
    }

    if (P && (!vsAI || P.c === "w")) {
      selected = sq; highlightMoves(sq);
    } else {
      selected = null; clearMarks();
    }
  });

  // ===== Kontrol =====
  btnReset && (btnReset.onclick = () => { game = new AzChess(); selected=null; clearMarks(); renderBoard(); });
  btnUndo  && (btnUndo.onclick  = () => { if (game.undo()) { selected=null; clearMarks(); renderBoard(); } });
  btnRedo  && (btnRedo.onclick  = () => { if (game.redo()) { selected=null; clearMarks(); renderBoard(); } });
  btnFlip  && (btnFlip.onclick  = () => { boardEl && boardEl.classList.toggle("flip"); renderBoard(); });

  btnBoardOnly && (btnBoardOnly.onclick = () => document.body.classList.toggle("board-only"));
  btnBack      && (btnBack.onclick      = () => document.body.classList.remove("board-only"));

  // ===== Mode =====
  function setMode(ai) {
    vsAI = !!ai;
    btnAI && btnAI.classList.toggle("active", vsAI);
    btnHuman && btnHuman.classList.toggle("active", !vsAI);
    game = new AzChess(); selected=null; clearMarks(); renderBoard();
  }
  btnHuman && (btnHuman.onclick = () => setMode(false));
  btnAI    && (btnAI.onclick    = () => setMode(true));

  // ===== Modal =====
  function showResult(text) {
    if (!modal || !mTitle || !mDesc) return;
    mTitle.textContent = "Permainan Selesai";
    mDesc.textContent = text || "Game selesai.";
    modal.style.display = "grid";
  }
  mClose   && (mClose.onclick   = () => modal.style.display = "none");
  mRestart && (mRestart.onclick = () => { modal.style.display="none"; game=new AzChess(); selected=null; clearMarks(); renderBoard(); });

  // Boot
  setMode(false); // default: vs Human
})();
