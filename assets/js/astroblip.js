/* Astro Blip — Azbry-MD (portrait, Azbry theme)
   - batas gerak tank
   - cooldown real + bar
   - score & best (localStorage)
   - tap = shoot, drag = gerak
*/

(() => {
  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d');
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));

  const elScore = document.getElementById('score');
  const elBest  = document.getElementById('best');
  const elCdBar = document.getElementById('cd');

  // ===== Game state
  const state = {
    w: 0, h: 0,
    playing: true,
    score: 0,
    best: Number(localStorage.getItem('azbry_astro_best') || 0),
    // player (tank)
    px: 0, py: 0, pr: 16, // radius
    speed: 7,
    minX: 0, maxX: 0,     // batas gerak
    // shooting
    cooldown: 380,        // ms
    lastShot: 0,
    bullets: [],
    enemies: [],
    nextEnemy: 0,
  };

  elBest.textContent = state.best;

  // ===== Resize (portrait)
  function resize() {
    state.w = Math.floor(innerWidth  * dpr);
    state.h = Math.floor(innerHeight * dpr);
    cvs.width  = state.w;
    cvs.height = state.h;
    cvs.style.width  = (state.w / dpr) + 'px';
    cvs.style.height = (state.h / dpr) + 'px';

    // Player start (bottom center)
    state.py = state.h - 120 * dpr;
    state.px = state.w / 2;

    // Batas gerak (padding kiri/kanan)
    const pad = 32 * dpr;
    state.minX = pad;
    state.maxX = state.w - pad;

    // Kecilkan hint agar tidak nutup player
    const hint = document.getElementById('hint');
    if (hint) hint.style.bottom = Math.round(76 + (envSafeInset('bottom'))) + 'px';
  }
  window.addEventListener('resize', resize, {passive: true});
  resize();

  // ===== Helpers
  function envSafeInset(edge) {
    // fallback 0, Safari iOS pakai env(safe-area-inset-*)
    try { return parseInt(getComputedStyle(document.documentElement).getPropertyValue(`env(safe-area-inset-${edge})`)||0,10) || 0; }
    catch { return 0; }
  }
  const now = () => performance.now();

  function drawGlowCircle(x, y, r, color) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 * dpr;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // ===== Player (tank icon)
  function drawTank(x, y) {
    // tank stylized neon (pakai rect + turret)
    const baseW = 44 * dpr, baseH = 18 * dpr;
    const towerW = 28 * dpr, towerH = 16 * dpr;
    const barrelW = 8 * dpr, barrelH = 16 * dpr;
    const col = '#39ff14';

    // glow
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 18 * dpr;

    // base
    ctx.fillStyle = col;
    ctx.fillRect(x - baseW/2, y - baseH/2, baseW, baseH);

    // tower
    ctx.fillRect(x - towerW/2, y - baseH/2 - towerH, towerW, towerH);

    // barrel (ke atas)
    ctx.fillRect(x - barrelW/2, y - baseH/2 - towerH - barrelH, barrelW, barrelH);
    ctx.restore();
  }

  // ===== Input: drag & tap
  let dragging = false;
  let lastTap = 0;

  function onDown(e) {
    dragging = true;
    moveFromEvent(e);
    tryShoot();
  }
  function onMove(e) {
    if (!dragging) return;
    moveFromEvent(e);
  }
  function onUp() {
    dragging = false;
  }
  function moveFromEvent(e) {
    const t = e.touches ? e.touches[0] : e;
    let targetX = t.clientX * dpr;
    // batas gerak
    if (targetX < state.minX) targetX = state.minX;
    if (targetX > state.maxX) targetX = state.maxX;
    state.px = targetX;
  }
  function onTap(e) {
    // tap cepat (tanpa drag)
    const t = now();
    if (t - lastTap < 350) { // double tap pun tetap shoot 1x karena cooldown
      tryShoot();
    } else {
      tryShoot();
    }
    lastTap = t;
  }

  cvs.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  cvs.addEventListener('touchstart', onDown, {passive:true});
  window.addEventListener('touchmove', onMove, {passive:true});
  window.addEventListener('touchend', onUp, {passive:true});
  cvs.addEventListener('click', onTap);

  document.addEventListener('keydown', (e)=>{
    if (e.code==='Space') { e.preventDefault(); tryShoot(); }
    if (e.code==='ArrowLeft')  { state.px = Math.max(state.minX, state.px - 36*dpr); }
    if (e.code==='ArrowRight') { state.px = Math.min(state.maxX, state.px + 36*dpr); }
  });

  // ===== Shoot + cooldown
  function tryShoot() {
    const t = now();
    if (t - state.lastShot < state.cooldown) return; // masih dingin

    state.lastShot = t;
    // bullet
    state.bullets.push({
      x: state.px,
      y: state.py - 48 * dpr,
      r: 6 * dpr,
      vy: -10 * dpr
    });
  }

  // ===== Enemies spawn
  function spawnEnemy() {
    const r = (12 + Math.random()*16) * dpr;
    const x = (r + Math.random()*(state.w - 2*r));
    state.enemies.push({
      x, y: -r-10, r,
      vy: (1.6 + Math.random()*1.8) * dpr
    });
  }

  // ===== Loop
  function loop(ts) {
    if (!state.playing) return;

    // Clear
    ctx.clearRect(0,0,state.w,state.h);

    // Background subtle grid/glow
    drawBackdrop();

    // Player
    drawTank(state.px, state.py);
    drawGlowCircle(state.px, state.py, 10*dpr, 'rgba(57,255,20,.25)');

    // Bullets
    for (let i=state.bullets.length-1;i>=0;i--){
      const b = state.bullets[i];
      b.y += b.vy;
      if (b.y < -20*dpr) { state.bullets.splice(i,1); continue; }
      drawGlowCircle(b.x, b.y, b.r, '#b8ff9a');
    }

    // Enemies + spawn
    if (ts > state.nextEnemy) {
      state.nextEnemy = ts + (750 + Math.random()*850); // jeda spawn
      spawnEnemy();
    }
    for (let i=state.enemies.length-1;i>=0;i--){
      const e = state.enemies[i];
      e.y += e.vy;
      if (e.y - e.r > state.h + 40*dpr) { // lewat bawah: game lanjut, gak minus skor
        state.enemies.splice(i,1); 
        continue;
      }
      drawGlowCircle(e.x, e.y, e.r, '#9dffcf');

      // collision bullet vs enemy
      let hit = false;
      for (let j=state.bullets.length-1;j>=0;j--){
        const b = state.bullets[j];
        const dx = e.x - b.x, dy = e.y - b.y;
        if (dx*dx + dy*dy <= (e.r + b.r)*(e.r + b.r)) {
          // destroy
          state.bullets.splice(j,1);
          hit = true;
          break;
        }
      }
      if (hit) {
        // boom effect (sederhana)
        for (let k=0;k<6;k++){
          drawGlowCircle(e.x + (Math.random()*12-6)*dpr, e.y + (Math.random()*12-6)*dpr, 3*dpr, '#39ff14');
        }
        state.enemies.splice(i,1);
        addScore(1);
      }
    }

    // UI (score + cooldown bar)
    elScore.textContent = state.score;
    const cdLeft = Math.max(0, 1 - ((now()-state.lastShot)/state.cooldown));
    elCdBar.style.width = (Math.round((1-cdLeft)*100)) + '%';

    requestAnimationFrame(loop);
  }

  function addScore(n) {
    state.score += n;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem('azbry_astro_best', String(state.best));
      elBest.textContent = state.best;
    }
  }

  function drawBackdrop(){
    // halus, cukup gradient bawah biar ada lantai sense
    const grad = ctx.createLinearGradient(0, state.h*0.7, 0, state.h);
    grad.addColorStop(0, 'rgba(57,255,20,0)');
    grad.addColorStop(1, 'rgba(57,255,20,0.08)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, state.h*0.7, state.w, state.h*0.3);
  }

  // Boot
  requestAnimationFrame(loop);
})();
