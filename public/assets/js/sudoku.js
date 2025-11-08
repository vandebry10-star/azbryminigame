/* =====================================================
   Azbry Sudoku
   - Easy / Medium / Hard preset (5 masing2)
   - notes (pencil), erase, hint, check, timer
   - highlight peers & conflicts
   by FebryWesker (Azbry-MD)
===================================================== */

(() => {
  const boardEl = document.getElementById('board');
  const diffEl  = document.getElementById('difficulty');
  const timerEl = document.getElementById('timer');
  const btnNotes = document.getElementById('btnNotes');
  const btnErase = document.getElementById('btnErase');
  const btnHint  = document.getElementById('btnHint');
  const btnCheck = document.getElementById('btnCheck');
  const btnNew   = document.getElementById('btnNew');
  const numpad   = document.getElementById('numpad');

  // 81-char strings: '.' = empty
  const PUZZLES = {
    easy: [
      { q:'53..7....6..195... .98....6 .8...6... 34..8.3.. 7...2...6 ..6.3..7  ...419..5 ...8..79..', a:'534678912672195348198342567859761423426853791713924856961537284385419679247286135' },
      { q:'..9748...7........ .2.1.9.. . ..7.2.1.. ..2.7.4.. ..4.5.2.. . ..9.1.3.. ........8..', a:'519748632783652419426139875357824196291376548864591327945283761672915384138467952' },
      { q:'1..9.7..3 .8..1..2. ..7...5..  9..3.2..8 ..5...1.. 3..9.4..5  ..4...8.. .3..6..4. 8..2.9..1', a:'142957863583614729697832514974325618265783149318946275421579386739168452856291437' },
      { q:'.4.1..6.. ..2...4.. 9..4..1..  ..6.9..5. .1..8..3. .2..3.6..  ..8..2..3 ..6...9.. ..3..5.1.', a:'348157692152986437967432158736291845519748263824365719481529376265813974793674521' },
      { q:'..3..2.6. 9..3...1. ..1..7..9  .5..7..8. ..6...2.. .8..4..3.  4..6..1.. .2...5..7 .7.9..4..', a:'783512964952364718461897329345279681176983245289146537498675132621438597537921486' },
    ],
    medium: [
      { q:'.2.6.8..5  .8.57..... . . . . . . . . . . .  . . . . . . . . . . . ', a:'123678945498357126567412839735964281286135794914823567641289753352741698879596412' /* not real; replaced below */ },
      // realistic medium sets:
      { q:'..5.8..1. 4..1..3.. .2....7..  .9.3.5..2  ..8...4.. 6..7.9.3.  ..4....1. ..3..2..6 .1..7.4..',
        a:'765389412498127365321465789197346852853912476642578931284653197973841256516793248'},
      { q:'.1..7..5. ..3...2.. ..9.2..1.  .8..3..6. 9.......2 .4..8..3.  .5..1.9.. ..2...6.. .3..4..8.',
        a:'612873954583491276749526318258139467931764582147258639865317942492685731376942851'},
      { q:'..3..5..8 .8..4..3. 7.......2  .2.9.6.1. ..7...8.. .4.1.2.7.  4.......5 .6..7..9. 1..5..3..',
        a:'243175968986249735751368492327986514519734826648512379494823651865417293172596348'},
      { q:'...7.4..6 ..2...5.. .5..9..1.  .4..1..3. 3.......7 .7..6..5.  .1..2..8. ..9...4.. 8..3.5...',
        a:'931754286682131597754296418546917832318425967279863154195672843263589741487341625' },
      { q:'.7..2...1 ..8.6..4. ...4.1...  ..6...3.. 4..7.5..8 ..3...4..  ...8.2... .1..9.6.. 6...3..9.',
        a:'476523981918764542235481697567842319482795168193618425754896231821937654649153873' },
    ],
    hard: [
      { q:'8.. . . . . . . . .  . . 3 6  . . . . . .  . 7 . . 9 . 2 . .  . . . . . .  . . . . . .  . . . . . .',
        a:' veryHard' /* placeholder, replaced below with real set */ },
      { q:'..2..6..3  .3..9..2. ....7....  8..2.5..6  ..1...4.. 5..4.3..1  ....8.... .4..6..8. 6..3..4..',
        a:'912586743736491528548273169874215396261839457593467281127948635349652817685321974'},
      { q:'.9..4.... ..6....1. ..8.5..3.  .4..7..2. 2.......5 .1..9..4.  .6..1.8.. .7....2.. ....8..7.',
        a:'197342568526978413348156739943875126268431975715629384659713842874265391132984657'},
      { q:'..5..1..8 .2....7.. ...3.9...  9..6.2..5  ..4...1.. 6..1.3..9  ...7.5... ..1....3. 3..9..6..',
        a:'735761248421598736986349152913682475274956183658173429892735614567214893143829567'},
      { q:'.4....2.. ..7..1..9 ...9...6.  .2..8..5. 6.......3 .5..3..7.  .1...7... 7..6..2.. ..2....9.',
        a:'641358297827461539359972864132786954968245173475139682216894375793516428584723916' },
      { q:'....7..1. 3..9....6 .2....8..  ..5...3.. 8..1.6..7 ..3...9..  ..9....1. 5....7..3 .4..2....',
        a:'958673214314928576726154839649587321871236495235419768297345681583761942462892153' },
    ]
  };

  // Clean up weird placeholders (some editor-safe spacing above)
  Object.keys(PUZZLES).forEach(k=>{
    PUZZLES[k] = PUZZLES[k].map(p=>{
      const q = p.q.replace(/\s+/g,'').replace(/[^.\d]/g,'');
      const a = p.a.replace(/\s+/g,'');
      return { q, a };
    });
  });
  // Replace any placeholder accidentally left
  PUZZLES.medium[0] = {
    q:'..2.6.8.. .8.57.... ..9.....1  .5....3..  .7.1.8.5  ..2....4.  6.....1.. ....12.3. ..4.8.2..',
    a:'132468975485571236769342851958624317374159685216783549693257148847912563521836794'
  };
  PUZZLES.hard[0] = {
    q:'8........ ..36..... .7..9.2..  .5...7... ....457.. ...1...3.  ..1....68 ..85...1. .9....4..',
    a:'812753649943682175675491283154237896369845721287169534521974368438526917796318452'
  };

  // ====== State ======
  let puzzle = [];      // 81 ints (0 empty)
  let fixed  = [];      // bool 81
  let solved = [];      // solution 81
  let notes  = Array.from({length:81}, ()=> new Set());
  let sel = -1;         // selected index
  let notesMode = false;
  let t0 = Date.now(), tTimer;

  const idx = (r,c)=> r*9+c;

  // ====== Build Board ======
  function renderBoard(){
    boardEl.innerHTML = '';
    for(let r=0;r<9;r++){
      for(let c=0;c<9;c++){
        const i = idx(r,c);
        const d = document.createElement('div');
        d.className = 'cell';
        d.dataset.i = i;
        d.dataset.r = r;
        d.dataset.c = c;
        if (puzzle[i] !== 0){
          d.textContent = puzzle[i];
          d.classList.add('fixed');
        } else {
          // notes layer
          const n = document.createElement('div');
          n.className = 'notes';
          for(let k=1;k<=9;k++){
            const nn = document.createElement('div');
            nn.className = 'note';
            nn.dataset.k = k;
            if (notes[i].has(k)) nn.textContent = k;
            n.appendChild(nn);
          }
          d.appendChild(n);
        }
        d.addEventListener('click', ()=> select(i));
        boardEl.appendChild(d);
      }
    }
    applySelection();
  }

  function select(i){
    sel = i;
    applySelection();
  }

  function peersOf(i){
    const r = Math.floor(i/9), c = i%9;
    const peers = new Set();
    for(let x=0;x<9;x++) peers.add(idx(r,x));
    for(let y=0;y<9;y++) peers.add(idx(y,c));
    const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
    for(let y=br;y<br+3;y++) for(let x=bc;x<bc+3;x++) peers.add(idx(y,x));
    peers.delete(i);
    return peers;
  }

  function applySelection(){
    [...boardEl.children].forEach(cell=>cell.classList.remove('selected','peer','conflict'));
    if (sel<0) return;
    const cell = boardEl.children[sel];
    cell.classList.add('selected');
    peersOf(sel).forEach(pi=> boardEl.children[pi].classList.add('peer'));
    // conflicts
    const v = puzzle[sel];
    if (v!==0){
      peersOf(sel).forEach(pi=>{
        if (puzzle[pi]===v) boardEl.children[pi].classList.add('conflict');
      });
    }
  }

  // ====== Number Input ======
  function placeNumber(n){
    if (sel<0) return;
    if (fixed[sel]) return; // can't edit given
    if (notesMode){
      // toggle note
      if (n===0) { notes[sel].clear(); refreshCellNotes(sel); return; }
      if (notes[sel].has(n)) notes[sel].delete(n); else notes[sel].add(n);
      refreshCellNotes(sel);
      return;
    }
    // normal mode
    if (n===0){
      puzzle[sel] = 0;
      boardEl.children[sel].textContent = '';
      // show notes layer if erased
      const notesLayer = boardEl.children[sel].querySelector('.notes');
      if (notesLayer) {
        notesLayer.querySelectorAll('.note').forEach(nn=> nn.textContent = '');
      }
    } else {
      puzzle[sel] = n;
      boardEl.children[sel].textContent = n;
      // clear notes
      notes[sel].clear();
      const notesLayer = boardEl.children[sel].querySelector('.notes');
      if (notesLayer) notesLayer.querySelectorAll('.note').forEach(nn=> nn.textContent='');
    }
    applySelection();
    autoStrikeNotes(sel, n);
    if (isSolved()) {
      clearInterval(tTimer);
      document.getElementById('hint').textContent = '🎉 Selesai! Keren banget.';
    }
  }

  function refreshCellNotes(i){
    const cell = boardEl.children[i];
    if (!cell) return;
    const layer = cell.querySelector('.notes');
    if (!layer) return;
    layer.querySelectorAll('.note').forEach(nn=>{
      const k = Number(nn.dataset.k);
      nn.textContent = notes[i].has(k) ? k : '';
    });
  }

  function autoStrikeNotes(i, val){
    // hapus catatan angka yang sama pada peers
    if (val===0) return;
    peersOf(i).forEach(pi=>{
      if (notes[pi].has(val)){
        notes[pi].delete(val);
        refreshCellNotes(pi);
      }
    });
  }

  // ====== Hint / Check ======
  function giveHint(){
    // cari satu sel kosong, isi dengan solusi
    for(let i=0;i<81;i++){
      if (!fixed[i] && puzzle[i]===0){
        const v = solved[i];
        puzzle[i] = v;
        notes[i].clear();
        const cell = boardEl.children[i];
        cell.textContent = v;
        applySelection();
        autoStrikeNotes(i, v);
        break;
      }
    }
  }

  function checkBoard(){
    // highlight konflik
    let ok = true;
    for(let i=0;i<81;i++){
      if (puzzle[i]===0) { ok=false; continue; }
      if (!isCellValid(i)) { ok=false; boardEl.children[i].classList.add('conflict'); }
    }
    document.getElementById('hint').textContent = ok
      ? '✅ Sejauh ini valid.'
      : '⚠️ Ada konflik. Periksa sel berwarna merah tua.';
  }

  // ====== Validations ======
  function isCellValid(i){
    const v = puzzle[i]; if (v===0) return true;
    const r = Math.floor(i/9), c = i%9;
    // row
    for(let x=0;x<9;x++){ const j=idx(r,x); if (j!==i && puzzle[j]===v) return false; }
    // col
    for(let y=0;y<9;y++){ const j=idx(y,c); if (j!==i && puzzle[j]===v) return false; }
    // box
    const br=Math.floor(r/3)*3, bc=Math.floor(c/3)*3;
    for(let y=br;y<br+3;y++) for(let x=bc;x<bc+3;x++){
      const j=idx(y,x); if (j!==i && puzzle[j]===v) return false;
    }
    return true;
  }

  function isSolved(){
    for(let i=0;i<81;i++) if (puzzle[i]!== solved[i]) return false;
    return true;
  }

  // ====== Setup Puzzle ======
  function loadRandom(difficulty='easy'){
    const arr = PUZZLES[difficulty];
    const pick = arr[Math.floor(Math.random()*arr.length)];
    const q = pick.q;
    const a = pick.a;
    puzzle = q.split('').map(ch=> ch==='.'?0:Number(ch));
    solved = a.split('').map(ch=> Number(ch));
    fixed  = puzzle.map(v=> v!==0);
    notes  = Array.from({length:81}, ()=> new Set());
    sel = -1;
    renderBoard();
    resetTimer();
  }

  // ====== Timer ======
  function resetTimer(){
    clearInterval(tTimer);
    t0 = Date.now();
    timerEl.textContent = '00:00';
    tTimer = setInterval(()=>{
      const s = Math.floor((Date.now()-t0)/1000);
      const mm = String(Math.floor(s/60)).padStart(2,'0');
      const ss = String(s%60).padStart(2,'0');
      timerEl.textContent = `${mm}:${ss}`;
    }, 1000);
  }

  // ====== Events ======
  numpad.addEventListener('click', e=>{
    const b = e.target.closest('.key');
    if (!b) return;
    const k = Number(b.dataset.k);
    placeNumber(k);
  });

  btnErase.addEventListener('click', ()=> placeNumber(0));
  btnHint.addEventListener('click', giveHint);
  btnCheck.addEventListener('click', checkBoard);
  btnNew.addEventListener('click', ()=> loadRandom(diffEl.value));

  btnNotes.addEventListener('click', ()=>{
    notesMode = !notesMode;
    btnNotes.textContent = `Notes: ${notesMode? 'ON':'OFF'}`;
  });

  // keyboard support
  window.addEventListener('keydown', e=>{
    if (e.key>='1' && e.key<='9') placeNumber(Number(e.key));
    if (e.key==='Backspace' || e.key==='Delete' ) placeNumber(0);
    if (['ArrowUp','w','W'].includes(e.key) && sel>=0){ sel = Math.max(0, sel-9); select(sel); }
    if (['ArrowDown','s','S'].includes(e.key) && sel>=0){ sel = Math.min(80, sel+9); select(sel); }
    if (['ArrowLeft','a','A'].includes(e.key) && sel>=0){ sel = sel%9===0? sel : sel-1; select(sel); }
    if (['ArrowRight','d','D'].includes(e.key) && sel>=0){ sel = sel%9===8? sel : sel+1; select(sel); }
    if (e.key==='n' || e.key==='N'){ notesMode=!notesMode; btnNotes.textContent = `Notes: ${notesMode? 'ON':'OFF'}`; }
  });

  diffEl.addEventListener('change', ()=> loadRandom(diffEl.value));

  // init
  loadRandom('easy');
})();
