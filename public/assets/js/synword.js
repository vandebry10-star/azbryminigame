// assets/js/synword.js
// Azbry GuessWord — 5 Soal per Sesi (CLUE bebas, jawaban 1 kata, panjang bebas)

(function () {
  // ===== DOM =====
  const $ = (id) => document.getElementById(id);
  const elInput  = $("syn-input");
  const elClue   = $("clue");
  const btnGuess = $("btnGuess");
  const btnGiveUp= $("btnGiveUp");

  const modal   = $("syn-modal");
  const mTitle  = $("syn-title");
  const mSub    = $("syn-sub");
  const mAgain  = $("syn-again");
  const mClose  = $("syn-close");

  // ===== Utils =====
  const norm = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")   // hapus diakritik
      .replace(/[^A-Za-z]/g, "")         // huruf saja
      .toUpperCase();

  const shuffle = (arr) => arr
    .map(v => [Math.random(), v])
    .sort((a,b)=>a[0]-b[0])
    .map(x=>x[1]);

  function showModal(title, sub, againText = "Lanjut") {
    mTitle.textContent = title || "";
    mSub.innerHTML = sub || "";
    mAgain.textContent = againText;
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }
  function hideModal() {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }
  function shake(el=elInput){
    el.classList.remove("shake");
    void el.offsetWidth; // reflow
    el.classList.add("shake");
  }

  // ===== BANK SOAL (clue bebas, 1 kata) =====
  // Tambah/ubah sesuka hati (jawaban boleh panjang, huruf saja)
  const RAW_BANK = [
    { clue: "Ibu kota Indonesia", answer: "JAKARTA" },
    { clue: "Bahasa pemrograman untuk web interaktif (di browser)", answer: "JAVASCRIPT" },
    { clue: "Alat untuk memotret", answer: "KAMERA" },
    { clue: "Hewan darat terbesar", answer: "GAJAH" },
    { clue: "Benda langit yang mengelilingi bumi di malam hari", answer: "BULAN" },
    { clue: "Warna campuran biru dan kuning", answer: "HIJAU" },
    { clue: "Olahraga dengan bola dan gawang", answer: "SEPAKBOLA" },
    { clue: "Tempat menyimpan uang di bank (bukan dompet)", answer: "REKENING" },
    { clue: "Perangkat untuk mengetik (hardware)", answer: "KEYBOARD" },
    { clue: "Kota kembang", answer: "BANDUNG" },
    { clue: "Ibukota Jawa Tengah", answer: "SEMARANG" },
    { clue: "Transportasi umum rel listrik di kota besar", answer: "MRT" },
    { clue: "Bunga nasional Indonesia", answer: "MELATI" },
    { clue: "Nama lain ‘pancaroba’", answer: "PERALIHAN" },
    { clue: "Bahasa resmi Indonesia", answer: "INDONESIA" },
    { clue: "Logam mulia berwarna kuning", answer: "EMAS" },
    { clue: "Perangkat untuk menampilkan keluaran komputer", answer: "MONITOR" },
    { clue: "Perangkat lunak sistem komputer", answer: "OPERASISISTEM" },
    { clue: "Kendaraan dua roda tanpa mesin", answer: "SEPEDA" },
    { clue: "Tempat meminjam buku", answer: "PERPUSTAKAAN" },

    // Tambahan biar banyak
    { clue: "Pulau terpadat di Indonesia", answer: "JAWA" },
    { clue: "Rangkaian halaman web dalam satu alamat", answer: "WEBSITE" },
    { clue: "Alat penghitung waktu di tangan", answer: "JAMTANGAN" },
    { clue: "Sosial media video pendek populer", answer: "TIKTOK" },
    { clue: "Komponen utama komputer, otak-nya", answer: "CPU" },
    { clue: "Bahasa untuk mendesain tampilan web", answer: "CSS" },
    { clue: "Bahasa untuk struktur halaman web", answer: "HTML" },
    { clue: "Tempat menonton film di layar lebar", answer: "BIOSKOP" },
    { clue: "Kendaraan di rel antar kota", answer: "KERETA" },
    { clue: "Alat untuk menangkap suara", answer: "MIKROFON" },
  ];
  const BANK = RAW_BANK.map(({clue, answer}) => ({ clue, answer: norm(answer) }));

  // ===== Session (5 soal) =====
  const QUESTIONS_PER_RUN = 5;
  let session = [];     // array soal
  let idx = 0;          // index soal saat ini (0..4)
  let correct = 0;      // jumlah benar dalam sesi
  let cur = null;       // soal aktif

  function newSession(){
    const pool = shuffle(BANK);
    session = pool.slice(0, QUESTIONS_PER_RUN);
    idx = 0;
    correct = 0;
    pickRound();
  }

  function pickRound() {
    cur = session[idx];
    if (!cur) { // safety
      endSession();
      return;
    }
    const len = cur.answer.length;
    elClue.innerHTML = `Soal <b>${idx+1}/${QUESTIONS_PER_RUN}</b> — Clue: <b>${cur.clue}</b> <span style="opacity:.7">(${len} huruf)</span>`;
    elInput.value = "";
    elInput.placeholder = `${len} huruf`;
    elInput.maxLength = Math.max(len*2, 32);
    elInput.focus();

    // hapus hint kemiripan jika ada
    const hint = document.getElementById("syn-hint");
    if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
  }

  function endSession(){
    // jika semua benar => MENANG
    if (correct >= QUESTIONS_PER_RUN) {
      showModal(
        "MENANG! 🎉",
        `Kamu menjawab <b>5/5</b> dengan benar.<br><small>Soal pasti acak & jumlahnya buaaanyak!</small>`,
        "Main Lagi (Soal acak)"
      );
      mAgain.onclick = () => { hideModal(); newSession(); };
      return;
    }
    // kalau tidak semua benar => tampilkan skor
    showModal(
      "Sesi Selesai",
      `Skor kamu: <b>${correct}/${QUESTIONS_PER_RUN}</b><br><small>Gas lagi: soal acak & jumlahnya banyak!</small>`,
      "Main Lagi (Soal acak)"
    );
    mAgain.onclick = () => { hideModal(); newSession(); };
  }

  // ===== Hint kemiripan (LCS) =====
  function lcs(a, b) {
    const n = a.length, m = b.length;
    const dp = Array.from({length: n+1}, () => Array(m+1).fill(0));
    for (let i=1;i<=n;i++){
      for (let j=1;j<=m;j++){
        dp[i][j] = a[i-1] === b[j-1]
          ? dp[i-1][j-1] + 1
          : Math.max(dp[i-1][j], dp[i][j-1]);
      }
    }
    return dp[n][m];
  }

  // ===== Interaksi =====
  function nextQuestion(){
    idx++;
    if (idx >= QUESTIONS_PER_RUN) {
      endSession();
    } else {
      pickRound();
    }
  }

  function onGuess(){
    if (!cur) return;
    const val = norm(elInput.value);
    if (!val) { shake(); return; }

    if (val === cur.answer) {
      correct++;
      showModal(
        "Benar! 🎉",
        `Jawaban: <b>${cur.answer}</b><br/><small>Clue: ${cur.clue}</small>`,
        (idx+1>=QUESTIONS_PER_RUN ? "Lihat Hasil" : "Soal Berikutnya")
      );
      mAgain.onclick = () => { hideModal(); nextQuestion(); };
    } else {
      // kasih indikator kemiripan
      const common = lcs(val, cur.answer);
      const pct = Math.round((common / cur.answer.length) * 100);
      shake();
      const hint = document.getElementById("syn-hint") || document.createElement("div");
      hint.id = "syn-hint";
      hint.style.marginTop = "6px";
      hint.style.opacity = ".85";
      hint.innerHTML = `⚡ Mirip: <b>${pct}%</b>`;
      elInput.parentElement.appendChild(hint);
    }
  }

  function onGiveUp(){
    if (!cur) return;
    showModal(
      "Menyerah 😅",
      `Jawaban: <b>${cur.answer}</b><br/><small>Clue: ${cur.clue}</small>`,
      (idx+1>=QUESTIONS_PER_RUN ? "Lihat Hasil" : "Soal Berikutnya")
    );
    mAgain.onclick = () => { hideModal(); nextQuestion(); };
  }

  // ===== Bind =====
  btnGuess.addEventListener("click", onGuess);
  btnGiveUp.addEventListener("click", onGiveUp);
  mClose.addEventListener("click", () => hideModal());
  modal.addEventListener("click", (e) => { if (e.target === modal) hideModal(); });
  elInput.addEventListener("keydown", (e) => { if (e.key === "Enter") onGuess(); });

  // ===== Start =====
  if (!BANK.length) {
    // fallback 1 soal
    session = [{ clue: "Contoh", answer: "CONTOH" }];
    pickRound();
  } else {
    newSession();
  }
})();
