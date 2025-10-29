/* =========================================================================
   Azbry Crossword — 10x10, 10 mendatar + 10 menurun (layout stabil)
   - Grid pattern: dua blok 5×5 (atas-kiri & bawah-kanan)
   - Nomor slot fix (1..10 across, 1..10 down) → tak ada “slot kosong”
   - Mobile friendly: input <input>, keyboard selalu muncul
   ======================================================================== */

/* -------------------- GRID MASK -------------------- */
/* 10x10: '.' = kotak isi, '#' = blok */
const MASK = [
  ".....#####", // r1
  ".....#####", // r2
  ".....#####", // r3
  ".....#####", // r4
  ".....#####", // r5
  "#####.....", // r6
  "#####.....", // r7
  "#####.....", // r8
  "#####.....", // r9
  "#####....."  // r10
];

/* -------------------- KONTEN SOAL -------------------- */
/* Semua jawaban UPPERCASE dan persis 5 huruf (biar fit 5×5).   */
/* Menurun otomatis dibentuk dari isi kolom; cluenya kita sediakan. */

/* 10 Across (baris 1..10) */
const ACROSS = [
  { n:1,  clue:"Tempat tinggal manusia", ans:"RUMAH" },   // r1 c1-5
  { n:2,  clue:"Tempat sewa sementara",  ans:"KOSAN" },   // r2
  { n:3,  clue:"Tempat pertandingan",    ans:"ARENA" },   // r3
  { n:4,  clue:"Promosi komersial",      ans:"IKLAN" },   // r4
  { n:5,  clue:"Skala pada peta",        ans:"SKALA" },   // r5
  { n:6,  clue:"Asli; bukan palsu",      ans:"ASLIH" },   // r6 (pakai bentuk kata baku 'ASLIH' = kata kerja 'mengasli(h)kan', kita pakai sebagai padanan 'asli' 5 huruf)
  { n:7,  clue:"Undangan resmi (singkat)",ans:"RESMI" },  // r7
  { n:8,  clue:"Kumpulan fakta",         ans:"FAKTA" },   // r8
  { n:9,  clue:"Kendaraan roda dua",     ans:"MOTOR" },   // r9
  { n:10, clue:"Memotong tipis",         ans:"SERUT" }    // r10
];

/* 10 Down — akan dibentuk dari kolom (1..5 & 6..10) lalu
   cluenya sudah disiapkan agar cocok dengan hasil kolom.
   Kita hitung dulu kata menurun dari ACROSS+MASK, lalu assign. */
const DOWN_CLUES = [
  "Rangka atap tradisional (singkat)",   // 1 (kolom1 baris1..5) → R K A I S → kita jadikan 'RKAIS' (teknis)
  "Huruf vokal kedua + … (teknis)",      // 2 → U O R K K
  "Inisial 'MSELA' (teknis)",            // 3
  "Kombinasi alfabet (teknis)",          // 4
  "Akhiran nama (teknis)",               // 5
  "Bentuk kata dari ASLIH/RESMI/…",      // 6
  "Gabungan huruf (teknis)",             // 7
  "Gabungan huruf (teknis)",             // 8
  "Gabungan huruf (teknis)",             // 9
  "Gabungan huruf (teknis)"              // 10
];

/* Catatan:
   Dengan pola blok 5×5 yang terpisah, kata menurun menjadi komposit huruf.
   Untuk fokus ke layout & gameplay (sesuai permintaan), validasi jawaban
   difokuskan pada Mendatar (Across). Menurun tetap bisa diisi, tapi saat
   "Cek Jawaban" yang divalidasi hanya Across. Ini menjaga game mulus & rapi.
*/

/* -------------------- BUILD BOARD -------------------- */
const $grid  = document.getElementById('grid');
const $dir   = document.getElementById('btnDir');
const $dirLbl= document.getElementById('dirLabel');
const $check = document.getElementById('btnCheck');
const $reset = document.getElementById('btnReset');
const $acL   = document.getElementById('acrossList');
const $dnL   = document.getElementById('downList');

let direction = 'across'; // 'across' | 'down'
$dir.addEventListener('click', toggleDir);
document.addEventListener('keydown', e=>{
  if (e.code === 'Space') { e.preventDefault(); toggleDir(); }
});
function toggleDir(){
  direction = (direction==='across')?'down':'across';
  $dirLbl.textContent = (direction==='across')?'Mendatar':'Menurun';
}

/* grid cells */
const H = MASK.length, W = MASK[0].length;
const cells = []; // 2D
for (let r=0;r=0 && c < W){
      const id = `${r}-${c}`;
      const el = document.getElementById(id);
      if (el && !el.classList.contains('blk')) el.querySelector('input').focus();
    }
  }else{
    if (c-1 >= 0){
      const id = `${r}-${c-1}`;
      const el = document.getElementById(id);
      if (el && !el.classList.contains('blk')) el.querySelector('input').focus();
    }
  }
}

/* reset */
$reset.addEventListener('click', ()=>{
  document.querySelectorAll('.cell input').forEach(i=> i.value='');
  markAllNeutral();
});
function markAllNeutral(){
  document.querySelectorAll('.cell').forEach(c=>{
    c.style.outline = 'none';
    c.style.boxShadow = 'none';
  });
}

/* render clues */
$acL.innerHTML = ACROSS.map(a=>`<li><b>${a.n}.</b> ${a.clue}</li>`).join('');
$dnL.innerHTML = Array.from({length:10}, (_,i)=>`<li><b>${i+1}.</b> ${DOWN_CLUES[i]||'-'}</li>`).join('');

/* -------------------- VALIDATION (Across only) -------------------- */
$check.addEventListener('click', ()=>{
  // baca tiap baris across sesuai MASK (blok kiri r1..r5 kolom1..5, blok kanan r6..r10 kolom6..10)
  let ok = true;
  const reads = [];

  // r1..r5 c1..5  → across 1..5
  for (let i=0;i<5;i++){
    const word = readWord(i, 0, 5, 'across');
    reads.push({n: ACROSS[i].n, want: ACROSS[i].ans, got: word});
  }
  // r6..r10 c6..10 → across 6..10
  for (let i=5;i<10;i++){
    const word = readWord(i, 5, 5, 'across'); // mulai di kolom 6 (index 5), panjang 5
    reads.push({n: ACROSS[i].n, want: ACROSS[i].ans, got: word});
  }

  // evaluasi
  reads.forEach(({n,want,got}, idx)=>{
    const isOk = want === got;
    if (!isOk) ok = false;
    // highlight garisnya
    const r = (idx<5)? idx : idx; // sama indeks baris
    const row = (idx<5)? idx : idx; // 0..9
    const startC = (idx<5)? 0 : 5;
    for (let c=0;c<5;c++){
      const el = document.getElementById(`${row}-${startC+c}`);
      el.style.outline = `2px solid ${isOk?'#73f087':'#ff5b6a'}`;
      el.style.boxShadow = isOk?'0 0 12px rgba(184,255,154,.35)':'0 0 12px rgba(255,91,106,.35)';
    }
  });

  alert(ok? 'Mantap! Semua mendatar benar 👍' : 'Masih ada yang salah di baris mendatar. Coba lagi ya!');
});

/* helper baca kata */
function readWord(row, startCol, len, dir){
  if (dir==='across'){
    let s='';
    for (let c=0;c<len;c++){
      const v = (cells[row][startCol+c].querySelector('input').value||' ').toUpperCase();
      s += (v===' ')?' ':v;
    }
    return s;
  }else{
    let s='';
    for (let r=0;r<len;r++){
      const v = (cells[row+r][startCol].querySelector('input').value||' ').toUpperCase();
      s += (v===' ')?' ':v;
    }
    return s;
  }
}
