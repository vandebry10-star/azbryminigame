/* =========================================================================
   Azbry Crossword — 10x10, 10 Mendatar + 10 Menurun (layout stabil)
   ======================================================================== */
(() => {
  "use strict";

  /* -------------------- GRID MASK -------------------- */
  // '.' = kotak isi, '#' = blok
  const MASK = [
    ".....#####",
    ".....#####",
    ".....#####",
    ".....#####",
    ".....#####",
    "#####.....",
    "#####.....",
    "#####.....",
    "#####.....",
    "#####....."
  ];

  /* -------------------- SOAL (semua 5 huruf) -------------------- */
  const ACROSS = [
    { n:1,  clue:"Tempat tinggal manusia", ans:"RUMAH" }, // r1 c1..5
    { n:2,  clue:"Tempat sewa sementara",  ans:"KOSAN" }, // r2
    { n:3,  clue:"Tempat pertandingan",    ans:"ARENA" }, // r3
    { n:4,  clue:"Promosi komersial",      ans:"IKLAN" }, // r4
    { n:5,  clue:"Skala pada peta",        ans:"SKALA" }, // r5
    { n:6,  clue:"Minuman panas favorit",  ans:"KOPII" }, // r6 (isi 5 huruf; ganti sesuai selera)
    { n:7,  clue:"Undangan resmi (singkat)",ans:"RESMI" },// r7
    { n:8,  clue:"Kumpulan fakta",         ans:"FAKTA" }, // r8
    { n:9,  clue:"Kendaraan roda dua",     ans:"MOTOR" }, // r9
    { n:10, clue:"Memotong tipis",         ans:"SERUT" }  // r10
  ];

  const DOWN_CLUES = [
    "Menurun #1", "Menurun #2", "Menurun #3", "Menurun #4", "Menurun #5",
    "Menurun #6", "Menurun #7", "Menurun #8", "Menurun #9", "Menurun #10"
  ];

  /* -------------------- DOM -------------------- */
  const $grid   = document.getElementById('grid');
  const $dirBtn = document.getElementById('btnDir');
  const $dirLbl = document.getElementById('dirLabel');
  const $check  = document.getElementById('btnCheck');
  const $reset  = document.getElementById('btnReset');
  const $acList = document.getElementById('acrossList');
  const $dnList = document.getElementById('downList');

  if (!$grid || !$acList || !$dnList) return; // halaman belum lengkap

  /* -------------------- BUILD GRID -------------------- */
  const H = MASK.length, W = MASK[0].length;
  const cells = Array.from({length:H}, () => Array(W).fill(null));
  let direction = 'across'; // 'across' | 'down'

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const ch = MASK[r][c];
      const cell = document.createElement('div');
      cell.id = `${r}-${c}`;
      cell.className = 'cell' + (ch === '#' ? ' blk' : '');
      if (ch === '.') {
        const inp = document.createElement('input');
        inp.inputMode = 'text';
        inp.maxLength = 1;
        inp.autocomplete = 'off';
        inp.spellcheck = false;

        inp.addEventListener('input', (e) => {
          e.target.value = (e.target.value || '').replace(/[^A-Za-z]/g, '').toUpperCase();
          if (e.target.value) focusNext(r, c);
        });
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !inp.value) { focusPrev(r, c); }
          if (e.key === ' '){ e.preventDefault(); toggleDir(); }
        });
        cell.appendChild(inp);
      }
      cells[r][c] = cell;
      $grid.appendChild(cell);
    }
  }

  // nomor kecil untuk semua start of word (across & down)
  function isStartAcross(r,c){ return MASK[r][c]==='.' && (c===0 || MASK[r][c-1]==='#'); }
  function isStartDown  (r,c){ return MASK[r][c]==='.' && (r===0 || MASK[r-1][c]==='#'); }
  let num = 1;
  for (let r=0;r<H;r++){
    for (let c=0;c<W;c++){
      if (isStartAcross(r,c) || isStartDown(r,c)){
        const d = document.createElement('div');
        d.className = 'num';
        d.textContent = num++;
        cells[r][c].appendChild(d);
      }
    }
  }

  /* -------------------- CLUES -------------------- */
  $acList.innerHTML = ACROSS.map(x => `<li><b>${x.n}.</b> ${x.clue}</li>`).join('');
  $dnList.innerHTML = DOWN_CLUES.map((t,i)=>`<li><b>${i+1}.</b> ${t}</li>`).join('');

  /* -------------------- FOCUS NAV -------------------- */
  function toggleDir(){
    direction = (direction === 'across') ? 'down' : 'across';
    $dirLbl.textContent = (direction === 'across') ? 'Mendatar' : 'Menurun';
  }
  $dirBtn.addEventListener('click', toggleDir);

  function focusNext(r,c){
    if (direction === 'across'){
      for (let cc = c+1; cc < W; cc++){
        const el = cells[r][cc];
        if (el && !el.classList.contains('blk')) { el.querySelector('input').focus(); break; }
      }
    }else{
      for (let rr = r+1; rr < H; rr++){
        const el = cells[rr][c];
        if (el && !el.classList.contains('blk')) { el.querySelector('input').focus(); break; }
      }
    }
  }
  function focusPrev(r,c){
    if (direction === 'across'){
      for (let cc = c-1; cc >= 0; cc--){
        const el = cells[r][cc];
        if (el && !el.classList.contains('blk')) { el.querySelector('input').focus(); break; }
      }
    }else{
      for (let rr = r-1; rr >= 0; rr--){
        const el = cells[rr][c];
        if (el && !el.classList.contains('blk')) { el.querySelector('input').focus(); break; }
      }
    }
  }

  /* -------------------- RESET & CHECK -------------------- */
  $reset.addEventListener('click', ()=>{
    document.querySelectorAll('.cell input').forEach(i=> i.value = '');
    clearMarks();
  });

  function clearMarks(){
    document.querySelectorAll('.cell').forEach(c=>{
      c.style.outline = 'none';
      c.style.boxShadow = 'none';
    });
  }

  $check.addEventListener('click', () => {
    clearMarks();
    // r1..r5 kolom 0..4  → across #1..#5
    // r6..r10 kolom 5..9 → across #6..#10
    const reads = [];

    for (let i=0;i<5;i++){
      reads.push({
        row: i, start: 0,
        want: ACROSS[i].ans,
        got: readWord(i, 0, 5)
      });
    }
    for (let i=5;i<10;i++){
      reads.push({
        row: i, start: 5,
        want: ACROSS[i].ans,
        got: readWord(i, 5, 5)
      });
    }

    let allOk = true;
    reads.forEach(({row,start,want,got})=>{
      const ok = want === got;
      if (!ok) allOk = false;
      for (let c=0;c<5;c++){
        const el = cells[row][start+c];
        el.style.outline = `2px solid ${ok ? '#73f087' : '#ff5b6a'}`;
        el.style.boxShadow = ok ? '0 0 10px rgba(184,255,154,.35)' : '0 0 10px rgba(255,91,106,.35)';
      }
    });

    alert(allOk ? 'Mantap! Semua mendatar benar 👍' : 'Ada yang belum tepat. Coba cek lagi ya!');
  });

  function readWord(row, startCol, len){
    let s = '';
    for (let k=0;k<len;k++){
      const inp = cells[row][startCol+k].querySelector('input');
      s += (inp.value || ' ').toUpperCase();
    }
    return s;
  }

  // Fokus awal di pojok kiri atas (r0,c0)
  const first = cells[0][0];
  if (first && first.querySelector) first.querySelector('input')?.focus();
})();
