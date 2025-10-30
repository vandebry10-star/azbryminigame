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

  // ===== BANK SOAL RINGAN (120++ SOAL) =====
const RAW_BANK = [
  { clue: "Minuman panas berwarna hitam", answer: "KOPI" },
  { clue: "Hewan yang suka makan wortel", answer: "KELINCI" },
  { clue: "Benda yang dipakai saat hujan", answer: "PAYUNG" },
  { clue: "Tempat kamu tidur", answer: "KASUR" },
  { clue: "Buah berwarna kuning yang bisa dikupas", answer: "PISANG" },
  { clue: "Hewan laut yang punya cangkang", answer: "KERANG" },
  { clue: "Dipakai untuk melihat waktu", answer: "JAMTANGAN" },
  { clue: "Benda yang bisa terbang di langit dengan benang", answer: "LAYANGAN" },
  { clue: "Hewan laut bertulang lunak dan punya delapan lengan", answer: "GURITA" },
  { clue: "Benda yang bisa pecah jika jatuh", answer: "GELAS" },
  { clue: "Tempat membeli sayur", answer: "PASAR" },
  { clue: "Benda untuk menulis di kertas", answer: "PULPEN" },
  { clue: "Alat untuk memotong kertas", answer: "GUNTING" },
  { clue: "Transportasi roda dua", answer: "MOTOR" },
  { clue: "Hewan peliharaan yang suka menggonggong", answer: "ANJING" },
  { clue: "Hewan yang bisa terbang dan bertelur", answer: "BURUNG" },
  { clue: "Benda yang digunakan untuk melihat jelas", answer: "KACAMATA" },
  { clue: "Buah berwarna merah yang sering dijus", answer: "JERUK" },
  { clue: "Tempat menonton film", answer: "BIOSKOP" },
  { clue: "Benda yang mengeluarkan cahaya di malam hari", answer: "LAMPU" },
  { clue: "Warna campuran merah dan biru", answer: "UNGU" },
  { clue: "Kalau lapar, kamu pergi ke...", answer: "DAPUR" },
  { clue: "Benda yang dipakai di kaki", answer: "SEPATU" },
  { clue: "Benda untuk membuka pintu", answer: "KUNCI" },
  { clue: "Buah berduri dari Indonesia", answer: "DURIAN" },
  { clue: "Tempat ikan hidup", answer: "AIR" },
  { clue: "Tempat kamu belajar", answer: "SEKOLAH" },
  { clue: "Minuman dingin dan manis", answer: "ESKRIM" },
  { clue: "Kamu duduk di atas ini", answer: "KURSI" },
  { clue: "Sumber cahaya terbesar di bumi", answer: "MATAHARI" },
  { clue: "Kamu pakai ini buat nonton YouTube", answer: "HANDPHONE" },
  { clue: "Hewan laut yang bisa dimakan", answer: "IKAN" },
  { clue: "Kalau mau pergi jauh, kamu naik...", answer: "PESAWAT" },
  { clue: "Benda bundar untuk bermain sepak bola", answer: "BOLA" },
  { clue: "Kendaraan besar pengangkut barang", answer: "TRUK" },
  { clue: "Pakaian yang dipakai ke sekolah", answer: "SERAGAM" },
  { clue: "Kalau kedinginan kamu pakai...", answer: "JAKET" },
  { clue: "Hewan hitam putih dari Tiongkok", answer: "PANDA" },
  { clue: "Benda kecil untuk melihat waktu di dinding", answer: "JAMDINDING" },
  { clue: "Kamu pakai ini agar wangi", answer: "PARFUM" },
  { clue: "Waktu kamu capek, kamu harus...", answer: "TIDUR" },
  { clue: "Hewan kecil yang bisa menyengat", answer: "LEBAH" },
  { clue: "Binatang yang suka makan pisang", answer: "MONYET" },
  { clue: "Makanan khas dari mie", answer: "BAKMI" },
  { clue: "Bisa kamu panaskan, digunakan untuk masak", answer: "KOMPOR" },
  { clue: "Benda yang kamu pakai di kepala", answer: "TOPI" },
  { clue: "Buah berwarna merah, manis dan berair", answer: "SEMANGKA" },
  { clue: "Hewan yang suka susu", answer: "KUCING" },
  { clue: "Kamu minum ini saat haus", answer: "AIR" },
  { clue: "Benda panjang untuk mengukur", answer: "PENGGARIS" },
  { clue: "Tempat duduk banyak orang di taman", answer: "BANGKU" },
  { clue: "Kamu gunakan ini untuk sikat gigi", answer: "SIKAT" },
  { clue: "Alat musik kecil ditiup", answer: "SERULING" },
  { clue: "Warna daun", answer: "HIJAU" },
  { clue: "Buah merah yang sering jadi sambal", answer: "CABAI" },
  { clue: "Benda yang bisa berdering saat ada panggilan", answer: "TELEPON" },
  { clue: "Kalau musim hujan turun...", answer: "HUJAN" },
  { clue: "Benda di kamar mandi untuk mencuci badan", answer: "SABUN" },
  { clue: "Hewan yang suka makan keju", answer: "TIKUS" },
  { clue: "Kalau haus kamu minum...", answer: "AIR" },
  { clue: "Kalau lapar kamu makan...", answer: "NASI" },
  { clue: "Benda di dapur yang bisa menanak nasi", answer: "MAGICOM" },
  { clue: "Benda yang digunakan untuk menyapu lantai", answer: "SAPU" },
  { clue: "Kendaraan dengan tiga roda", answer: "BAJAJ" },
  { clue: "Makanan berbentuk bulat dari daging", answer: "BAKSO" },
  { clue: "Tempat tinggal manusia", answer: "RUMAH" },
  { clue: "Alat untuk menulis di papan tulis", answer: "SPIDOL" },
  { clue: "Hewan besar dengan belalai", answer: "GAJAH" },
  { clue: "Buah tropis berwarna oranye", answer: "MANGGA" },
  { clue: "Kalau lapar malam-malam kamu makan...", answer: "MIEINSTAN" },
  { clue: "Benda untuk menyalakan api", answer: "KOREK" },
  { clue: "Kalau takut, jantung jadi...", answer: "DEGDEGAN" },
  { clue: "Kamu pakai ini di tangan untuk mengetik", answer: "JARI" },
  { clue: "Benda yang kamu pakai untuk mandi", answer: "HANDUK" },
  { clue: "Minuman dari daun teh", answer: "TEH" },
  { clue: "Benda yang menyala di langit saat malam tahun baru", answer: "KEMBANGAPI" },
  { clue: "Alat untuk mendengar musik", answer: "EARPHONE" },
  { clue: "Makanan dari gandum, dimakan pagi hari", answer: "ROTI" },
  { clue: "Benda untuk menutup kepala dari matahari", answer: "TOPI" },
  { clue: "Buah hijau kecil sering jadi rujak", answer: "JAMBU" },
  { clue: "Kamu pakai ini kalau hujan turun", answer: "PAYUNG" },
  { clue: "Alat untuk mengetik di komputer", answer: "KEYBOARD" },
  { clue: "Benda di rumah yang bisa nyalain listrik", answer: "STOPKONTAK" },
  { clue: "Makanan khas Italia berbentuk pipih", answer: "PIZZA" },
  { clue: "Benda di tangan buat lihat jam", answer: "JAMTANGAN" },
  { clue: "Hewan yang bisa menirukan suara manusia", answer: "BURUNGBEAO" },
  { clue: "Kalau sakit kepala kamu minum...", answer: "OBAT" },
  { clue: "Tempat beli tiket bioskop", answer: "LOKET" },
  { clue: "Hewan berbulu putih yang suka mengembik", answer: "DOMBA" },
  { clue: "Makanan dari kedelai yang digoreng", answer: "TAHU" },
  { clue: "Pasangan dari tahu", answer: "TEMPE" },
  { clue: "Kalau gelap, kamu nyalain...", answer: "LAMPU" },
  { clue: "Kalau kamu mau nulis surat, kamu butuh...", answer: "KERTAS" },
  { clue: "Hewan kecil bersayap dan bisa menggigit", answer: "NYAMUK" },
  { clue: "Hewan di laut yang bisa menyala di gelap", answer: "UBURUBUR" },
  { clue: "Benda yang digunakan untuk menutup kepala muslimah", answer: "KERUDUNG" },
  { clue: "Kalau kedinginan kamu minum...", answer: "KOPIPANAS" },
  { clue: "Benda yang digunakan untuk mengeringkan rambut", answer: "HAIRDRYER" },
  { clue: "Tempat kamu menyimpan uang di rumah", answer: "CELENGAN" },
  { clue: "Kalau ada tugas kamu tulis di...", answer: "BUKUTULIS" },
  { clue: "Tempat duduk besar di ruang tamu", answer: "SOFA" },
  { clue: "Benda untuk menggantung baju", answer: "GANTUNGAN" },
  { clue: "Tempat kamu mencuci baju", answer: "MESINCUCI" },
  { clue: "Kalau musim panas kamu butuh...", answer: "KIPAS" },
  { clue: "Makanan bulat dari tepung dan gula, sering di kafe", answer: "DONAT" },
  { clue: "Minuman bersoda warna gelap", answer: "COLA" },
  { clue: "Hewan yang suka bertelur di kolam", answer: "BESEKOR" },
  { clue: "Kamu pakai ini biar bisa berenang", answer: "PELAMPUNG" },
  { clue: "Hewan berleher panjang dari Afrika", answer: "JERAPAH" },
  { clue: "Benda yang bisa terbang dan bising di langit", answer: "HELIKOPTER" },
  { clue: "Mainan anak kecil berbentuk bulat, bisa dilempar", answer: "BOLA" },
  { clue: "Tempat penyimpanan makanan dingin", answer: "KULKAS" },
  { clue: "Hewan melata tanpa kaki", answer: "ULAR" },
  { clue: "Makanan dari beras, jadi bentuk segitiga", answer: "LONTONG" }
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
