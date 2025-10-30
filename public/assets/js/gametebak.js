/* GameTebak Engine (Azbry) + Splash Screen + Replay + Random 10 Soal */
(() => {
  const modes = [
    { id: 'tebakkata', name: 'Tebak Kata', data: 'assets/data/tebakkata.json' },
    { id: 'asahotak', name: 'Asah Otak', data: 'assets/data/asahotak.json' },
    { id: 'family100', name: 'Family 100', data: 'assets/data/family100.json' },
    { id: 'sambungkata', name: 'Sambung Kata', data: 'assets/data/sambungkata.json' },
    { id: 'siapakahaku', name: 'Siapakah Aku', data: 'assets/data/siapakahaku.json' },
    { id: 'susunkata', name: 'Susun Kata', data: 'assets/data/susunkata.json' },
    { id: 'tebakpemainbola', name: 'Tebak Pemain Bola', data: 'assets/data/tebakpemainbola.json' },
  ];

  const el = {
    modePicker: document.getElementById('modePicker'),
    btnStart: document.getElementById('btnStart'),
    btnNext: document.getElementById('btnNext'),
    btnHint: document.getElementById('btnHint'),
    btnSkip: document.getElementById('btnSkip'),
    btnReset: document.getElementById('btnReset'),
    btnAnswer: document.getElementById('btnAnswer'),
    input: document.getElementById('answerInput'),
    title: document.getElementById('questionTitle'),
    text: document.getElementById('questionText'),
    log: document.getElementById('log'),
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    timer: document.getElementById('timer'),
  };

  // Splash elements
  const splash = document.getElementById('splash');
  const splashPlay = document.getElementById('splashPlay');
  const splashHow = document.getElementById('splashHow');

  let state = {
    mode: null,
    data: [],
    idx: -1,
    score: 0,
    startTs: 0,
    timerIvt: null,
  };

  // Utils
  function log(msg) {
    const time = new Date().toLocaleTimeString();
    el.log.textContent = `[${time}] ${msg}\n` + el.log.textContent;
  }

  function setButtonsPlaying(playing) {
    el.btnNext.disabled = !playing;
    el.btnHint.disabled = !playing;
    el.btnSkip.disabled = !playing;
    el.btnAnswer.disabled = !playing;
    el.input.disabled = !playing;
  }

  function setModeActive(id) {
    [...el.modePicker.querySelectorAll('.seg')].forEach(b => {
      b.classList.toggle('active', b.dataset.id === id);
    });
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  }

  function startTimer() {
    state.startTs = Date.now();
    clearInterval(state.timerIvt);
    state.timerIvt = setInterval(() => {
      const sec = (Date.now() - state.startTs) / 1000;
      el.timer.textContent = fmtTime(sec);
    }, 500);
  }

  function stopTimer() {
    clearInterval(state.timerIvt);
  }

  const norm = s => (s || '').toString().toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  function levenshtein(a, b) {
    a = norm(a); b = norm(b);
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  function isCorrect(input, answers) {
    const s = norm(input);
    for (const a of answers) {
      const t = norm(a);
      if (s === t) return true;
      if (t.includes(s) && s.length >= Math.min(4, t.length)) return true;
      if (levenshtein(s, t) <= 1 && Math.max(s.length, t.length) >= 5) return true;
    }
    return false;
  }

  function showSplash() {
    splash?.classList.add('visible');
    splash?.classList.remove('hidden');
  }
  function hideSplash() {
    splash?.classList.remove('visible');
    splash?.classList.add('hidden');
  }

  // 🔀 Ambil 10 soal acak per sesi
  async function loadMode(mode) {
    state.mode = mode;
    setModeActive(mode.id);
    el.title.textContent = `${mode.name}`;
    el.text.textContent = `Memuat soal...`;

    try {
      const res = await fetch(mode.data, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.statusText);
      const raw = await res.json();

      let parsed = raw.map(item => {
        if (typeof item === 'string') return { q: item, a: [item], hint: '' };
        let q = item.q || item.question || item.pertanyaan || '';
        let a = item.a || item.answer || item.jawaban || item.answers || [];
        if (typeof a === 'string') a = [a];
        let hint = item.hint || item.petunjuk || '';
        return { q, a, hint };
      }).filter(x => x.q && x.a && x.a.length);

      // acak urutan dan ambil maksimal 10
      parsed = parsed.sort(() => Math.random() - 0.5).slice(0, 10);

      state.data = parsed;
      state.idx = -1;
      state.score = 0;
      el.score.textContent = '0';
      el.input.value = '';
      setButtonsPlaying(false);
      el.btnStart.disabled = false;
      el.btnAnswer.disabled = true;
      updateBest();
      el.text.textContent = `Tersedia ${raw.length} soal, diambil acak 10 untuk sesi ini.`;
      log(`Mode ${mode.name} dimuat (${state.data.length} soal acak).`);
    } catch (e) {
      el.text.textContent = `Gagal memuat data untuk ${mode.name}.`;
      log(`Gagal memuat data: ${e.message}`);
    }
  }

  function updateBest() {
    const key = `azbry-best-${state.mode?.id || 'default'}`;
    el.best.textContent = Number(localStorage.getItem(key) || 0);
  }

  function commitBest() {
    const key = `azbry-best-${state.mode?.id || 'default'}`;
    const v = Number(localStorage.getItem(key) || 0);
    if (state.score > v) {
      localStorage.setItem(key, String(state.score));
      el.best.textContent = state.score;
      log(`Best baru: ${state.score}`);
    }
  }

  // ✅ Game selesai & replay
  function nextQuestion() {
    if (!state.data.length) return;

    state.idx++;
    if (state.idx >= state.data.length) {
      stopTimer();
      setButtonsPlaying(false);
      el.btnStart.disabled = true;
      el.input.disabled = true;
      el.btnAnswer.disabled = true;

      el.title.textContent = "Selesai 🎉";
      el.text.textContent = `Kamu sudah menjawab semua soal!\nSkor akhir: ${state.score}`;
      log(`Game selesai. Total skor: ${state.score}`);
      commitBest();

      const replayBtn = document.createElement("button");
      replayBtn.textContent = "Main Lagi 🔁";
      replayBtn.className = "btn accent";
      replayBtn.style.marginTop = "16px";
      replayBtn.onclick = () => {
        state.idx = -1;
        state.score = 0;
        el.score.textContent = "0";
        el.input.value = "";
        setButtonsPlaying(true);
        el.btnStart.disabled = true;
        el.input.disabled = false;
        el.btnAnswer.disabled = false;
        startTimer();
        nextQuestion();
        replayBtn.remove();
        log("Mulai ulang game!");
      };

      el.text.appendChild(document.createElement("br"));
      el.text.appendChild(replayBtn);
      return;
    }

    const cur = state.data[state.idx];
    el.title.textContent = `${state.mode.name} — Soal ${state.idx + 1}/${state.data.length}`;
    el.text.textContent = cur.q;
    el.input.value = "";
    el.input.focus();
  }

  // UI setup
  function buildModeButtons() {
    el.modePicker.innerHTML = '';
    modes.forEach(m => {
      const b = document.createElement('button');
      b.className = 'seg';
      b.dataset.id = m.id;
      b.textContent = m.name;
      b.onclick = () => loadMode(m);
      el.modePicker.appendChild(b);
    });
  }

  // Splash events
  splashPlay?.addEventListener('click', () => {
    hideSplash();
    if (!state.mode) loadMode(modes[0]);
    el.btnStart.focus();
  });
  splashHow?.addEventListener('click', () => {
    log('Cara main: Pilih mode ➜ Tekan Mulai ➜ Ketik jawaban ➜ Enter atau tombol Jawab. Tombol Hint/Skip tersedia.');
  });
  window.addEventListener('keydown', e => {
    if (!splash) return;
    if (!splash.classList.contains('visible')) return;
    if (e.key.toLowerCase() === 'enter') splashPlay?.click();
    else if (e.key.toLowerCase() === 'h') splashHow?.click();
  });

  // Buttons
  el.btnStart.onclick = () => {
    if (!state.mode) return log('Pilih mode dulu.');
    if (!state.data.length) return log('Data belum termuat.');
    state.score = 0;
    el.score.textContent = '0';
    setButtonsPlaying(true);
    el.btnStart.disabled = true;
    startTimer();
    nextQuestion();
    log('Mulai!');
  };

  el.btnNext.onclick = () => nextQuestion();
  el.btnSkip.onclick = () => {
    const cur = state.data[state.idx];
    if (cur) log(`Lewat. Jawaban: ${cur.a[0]}`);
    nextQuestion();
  };

  el.btnHint.onclick = () => {
    const cur = state.data[state.idx];
    if (cur?.hint) log(`Hint: ${cur.hint}`);
    else {
      const ans = cur?.a?.[0] || '';
      log(`Hint: ${ans.slice(0, 1)}${'*'.repeat(Math.max(0, ans.length - 2))}${ans.slice(-1)}`);
    }
  };

  function submitAnswer() {
    if (!state.data.length) return;
    const cur = state.data[state.idx];
    const val = el.input.value.trim();
    if (!val) return;
    if (isCorrect(val, cur.a)) {
      state.score++;
      el.score.textContent = String(state.score);
      log(`Benar! Jawaban: ${cur.a[0]}`);
      commitBest();
      nextQuestion();
    } else log(`Salah. Coba lagi!`);
  }

  el.btnAnswer.onclick = submitAnswer;
  el.input.addEventListener('keydown', e => e.key === 'Enter' && submitAnswer());

  el.btnReset.onclick = () => {
    stopTimer();
    el.timer.textContent = '00:00';
    setButtonsPlaying(false);
    el.btnStart.disabled = false;
    el.title.textContent = 'Reset';
    el.text.textContent = 'Pilih mode lalu tekan Mulai.';
    state.idx = -1;
    state.score = 0;
    el.score.textContent = '0';
    el.input.value = '';
    log('Game direset.');
  };

  buildModeButtons();
  showSplash();
})();
