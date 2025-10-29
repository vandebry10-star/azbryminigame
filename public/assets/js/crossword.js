/* ============================================================
   Azbry Crossword — Simplified Functional Engine (v2)
   ============================================================ */

(() => {
  const board = document.getElementById("cwGrid");
  const label = document.getElementById("dirLabel");
  const btnCheck = document.getElementById("btnCheck");
  const btnReset = document.getElementById("btnReset");

  // ---------- Data ----------
  const N = 10; // ukuran papan 10x10
  const BLOCKS = [2, 9, 15, 19, 23, 28, 31, 45, 51, 58, 64, 70, 78, 85, 93]; // kotak hitam (contoh)

  const ACROSS = [
    { n: 1, clue: "Tempat tinggal", ans: "RUMAH", start: 0 },
    { n: 2, clue: "Disewa sementara", ans: "KOST", start: 10 },
    { n: 3, clue: "Tempat pertandingan", ans: "ARENA", start: 30 },
  ];
  const DOWN = [
    { n: 1, clue: "Ruang bagian dalam rumah", ans: "KAMAR", start: 0 },
    { n: 2, clue: "Biji penghasil gula merah", ans: "AREN", start: 1 },
  ];

  // ---------- State ----------
  let grid = [];
  let direction = "across"; // or 'down'
  let current = null;

  // ---------- Generate Grid ----------
  function initBoard() {
    board.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
    board.innerHTML = "";

    for (let i = 0; i < N * N; i++) {
      const cell = document.createElement("div");
      cell.className = "cell" + (BLOCKS.includes(i) ? " block" : "");
      cell.dataset.i = i;
      cell.contentEditable = BLOCKS.includes(i) ? "false" : "true";
      board.appendChild(cell);
      grid.push(cell);
    }
  }

  initBoard();

  // ---------- Controls ----------
  function toggleDir() {
    direction = direction === "across" ? "down" : "across";
    label.textContent = "Arah: " + (direction === "across" ? "Mendatar" : "Menurun");
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      toggleDir();
    }
  });

  // ---------- Input Focus ----------
  grid.forEach((cell, i) => {
    if (BLOCKS.includes(i)) return;
    cell.addEventListener("focus", () => {
      current = i;
      highlight(i);
    });

    cell.addEventListener("input", (e) => {
      e.target.textContent = e.target.textContent.replace(/[^A-Za-z]/g, "").toUpperCase();
      moveNext();
    });
  });

  function moveNext() {
    if (current == null) return;
    let next = current;
    do {
      if (direction === "across") next++;
      else next += N;
    } while (next < N * N && BLOCKS.includes(next));

    if (next < N * N && !BLOCKS.includes(next)) {
      grid[next].focus();
      current = next;
    }
  }

  // ---------- Highlight ----------
  function highlight(i) {
    grid.forEach((c) => c.classList.remove("active"));
    grid[i].classList.add("active");
  }

  // ---------- Check Answer ----------
  function checkAnswers() {
    let correct = 0, total = 0;
    ACROSS.concat(DOWN).forEach((w) => {
      total++;
      const ok = testWord(w);
      if (ok) correct++;
    });
    alert(`Benar ${correct} dari ${total} jawaban.`);
  }

  function testWord(word) {
    let pos = word.start;
    for (let j = 0; j < word.ans.length; j++) {
      const ch = grid[pos]?.textContent.trim().toUpperCase();
      if (ch !== word.ans[j]) return false;
      pos += wordDirStep(word);
    }
    return true;
  }

  function wordDirStep(w) {
    // deteksi orientasi berdasarkan clue di daftar
    const matchAcross = ACROSS.find(a => a.n === w.n);
    return matchAcross ? 1 : N;
  }

  // ---------- Reset ----------
  function resetBoard() {
    grid.forEach((c) => {
      if (!BLOCKS.includes(parseInt(c.dataset.i))) c.textContent = "";
    });
  }

  btnCheck.addEventListener("click", checkAnswers);
  btnReset.addEventListener("click", resetBoard);

  // ---------- Render Clues ----------
  function renderClues() {
    const A = document.getElementById("listAcross");
    const D = document.getElementById("listDown");
    A.innerHTML = ACROSS.map((c) => `<li><b>${c.n}.</b> ${c.clue}</li>`).join("");
    D.innerHTML = DOWN.map((c) => `<li><b>${c.n}.</b> ${c.clue}</li>`).join("");
  }
  renderClues();
})();
