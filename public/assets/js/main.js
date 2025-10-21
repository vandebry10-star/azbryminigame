/* Azbry Chess — MAIN glue */
(() => {
  const $ = s => document.querySelector(s);

  let mode = 'human'; // 'human' | 'ai'
  let flipped = false;

  const boardEl = $('#board');

  function snapshot(){
    const s = AzEngine.snapshot();
    AzUI.update(s.board, s.turn, s.legal, AzEngine._hist, null);
    return s;
  }

  function reset(){
    const s = AzEngine.reset();
    AzUI.reset(s.board, s.turn, s.legal, AzEngine._hist);
  }

  function applyAndRender(move){
    const res = AzEngine.apply(move);
    const snap = AzEngine.snapshot();
    AzUI.update(snap.board, snap.turn, snap.legal, AzEngine._hist, move);
    // check status (win/draw)
    if(snap.status.over){
      toastResult(snap.status);
      return;
    }
    // AI reply if needed
    if(mode==='ai' && snap.turn==='b'){ // manusia selalu putih untuk sederhana
      setTimeout(aiStep, 180);
    }
  }

  function toastResult(st){
    const msg = st.reason==='checkmate'
      ? (st.result==='1-0'?'Putih menang (Checkmate)':'Hitam menang (Checkmate)')
      : 'Seri';
    const el = $('#resultToast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 2000);
  }

  function aiStep(){
    const s = AzEngine.snapshot();
    if(s.status.over) return;
    const mv = AzEngine.randomAIMove();
    if(!mv){ toastResult({reason:'stalemate'}); return; }
    applyAndRender(mv);
  }

  // === UI events ===
  $('#modeHuman').addEventListener('click', ()=>{
    mode='human';
    $('#modeHuman').classList.add('active');
    $('#modeAI').classList.remove('active');
    reset();
  });
  $('#modeAI').addEventListener('click', ()=>{
    mode='ai';
    $('#modeAI').classList.add('active');
    $('#modeHuman').classList.remove('active');
    reset(); // start fresh; manusia = putih
  });

  $('#btnReset').addEventListener('click', reset);

  $('#btnFlip').addEventListener('click', ()=>{
    flipped = !flipped;
    AzUI.setFlipped(flipped);
    snapshot();
  });

  $('#btnUndo').addEventListener('click', ()=>{
    const s = AzEngine.undo();
    if(s) AzUI.update(s.board, s.turn, s.legal, AzEngine._hist, null);
  });

  $('#btnRedo').addEventListener('click', ()=>{/* optional in next build */});

  $('#btnBoardOnly').addEventListener('click', ()=>{
    document.body.classList.toggle('board-only');
  });

  $('#btnBack').addEventListener('click', ()=>{
    // balik ke tests.html atau index? di sini: history.back
    history.back();
  });

  // Click square from UI
  window.onSquareClick = function(i){
    const snap = AzEngine.snapshot();
    const legal = snap.legal;

    // cari apakah sedang memilih source
    const srcMoves = legal.filter(m=>m.from===i);
    const isSrc = srcMoves.length>0;

    // jika klik source
    if(isSrc){
      window.AzUI.update(snap.board, snap.turn, snap.legal, AzEngine._hist, null);
      // tandai selection via UI internal
      window.AzUI.selection = i; // not used (but kept)
      // rebuild with highlight handled inside AzUI.update
      window.AzUI.update(snap.board, snap.turn, snap.legal, AzEngine._hist, null);
      return;
    }

    // atau klik target dari source yang sebelumnya?
    // cek dari semua legal apakah ada move dengan to = i (ambiguous); ambil yang from terakhir dipilih (jika ada)
    // untuk sederhana, pilih move pertama yang menuju i
    const mv = legal.find(m=>m.to===i);
    if(mv){
      applyAndRender(mv);
      return;
    }
  };

  // init
  reset();
})();
