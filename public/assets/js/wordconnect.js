/* Azbry • Word Connect (clean version — auto submit, no manual buttons) */
(() => {
  // ===== LEVELS =====
  const LEVELS = [
  { letters: 'BATIK', words: ['BATIK','BAKTI','IKAT','TIBA','KITA','TIKA','BAKI'] },
  { letters: 'SAKIT', words: ['SAKIT','SIKAT','TAKSI','AKSI','KATA','TIKA','SITA'] },
  { letters: 'PASIR', words: ['PASIR','SIRAP','PRIA','RAPI','SARI','ASRI','IRIS'] },
  { letters: 'MELATI', words: ['MELATI','TELAI','ELIT','TALI','LIMA','TEMA','MATA'] },
  { letters: 'IKLAN', words: ['IKLAN','KAIN','NAIK','KALI','KIAN','LAIN','IKAL'] },
  { letters: 'RUMAH', words: ['RUMAH','HARUM','ARUM','HUMA','HARI','MAHU'] },
  { letters: 'KAPUR', words: ['KAPUR','PAKU','RUPA','PURA','KURA','ARPU','AKU'] },
  { letters: 'SEPEDA', words: ['SEPEDA','SAPA','SEPA','PELA','LEPAS','PELAS'] },
  { letters: 'GARIS', words: ['GARIS','SARI','RASI','ASRI','IRIS','RIGA'] },
  { letters: 'SENJA', words: ['SENJA','JASA','SENA','NESA','JAN','ESA','ANE'] },
  { letters: 'KOPIAH', words: ['KOPIAH','KOPI','PAKAI','PAI','PAK','OHA'] },
  { letters: 'GARAMU', words: ['GARAM','AGAR','RAGA','AMAR','ARUM','RAMA'] },
  { letters: 'KAMBING', words: ['KAMBING','BINGKA','BINA','KAMI','AMIN','GAMI'] },
  { letters: 'CABAIK', words: ['CABAI','BAIK','BACA','AKIB','ABAI','KACA','BIA'] },
  { letters: 'ROTANG', words: ['ROTAN','TANG','RANG','RONTGA','RONA','TARO'] },
  { letters: 'SAYUR', words: ['SAYUR','RASA','SURA','AYU','RAYA','SURAU'] },
  { letters: 'NASIRO', words: ['NASI','SION','SARI','RONA','ORANG','ARIS','RISA'] },
  { letters: 'LAPANG', words: ['LAPANG','PALANG','LAGAN','LAGA','PALA','LANG'] },
  { letters: 'TANJUR', words: ['TANJUR','TARUN','JUTA','JARUT','TARU','JURAT'] },
  { letters: 'RAMBUT', words: ['RAMBUT','TARUM','BURAM','TARU','RATU','TUBA'] },
];

  // ===== ELEMENTS =====
  const el = {
    board: document.getElementById('board'),
    wheel: document.getElementById('wheel'),
    trail: document.getElementById('trail'),
    badge: document.getElementById('badge'),
    curWord: document.getElementById('curWord'),
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    levelNum: document.getElementById('levelNum'),
    log: document.getElementById('log'),
    btnShuffle: document.getElementById('btnShuffle'),
    topHint: document.getElementById('topHint')
  };
  const ctx = el.trail.getContext('2d');

  // ===== STATE =====
  const state = {
    level: Number(localStorage.getItem('azbry-wc-level') || 1),
    score: Number(localStorage.getItem('azbry-wc-score') || 0),
    best: Number(localStorage.getItem('azbry-wc-best') || 0),
    selected: [],
    usedWords: new Set(),
    grid: [], gridW: 12, gridH: 12,
    selecting: false,
    lastNode: null,
    points: [],
  };

  // ===== UTILS =====
  const log = (m) => el.log.textContent = `[${new Date().toLocaleTimeString()}] ${m}\n` + el.log.textContent;
  const norm = s => (s||'').toUpperCase().replace(/[^A-Z]/g,'');
  const rand = arr => arr[Math.floor(Math.random()*arr.length)];
  const save = () => { localStorage.setItem('azbry-wc-level', state.level); localStorage.setItem('azbry-wc-score', state.score); localStorage.setItem('azbry-wc-best', state.best); };
  const updateHUD = () => { el.levelNum.textContent = state.level; el.score.textContent = state.score; el.best.textContent = state.best; };
  const setTopHint = text => { if (el.topHint) el.topHint.textContent = text; };

  // ===== CANVAS =====
  function fitCanvas(){
    const r = el.wheel.getBoundingClientRect();
    el.trail.width = Math.max(1, Math.round(r.width));
    el.trail.height = Math.max(1, Math.round(r.height));
  }

  // ===== GRID =====
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
          const ph = document.createElement('div');
          ph.className = 'slot';
          ph.style.visibility = 'hidden';
          el.board.appendChild(ph);
          continue;
        }
        const cell = document.createElement('div');
        cell.className = 'slot';
        cell.dataset.letter = ch;
        cell.textContent = '';
        el.board.appendChild(cell);
      }
    }
  }

  function findPositions(word){
    word = norm(word);
    const H = state.grid.length, W = state.grid[0].length;
    for (let y=0;y<H;y++){
      for (let x=0;x<=W - word.length;x++){
        let ok = true;
        for (let i=0;i<word.length;i++){ if (state.grid[y][x+i] !== word[i]) { ok=false; break; } }
        if (ok) return Array.from({length:word.length},(_,i)=>({x:x+i,y}));
      }
    }
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
    const w = el.wheel.clientWidth, h = el.wheel.clientHeight;
    if (w < 40 || h < 40) return;
    const R = (w/2) - 56;
    const cx = w/2, cy = h/2;
    const arr = letters.split(''); const N = arr.length;
    arr.forEach((ch,i)=>{
      const ang = (i/N)*Math.PI*2 - Math.PI/2;
      const x = cx + R*Math.cos(ang) - 37, y = cy + R*Math.sin(ang) - 37;
      const b = document.createElement('div');
      b.className = 'letter'; b.textContent = ch;
      b.style.left = x+'px'; b.style.top = y+'px';
      b.addEventListener('click', () => addLetter(b, ch, true));
      el.wheel.appendChild(b);
    });
    fitCanvas();
  }

  const getCenterOnCanvas = node => {
    const wr = el.wheel.getBoundingClientRect();
    const nr = node.getBoundingClientRect();
    return { x: (nr.left - wr.left) + nr.width/2, y: (nr.top - wr.top) + nr.height/2 };
  };

  function drawTrail(previewPoint=null){
    ctx.clearRect(0,0,el.trail.width, el.trail.height);
    if (state.points.length === 0) return;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(184,255,154,0.95)';
    ctx.shadowColor = 'rgba(184,255,154,0.65)';
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.moveTo(state.points[0].x, state.points[0].y);
    for (let i=1;i<state.points.length;i++) ctx.lineTo(state.points[i].x, state.points[i].y);
    if (previewPoint) ctx.lineTo(previewPoint.x, previewPoint.y);
    ctx.stroke();
  }

  function addLetter(node, ch, flash=false){
    state.selected.push(ch);
    el.curWord.textContent = state.selected.join('');
    const p = getCenterOnCanvas(node);
    state.points.push(p);
    drawTrail();
    if (flash){
      node.classList.add('flash');
      setTimeout(()=>node.classList.remove('flash'),160);
    }
  }

  function clearSelection(){
    state.selected = [];
    state.points = [];
    state.lastNode = null;
    el.curWord.textContent = '—';
    ctx.clearRect(0,0,el.trail.width, el.trail.height);
  }

  function shuffleLetters(){
    const lvl = LEVELS[state.level-1];
    const s = lvl.letters.split('');
    for (let i=s.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [s[i],s[j]]=[s[j],s[i]]; }
    lvl.letters = s.join('');
    layoutWheel(lvl.letters);
    clearSelection();
  }

  // ===== INPUT DRAG =====
  function letterAtPoint(x,y){
    const els = document.elementsFromPoint(x,y);
    return els.find(e => e.classList && e.classList.contains('letter'));
  }
  function startSelect(e){
    state.selecting = true;
    clearSelection();
    updateSelect(e);
  }
  function endSelect(){
    if (!state.selecting) return;
    state.selecting = false;
    drawTrail();
    submit();
  }
  function updateSelect(e){
    if (!state.selecting) return;
    const pt = (e.touches && e.touches[0]) ? e.touches[0] : e;
    const node = letterAtPoint(pt.clientX, pt.clientY);
    if (node && node !== state.lastNode){
      state.lastNode = node;
      addLetter(node, node.textContent.trim());
    }
    const wr = el.wheel.getBoundingClientRect();
    drawTrail({ x: pt.clientX - wr.left, y: pt.clientY - wr.top });
  }

  el.wheel.addEventListener('pointerdown', startSelect);
  window.addEventListener('pointermove', updateSelect);
  window.addEventListener('pointerup', endSelect);
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
    updateHUD();
    const sisa = lvl.words.length - state.usedWords.size;
    setTopHint(`Hint: Geser huruf untuk membentuk kata. Sisa ${sisa} kata.`);
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
        const sisa = lvl.words.length - state.usedWords.size;
        setTopHint(`✅ Benar: “${word}”. Sisa ${sisa} kata.`);
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
    setTopHint(`Coba lagi… “${word}” belum cocok.`);
    clearSelection();
  }

  // ===== BUTTONS =====
  el.btnShuffle.onclick = shuffleLetters;

  window.addEventListener('resize', () => {
    fitCanvas();
    layoutWheel(LEVELS[state.level-1].letters);
  });

  // ===== INIT =====
  fitCanvas();
  loadLevel(state.level);
  window.addEventListener('load', () => {
    layoutWheel(LEVELS[state.level-1].letters);
    setTimeout(() => layoutWheel(LEVELS[state.level-1].letters), 200);
  });
})();
