/* ==========================
 *  AZBRY CHESS – MAIN (FIX)
 *  – wiring tombol, history, turn, move log
 *  ========================== */

(() => {
  // turn & mode
  window.currentTurnColor = 'white';
  let mode = 'human'; // 'human' | 'ai' (AI nyusul)

  // history (deep-clone boardState per langkah)
  const history = [];
  const redoStack = [];

  const logEl = document.getElementById('moveHistory');

  function cloneBoard(b=window.boardState){ return b.map(r=>r.map(p=>p?{...p}:null)); }

  function pushHistory(note) {
    history.push({ board: cloneBoard(), note });
    // kalau ada langkah baru, redo kosong
    redoStack.length = 0;
    renderLog();
  }

  function renderLog() {
    if (!logEl) return;
    if (!history.length) { logEl.textContent = '—'; return; }
    const rows = history.map((h,i)=>`${i+1}. ${h.note}`).join('\n');
    logEl.textContent = rows;
  }

  function algebra([fx,fy],[tx,ty]){
    const file = i => String.fromCharCode(97 + i);
    const rank = j => 8 - j;
    return `${file(fx)}${rank(fy)} → ${file(tx)}${rank(ty)}`;
  }

  // dipanggil UI saat move sukses
  window.onMoveApplied = (from,to) => {
    const note = algebra(from,to);
    pushHistory(note);

    // cek status
    const next = window.currentTurnColor === 'white' ? 'black' : 'white';
    const st = window.getGameStatus(next); // status utk pihak yg akan jalan
    if (st.mate) {
      // tampilkan modal simple
      toast(`${next === 'white' ? 'Putih' : 'Hitam'} MAT!`);
    } else if (st.check) {
      toast('Check!');
    }

    // ganti turn
    window.currentTurnColor = next;
  };

  function toast(msg){
    let box = document.getElementById('resultModal');
    if(!box){
      box = document.createElement('div');
      box.id='resultModal';
      box.style.cssText='position:fixed;inset:auto 0 24px 0;margin:auto;width:max-content;max-width:90%;background:#202225;color:#e6ffe6;padding:10px 14px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.4);z-index:10000';
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.style.display='block';
    setTimeout(()=>{ box.style.display='none'; }, 1400);
  }

  // tombol
  document.getElementById('btnReset')?.addEventListener('click', () => {
    window.initBoard();
    window.currentTurnColor = 'white';
    history.length = 0; redoStack.length = 0;
    window.UIChess?.rebuild();
    renderLog();
  });

  document.getElementById('btnUndo')?.addEventListener('click', () => {
    if (!history.length) return;
    const last = history.pop();
    redoStack.push({ board: cloneBoard(), note: last.note });
    window.boardState = cloneBoard(last.board);
    // balik turn
    window.currentTurnColor = (window.currentTurnColor === 'white') ? 'black' : 'white';
    window.UIChess?.render();
    renderLog();
  });

  document.getElementById('btnRedo')?.addEventListener('click', () => {
    if (!redoStack.length) return;
    const nxt = redoStack.pop();
    history.push({ board: cloneBoard(), note: nxt.note });
    window.boardState = cloneBoard(nxt.board);
    window.currentTurnColor = (window.currentTurnColor === 'white') ? 'black' : 'white';
    window.UIChess?.render();
    renderLog();
  });

  document.getElementById('btnFlip')?.addEventListener('click', () => {
    document.getElementById('board')?.classList.toggle('flip');
  });

  // mode
  document.getElementById('modeHuman')?.addEventListener('click', () => {
    mode = 'human';
    document.getElementById('modeHuman')?.classList.add('active');
    document.getElementById('modeAI')?.classList.remove('active');
  });

  document.getElementById('modeAI')?.addEventListener('click', () => {
    mode = 'ai';
    document.getElementById('modeAI')?.classList.add('active');
    document.getElementById('modeHuman')?.classList.remove('active');
    // (AI move generator nyusul—sekarang tetap manusia vs manusia,
    //  tapi tombolnya sudah hidup dan tidak bikin JS error)
  });

  // board only / back – biar gak bikin error kalau belum di-wire ke halaman lain
  document.getElementById('btnBoardOnly')?.addEventListener('click', () => {
    document.querySelector('.panel')?.classList.toggle('hidden');
  });
  document.getElementById('btnBack')?.addEventListener('click', () => {
    history.length = 0; redoStack.length = 0;
    window.initBoard();
    window.currentTurnColor = 'white';
    window.UIChess?.rebuild();
    renderLog();
  });

  // init pertama
  if (!window.boardState || !window.boardState.length) {
    window.initBoard();
  }
  window.UIChess?.rebuild();
  renderLog();
})();
