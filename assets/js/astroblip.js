/* Astro Blip – Azbry-MD (auto-fire, batas gerak, HUD baru) */
(() => {
  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d', { alpha: false });

  // HUD refs
  const scoreEl = document.getElementById('scoreBig');
  const bestEl  = document.getElementById('best');
  const BEST_KEY = 'ab_ast_best_v2';

  // Theme colors (sinkron dgn azbry.css)
  const BG_TOP = '#0b0d10';
  const GRID_GLOW = 'rgba(57,255,20,0.12)';
  const NEON = '#39ff14';

  // Game params
  const WORLD = { w: innerWidth, h: innerHeight };
  const PADDING_X = 16;             // batas gerak tank dari tepi
  const TANK_SIZE = 44;
  const BULLET_W = 5, BULLET_H = 12, BULLET_SPEED = 640; // px/s
  const FIRE_INTERVAL = 180;        // ms (auto-fire)
  const DRONE_SPAWN = 800;          // ms
  const DRONE_MIN_R = 18, DRONE_MAX_R = 32;
  const DRONE_SPEED = [90, 160];    // px/s range turun
  const CLEAN_BELOW = 40;

  let lastTime = 0;
  let score = 0;
  let best  = Number(localStorage.getItem(BEST_KEY) || 0);
  bestEl.textContent = best;

  const tank = {
    x: WORLD.w * 0.5,
    y: WORLD.h - 120,
    targetX: null
  };

  /** Entities */
  const bullets = [];
  const drones  = [];

  /** Resize canvas */
  function resize() {
    WORLD.w = innerWidth; WORLD.h = innerHeight;
    cvs.width = WORLD.w;  cvs.height = WORLD.h;
    tank.y = WORLD.h - 120;
    clampTank();
    drawBackdrop(true);
  }
  addEventListener('resize', resize, { passive:true });
  resize();

  /** Background neon grid */
  function drawBackdrop(clearOnly=false) {
    ctx.fillStyle = BG_TOP;
    ctx.fillRect(0,0,cvs.width,cvs.height);

    if (clearOnly) return;
    // subtle grid + vignette
    const step = 48;
    ctx.strokeStyle = GRID_GLOW;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x=0; x<=cvs.width; x+=step) {
      ctx.moveTo(x, cvs.height); ctx.lineTo(x, cvs.height*0.55);
    }
    for (let y=cvs.height; y>=cvs.height*0.55; y-=step) {
      ctx.moveTo(0,y); ctx.lineTo(cvs.width,y);
    }
    ctx.stroke();

    // vignette
    const g = ctx.createRadialGradient(
      cvs.width*0.5, cvs.height*0.4, 80,
      cvs.width*0.5, cvs.height*0.6, Math.max(cvs.width,cvs.height)*0.9
    );
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(1,'rgba(0,0,0,0.6)');
    ctx.fillStyle = g; ctx.fillRect(0,0,cvs.width,cvs.height);
  }

  /** Drawing helpers */
  function drawTank() {
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.shadowColor = NEON; ctx.shadowBlur = 18;
    ctx.fillStyle = NEON;
    // Bentuk tank pixel-simple (ikon)
    ctx.fillRect(-12, -6, 24, 12);         // body
    ctx.fillRect(-6, -18, 12, 12);         // tower
    ctx.fillRect(-3, -26, 6, 10);          // canon
    ctx.restore();
  }

  function drawBullet(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = NEON;
    ctx.shadowColor = NEON; ctx.shadowBlur = 12;
    ctx.fillRect(-BULLET_W/2, -BULLET_H, BULLET_W, BULLET_H);
    ctx.restore();
  }

  function drawDrone(d) {
    ctx.save();
    ctx.translate(d.x, d.y);
    const g = ctx.createRadialGradient(0,0,2, 0,0,d.r);
    g.addColorStop(0,'#dfffe0'); g.addColorStop(1,'rgba(184,255,154,0.15)');
    ctx.fillStyle = g;
    ctx.shadowColor = NEON; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(0,0,d.r,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  /** Spawn logic */
  let fireTimer = 0;
  let droneTimer = 0;

  function spawnBullet() {
    bullets.push({ x: tank.x, y: tank.y-28 });
  }

  function spawnDrone() {
    const r = rand(DRONE_MIN_R, DRONE_MAX_R);
    const x = rand(PADDING_X + r, WORLD.w - PADDING_X - r);
    const v = rand(DRONE_SPEED[0], DRONE_SPEED[1]);
    drones.push({ x, y: -r-10, r, v });
  }

  /** Update */
  function update(dt) {
    // auto fire
    fireTimer += dt*1000;
    if (fireTimer >= FIRE_INTERVAL) {
      fireTimer = 0;
      spawnBullet();
    }

    // spawn drone
    droneTimer += dt*1000;
    if (droneTimer >= DRONE_SPAWN) {
      droneTimer = 0;
      spawnDrone();
    }

    // bullets
    for (let i=bullets.length-1;i>=0;i--){
      const b = bullets[i];
      b.y -= BULLET_SPEED * dt;
      if (b.y < -BULLET_H) bullets.splice(i,1);
    }

    // drones
    for (let i=drones.length-1;i>=0;i--){
      const d = drones[i];
      d.y += d.v * dt;
      if (d.y - d.r > WORLD.h + CLEAN_BELOW) drones.splice(i,1);
    }

    // collisions
    for (let i=drones.length-1;i>=0;i--){
      const d = drones[i];
      for (let j=bullets.length-1;j>=0;j--){
        const b = bullets[j];
        const dx = d.x - b.x, dy = d.y - b.y;
        if (dx*dx + dy*dy <= (d.r+8)*(d.r+8)) {
          bullets.splice(j,1);
          drones.splice(i,1);
          score++;
          scoreEl.textContent = score;
          if (score > best) {
            best = score;
            bestEl.textContent = best;
            localStorage.setItem(BEST_KEY, String(best));
          }
          break;
        }
      }
    }
  }

  /** Render */
  function render() {
    drawBackdrop();
    // draw entities
    for (const d of drones) drawDrone(d);
    for (const b of bullets) drawBullet(b);
    drawTank();
  }

  /** Game loop */
  function loop(t) {
    if (!lastTime) lastTime = t;
    const dt = Math.min(0.033, (t - lastTime)/1000);
    lastTime = t;

    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /** Input: drag horizontal */
  let dragging = false;
  function pointerXY(ev){
    if (ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
    return { x: ev.clientX, y: ev.clientY };
  }
  function clampTank(){
    tank.x = Math.max(PADDING_X + TANK_SIZE*0.5, Math.min(WORLD.w - (PADDING_X + TANK_SIZE*0.5), tank.x));
  }
  function onDown(ev){ dragging = true; const p = pointerXY(ev); tank.x = p.x; clampTank(); }
  function onMove(ev){ if(!dragging) return; const p = pointerXY(ev); tank.x = p.x; clampTank(); }
  function onUp(){ dragging = false; }

  cvs.addEventListener('mousedown', onDown);
  addEventListener('mousemove', onMove, { passive:true });
  addEventListener('mouseup', onUp);

  cvs.addEventListener('touchstart', onDown, { passive:true });
  addEventListener('touchmove', onMove, { passive:true });
  addEventListener('touchend', onUp);

  /** Utils */
  function rand(a,b){ return a + Math.random()*(b-a); }

  // Reset skor saat reload page (opsional tak reset best)
  score = 0; scoreEl.textContent = score;
})();
