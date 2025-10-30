// assets/js/tests-extra.js
// Integrasi konten cekcek.zip jadi game web (khodam & cek pacar)

(function(){
  // --- util hash deterministik: string -> 0..(mod-1)
  function hashTo(s, mod){
    s = (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    let h=0; for(const ch of s){ h = (h*131 + ch.charCodeAt(0)) >>> 0; }
    return mod ? (h % mod) : h;
  }

  // --- dataset khodam (nama & “arti” ringkas)
  const KHODAMS = [
    {name:"Harimau Putih", meaning:"Melambangkan keberanian & pelindung, tetap rendah hati."},
    {name:"Naga Wungu", meaning:"Intuisi tajam, cocok memimpin & menginspirasi kawan."},
    {name:"Macan Loreng", meaning:"Pemberani, tapi bijak—pilih pertempuran yang perlu."},
    {name:"Elang Timur", meaning:"Pengamat yang fokus—peluang jarang terlewat."},
    {name:"Kuda Embun", meaning:"Kerja keras & konsisten, rezeki datang perlahan pasti."},
    {name:"Rusa Rimba", meaning:"Hati lembut, disenangi banyak orang."},
    {name:"Buaya Senja", meaning:"Tenang & sabar, jarang gegabah ambil keputusan."},
    {name:"Gajah Arunika", meaning:"Kokoh & setia kawan—pijakan buat lingkaran teman."},
    {name:"Serigala Malam", meaning:"Tajam naluri, setia, cerdas membaca situasi."},
    {name:"Ular Purnama", meaning:"Adaptif & gesit; perubahan justru jadi keunggulan."},
    {name:"Garuda Hijau", meaning:"Wibawa kuat; cocok jadi tumpuan tim."},
    {name:"Penyu Samudra", meaning:"Panorama sabar—hasil besar butuh waktu."},
    {name:"Rajawali Salju", meaning:"Berani tinggi-tinggi, tapi tetap awas arus angin."},
    {name:"Kijang Lembayung", meaning:"Lincah & ceria; bawa warna di tiap suasana."},
    {name:"Kerbau Bumi", meaning:"Tangguh & tahan banting; kalau jatuh cepat bangkit."},
  ];

  // --- hasil status cinta (buat “cek pacar”)
  const LOVE_STATUS = [
    {label:"Jadian 🎉", msg:"Chemistry-nya kerasa! Coba ajak ngopi santai."},
    {label:"HTS 🤝", msg:"Hampir! Perlu obrolan terbuka biar jelas arahnya."},
    {label:"Bestie Only 🙂", msg:"Nyambung, tapi vibes lebih ke sahabat."},
    {label:"Kurang Nyambung 😅", msg:"Coba pendekatan lain dulu, jangan buru-buru."},
  ];

  // ====== KHODAM (UI bindings) ======
  const btnK = document.getElementById('btn-khodam');
  if (btnK){
    btnK.addEventListener('click', ()=>{
      const name = (document.getElementById('khodam-name')?.value || '').trim();
      const out  = document.getElementById('out-khodam');
      const title= document.getElementById('khodam-title');
      const mean = document.getElementById('khodam-mean');
      if (!name){ out.hidden = true; return; }
      const i = hashTo(name, KHODAMS.length);
      const k = KHODAMS[i];
      title.textContent = `Khodam @${name} : ${k.name}`;
      mean.textContent  = `Penjelasan: ${k.meaning}`;
      out.hidden = false;
    });
  }

  // ====== CEK PACAR (UI bindings) ======
  const btnCP = document.getElementById('btn-cekpacar');
  if (btnCP){
    btnCP.addEventListener('click', ()=>{
      const a = (document.getElementById('cp-a')?.value || '').trim();
      const b = (document.getElementById('cp-b')?.value || '').trim();
      const out  = document.getElementById('out-cekpacar');
      const stat = document.getElementById('cp-status');
      const msg  = document.getElementById('cp-msg');
      if (!a || !b){ out.hidden = true; return; }

      // gabungkan nama -> skor deterministik
      const s = `${a}#${b}`;
      const pick = hashTo(s, LOVE_STATUS.length);
      const res = LOVE_STATUS[pick];

      stat.textContent = `Status: ${res.label}`;
      msg.textContent  = `${a} ❤️ ${b} — ${res.msg}`;
      out.hidden = false;
    });
  }
})();
