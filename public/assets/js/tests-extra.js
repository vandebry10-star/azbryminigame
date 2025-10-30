// assets/js/tests-extra.js
// Khodam & Cek Pacar (deterministik) — DOM ready + tombol type=button safe

window.addEventListener('DOMContentLoaded', () => {
  // util hash: string -> 0..mod-1
  function hashTo(s, mod){
    s = (s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    let h = 0;
    for (const ch of s) h = (h * 131 + ch.charCodeAt(0)) >>> 0;
    return mod ? (h % mod) : h;
  }

  const KHODAMS = [
    {name:"Harimau Putih", meaning:"Keberanian & pelindung; tetap rendah hati."},
    {name:"Naga Wungu", meaning:"Intuisi tajam; cocok memimpin & menginspirasi."},
    {name:"Macan Loreng", meaning:"Pemberani tapi bijak—pilih pertempuran yang perlu."},
    {name:"Elang Timur", meaning:"Pengamat fokus; peluang jarang terlewat."},
    {name:"Kuda Embun", meaning:"Kerja keras konsisten; hasil datang pasti."},
    {name:"Rusa Rimba", meaning:"Hati lembut; disenangi banyak orang."},
    {name:"Buaya Senja", meaning:"Tenang & sabar; jarang gegabah."},
    {name:"Gajah Arunika", meaning:"Kokoh & setia; pijakan buat teman."},
    {name:"Serigala Malam", meaning:"Naluri tajam & setia; cerdas membaca situasi."},
    {name:"Ular Purnama", meaning:"Adaptif & gesit; perubahan jadi keunggulan."},
    {name:"Garuda Hijau", meaning:"Wibawa kuat; jadi tumpuan tim."},
    {name:"Penyu Samudra", meaning:"Sabar; hasil besar butuh waktu."},
    {name:"Rajawali Salju", meaning:"Berani tinggi; tetap awas arus angin."},
    {name:"Kijang Lembayung", meaning:"Lincah & ceria; bawa warna suasana."},
    {name:"Kerbau Bumi", meaning:"Tahan banting; jatuh bangkit lagi."},
  ];

  const LOVE_STATUS = [
    {label:"Jadian 🎉", msg:"Chemistry kerasa! Coba ajak ngopi santai."},
    {label:"HTS 🤝", msg:"Hampir! Perlu obrolan terbuka biar jelas arahnya."},
    {label:"Bestie Only 🙂", msg:"Nyambung, tapi vibes masih sahabatan."},
    {label:"Kurang Nyambung 😅", msg:"Coba pendekatan lain dulu, pelan-pelan."},
  ];

  // ==== KHODAM ====
  const btnK = document.getElementById('btn-khodam');
  if (btnK) {
    btnK.addEventListener('click', (e) => {
      e.preventDefault();
      const nameEl = document.getElementById('khodam-name');
      const out  = document.getElementById('out-khodam');
      const title= document.getElementById('khodam-title');
      const mean = document.getElementById('khodam-mean');
      const name = (nameEl?.value || '').trim();

      if (!name) { if(out) out.hidden = true; return; }
      const k = KHODAMS[hashTo(name, KHODAMS.length)];
      if (title) title.textContent = `Khodam @${name} : ${k.name}`;
      if (mean)  mean.textContent  = `Penjelasan: ${k.meaning}`;
      if (out)   out.hidden = false;
    });
  }

  // ==== CEK PACAR ====
  const btnCP = document.getElementById('btn-cekpacar');
  if (btnCP) {
    btnCP.addEventListener('click', (e) => {
      e.preventDefault();
      const a = (document.getElementById('cp-a')?.value || '').trim();
      const b = (document.getElementById('cp-b')?.value || '').trim();
      const out  = document.getElementById('out-cekpacar');
      const stat = document.getElementById('cp-status');
      const msg  = document.getElementById('cp-msg');

      if (!a || !b) { if(out) out.hidden = true; return; }
      const res = LOVE_STATUS[hashTo(`${a}#${b}`, LOVE_STATUS.length)];

      if (stat) stat.textContent = `Status: ${res.label}`;
      if (msg)  msg.textContent  = `${a} ❤️ ${b} — ${res.msg}`;
      if (out)  out.hidden = false;
    });
  }
});
