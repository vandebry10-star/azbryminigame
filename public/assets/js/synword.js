// Azbry SynWord — Tebak Sinonim (no API, full offline)
// Skor 0–100 berdasarkan: sinonim persis, klaster makna, + kemiripan huruf (Jaro-Winkler & bigram)

(function(){
  // ===== Mini “thesaurus” Indonesia (cluster by topic) =====
  // target dipilih acak dari daftar ini.
  const BANK = [
    group('EMOSI POSITIF', [
      entry('BAHAGIA',  ['SENANG','GEMBIRA','RIA','SUKACITA','BERSUKA','RIANG'],  ['PUAS','LEGA','SUMRINGAH']),
      entry('TENANG',   ['DAMAI','HENING','TEDUH','ADEM'],                         ['SANTAI','LAPANG','SEJUK']),
      entry('BANGGA',   ['HARU','GAGAH','MEGAH'],                                  ['PUAS','PUJIAN','PERCAYA DIRI']),
      entry('LEGA',     ['LEPAS','PLONG','RINGAN'],                                ['PUAS','TENANG']),
    ]),
    group('EMOSI NEGATIF', [
      entry('MARAH',    ['MURKA','NAIK DARAH','GERAM','NGLAMUN?'],                 ['KESAL','SEWOT']), // candaan cluster boleh
      entry('SEDIH',    ['DUKA','PILU','LARA','GUNDAH'],                            ['KECEWA','TERPURUK']),
      entry('TAKUT',    ['NGERI','NGERIAN','WASWAS','CIUT'],                        ['CEMAS','RAGU']),
      entry('MUAK',     ['JEMU','ENEG','BOSAN'],                                    ['ILFEEL','JENUH']),
    ]),
    group('AKTIVITAS', [
      entry('BERLARI',  ['LARI','MENGGAS','MELAJU'],                                ['MENDADAK','SPRINT']),
      entry('MAKAN',    ['SANTAP','HIDANG','MENYANTAP'],                            ['NYEMIL','KUNYAH']),
      entry('MINUM',    ['TEGUK','SERUPUT'],                                        ['MENEGUK','MENYERUPUT']),
      entry('TIDUR',    ['LELAP','TERLELAP','BERISTIRAHAT'],                        ['MEREM','BANTAI KASUR']),
    ]),
    group('SIFAT / KARAKTER', [
      entry('JUJUR',    ['LUGAS','TERBUKA'],                                        ['APA ADANYA','TULUS']),
      entry('RAJIN',    ['TEKUN','GIAT','KONSISTEN'],                               ['DISIPLIN','ULET']),
      entry('SOMBONG',  ['ANGKUH','CONGKAK'],                                       ['KEPALA BATU','MEREMEHKAN']),
      entry('DERMAWAN', ['MURAH HATI','ROYAL'],                                     ['SUDAH-SUDAH BAIK']),
    ]),
    group('UMUM', [
      entry('PEDAS',    ['PENAS','LADA','CABAI'],                                   ['HOT','MENYENGAT']),
      entry('DINGIN',   ['SEJUK','BEKU'],                                           ['ADEM','MEMBEKU']),
      entry('PANAS',    ['HANGAT','TERIK'],                                         ['MENDIDIH','MENGGELORA']),
      entry('INDAH',    ['CANTIK','ELOK','PERMAI'],                                 ['MOLEK','ANGGUN']),
    ]),
  ];

  // ===== Helpers to build clusters =====
  function group(name, arr){ return { name, words: arr }; }
  function entry(target, perfect=[], near=[]){
    // simpan uppercase semua agar seragam
    const norm = s => s.toUpperCase().replace(/[^\p{L}\p{N}\s]/gu,'').trim();
    const T = norm(target);
    const P = perfect.map(norm);
    const N = near.map(norm);
    return { target:T, perfect:P, near:N, len:T.length };
  }

  // ===== Pick a random target =====
  let state;
  function newRound(){
    const G = BANK[Math.random()*BANK.length|0];
    const E = G.words[Math.random()*G.words.length|0];
    state = {
      group: G.name,
      target: E.target,
      perfect: new Set([E.target, ...E.perfect]),
      near: new Set(E.near),
      tries: 0,
      best: 0,
      solved: false,
      len: E.len
    };
    drawHints();
    setBar(0);
    setBest(0);
    setTries(0);
    clearLog();
    focusInput();
  }

  // ===== String similarity (Jaro-Winkler + bigram dice) =====
  function jaroWinkler(a,b){
    a=a.toUpperCase(); b=b.toUpperCase();
    if(a===b) return 1;
    const mrange = Math.floor(Math.max(a.length,b.length)/2)-1;
    const aMatch=new Array(a.length).fill(false);
    const bMatch=new Array(b.length).fill(false);
    let m=0;
    for(let i=0;i<a.length;i++){
      const start=Math.max(0,i-mrange), end=Math.min(b.length-1,i+mrange);
      for(let j=start;j<=end;j++){
        if(!bMatch[j] && a[i]===b[j]){ aMatch[i]=bMatch[j]=true; m++; break; }
      }
    }
    if(m===0) return 0;
    let t=0, k=0;
    for(let i=0;i<a.length;i++){
      if(!aMatch[i]) continue;
      while(!bMatch[k]) k++;
      if(a[i]!==b[k]) t++;
      k++;
    }
    t/=2;
    const jw = (m/a.length + m/b.length + (m - t)/m)/3;
    // prefix boost
    let l=0; const maxL=4;
    while(l<Math.min(maxL,a.length,b.length) && a[l]===b[l]) l++;
    return jw + l*0.1*(1-jw);
  }
  function bigramDice(a,b){
    a=a.toUpperCase(); b=b.toUpperCase();
    const grams = s=>{
      const g=[]; for(let i=0;i<s.length-1;i++) g.push(s.slice(i,i+2));
      return g;
    };
    const A=grams(a), B=grams(b);
    if(A.length===0 || B.length===0) return 0;
    let inter=0;
    const map=new Map();
    for(const x of A) map.set(x,(map.get(x)||0)+1);
    for(const y of B){ const c=map.get(y)||0; if(c>0){ inter++; map.set(y,c-1); } }
    return (2*inter)/(A.length+B.length);
  }
  function semanticScore(guess){
    const g = norm(guess);
    if(!g) return 0;
    if(state.perfect.has(g)) return 100;
    if(state.near.has(g)) return 85;
    // skor huruf mirip untuk “aroma” semantik ringan (tanpa corpus)
    const jw = jaroWinkler(g, state.target);
    const di = bigramDice(g, state.target);
    // gabungan, lalu skala 0..70 biar tak menyalip near
    let s = Math.max(jw, di) * 70;
    // sedikit bonus bila panjangnya mirip
    const lenSim = 1 - Math.min(1, Math.abs(g.length - state.len)/Math.max(state.len,1));
    s += lenSim * 10; // bonus kecil
    return Math.max(0, Math.min(84, Math.round(s))); // stop di 84 (85 = NEAR)
  }
  function norm(s){ return (s||'').toUpperCase().replace(/[^\p{L}\p{N}\s]/gu,'').trim(); }

  // ===== DOM =====
  const $g = id('guess');
  const $btnSubmit = id('btnSubmit');
  const $btnGiveUp = id('btnGiveUp');
  const $btnNew = id('btnNew');
  const $hints = id('hints');
  const $bar = id('bar');
  const $tries = id('tries');
  const $best = id('best');
  const $log = id('log');

  function id(x){ return document.getElementById(x); }
  function focusInput(){ setTimeout(()=>{ $g.focus(); $g.select(); }, 0); }
  function setBar(p){ $bar.style.width = Math.max(0,Math.min(100,p)) + '%'; }
  function setTries(n){ $tries.textContent = n; }
  function setBest(n){ $best.textContent = n; }
  function clearLog(){ $log.innerHTML=''; }
  function addLog(guess, score){
    const div = document.createElement('div');
    div.className = 'card';
    const badge = score>=100 ? 'ok' : score>=60 ? 'near' : 'far';
    div.innerHTML = `
      <div class="guessline">
        <div class="guess">${guess}</div>
        <span class="badge ${badge}">${score}</span>
      </div>
      <div class="mini mono">kedekatan: ${score}/100</div>
      <div class="scorebar"><span style="width:${score}%;"></span></div>
    `;
    // prepend
    if ($log.firstChild) $log.insertBefore(div, $log.firstChild); else $log.appendChild(div);
  }
  function drawHints(){
    $hints.innerHTML = '';
    const chip = txt=>{
      const s=document.createElement('span'); s.className='chip'; s.textContent = txt; return s;
    };
    $hints.append(
      chip(`Kategori: ${state.group}`),
      chip(`Panjang: ${state.len} huruf`),
      chip(`Hint awal: ${state.target[0]} _ _ ...`)
    );
  }

  // ===== Actions =====
  function submit(){
    if(state.solved) return;
    const g = norm($g.value);
    if(!g) return;
    state.tries++;
    const score = semanticScore(g);
    state.best = Math.max(state.best, score);
    addLog(g, score);
    setTries(state.tries);
    setBest(state.best);
    setBar(state.best);
    $g.value='';
    if(score>=100){
      state.solved = true;
      addLog(`BENAR: ${state.target}`, 100);
      setBar(100);
    }
  }
  function giveUp(){
    if(state.solved) return;
    state.solved = true;
    addLog(`JAWABAN: ${state.target}`, 100);
    setBar(100);
  }

  // ===== Bind =====
  $btnSubmit.addEventListener('click', submit);
  $btnGiveUp.addEventListener('click', giveUp);
  $btnNew.addEventListener('click', newRound);
  $g.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){ submit(); }
  });

  // ===== Start =====
  newRound();
})();
