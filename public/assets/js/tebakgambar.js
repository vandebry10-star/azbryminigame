/* Tebak Gambar (via BotCahx API → proxy Vercel) — FIX */
(() => {
  // ===== KONFIG =====
  const TIMEOUT_MS = 100_000;     // 100 detik per soal
  const BONUS = 10_000;
  const USE_PROXY = true;         // ambil dari /api/tebakgambar
  const API_ENDPOINT = () =>
    USE_PROXY ? '/api/tebakgambar'
              : `https://api.botcahx.eu.org/api/game/tebakgambar?apikey=${encodeURIComponent(window.BTC_API_KEY||'')}`;

  // Fallback lokal opsional (jika mau sediakan):
  const LOCAL_URL = 'assets/data/tebakgambar.json'; // [{img, deskripsi, jawaban}]

  // ===== ELEMENTS =====
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

  // ===== STATE =====
  const state = {
    batch: [],   // cache batch dari API (mirip "src" di plugin)
    cur: null,   // {img, deskripsi, jawaban}
    score: 0,
    timerIvt: null,
    endAt: 0,
  };

  // ===== UTIL =====
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

  // ===== LOADER ROBUST =====
  async function loadBatch() {
    const url = API_ENDPOINT();
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const text = await r.text();               // raw untuk debug
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${text?.slice(0,200)}`);

      let data;
      try { data = JSON.parse(text); } catch { throw new Error('JSON parse error'); }

      // array langsung atau {result:[]}/{data:[]}/{items:[]}
      const arr = Array.isArray(data) ? data : (data.result || data.data || data.items || []);
      if (!Array.isArray(arr) || !arr.length) {
        throw new Error('Empty payload: tidak ada soal di response');
      }

      state.batch = arr;
      log(`Batch OK (${arr.length} soal) dari ${USE_PROXY ? '/api/tebakgambar' : 'BotCahx'}.`);
    } catch (e) {
      log(`Gagal load API: ${e.message}`);

      // Fallback lokal opsional
      try {
        const r2 = await fetch(LOCAL_URL, { cache: 'no-store' });
        const local = await r2.json();
        if (Array.isArray(local) && local.length) {
          state.batch = local;
          log(`Fallback lokal (${local.length} soal).`);
        } else {
          log('Fallback lokal kosong.');
        }
      } catch (ee) {
        log(`Fallback lokal error: ${ee.message}`);
      }
    }
  }

  // alias field fleksibel
  function pickRandom(){
    if (!state.batch.length) return null;
    const x = state.batch[Math.floor(Math.random() * state.batch.length)];

    const img = x.img || x.image || x.url || x.link;
    const deskripsi = x.deskripsi || x.description || x.hint || '';
    const jawaban = x.jawaban || x.answer || x.a || x.key;

    return { img, deskripsi, jawaban };
  }

  // tampilkan dan auto-skip kalau gagal
  function showCurrent(){
    const cur = state.cur; if (!cur) return;
    el.img.style.display = 'none';
    el.imgLoading.style.display = 'grid';
    el.imgLoading.textContent = 'Memuat gambar…';

    // paksa gagal jika lama (10s) → auto-skip
    let failTimer = setTimeout(() => {
      el.img.onerror?.();
    }, 10000);

    el.img.onload = () => {
      clearTimeout(failTimer);
      el.imgLoading.style.display = 'none';
      el.img.style.display = 'block';
    };
    el.img.onerror = () => {
      clearTimeout(failTimer);
      el.imgLoading.style.display = 'grid';
      el.imgLoading.textContent = 'Gambar gagal dimuat. Lewat ke soal berikut…';
      log('Gambar gagal dimuat — auto-skip.');
      setTimeout(() => { stopCountdown(); nextQuestion(); }, 800);
    };
    el.img.src = cur.img;
  }

  async function nextQuestion() {
    if (!state.batch.length) await loadBatch();
    state.cur = pickRandom();
    if (!state.cur) { log('Tidak ada soal.'); return; }

    el.input.value = '';
    setPlaying(true);
    showCurrent();

    log(`SOAL: ${state.cur.deskripsi || '-'} • Timeout ${(TIMEOUT_MS/1000).toFixed(0)} dtk • Bonus ${BONUS}.`);
    startCountdown(TIMEOUT_MS);
  }

  function timesUp() {
    setPlaying(false);
    log(`⏱️ Waktu habis! Jawaban: ${state.cur?.jawaban || '(?)'}`);
    commitBest();
  }

  function isCorrect(input, answer) {
    const s = norm(input);
    const raw = Array.isArray(answer) ? answer[0] : answer;
    const t = norm(raw);
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

  // ===== EVENTS =====
  el.btnStart.onclick = nextQuestion;
  el.btnNext.onclick = () => { stopCountdown(); nextQuestion(); };
  el.btnSkip.onclick = () => { log(`Lewat. Jawaban: ${state.cur?.jawaban || '-'}`); stopCountdown(); nextQuestion(); };
  el.btnHint.onclick = () => {
    const ans = String(Array.isArray(state.cur?.jawaban) ? state.cur.jawaban[0] : (state.cur?.jawaban || ''));
    const vis = ans.slice(0, Math.ceil(ans.length/2));
    log(`Hint: ${vis}…`);
  };
  function submit(){
    if (!state.cur) return;
    const v = el.input.value.trim();
    if (!v) return;
    if (isCorrect(v, state.cur.jawaban)) {
      state.score += 1; el.score.textContent = String(state.score);
      log(`✅ Benar! (${Array.isArray(state.cur.jawaban) ? state.cur.jawaban[0] : state.cur.jawaban}) +${BONUS}`);
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
