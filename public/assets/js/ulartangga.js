/* Ular Tangga 2P — Azbry Minigame */
(() => {
  // ===== CONFIG =====
  const SIZE = 10;       // 10x10
  const GOAL = 100;      // finish tile
  const STEP_MS = 220;   // animation per step
  const AUTO_MS = 500;   // auto roll speed

  // Snakes & ladders (classic-ish, boleh ubah sesuka hati)
  // key: start -> end
  const LADDERS = {
    2: 23,   6: 45,   8: 12,  14: 32,  20: 41,
    29: 54,  36: 57,  44: 66,  51: 67,  71: 92
  };
  const SNAKES = {
    98: 78,  95: 75,  93: 73,  87: 56,  64: 60,
    62: 19,  49: 30,  48: 26,  24: 5,   17: 7
  };

  // ===== STATE =====
  const state = {
    pos: { p1: 1, p2: 1 },
    turn: 'p1',
    steps: 0,
    rolling: false,
    auto: null
  };

  // ===== ELEMENTS =====
  const el = {
    board: document.getElementById('board'),
    dice: document.getElementById('dice'),
    turnBadge: document.getElementById('turnBadge'),
    pos1: document.getElementById('pos1'),
    pos2: document.getElementById('pos2'),
    steps: document.getElementById('steps'),
    log: document.getElementById('log'),
    btnRoll: document.getElementById('btnRoll'),
    btnAuto: document.getElementById('btnAuto'),
    btnReset: document.getElementById('btnReset'),
  };

  // ===== UTILS =====
  function log(m) {
    el.log.textContent = `[${new Date().toLocaleTimeString()}] ${m}\n` + el.log.textContent;
  }
  function updateBadges() {
    el.pos1.textContent = state.pos.p1;
    el.pos2.textContent = state.pos.p2;
    el.steps.textContent = state.steps;
    el.turnBadge.textContent = `Giliran: ${state.turn.toUpperCase()}`;
    el.turnBadge.classList.toggle('turn', true);
    setTimeout(()=>el.turnBadge.classList.remove('turn'), 250);
  }

  // Number -> grid cell index (row, col) with zigzag rows
  function numToRowCol(n){
    const zero = n - 1;
    const rowFromBottom = Math.floor(zero / SIZE);
    const row = SIZE - 1 - rowFromBottom; // 0..9 top->bottom
    const offset = zero % SIZE;
    const isEvenRowFromBottom = rowFromBottom % 2 === 0;
    const col = isEvenRowFromBottom ? offset : SIZE - 1 - offset;
    return { row, col };
  }

  // Place token visually
  function placeToken(elToken, n, offset = 0){
    const { row, col } = numToRowCol(n);
    const cellW = el.board.clientWidth / SIZE;
    const cellH = el.board.clientHeight / SIZE;
    // small offset so two tokens don't overlap perfectly
    const x = col * cellW + cellW * 0.15 + (offset ? cellW * 0.45 : 0);
    const y = row * cellH + cellH * 0.55;
    elToken.style.transform = `translate(${x}px, ${y}px)`;
  }

  // Draw cells 1..100
  function drawBoard(){
    el.board.innerHTML = '';
    for (let i = GOAL; i >= 1; i--){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.num = i;
      cell.textContent = i;
      el.board.appendChild(cell);
    }

    // Draw ladders & snakes "stripes"
    const drawStrip = (from, to, cls) => {
      const a = numToRowCol(from);
      const b = numToRowCol(to);
      const w = el.board.clientWidth / SIZE;
      const h = el.board.clientHeight / SIZE;

      const x1 = (a.col + .5) * w, y1 = (a.row + .5) * h;
      const x2 = (b.col + .5) * w, y2 = (b.row + .5) * h;

      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      const bar = document.createElement('div');
      bar.className = cls;
      bar.style.width = `${len}px`;
      bar.style.height = cls === 'ladder' ? '10px' : '8px';
      bar.style.left = `${x1}px`;
      bar.style.top = `${y1}px`;
      bar.style.transformOrigin = '0 50%';
      bar.style.transform = `rotate(${angle}deg)`;
      el.board.appendChild(bar);
    };

    Object.entries(LADDERS).forEach(([s,e]) => drawStrip(+s,+e,'ladder'));
    Object.entries(SNAKES).forEach(([s,e]) => drawStrip(+s,+e,'snake'));

    // Tokens
    tokenP1 = document.createElement('div');
    tokenP2 = document.createElement('div');
    tokenP1.className = 'token p1'; tokenP1.textContent = '1';
    tokenP2.className = 'token p2'; tokenP2.textContent = '2';
    el.board.appendChild(tokenP1); el.board.appendChild(tokenP2);

    // Initial place
    placeToken(tokenP1, state.pos.p1, 0);
    placeToken(tokenP2, state.pos.p2, 1);
  }

  // Animate move step by step
  function moveSteps(player, steps, cb){
    if (steps <= 0) { cb?.(); return; }
    state.rolling = true;
    let i = 0;
    const iv = setInterval(() => {
      if (i >= steps) { clearInterval(iv); state.rolling = false; cb?.(); return; }
      const cur = state.pos[player];
      if (cur < GOAL) state.pos[player] = Math.min(cur + 1, GOAL);
      updateToken(player);
      i++;
    }, STEP_MS);
  }

  function updateToken(player){
    const token = player === 'p1' ? tokenP1 : tokenP2;
    placeToken(token, state.pos[player], player === 'p2' ? 1 : 0);
    updateBadges();
  }

  // After landing, check snake/ladder
  function checkSnakeLadder(player){
    const cur = state.pos[player];
    if (LADDERS[cur]) {
      state.pos[player] = LADDERS[cur];
      updateToken(player);
      log(`🪜 ${player.toUpperCase()} naik tangga: ${cur} → ${state.pos[player]}`);
    } else if (SNAKES[cur]) {
      state.pos[player] = SNAKES[cur];
      updateToken(player);
      log(`🐍 ${player.toUpperCase()} digigit ular: ${cur} → ${state.pos[player]}`);
    }
  }

  // Roll dice (1..6)
  function roll(){
    if (state.rolling) return;
    const who = state.turn;
    const d = 1 + Math.floor(Math.random()*6);
    el.dice.textContent = d;
    log(`🎲 ${who.toUpperCase()} kocok: ${d}`);

    const cur = state.pos[who];
    if (cur + d > GOAL) {
      log(`Lewat target. Harus pas di ${GOAL}.`);
      // switch turn
      state.turn = (who === 'p1') ? 'p2' : 'p1';
      updateBadges();
      return;
    }

    state.steps++;
    moveSteps(who, d, () => {
      checkSnakeLadder(who);
      // win?
      if (state.pos[who] === GOAL){
        log(`🏆 ${who.toUpperCase()} MENANG!`);
        alert(`${who.toUpperCase()} MENANG!`);
        stopAuto();
        return;
      }
      // next turn
      state.turn = (who === 'p1') ? 'p2' : 'p1';
      updateBadges();
      // auto chain
      if (state.auto) setTimeout(roll, AUTO_MS);
    });
  }

  function startAuto(){
    if (state.auto) { stopAuto(); return; }
    state.auto = true;
    el.btnAuto.classList.add('seg','active');
    log('Auto ON.');
    if (!state.rolling) setTimeout(roll, 300);
  }
  function stopAuto(){
    if (!state.auto) return;
    state.auto = false;
    el.btnAuto.classList.remove('seg','active');
    log('Auto OFF.');
  }

  function resetGame(){
    stopAuto();
    state.pos.p1 = 1; state.pos.p2 = 1;
    state.turn = 'p1';
    state.steps = 0;
    el.dice.textContent = '–';
    drawBoard();
    updateBadges();
    log('Reset permainan.');
  }

  // Global tokens
  let tokenP1, tokenP2;

  // Init
  drawBoard();
  updateBadges();
  log('Selamat datang di Ular Tangga 2P. Kocok dadu untuk mulai!');

  // Events
  el.btnRoll.onclick = () => roll();
  el.btnAuto.onclick = () => { state.auto ? stopAuto() : startAuto(); };
  el.btnReset.onclick = () => resetGame();
  window.addEventListener('resize', () => {
    // Re-place tokens on resize so they stay in cell center
    placeToken(tokenP1, state.pos.p1, 0);
    placeToken(tokenP2, state.pos.p2, 1);
  });
})();
