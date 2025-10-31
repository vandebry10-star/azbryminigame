/* Tebak Gambar (via BotCahx API) — single-question flow ala plugin */
(() => {
  // ====== KONFIG ======
  const TIMEOUT_MS = 100_000; // 100 detik
  const BONUS = 10_000;
  // set salah satu:
  const USE_PROXY = true; // true kalau pakai /api/tebakgambar di Vercel
  const API_ENDPOINT = () =>
    USE_PROXY
      ? '/api/tebakgambar'
      : `https://api.botcahx.eu.org/api/game/tebakgambar?apikey=${encodeURIComponent(window.BTC_API_KEY||'')}`;
  // Fallback lokal opsional:
  const LOCAL_URL = 'assets/data/tebakgambar.json'; // [{img, deskripsi, jawaban}]

  // ====== ELEM ======
  const el = {
    splash: document.getElementById('splash'),
    splashPlay: document.getElementById('splashPlay'),

    img: document.getElementById('quizImg'),
    imgLoading: document.getElementById('imgLoading'),

    btnStart: document.getElementById('btnStart'),
    btnNext: document.getElementById('btnNext'),
    btnHint: document.getElementById('btnHint'),
    btnSkip: document.getElementById('btnSkip'),
    btnReset: document.getElementById('btnReset'),
    btnAnswer: document.getElementById('btnAnswer'),

    input: document.getElementById('answerInput'),
    log: document.getElementById('log'),
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    timer: document.getElementById('timer'),
  };

  // ====== STATE ======
  const state = {
    batch: [],   // cache batch dari API (kayak var src di plugin)
    cur: null,   // {img, deskripsi, jawaban}
    score: 0,
    timerIvt: null,
    endAt: 0,    // timestamp timeout
  };

  // ====== UTIL ======
  const norm = s => (s||'').toString().toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();

  function log(m){ el.log.textContent = `[${new Date().toLocaleTimeString()}] ${m}\n` + el.log.textContent; }
  function setPlaying(b){
    el.btnNext.disabled = !b; el.btnHint.disabled = !b;
    el.btnSkip.disabled = !b; el.btnAnswer.disabled = !b;
    el.input.disabled = !b;
  }
  function startCountdown(ms){
    state.endAt = Date.now() + ms;
    clearInterval(state.timerIvt);
    tick();
    state.timerIvt = setInterval(tick, 250);
  }
  function stopCountdown(){ clearInterval(state.timerIvt); el.timer.textContent = '00:00'; }
  function tick(){
    const left = Math.max(0, state.endAt - Date.now());
    const s = Math.ceil(left/1000);
    const mm = String(Math.floor(s/60)).padStart(2,'0');
    const ss = String(s%60).padStart(2,'0');
    el.timer.textContent = `${mm}:${ss}`;
    if (left <= 0) {
      clearInterval(state.timerIvt);
      timesUp();
    }
  }
  function updateBest(){
    const key = 'azbry-best-tebakgambar-api';
    el.best.textContent = Number(localStorage.getItem(key) || 0);
  }
  function commitBest(){
    const key = 'azbry-best-tebakgambar-api';
    const v = Number(localStorage.getItem(key) || 0);
    if (state.score > v){ localStorage.setItem(key, String(state.score)); el.best.textContent = state.score; log(`Best baru: ${state.score}`); }
  }

  // ====== DATA LOADER (persis konsep plugin) ======
  async function loadBatch() {
    try {
      const r = await fetch(API_ENDPOINT(), { cache: 'no-store' });
      if (!r.ok) throw new Error('API error');
      const arr = await r.json();
      if (!Array.isArray(arr) || !arr.length) throw new Error('API empty');
      state.batch = arr; // simpan cache, mirip "src" di plugin
      log(`Batch dari BotCahx: ${arr.length} soal.`);
    } catch (e) {
      // fallback lokal opsional
      const r2 = await fetch(LOCAL_URL, { cache: 'no-store' });
      state.batch = await r2.json();
      log(`API gagal, pakai fallback lokal (${state.batch.length} soal).`);
    }
  }

  function pickRandom(){
    if (!state.batch.length) return null;
    const i = Math.floor(Math.random() * state.batch.length);
    // Normalisasi ke bentuk {img, deskripsi, jawaban}
    const x = state.batch[i];
    const img = x.img || x.image;
    const deskripsi = x.deskripsi || x.hint || '';
    const jawaban = x.jawaban || x.answer || x.a;
    return { img, deskripsi, jawaban };
  }

  function showCurrent() {
    const cur = state.cur; if (!cur) return;
    el.img.style.display = 'none';
    el.imgLoading.style.display = 'grid';
    el.imgLoading.textContent = 'Memuat gambar…';
    el.img.onload = () => { el.imgLoading.style.display = 'none'; el.img.style.display = 'block'; };
    el.img.onerror = () => { el.imgLoading.textContent = 'Gambar gagal dimuat.'; log('Cek URL gambar.'); };
    el.img.src = cur.img;
  }

  async function nextQuestion() {
    if (!state.batch.length) await loadBatch();
    state.cur = pickRandom();
    if (!state.cur) { log('Tidak ada soal.'); return; }
    el.input.value = '';
    setPlaying(true);
    showCurrent();
    // caption/log seperti plugin
    log(`SOAL: ${state.cur.deskripsi || '-'}. Timeout ${(TIMEOUT_MS/1000).toFixed(0)} detik. Bonus ${BONUS}.`);
    startCountdown(TIMEOUT_MS);
  }

  function timesUp() {
    setPlaying(false);
    log(`⏱️ Waktu habis! Jawaban: ${state.cur?.jawaban || '(?)'}`);
    commitBest();
  }

  function isCorrect(input, answer) {
    const s = norm(input);
    const t = norm(Array.isArray(answer) ? answer[0] : answer);
    if (!t) return false;
    if (s === t) return true;
    // toleransi typo kecil
    if (Math.abs(s.length - t.length) <= 1){
      let diff = 0;
      for (let i=0;i<Math.min(s.length,t.length);i++){ if (s[i]!==t[i]) diff++; }
      diff += Math.abs(s.length - t.length);
      if (diff <= 1 && Math.max(s.length,t.length) >= 5) return true;
    }
    return false;
  }

  // ====== EVENTS ======
  el.btnStart.onclick = nextQuestion;
  el.btnNext.onclick = () => { stopCountdown(); nextQuestion(); };
  el.btnSkip.onclick = () => { log(`Lewat. Jawaban: ${state.cur?.jawaban || '-'}`); stopCountdown(); nextQuestion(); };
  el.btnHint.onclick = () => {
    const ans = String(state.cur?.jawaban || '');
    const vis = ans.slice(0, Math.ceil(ans.length/2));
    log(`Hint: ${vis}…`);
  };
  function submit(){
    if (!state.cur) return;
    const v = el.input.value.trim();
    if (!v) return;
    if (isCorrect(v, state.cur.jawaban)) {
      state.score += 1; el.score.textContent = String(state.score);
      log(`✅ Benar! (${state.cur.jawaban}) +${BONUS}`);
      stopCountdown();
      commitBest();
      nextQuestion();
    } else {
      log('❌ Salah. Coba lagi!');
    }
  }
  el.btnAnswer.onclick = submit;
  el.input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  el.btnReset.onclick = () => {
    stopCountdown(); el.timer.textContent = '00:00';
    setPlaying(false); state.score = 0; el.score.textContent = '0';
    log('Reset.');
  };

  // Splash
  el.splashPlay?.addEventListener('click', () => {
    el.splash.classList.remove('visible');
    el.splash.classList.add('hidden');
    el.btnStart.focus();
  });
  window.addEventListener('keydown', e => {
    if (!el.splash) return;
    if (!el.splash.classList.contains('visible')) return;
    if (e.key.toLowerCase() === 'enter') el.splashPlay?.click();
  });

  // Init
  updateBest();
  setPlaying(false);
})();
