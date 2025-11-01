/* Azbry • Word Connect (hidden board + drag gesture) */
(() => {
  // ===== LEVELS =====
  const LEVELS = [
    { letters: 'KRGUSN', words: ['RUKUN','GURU','SUKU','KURUN','URUS','RUSUK','GUS','KUR','SUNGKUR','UNGU'] },
    { letters: 'PINARE', words: ['AIR','PAIN','PERAN','NAIK','RAIN','PEAR'] },
    { letters: 'LAMBER', words: ['AMAL','RAMAL','LAMB','BERLAR','LAMBER'] },
    { letters: 'SATURN', words: ['SATU','TURUN','RATUS','SANTUR'] },
    { letters: 'TANJIR', words: ['JARI','TANI','RANTAI','JARIT'] },
  ];

  // ===== ELEMENTS =====
  const el = {
    board: document.getElementById('board'),
    wheel: document.getElementById('wheel'),
    badge: document.getElementById('badge'),
    curWord: document.getElementById('curWord'),
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    levelNum: document.getElementById('levelNum'),
    log: document.getElementById('log'),
    btnSubmit: document.getElementById('btnSubmit'),
    btnShuffle: document.getElementById('btnShuffle'),
    btnClear: document.getElementById('btnClear'),
    btnHint: document.getElementById('btnHint'),
    btnReset: document.getElementById('btnReset'),
  };

  // ===== STATE =====
  const state = {
    level: Number(localStorage.getItem('azbry-wc-level') || 1),
    score: Number(localStorage.getItem('azbry-wc-score') || 0),
    best: Number(localStorage.getItem('azbry-wc-best') || 0),
    selected: [],
    usedWords: new Set(),
    grid: [], gridW: 12, gridH: 12,
    selecting: false,
  };

  // ===== UTILS =====
  const log = (m) => el.log.textContent = `[${new Date().toLocaleTimeString()}] ${m}\n` + el.log.textContent;
  const norm = s => (s||'').toUpperCase().replace(/[^A-Z]/g,'');
  const rand = arr => arr[Math.floor(Math.random()*arr.length)];

  function save(){ localStorage.setItem('azbry-wc-level', state.level); localStorage.setItem('azbry-wc-score', state.score); localStorage.setItem('azbry-wc-best', state.best); }
  function updateHUD(){ el.levelNum.textContent = state.level; el.score.textContent = state.score; el.best.textContent = state.best; }

  // ===== GRID GEN =====
  const blankGrid = (w,h)=>Array.from({length:h},()=>Array.from({length:w},()=>''));  

  function placeWord(grid, word){
    word = norm(word);
    const W = grid[0].length, H = grid.length;
    const cands = [];
    for (let y=0;y<H;y++) for (let x=0;x<=W-word.length;x++){
      let ok = true; for (let i=0;i<word.length;i++){ const ch=grid[y][x+i]; if (ch && ch!==word[i]) {ok=false;break;} }
      if (ok) cands.push({x,y,dir:'H'});
    }
    for (let x=0;x<W;x++) for (let y=0;y<=H-word.length;y++){
      let ok = true; for (let i=0;i<word.length;i++){ const ch=grid[y+i][x]; if (ch && ch!==word[i]) {ok=false;break;} }
      if (ok) cands.push({x,y,dir:'V'});
    }
    if (!cands.length) return false;
    const p = rand(cands);
    for (let i=0;i<word.length;i++) (p.dir==='H') ? grid[p.y][p.x+i]=word[i] : grid[p.y+i][p.x]=word[i];
    return true;
  }

  function buildBoard(words){
    const list = [...words].sort((a,b)=>b.length-a.length);
    let W=state.gridW, H=state.gridH;
    for (let t=0;t<8;t++){
      const g = blankGrid(W,H);
      let ok = true;
      for (const w of list){ if (!placeWord(g,w)) { ok=false; break; } }
      if (ok){ state.grid=g; return; }
      W++; H++;
    }
    state.grid = blankGrid(state.gridW,state.gridH);
  }

  function renderBoard(){
    el.board.innerHTML='';
    const H = state.grid.length, W = state.grid[0].length;
    for (let y=0;y<H;y++){
      for (let x=0;x<W;x++){
        const ch = state.grid[y][x];
        if (!ch){
          // slot tidak dipakai → tidak dibuat (agar rapih)
          const ph = document.createElement('div');
          ph.className = 'slot';
          ph.style.visibility='hidden';
          el.board.appendChild(ph);
          continue;
        }
        const cell = document.createElement('div');
        cell.className = 'slot';            // kosong default
        cell.dataset.letter = ch;           // simpan huruf (disembunyikan)
        cell.textContent = '';              // tidak tampil duluan
        cell.dataset.x = x; cell.dataset.y = y;
        el.board.appendChild(cell);
      }
    }
  }

  // cari posisi kata di grid
  function findPositions(word){
    word = norm(word);
    const H = state.grid.length, W = state.grid[0].length;
    // horizontal
    for (let y=0;y<H;y++){
      for (let x=0;x<=W - word.length;x++){
        let ok = true;
        for (let i=0;i<word.length;i++){ if (state.grid[y][x+i] !== word[i]) { ok=false; break; } }
        if (ok) return Array.from({length:word.length},(_,i)=>({x:x+i,y}));
      }
    }
    // vertical
    for (let x=0;x<W;x++){
      for (let y=0;y<=H - word.length;y++){
        let ok = true;
        for (let i=0;i<word.length;i++){ if (state.grid[y+i][x] !== word[i]) { ok=false; break; } }
        if (ok) return Array.from({length:word.length},(_,i)=>({x,y:y+i}));
      }
    }
    return null;
  }

  function reveal(word){
    const pos = findPositions(word); if (!pos) return false;
    const W = state.grid[0].length;
    pos.forEach(({x,y})=>{
      const idx = y*W + x;
      const cell = el.board.children[idx];
      cell.textContent = cell.dataset.letter || '';
      cell.classList.add('revealed');
    });
    return true;
  }

  // ===== WHEEL =====
  function layoutWheel(letters){
    [...el.wheel.querySelectorAll('.letter')].forEach(n=>n.remove());
    const R = (el.wheel.clientWidth/2) - 56;
    const cx = el.wheel.clientWidth/2, cy = el.wheel.clientHeight/2;
    const arr = letters.split(''); const N = arr.length;
    arr.forEach((ch,i)=>{
      const ang = (i/N)*Math.PI*2 - Math.PI/2;
      const x = cx + R*Math.cos(ang) - 37, y = cy + R*Math.sin(ang) - 37;
      const b = document.createElement('div');
      b.className = 'letter'; b.textContent = ch;
      b.style.left = x+'px'; b.style.top = y+'px';
      // tap click fallback
      b.addEventListener('click', () => addLetter(b, ch));
      el.wheel.appendChild(b);
    });
  }

  function addLetter(node, ch){
    if (node.classList.contains('sel')) return;
    state.selected.push(ch);
    node.classList.add('sel');
    el.curWord.textContent = state.selected.join('');
  }
  function clearSelection(){
    state.selected = []; el.curWord.textContent = '—';
    [...el.wheel.querySelectorAll('.letter.sel')].forEach(n=>n.classList.remove('sel'));
  }
  function shuffleLetters(){
    const lvl = LEVELS[state.level-1];
    const s = lvl.letters.split(''); for (let i=s.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [s[i],s[j]]=[s[j],s[i]]; }
    lvl.letters = s.join(''); layoutWheel(lvl.letters);
  }

  // ===== DRAG / SLIDE GESTURE =====
  function letterAtPoint(x,y){
    const els = document.elementsFromPoint(x,y);
    return els.find(e => e.classList && e.classList.contains('letter'));
  }
  function startSelect(e){
    state.selecting = true; clearSelection();
    updateSelect(e);
  }
  function endSelect(){
    if (!state.selecting) return;
    state.selecting = false;
    // auto-submit saat lepas
    submit();
  }
  function updateSelect(e){
    if (!state.selecting) return;
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    const node = letterAtPoint(p.clientX, p.clientY);
    if (node && !node.classList.contains('sel')){
      addLetter(node, node.textContent.trim());
    }
  }
  el.wheel.addEventListener('pointerdown', startSelect);
  window.addEventListener('pointermove', updateSelect);
  window.addEventListener('pointerup', endSelect);
  // touch fallback (Safari lama)
  el.wheel.addEventListener('touchstart', startSelect, {passive:false});
  el.wheel.addEventListener('touchmove', (e)=>{ e.preventDefault(); updateSelect(e); }, {passive:false});
  window.addEventListener('touchend', endSelect);

  // ===== GAME FLOW =====
  function loadLevel(n){
    state.level = Math.max(1, Math.min(LEVELS.length, n));
    const lvl = LEVELS[state.level-1];
    state.usedWords = new Set();
    clearSelection();
    buildBoard(lvl.words);
    renderBoard();
    layoutWheel(lvl.letters);
    el.badge.textContent = '⟳';
    updateHUD();
    log(`Level ${state.level} dimulai. Huruf: ${lvl.letters.split('').join(' • ')}`);
    save();
  }

  function submit(){
    const lvl = LEVELS[state.level-1];
    const word = norm(state.selected.join(''));
    if (!word){ log('Pilih huruf dulu.'); return; }
    const valid = lvl.words.map(norm);
    if (valid.includes(word)){
      if (state.usedWords.has(word)) { log('Kata sudah terisi.'); clearSelection(); return; }
      if (reveal(word)){
        state.usedWords.add(word);
        state.score += 10;
        state.best = Math.max(state.best, state.score);
        updateHUD(); save();
        log(`✅ Benar: ${word}`);
        clearSelection();
        if (state.usedWords.size === lvl.words.length){
          log('🎉 Level selesai! Naik level…');
          setTimeout(()=> loadLevel(state.level+1), 600);
        }
        return;
      }
    }
    log(`❌ Salah: ${word}`);
    clearSelection();
  }

  function hint(){
    const lvl = LEVELS[state.level-1];
    const remain = lvl.words.map(norm).filter(w=>!state.usedWords.has(w));
    if (!remain.length) return;
    const pick = rand(remain);
    reveal(pick);
    state.usedWords.add(pick);
    state.score = Math.max(0, state.score-5);
    updateHUD(); save();
    log(`💡 Hint mengisi: ${pick}`);
    if (state.usedWords.size === lvl.words.length){
      log('🎉 Level selesai! Naik level…');
      setTimeout(()=> loadLevel(state.level+1), 600);
    }
  }

  // ===== EVENTS =====
  el.btnSubmit.onclick = submit;
  el.btnClear.onclick = clearSelection;
  el.btnShuffle.onclick = shuffleLetters;
  el.btnHint.onclick = hint;
  el.btnReset.onclick = () => { state.score=0; state.best=Math.max(state.best,0); loadLevel(1); save(); log('Reset permainan.'); };
  window.addEventListener('resize', () => layoutWheel(LEVELS[state.level-1].letters));

  // ===== INIT =====
  loadLevel(state.level);
})();
