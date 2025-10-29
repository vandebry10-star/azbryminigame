/* ============================================================
   Azbry Crossword — FIXED GRID DISPLAY (auto render)
   ============================================================ */

(() => {
  const N = 10; // ukuran papan
  const BLOCKS = [12, 19, 21, 34, 39, 42, 46, 52, 65, 72, 77, 88, 91]; // kotak hitam

  const ACROSS = [
    { n: 1, clue: "Tempat tinggal manusia", ans: "RUMAH", start: 0 },
    { n: 2, clue: "Sumber cahaya alami", ans: "MATAHARI", start: 20 },
  ];
  const DOWN = [
    { n: 1, clue: "Bagian tubuh untuk melihat", ans: "MATA", start: 1 },
    { n: 2, clue: "Benda yang digunakan untuk menulis", ans: "PENA", start: 5 },
  ];

  const board = document.getElementById("cwGrid");
  const acrossList = document.getElementById("listAcross");
  const downList = document.getElementById("listDown");
  const dirLabel = document.getElementById("dirLabel");

  if (!board) return;

  // ========== Buat papan ==========
  function makeBoard() {
    board.innerHTML = "";
    board.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
    for (let i = 0; i < N * N; i++) {
      const c = document.createElement("div");
      c.className = "cell" + (BLOCKS.includes(i) ? " block" : "");
      if (!BLOCKS.includes(i)) {
        c.contentEditable = "true";
        c.spellcheck = false;
      }
      board.appendChild(c);
    }
  }

  makeBoard();

  // ========== Render soal ==========
  function renderClues() {
    acrossList.innerHTML = ACROSS.map(x => `<li><b>${x.n}.</b> ${x.clue}</li>`).join("");
    downList.innerHTML = DOWN.map(x => `<li><b>${x.n}.</b> ${x.clue}</li>`).join("");
  }
  renderClues();

  // ========== Input dan navigasi ==========
  let direction = "across";
  let current = null;

  const cells = Array.from(document.querySelectorAll("#cwGrid .cell:not(.block)"));
  cells.forEach((cell, i) => {
    cell.addEventListener("focus", () => current = i);
    cell.addEventListener("input", e => {
      e.target.textContent = e.target.textContent.replace(/[^A-Z]/gi, "").toUpperCase();
      moveNext();
    });
  });

  document.addEventListener("keydown", e => {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      direction = direction === "across" ? "down" : "across";
      dirLabel.textContent = "Arah: " + (direction === "across" ? "Mendatar" : "Menurun");
    }
  });

  function moveNext() {
    if (current == null) return;
    let next = current;
    do {
      next += (direction === "across") ? 1 : N;
    } while (next < N * N && board.children[next]?.classList.contains("block"));
    if (next < N * N) board.children[next].focus();
  }

  // ========== Tombol aksi ==========
  document.getElementById("btnReset")?.addEventListener("click", () => {
    cells.forEach(c => c.textContent = "");
  });

  document.getElementById("btnCheck")?.addEventListener("click", () => {
    alert("Belum ada sistem cek otomatis (contoh demo Azbry Crossword).");
  });
})();
