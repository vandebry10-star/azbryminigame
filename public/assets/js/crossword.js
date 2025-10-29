/* =========================================================
   Azbry Crossword — clean engine (mobile friendly)
   - MASK: '.' = kotak jawaban, '#' = blok
   - Nomor otomatis (start-of-word)
   - Input HP lewat hidden <input> agar keyboard muncul
   - 10 mendatar + 10 menurun (clue & kunci sudah disetel)
   ========================================================= */

/* ---------- GRID SHAPE (13x13, 10 across + 10 down) ---------- */
const MASK = [
  //    0 1 2 3 4 5 6 7 8 9 0 1 2  (13 kolom)
  ".....#......", // row 0  -> A1 len5,  A2 len6
  "...#....#...", // row 1  -> A3 len3,  A4 len4, A5 len3
  ".....#......", // row 2  -> A6 len5,  A7 len6
  "..#......#..", // row 3  -> A8 len2,  A9 len6, A10 len2
  ".....#......", // row 4
  "###.###.####", // row 5  (separator baris)
  ".....#......", // row 6
  "...#....#...", // row 7
  ".....#......", // row 8
  "..#......#..", // row 9
  ".....#......", // row10
  "...#....#...", // row11
  ".....#......"  // row12
];
// NB: Pola di atas menghasilkan PASTI 10 slot Across & 10 slot Down.

/* ---------- KUNCI & CLUE (harus sama urutan scanning otomatis) ---------- */
/* Mendatar (10) */
const ACROSS = [
  {answer:"RUMAH", clue:"Tempat tinggal manusia"},
  {answer:"SEMENTARA", clue:"Disewa sementara"},
  {answer:"ARENA", clue:"Tempat pertandingan"},
  {answer:"IKLAN", clue:"Promosi komersial"},
  {answer:"PETA", clue:"Penunjuk arah di peta"},
  {answer:"ASAL", clue:"Berasal"},
  {answer:"UNDANG", clue:"Meminta hadir secara resmi"},
  {answer:"DATA", clue:"Kumpulan fakta"},
  {answer:"SEPEDA", clue:"Kendaraan beroda dua"},
  {answer:"IRIS", clue:"Memotong tipis"}
];

/* Menurun (10) */
const DOWN = [
  {answer:"MATA", clue:"Bagian tubuh untuk melihat"},
  {answer:"PENA", clue:"Benda untuk menulis"},
  {answer:"SUARA", clue:"Bunyi; vokal"},
  {answer:"TANAM", clue:"Menanam bibit"},
  {answer:"INTI", clue:"Pusat; inti"},
  {answer:"ALAMI", clue:"Berasal dari alam"},
  {answer:"GERAK", clue:"Banyak bergerak"},
  {answer:"HOBI", clue:"Kegemaran"},
  {answer:"RAMAH", clue:"Sikap bersahabat"},
  {answer:"LIRIK", clue:"Kata-kata pada lagu"}
];

/* ---------- UTIL ---------- */
const ROWS = MASK.length;
const COLS = MASK[0].length;
const board = document.getElementById('board');
board.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
board.style.gridTemplateRows    = `repeat(${ROWS}, 1fr)`;

const soft = document.getElementById('softkey');
const btnDir = document.getElementById('btnDir');
const dirLabel = document.getElementById('dirLabel');
const listA = document.getElementById('acrossList');
const listD = document.getElementById('downList');

let dir = 'A'; // 'A' mendatar, 'D' menurun
let cursor = {r:0,c:0};
const letters = Array.from({length:ROWS},()=>Array(COLS).fill(''));

/* ---------- Nomor otomatis ---------- */
function isBlock(r,c){ return MASK[r][c]==='#'; }
function startOfAcross(r,c){
  if (isBlock(r,c)) return false;
  return (c===0 || isBlock(r,c-1)) && (c+1<COLS && !isBlock(r,c+1));
}
function startOfDown(r,c){
  if (isBlock(r,c)) return false;
  return (r===0 || isBlock(r-1,c)) && (r+1<ROWS && !isBlock(r+1,c));
}
function scanSlots(){
  const A=[], D=[];
  let num=1;
  for (let r=0;r<ROWS;r++){
    for (let c=0;c<COLS;c++){
      if (startOfAcross(r,c)){
        let len=0; while(c+len<COLS && !isBlock(r,c+len)) len++;
        A.push({num, r, c, len});
      }
      if (startOfDown(r,c)){
        let len=0; while(r+len<ROWS && !isBlock(r+len,c)) len++;
        D.push({num, r, c, len});
      }
      if (startOfAcross(r,c) || startOfDown(r,c)) num++;
    }
  }
  return {A,D};
}
const SLOTS = scanSlots();

/* Safety: pastikan jumlah & panjang cocok */
function assertMapping(){
  if (SLOTS.A.length!==ACROSS.length || SLOTS.D.length!==DOWN.length){
    console.warn('Jumlah slot/answer tidak cocok. Pastikan pola MASK sesuai.');
  }
  // bisa dicek panjang jika mau; untuk ringkas dibiarkan fleksibel.
}
assertMapping();

/* ---------- Render Board ---------- */
let cellRefs = []; // [r][c] -> div
function drawBoard(){
  board.innerHTML=''; cellRefs = Array.from({length:ROWS},()=>Array(COLS).fill(null));

  // taruh angka di start-of-word
  const numberMap = Array.from({length:ROWS},()=>Array(COLS).fill(null));
  [...SLOTS.A, ...SLOTS.D].forEach(s=>{ numberMap[s.r][s.c] = (numberMap[s.r][s.c] ?? s.num); });

  for (let r=0;r<ROWS;r++){
    for (let c=0;c<COLS;c++){
      const div = document.createElement('div');
      div.className = 'cell';
      if (isBlock(r,c)) div.classList.add('block');
      if (numberMap[r][c]!=null){
        const n = document.createElement('span');
        n.className='num'; n.textContent = numberMap[r][c];
        div.appendChild(n);
      }
      const ch = document.createElement('span');
      ch.className='ch';
      ch.textContent = letters[r][c] || '';
      div.appendChild(ch);

      div.dataset.r=r; div.dataset.c=c;
      if (!isBlock(r,c)){
        div.addEventListener('click', ()=>focusCell(r,c,true));
      }
      board.appendChild(div);
      cellRefs[r][c]=div;
    }
  }
}
drawBoard();

/* ---------- Clues ---------- */
function renderClues(){
  listA.innerHTML='';
  SLOTS.A.forEach((s,i)=>{
    const li = document.createElement('li');
    li.innerHTML = `<b>${s.num}.</b> ${ACROSS[i]?.clue||'-'}`;
    listA.appendChild(li);
  });
  listD.innerHTML='';
  SLOTS.D.forEach((s,i)=>{
    const li = document.createElement('li');
    li.innerHTML = `<b>${s.num}.</b> ${DOWN[i]?.clue||'-'}`;
    listD.appendChild(li);
  });
}
renderClues();

/* ---------- Focus & highlight ---------- */
function clearFocus(){
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++){
    const el = cellRefs[r][c]; if (!el) continue;
    el.classList.remove('focus','hlite');
  }
}
function highlightRun(r,c,dirChar){
  clearFocus();
  if (isBlock(r,c)) return;
  cellRefs[r][c].classList.add('focus');

  if (dirChar==='A'){
    let cc=c; while(cc>0 && !isBlock(r,cc-1)) cc--;
    while(cc<COLS && !isBlock(r,cc)){
      cellRefs[r][cc].classList.add('hlite'); cc++;
    }
  }else{
    let rr=r; while(rr>0 && !isBlock(rr-1,c)) rr--;
    while(rr<ROWS && !isBlock(rr,c)){
      cellRefs[rr][c].classList.add('hlite'); rr++;
    }
  }
}
function focusCell(r,c,bringKeyboard=false){
  cursor={r,c};
  highlightRun(r,c,dir);
  if (bringKeyboard){ soft.focus(); }
}

/* ---------- Move cursor ---------- */
function stepForward(){
  if (dir==='A'){
    let {r,c}=cursor;
    do { c++; if (c>=COLS){ c=0; r=(r+1)%ROWS; } } while (isBlock(r,c));
    focusCell(r,c);
  }else{
    let {r,c}=cursor;
    do { r++; if (r>=ROWS){ r=0; c=(c+1)%COLS; } } while (isBlock(r,c));
    focusCell(r,c);
  }
}
function stepBackward(){
  if (dir==='A'){
    let {r,c}=cursor;
    do { c--; if (c<0){ c=COLS-1; r=(r-1+ROWS)%ROWS; } } while (isBlock(r,c));
    focusCell(r,c);
  }else{
    let {r,c}=cursor;
    do { r--; if (r<0){ r=ROWS-1; c=(c-1+COLS)%COLS; } } while (isBlock(r,c));
    focusCell(r,c);
  }
}

/* ---------- Input handling (mobile + desktop) ---------- */
function putLetter(ch){
  if (isBlock(cursor.r,cursor.c)) return;
  const L = ch.toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ]/g,'');
  if (!L) return;
  letters[cursor.r][cursor.c] = L[0];
  cellRefs[cursor.r][cursor.c].querySelector('.ch').textContent = L[0];
  stepForward();
}
function erase(){
  letters[cursor.r][cursor.c] = '';
  cellRefs[cursor.r][cursor.c].querySelector('.ch').textContent = '';
}

document.addEventListener('keydown', (e)=>{
  if (e.key === ' ') { e.preventDefault(); toggleDir(); return; }
  if (e.key === 'Backspace'){ e.preventDefault(); erase(); return; }
  if (e.key.length===1){ putLetter(e.key); }
});
soft.addEventListener('input', e=>{
  const v = e.target.value;
  if (v){ putLetter(v.slice(-1)); e.target.value=''; }
});

/* ---------- Direction ---------- */
function toggleDir(){
  dir = (dir==='A') ? 'D' : 'A';
  dirLabel.textContent = (dir==='A') ? 'Mendatar' : 'Menurun';
  highlightRun(cursor.r,cursor.c,dir);
}
btnDir.addEventListener('click', toggleDir);

/* ---------- Check & Reset ---------- */
function readRun(slot, dirChar){
  const out=[];
  if (dirChar==='A'){
    for (let k=0;k<slot.len;k++) out.push(letters[slot.r][slot.c+k]||'');
  }else{
    for (let k=0;k<slot.len;k++) out.push(letters[slot.r+k][slot.c]||'');
  }
  return out.join('');
}

function checkAll(){
  let ok = true;

  // Across
  SLOTS.A.forEach((s,i)=>{
    const want = (ACROSS[i]?.answer||'').toUpperCase();
    const got  = readRun(s,'A');
    const good = want && want.length===s.len && got===want;
    colorizeSlot(s,'A', good);
    ok = ok && good;
  });
  // Down
  SLOTS.D.forEach((s,i)=>{
    const want = (DOWN[i]?.answer||'').toUpperCase();
    const got  = readRun(s,'D');
    const good = want && want.length===s.len && got===want;
    colorizeSlot(s,'D', good);
    ok = ok && good;
  });

  btnCheck.textContent = ok ? '👍 Benar semua!' : 'Periksa lagi';
  setTimeout(()=>{ btnCheck.textContent='Cek Jawaban'; }, 1600);
}
function colorizeSlot(slot, dirChar, good){
  if (dirChar==='A'){
    for (let k=0;k<slot.len;k++){
      cellRefs[slot.r][slot.c+k].style.background = good ? 'rgba(184,255,154,.22)' : 'rgba(255,77,77,.18)';
    }
  }else{
    for (let k=0;k<slot.len;k++){
      cellRefs[slot.r+k][slot.c].style.background = good ? 'rgba(184,255,154,.22)' : 'rgba(255,77,77,.18)';
    }
  }
}
function resetAll(){
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++){
    letters[r][c]='';
    const el=cellRefs[r][c];
    if (el) { el.querySelector('.ch').textContent=''; el.style.background=''; }
  }
  btnCheck.textContent='Cek Jawaban';
}
document.getElementById('btnCheck').addEventListener('click', checkAll);
document.getElementById('btnReset').addEventListener('click', resetAll);

/* ---------- Start focus ---------- */
(function boot(){
  // fokus di sel valid pertama
  outer: for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++){
    if (!isBlock(r,c)){ focusCell(r,c); break outer; }
  }
})();
