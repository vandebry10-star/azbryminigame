/* =========================================================
   Azbry Crossword — Core
   - Papan 10×10
   - Input keyboard (huruf A-Z, Backspace, panah)
   - Toggle arah (Mendatar/Menurun)
   - Cek & Reset
   ========================================================= */

(function(){
  // ====== DATA PUZZLE (GANTI SESUAI SELERA) ======
  // '.' = blok hitam, huruf = solusi. Huruf tidak peka kapital.
  const GRID = [
    "R U M A H . S E W A".replace(/ /g,''),
    "A R E N A . I K L A N".replace(/ /g,''),
    "K O M P A S . A S A L".replace(/ /g,''),
    "U N D A N G . D A T A".replace(/ /g,''),
    "S E P E D A . I R I S".replace(/ /g,''),
    ". . . . . . . . . .".replace(/ /g,''),
    "T A N A M . P U S A T".replace(/ /g,''),
    "E N E R G I . S U A R".replace(/ /g,''),
    "K O T A K . T E M A N".replace(/ /g,''),
    "I N F O R M A S I . .".replace(/ /g,'')
  ];
  // Clue numbering otomatis. Isi daftar petunjuk:
  const CLUES_ACROSS = {
    1:  "Tempat tinggal",
    6:  "Disewa sementara",
    12: "Tempat pertandingan",
    13: "Promosi komersial",
    14: "Penunjuk arah di peta",
    15: "Berasal",
    16: "Meminta hadir secara resmi",
    17: "Kumpulan fakta",
    18: "Kendaraan beroda dua",
    19: "Memotong tipis",
    22: "Menanam bibit",
    23: "Pusat; inti",
    24: "Daya untuk melakukan kerja",
    25: "Bunyi; vokal",
    26: "Benda berbentuk empat sisi",
    27: "Kawan"
  };
  const CLUES_DOWN = {
    1:  "Ruang bagian dalam rumah",
    2:  "Biji penghasil gula merah",
    3:  "Alat menunjukkan arah mata angin",
    4:  "Mengajak secara resmi",
    5:  "Aliran informasi massal",
    6:  "Milik yang tidak gratis",
    7:  "Tempat duduk bertingkat di stadion",
    8:  "Papan informasi di jalan raya",
    9:  "Pusat kegiatan kota",
    10: "Sumber tenaga alternatif",
    11: "Koleksi bunyi tertulis",
  };

  // ====== BUILD BOARD ======
  const N = 10;
  const board = document.getElementById('board');
  board.style.setProperty('--N', N);

  // grid state: user letters ('' untuk kosong, '#' untuk blok)
  const cells = [];
  for(let r=0;r<N;r++){
    for(let c=0;c<N;c++){
      const ch = GRID[r][c];
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.r = r; el.dataset.c = c;
      if (ch==='.' ){
        el.classList.add('block');
        el.textContent = '';
      } else {
        el.textContent = '';
      }
      board.appendChild(el);
      cells.push(el);
    }
  }

  // ====== NUMBERING (Across & Down) ======
  function isBlock(r,c){ return GRID[r][c]==='.'; }
  function id(r,c){ return r*N+c; }

  const numberMap = {}; // key: r,c -> number
  let num=1;

  // Across starts where (c==0 or left is block) and cell not block
  for(let r=0;r<N;r++){
    for(let c=0;c<N;c++){
      if (isBlock(r,c)) continue;
      const start = (c===0 || isBlock(r,c-1)) && (c+1<N) && !isBlock(r,c+1);
      if (start){
        numberMap[`${r},${c}`]=num++;
      }
    }
  }
  // Down starts where (r==0 or above is block) and cell not block
  for(let r=0;r<N;r++){
    for(let c=0;c<N;c++){
      if (isBlock(r,c)) continue;
      const start = (r===0 || isBlock(r-1,c)) && (r+1<N) && !isBlock(r+1,c);
      if (start){
        if (!numberMap[`${r},${c}`]) numberMap[`${r},${c}`]=num++;
      }
    }
  }

  // render small numbers
  for(const el of cells){
    if (el.classList.contains('block')) continue;
    const r=+el.dataset.r, c=+el.dataset.c;
    const n=numberMap[`${r},${c}`];
    if (n){
      const s=document.createElement('span'); s.className='num'; s.textContent=n;
      el.appendChild(s);
    }
  }

  // ====== CLUES UI ======
  function fillClues(ol, obj){
    ol.innerHTML='';
    Object.keys(obj).sort((a,b)=>+a-+b).forEach(k=>{
      const li=document.createElement('li'); li.textContent=`${obj[k]}`;
      ol.appendChild(li);
    });
  }
  fillClues(document.getElementById('cluesAcross'), CLUES_ACROSS);
  fillClues(document.getElementById('cluesDown'),   CLUES_DOWN);

  // ====== DIRECTION & SELECTION ======
  let dir = 'across'; // 'across' | 'down'
  let cur = { r:0, c:0 };

  const $btnDir   = document.getElementById('btnDir');
  const $btnCheck = document.getElementById('btnCheck');
  const $btnReset = document.getElementById('btnReset');
  const $status   = document.getElementById('status');

  function setDir(d){
    dir=d;
    $btnDir.textContent = `Arah: ${dir==='across'?'Mendatar':'Menurun'}`;
    highlightRun();
  }

  $btnDir.addEventListener('click', ()=>{
    setDir(dir==='across'?'down':'across');
  });

  function clampToValid(r,c){
    // kalau di blok, geser maju sampai non-blok (atau mundur)
    if (!isBlock(r,c)) return {r,c};
    // cari terdekat non-block di row/col ini:
    if (dir==='across'){
      // cari kiri
      for(let cc=c-1; cc>=0; cc--) if(!isBlock(r,cc)) return {r, c:cc};
      // cari kanan
      for(let cc=c+1; cc<N; cc++) if(!isBlock(r,cc)) return {r, c:cc};
      // fallback: scan semua
    } else {
      for(let rr=r-1; rr>=0; rr--) if(!isBlock(rr,c)) return {r:rr, c};
      for(let rr=r+1; rr<N; rr++) if(!isBlock(rr,c)) return {r:rr, c};
    }
    // fallback: ke 0,0
    for(let rr=0;rr<N;rr++) for(let cc=0;cc<N;cc++) if(!isBlock(rr,cc)) return {r:rr,c:cc};
    return {r:0,c:0};
  }

  function setCur(r,c){
    ({r,c} = clampToValid(r,c));
    cur.r=r; cur.c=c;
    updateActive();
    highlightRun();
  }

  function cellAt(r,c){ return cells[id(r,c)]; }

  function runCellsFrom(r,c, d){
    const out=[];
    if (d==='across'){
      let cc=c; while(cc>=0 && !isBlock(r,cc)) cc--;
      cc++;
      while(cc<N && !isBlock(r,cc)){ out.push({r,c:cc}); cc++; }
    } else {
      let rr=r; while(rr>=0 && !isBlock(rr,c)) rr--;
      rr++;
      while(rr<N && !isBlock(rr,c)){ out.push({r:rr,c}); rr++; }
    }
    return out;
  }

  function updateActive(){
    cells.forEach(el=>el.classList.remove('active'));
    if (!isBlock(cur.r,cur.c)) cellAt(cur.r,cur.c).classList.add('active');
  }

  function highlightRun(){
    cells.forEach(el=>el.classList.remove('hl'));
    const seg = runCellsFrom(cur.r, cur.c, dir);
    seg.forEach(({r,c})=>cellAt(r,c).classList.add('hl'));
  }

  // mouse click -> fokus ke cell
  board.addEventListener('click', (e)=>{
    const t = e.target.closest('.cell'); if(!t || t.classList.contains('block')) return;
    const r=+t.dataset.r, c=+t.dataset.c;
    // klik cell yang sama -> toggle arah
    if (cur.r===r && cur.c===c) setDir(dir==='across'?'down':'across');
    setCur(r,c);
  });

  // ====== INPUT KEYBOARD ======
  function moveNext(){
    if (dir==='across'){
      let c=cur.c+1;
      while(c<N && isBlock(cur.r,c)) c++;
      if (c<N) setCur(cur.r,c);
    } else {
      let r=cur.r+1;
      while(r<N && isBlock(r,cur.c)) r++;
      if (r<N) setCur(r,cur.c);
    }
  }
  function movePrev(){
    if (dir==='across'){
      let c=cur.c-1;
      while(c>=0 && isBlock(cur.r,c)) c--;
      if (c>=0) setCur(cur.r,c);
    } else {
      let r=cur.r-1;
      while(r>=0 && isBlock(r,cur.c)) r--;
      if (r>=0) setCur(r,cur.c);
    }
  }

  function putLetter(ch){
    ch = (ch||'').toUpperCase();
    if (!/^[A-Z]$/.test(ch)) return;
    if (isBlock(cur.r,cur.c)) return;
    cellAt(cur.r,cur.c).dataset.val = ch;
    cellAt(cur.r,cur.c).textContent = ch;
    // keep small number in corner
    const n=numberMap[`${cur.r},${cur.c}`];
    if (n){
      const span = document.createElement('span'); span.className='num'; span.textContent=n;
      cellAt(cur.r,cur.c).appendChild(span);
    }
    moveNext();
  }

  function backspace(){
    if (isBlock(cur.r,cur.c)) return;
    cellAt(cur.r,cur.c).dataset.val = '';
    cellAt(cur.r,cur.c).textContent = '';
    const n=numberMap[`${cur.r},${cur.c}`];
    if (n){
      const span = document.createElement('span'); span.className='num'; span.textContent=n;
      cellAt(cur.r,cur.c).appendChild(span);
    }
  }

  document.addEventListener('keydown',(e)=>{
    const k=e.key;
    if (k==='ArrowLeft'){ e.preventDefault(); setDir('across'); movePrev(); }
    else if (k==='ArrowRight'){ e.preventDefault(); setDir('across'); moveNext(); }
    else if (k==='ArrowUp'){ e.preventDefault(); setDir('down'); movePrev(); }
    else if (k==='ArrowDown'){ e.preventDefault(); setDir('down'); moveNext(); }
    else if (k===' '){ e.preventDefault(); setDir(dir==='across'?'down':'across'); }
    else if (k==='Backspace'){ e.preventDefault(); backspace(); }
    else if (/^[a-zA-Z]$/.test(k)){ putLetter(k); }
  });

  // ====== CHECK & RESET ======
  function checkAll(){
    let correct=0, filled=0, total=0;
    for(let r=0;r<N;r++){
      for(let c=0;c<N;c++){
        if (isBlock(r,c)) continue;
        total++;
        const need = GRID[r][c].toUpperCase();
        const val  = (cellAt(r,c).dataset.val||'').toUpperCase();
        const el   = cellAt(r,c);
        el.classList.remove('ok','bad');
        if (!val) continue;
        filled++;
        if (val===need){ el.classList.add('ok'); correct++; }
        else{ el.classList.add('bad'); }
      }
    }
    const $s = document.getElementById('status');
    if (correct===total) $s.textContent = "Mantap! Semua jawaban benar 🎉";
    else $s.textContent = `Terisi ${filled}/${total}. Benar ${correct}.`;
  }
  function resetAll(){
    cells.forEach(el=>{
      if (!el.classList.contains('block')){
        el.dataset.val=''; el.textContent='';
        el.classList.remove('ok','bad');
        const r=+el.dataset.r, c=+el.dataset.c;
        const n=numberMap[`${r},${c}`];
        if (n){ const span=document.createElement('span'); span.className='num'; span.textContent=n; el.appendChild(span); }
      }
    });
    document.getElementById('status').textContent='';
    setCur(0,0);
  }

  document.getElementById('btnCheck').addEventListener('click', checkAll);
  document.getElementById('btnReset').addEventListener('click', resetAll);

  // boot
  setCur(0,0);
  setDir('across');
})();
