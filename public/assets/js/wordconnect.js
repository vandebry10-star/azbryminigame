/* Azbry • Word Connect */
(() => {
  // ===== LEVEL PACK =====
  // Tiap level: letters (unik, boleh duplikat) + daftar kata target
  // Posisi crossword auto-generate sederhana (left→right / top→bottom)
  const LEVELS = [
    // Level 1 — set yang ada di screenshot (huruf: K R G U N S)
    { letters: 'KRGUSN', words: ['RUKUN','GURU','SUKU','KURUN','URUS','RUSUK','GUS','KUR','SUNGKUR','UNGU'] },
    // Level 2
    { letters: 'PINARE', words: ['AIR','PAIN','PERAI','PERAN','PAINER','PELANGI'.slice(0,5)] }, // variasi ringan
    // Level 3
    { letters: 'LAMBER', words: ['AMAL','BELAR','BERLAR','RAMAL','LAMBER'] },
    // Level 4
    { letters: 'SATURN', words: ['TURUN','SATU','SANTUR','RANTU','TARUN'] },
    // Level 5
    { letters: 'TANJIR', words: ['INAR','RANTI','JARI','TARIN','JANTIR'] },
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
    grid: [], // 2D char
    gridW: 12, gridH: 12,
  };

  // ===== UTIL =====
  const log = (m) => el.log.textContent = `[${new Date().toLocaleTimeString()}] ${m}\n` + el.log.textContent;
  const norm = s => (s||'').toUpperCase().replace(/[^A-Z]/g,'');
  const rand = arr => arr[Math.floor(Math.random()*arr.length)];

  function save(){
    localStorage.setItem('azbry-wc-level', state.level);
    localStorage.setItem('azbry-wc-score', state.score);
    localStorage.setItem('azbry-wc-best', state.best);
  }
  function updateHUD(){
    el.levelNum.textContent = state.level;
    el.score.textContent = state.score;
    el.best.textContent = state.best;
  }

  // ===== BOARD GEN (sederhana) =====
  function blankGrid(w,h){ return Array.from({length:h},()=>Array.from({length:w},()=>'')); }

  // menempatkan kata ke grid (coba horizontal lalu vertikal)
  function placeWord(grid, word){
    word = norm(word);
    const W = grid[0].length, H = grid.length;
    const candidates = [];

    // horizontal
    for (let y=0;y<H;y++){
      for (let x=0;x<=W - word.length;x++){
        let ok = true;
        for (let i=0;i<word.length;i++){
          const ch = grid[y][x+i];
          if (ch && ch !== word[i]) { ok=false; break; }
        }
        if (ok) candidates.push({x,y,dir:'H'});
      }
    }
    // vertical
    for (let x=0;x<W;x++){
      for (let y=0;y<=H - word.length;y++){
        let ok = true;
        for (let i=0;i<word.length;i++){
          const ch = grid[y+i][x];
          if (ch && ch !== word[i]) { ok=false; break; }
        }
        if (ok) candidates.push({x,y,dir:'V'});
      }
    }

    if (!candidates.length) return false;
    const pick = rand(candidates);
    for (let i=0;i<word.length;i++){
      if (pick.dir==='H') grid[pick.y][pick.x+i] = word[i];
      else grid[pick.y+i][pick.x] = word[i];
    }
    return true;
  }

  function buildBoard(words){
    // urutkan biar mudah nempel (kata panjang dulu)
    const list = [...words].sort((a,b)=>b.length-a.length);
    let W=state.gridW, H=state.gridH;
    for (let tries=0; tries<8; tries++){
      const g = blankGrid(W,H);
      let ok = true;
      for (const w of list){
        if (!placeWord(g,w)) { ok=false; break; }
      }
      if (ok) { state.grid = g; return; }
      // kalau gagal, perbesar grid sedikit
      W++; H++;
    }
    // fallback
    state.grid = blankGrid(state.gridW,state.gridH);
    list.forEach((w,i)=>{ for (let j=0;j<w.length && j<state.gridW;j++) state.grid[i%state.gridH][j]=norm(w)[j]; });
  }

  function renderBoard(){
    el.board.innerHTML = '';
    for (let y=0;y<state.grid.length;y++){
      for (let x=0;x<state.grid[0].length;x++){
        const ch = state.grid[y][x];
        const div = document.createElement('div');
        div.className = ch ? 'cell empty' : 'cell empty';
        div.textContent = ch ? ch : '';
        if (!ch) div.style.visibility='hidden'; // hanya slot yang dipakai yang terlihat
        div.dataset.x = x; div.dataset.y = y;
        el.board.appendChild(div);
      }
    }
  }

  // Saat kata benar, fill sel terkait menjadi “lock”
  function fillWord(word){
    word = norm(word);
    // scan horizontal
    for (let y=0;y<state.grid.length;y++){
      for (let x=0;x<=state.grid[0].length - word.length;x++){
        let ok = true;
        for (let i=0;i<word.length;i++){
          if (state.grid[y][x+i] !== word[i]) { ok=false; break; }
        }
        if (ok){
          for (let i=0;i<word.length;i++){
            const idx = y*state.grid[0].length + (x+i);
            const cell = el.board.children[idx];
            cell.classList.remove('empty'); cell.classList.add('lock');
          }
          return true;
        }
      }
    }
    // scan vertical
    for (let x=0;x<state.grid[0].length;x++){
      for (let y=0;y<=state.grid.length - word.length;y++){
        let ok = true;
        for (let i=0;i<word.length;i++){
          if (state.grid[y+i][x] !== word[i]) { ok=false; break; }
        }
        if (ok){
          for (let i=0;i<word.length;i++){
            const idx = (y+i)*state.grid[0].length + x;
            const cell = el.board.children[idx];
            cell.classList.remove('empty'); cell.classList.add('lock');
          }
          return true;
        }
      }
    }
    return false;
  }

  // ===== WHEEL =====
  function layoutWheel(letters){
    // hapus huruf lama
    [...el.wheel.querySelectorAll('.letter')].forEach(n=>n.remove());

    const R = (el.wheel.clientWidth/2) - 56;
    const cx = el.wheel.clientWidth/2, cy = el.wheel.clientHeight/2;

    const arr = letters.split('');
    const N = arr.length;
    arr.forEach((ch,i)=>{
      const ang = (i/N) * Math.PI*2 - Math.PI/2;
      const x = cx + R*Math.cos(ang) - 37, y = cy + R*Math.sin(ang) - 37;
      const b = document.createElement('div');
      b.className = 'letter';
      b.style.left = x+'px'; b.style.top = y+'px';
      b.textContent = ch;
      b.addEventListener('click', () => selectLetter(b, ch));
      el.wheel.appendChild(b);
    });
  }

  function selectLetter(btn, ch){
    if (btn.classList.contains('sel')) return;
    state.selected.push(ch);
    btn.classList.add('sel');
    el.curWord.textContent = state.selected.join('');
  }

  function clearSelection(){
    state.selected = [];
    el.curWord.textContent = '—';
    [...el.wheel.querySelectorAll('.letter.sel')].forEach(n=>n.classList.remove('sel'));
  }

  function shuffleLetters(){
    const lvl = LEVELS[state.level-1];
    const s = lvl.letters.split('');
    for (let i=s.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [s[i],s[j]]=[s[j],s[i]]; }
    lvl.letters = s.join('');
    layoutWheel(lvl.letters);
  }

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
      if (fillWord(word)){
        state.usedWords.add(word);
        state.score += 10;
        state.best = Math.max(state.best, state.score);
        updateHUD(); save();
        log(`✅ Benar: ${word}`);
        clearSelection();
        // selesai level?
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
    fillWord(pick);
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
  window.addEventListener('resize', () => {
    const lvl = LEVELS[state.level-1];
    layoutWheel(lvl.letters);
  });

  // ===== INIT =====
  loadLevel(state.level);
})();
