/* Azbry Crossword — smooth UX (mobile/desktop)
   - highlight kata aktif
   - kursor auto maju & skip blok
   - sinkron ke clue
   - spasi ganti arah; panah navigasi
*/
(() => {
  // ====== DATA SAMPLE (bebas kamu ganti) ======
  // 10x10 grid; "." = blok
  const GRID_SIZE = 10;
  const MASK = [
    "...#......",
    ".....#....",
    "..#....#..",
    "......#..#",
    ".#....#...",
    "....#.....",
    "..#....#..",
    ".#......#.",
    "....#.....",
    "......#..."
  ];
  // Clues & answers (HARUS uppercase tanpa spasi/aksen)
  const ACROSS = [
    { no: 1,  row:0, col:3, ans:"RUMAH", clue:"Tempat tinggal manusia" },
    { no: 2,  row:1, col:0, ans:"MATAHARI", clue:"Sumber cahaya alami" },
    { no: 3,  row:3, col:0, ans:"JALAN", clue:"Rute untuk kendaraan" },
    { no: 4,  row:4, col:2, ans:"BUKU", clue:"Benda untuk membaca" },
  ];
  const DOWN = [
    { no: 1,  row:0, col:3, ans:"MATA", clue:"Bagian tubuh untuk melihat" },
    { no: 2,  row:0, col:5, ans:"PENA", clue:"Benda yang digunakan untuk menulis" },
    { no: 3,  row:2, col:8, ans:"LAMPU", clue:"Sumber cahaya buatan" },
    { no: 4,  row:1, col:1, ans:"TAMAN", clue:"Area hijau umum" },
  ];

  // ====== DOM ======
  const $grid = document.getElementById('cwGrid');
  const $dirLabel = document.getElementById('dirLabel');
  const $btnCheck = document.getElementById('btnCheck');
  const $btnReset = document.getElementById('btnReset');
  const $listAcross = document.getElementById('listAcross');
  const $listDown = document.getElementById('listDown');

  // ====== STATE ======
  const CELLS = []; // array of {el,row,col,block,letter}
  let dir = 'across'; // 'across' | 'down'
  let cur = {row:0, col:0}; // posisi kursor
  let wordCells = []; // daftar cell untuk kata aktif sekarang
  const answers = new Map(); // key "r,c" -> char

  // ====== BUILD GRID ======
  function buildGrid(){
    $grid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
    $grid.innerHTML = '';
    CELLS.length = 0;

    for(let r=0;r<GRID_SIZE;r++){
      for(let c=0;c<GRID_SIZE;c++){
        const ch = MASK[r].charAt(c);
        const block = (ch === '#');
        const el = document.createElement('div');
        el.className = 'cell' + (block ? ' block' : '');
        el.dataset.r = r; el.dataset.c = c;

        if(!block){
          el.tabIndex = 0;
          el.addEventListener('click', () => {
            setCursor(r,c,true);
          });
        }

        $grid.appendChild(el);
        CELLS.push({el, row:r, col:c, block, letter:''});
      }
    }
  }

  // ====== HELPERS ======
  const idx = (r,c) => r*GRID_SIZE + c;
  const inBoard = (r,c) => r>=0 && r<GRID_SIZE && c>=0 && c<GRID_SIZE;
  function cell(r,c){ return inBoard(r,c) ? CELLS[idx(r,c)] : null; }

  function setDir(d){
    dir = d;
    $dirLabel.textContent = `Arah: ${dir==='across'?'Mendatar':'Menurun'}`;
    highlightWord();
  }

  function setCursor(r,c,keepDir=false){
    const ce = cell(r,c);
    if(!ce || ce.block) return;
    cur.row=r; cur.col=c;
    // jika datang dari klik blok atau cell tunggal, pilih arah yang paling masuk akal
    if(!keepDir){
      // pilih otomatis: cek ada huruf di kiri/atas untuk continuity
      if(dir==='across'){
        if(cell(r,c-1)?.block && cell(r,c+1)?.block) setDir('down');
      }else{
        if(cell(r-1,c)?.block && cell(r+1,c)?.block) setDir('across');
      }
    }
    highlightWord();
    focusCell();
  }

  function focusCell(){
    document.querySelectorAll('.cell.active').forEach(e=>e.classList.remove('active'));
    cell(cur.row,cur.col)?.el.classList.add('active');
  }

  function getWordCells(r,c,d=dir){
    const list=[];
    // cari awal kata
    if(d==='across'){
      let cc=c; while(inBoard(r,cc-1) && !cell(r,cc-1).block) cc--;
      while(inBoard(r,cc) && !cell(r,cc).block){ list.push(cell(r,cc)); cc++; }
    }else{
      let rr=r; while(inBoard(rr-1,c) && !cell(rr-1,c).block) rr--;
      while(inBoard(rr,c) && !cell(rr,c).block){ list.push(cell(rr,c)); rr++; }
    }
    return list;
  }

  function highlightWord(){
    document.querySelectorAll('.cell.word').forEach(e=>e.classList.remove('word'));
    wordCells = getWordCells(cur.row,cur.col,dir);
    wordCells.forEach(c=>c.el.classList.add('word'));
    focusCell();
    highlightClue();
  }

  function moveNext(){
    const i = wordCells.findIndex(c=>c.row===cur.row && c.col===cur.col);
    if(i>=0 && i<wordCells.length-1){
      setCursor(wordCells[i+1].row, wordCells[i+1].col, true);
    }else{
      // di ujung kata, tidak pindah
      focusCell();
    }
  }
  function movePrev(){
    const i = wordCells.findIndex(c=>c.row===cur.row && c.col===cur.col);
    if(i>0){
      setCursor(wordCells[i-1].row, wordCells[i-1].col, true);
    }else{
      focusCell();
    }
  }

  function putChar(ch){
    ch = ch.toUpperCase();
    const ce = cell(cur.row,cur.col);
    if(!ce || ce.block) return;
    ce.letter = ch;
    ce.el.textContent = ch;
    answers.set(`${ce.row},${ce.col}`, ch);
    moveNext();
  }

  function backspace(){
    const ce = cell(cur.row,cur.col);
    if(!ce || ce.block) return;
    if(ce.letter){
      ce.letter = '';
      ce.el.textContent = '';
      answers.delete(`${ce.row},${ce.col}`);
    }else{
      movePrev();
      const ce2 = cell(cur.row,cur.col);
      if(ce2 && ce2.letter){
        ce2.letter='';
        ce2.el.textContent='';
        answers.delete(`${ce2.row},${ce2.col}`);
      }
    }
  }

  // ====== CLUES ======
  function renderClues(){
    $listAcross.innerHTML = '';
    ACROSS.forEach((cl,i)=>{
      const li=document.createElement('li');
      li.innerHTML = `<strong>${cl.no}.</strong> ${cl.clue}`;
      li.dataset.r = cl.row; li.dataset.c = cl.col; li.dataset.d='across';
      li.addEventListener('click', ()=>{
        setDir('across');
        setCursor(cl.row, cl.col, true);
      });
      $listAcross.appendChild(li);
    });

    $listDown.innerHTML = '';
    DOWN.forEach((cl,i)=>{
      const li=document.createElement('li');
      li.innerHTML = `<strong>${cl.no}.</strong> ${cl.clue}`;
      li.dataset.r = cl.row; li.dataset.c = cl.col; li.dataset.d='down';
      li.addEventListener('click', ()=>{
        setDir('down');
        setCursor(cl.row, cl.col, true);
      });
      $listDown.appendChild(li);
    });
  }

  function sameRun(a,b){
    return a && b && a.row===b.row && a.col===b.col;
  }
  function highlightClue(){
    document.querySelectorAll('#listAcross li.active, #listDown li.active')
      .forEach(li=>li.classList.remove('active'));

    const head = wordCells[0];
    if(!head) return;

    let found = [...$listAcross.children].find(li =>
      Number(li.dataset.r)===head.row &&
      Number(li.dataset.c)===head.col &&
      li.dataset.d==='across'
    );
    if(!found){
      found = [...$listDown.children].find(li =>
        Number(li.dataset.r)===head.row &&
        Number(li.dataset.c)===head.col &&
        li.dataset.d==='down'
      );
    }
    found && found.classList.add('active');
  }

  // ====== CHECK & RESET ======
  function checkAll(){
    // validasi dari daftar ACROSS & DOWN
    let ok = true;

    function checkEntry(list, dkey){
      for(const cl of list){
        const arr = getWordFrom(cl.row, cl.col, dkey);
        const got = arr.map(c=>c.letter||'_').join('');
        if(got !== cl.ans){
          ok = false;
          // highlight merah sementara
          arr.forEach(c=>{
            c.el.classList.add('wrong');
            setTimeout(()=>c.el.classList.remove('wrong'), 500);
          });
        }
      }
    }
    checkEntry(ACROSS,'across');
    checkEntry(DOWN,'down');

    if(ok){
      flashOK();
    }
  }

  function flashOK(){
    wordCells.forEach(c=>c.el.classList.add('ok'));
    setTimeout(()=>wordCells.forEach(c=>c.el.classList.remove('ok')), 600);
  }

  function getWordFrom(r,c,d){
    // seperti getWordCells tapi titik awal spesifik
    const list=[];
    if(d==='across'){
      let cc=c; while(inBoard(r,cc-1) && !cell(r,cc-1).block) cc--;
      while(inBoard(r,cc) && !cell(r,cc).block){ list.push(cell(r,cc)); cc++; }
    }else{
      let rr=r; while(inBoard(rr-1,c) && !cell(rr-1,c).block) rr--;
      while(inBoard(rr,c) && !cell(rr,c).block){ list.push(cell(rr,c)); rr++; }
    }
    return list;
  }

  function resetBoard(){
    CELLS.forEach(c=>{
      if(!c.block){
        c.letter = '';
        c.el.textContent = '';
      }
    });
    answers.clear();
    setDir('across');
    // cari cell playable pertama
    outer: for(let r=0;r<GRID_SIZE;r++){
      for(let c=0;c<GRID_SIZE;c++){
        if(!cell(r,c).block){ setCursor(r,c,true); break outer; }
      }
    }
  }

  // ====== KEYS ======
  function onKey(e){
    const k = e.key;
    if(k === ' '){
      e.preventDefault();
      setDir(dir==='across'?'down':'across');
      return;
    }
    if(k === 'ArrowLeft'){ e.preventDefault(); setCursor(cur.row, Math.max(0,cur.col-1), true); return; }
    if(k === 'ArrowRight'){ e.preventDefault(); setCursor(cur.row, Math.min(GRID_SIZE-1,cur.col+1), true); return; }
    if(k === 'ArrowUp'){ e.preventDefault(); setCursor(Math.max(0,cur.row-1), cur.col, true); return; }
    if(k === 'ArrowDown'){ e.preventDefault(); setCursor(Math.min(GRID_SIZE-1,cur.row+1), cur.col, true); return; }
    if(k === 'Backspace'){ e.preventDefault(); backspace(); return; }

    if(k.length === 1){
      const ch = k.toUpperCase();
      if(ch >= 'A' && ch <= 'Z'){
        e.preventDefault();
        putChar(ch);
      }
    }
  }

  // ====== INIT ======
  buildGrid();
  renderClues();
  resetBoard();

  document.addEventListener('keydown', onKey);
  $btnCheck?.addEventListener('click', checkAll);
  $btnReset?.addEventListener('click', resetBoard);
})();
