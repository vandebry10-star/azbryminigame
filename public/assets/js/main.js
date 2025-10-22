// assets/js/main.js — Controller + Renderer (Azbry Chess Final)
// Support: check highlight (raja merah) + popup menang + koordinat + captured bar

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // Root UI
  let boardEl      = $('board');
  const modeHuman  = $('modeHuman');
  const modeAI     = $('modeAI');
  const btnReset   = $('btnReset');
  const btnUndo    = $('btnUndo');
  const btnRedo    = $('btnRedo');
  const btnFlip    = $('btnFlip');
  const btnOnly    = $('btnBoardOnly');
  const btnBack    = $('btnBack');
  const moveLog    = $('moveHistory');

  // Overlays
  const startMenu     = $('startMenu');
  const btnStartHuman = $('btnStartHuman');
  const btnStartAI    = $('btnStartAI');

  const resultPopup = $('resultPopup');
  const resultText  = $('resultText');
  const btnRestart  = $('btnRestart');

  // Fallback: kalau board belum ada
  if (!boardEl) {
    boardEl = document.createElement('div');
    boardEl.id = 'board';
    boardEl.className = 'board';
    document.body.appendChild(boardEl);
  }

  // Game state
  const game = new Chess();                 // engine
  const ui   = new ChessUI(boardEl, onSquare);
  let mode   = 'human';                     // 'human' | 'ai'
  let selected = null;
  let lastMove = null;

  // === Captured pieces (graveyard) =======================================

  // unicode pieces (biar sama dengan UI)
  const PIECE_CHAR = {
    k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟',
    K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙'
  };

  // jumlah awal tiap jenis per warna
  const INITIAL_COUNTS = {
    w: { P:8, R:2, N:2, B:2, Q:1, K:1 },
    b: { P:8, R:2, N:2, B:2, Q:1, K:1 },
  };

  // buat container captured di bawah papan (sekali)
  function injectCapturedContainers(){
    if (document.querySelector('.captured-wrap')) return;
    const capWrap = document.createElement('div');
    capWrap.className = 'captured-wrap';

    const capWhite = document.createElement('div');
    capWhite.id = 'capturedWhite';
    capWhite.className = 'captured captured-white';

    const spacer = document.createElement('div');
    spacer.className = 'captured-spacer';
    spacer.style.flex = '1';

    const capBlack = document.createElement('div');
    capBlack.id = 'capturedBlack';
    capBlack.className = 'captured captured-black';

    capWrap.appendChild(capWhite);
    capWrap.appendChild(spacer);
    capWrap.appendChild(capBlack);

    // taruh setelah elemen board
    boardEl.insertAdjacentElement('afterend', capWrap);
  }

  function computeCapturedFromBoard(boardArray){
    const remain = { w: { P:0,R:0,N:0,B:0,Q:0,K:0 }, b: { P:0,R:0,N:0,B:0,Q:0,K:0 } };
    for (let i=0;i<64;i++){
      const c = boardArray[i];
      if (!c) continue;
      const clr = c.color === 'w' ? 'w' : 'b';
      const p = c.piece.toUpperCase();
      if (remain[clr][p] != null) remain[clr][p] += 1;
    }

    const captured = { w: [], b: [] };
    for (const clr of ['w','b']){
      for (const p of ['Q','R','B','N','P']){ // tampilkan mayor dulu
        const dead = Math.max(0, (INITIAL_COUNTS[clr][p] || 0) - (remain[clr][p] || 0));
        for (let k=0;k<dead;k++) captured[clr].push(p);
      }
    }
    return captured;
  }

  function renderCapturedFromBoard(boardArray){
    const capW = document.getElementById('capturedWhite');
    const capB = document.getElementById('capturedBlack');
    if (!capW || !capB) return;

    const caps = computeCapturedFromBoard(boardArray);

    // putih yang hilang (tertangkap oleh hitam)
    capW.innerHTML = '';
    caps.w.forEach(p => {
      const el = document.createElement('span');
      el.className = 'cap cap-w new';
      el.textContent = PIECE_CHAR[p];
      capW.appendChild(el);
      requestAnimationFrame(()=> el.classList.remove('new'));
    });

    // hitam yang hilang (tertangkap oleh putih)
    capB.innerHTML = '';
    caps.b.forEach(p => {
      const el = document.createElement('span');
      el.className = 'cap cap-b new';
      const key = p.toLowerCase();
      el.textContent = PIECE_CHAR[key] || PIECE_CHAR[p];
      capB.appendChild(el);
      requestAnimationFrame(()=> el.classList.remove('new'));
    });
  }

  // === Controls & Mode ====================================================

  // Mode picker
  if (modeHuman) modeHuman.addEventListener('click', () => setMode('human'));
  if (modeAI)    modeAI.addEventListener('click',    () => setMode('ai'));

  // Buttons
  if (btnReset)  btnReset.addEventListener('click',  () => hardReset());
  if (btnUndo)   btnUndo.addEventListener('click',   () => { game.undo(); selected=null; lastMove=null; sync(); });
  if (btnRedo)   btnRedo.addEventListener('click',   () => { game.redo(); selected=null; lastMove=null; sync(); });
  if (btnFlip)   btnFlip.addEventListener('click',   () => { ui.toggleFlip(); sync(); });

  // Board Only toggle
  if (btnOnly && btnBack) {
    btnOnly.addEventListener('click', () => {
      document.body.classList.add('board-only');
      btnOnly.style.display = 'none';
      btnBack.style.display = 'inline-block';
    });
    btnBack.addEventListener('click', () => {
      document.body.classList.remove('board-only');
      btnBack.style.display = 'none';
      btnOnly.style.display = 'inline-block';
    });
  }

  // Start menu
  if (btnStartHuman) btnStartHuman.addEventListener('click', () => startGame('human'));
  if (btnStartAI)    btnStartAI.addEventListener('click',    () => startGame('ai'));

  // Result popup
  if (btnRestart) btnRestart.addEventListener('click', () => {
    hideResult();
    if (startMenu) startMenu.classList.add('show');
    hardReset();
  });

  function startGame(m) {
    setMode(m);
    if (startMenu) startMenu.classList.remove('show');
  }

  function setMode(m) {
    mode = m;
    if (modeHuman) modeHuman.classList.toggle('active', m==='human');
    if (modeAI)    modeAI.classList.toggle('active',   m==='ai');
    selected = null;
    lastMove = null;
    sync();
  }

  function hardReset() {
    game.reset();
    selected = null;
    lastMove = null;
    sync();
  }

  // Klik papan
  function onSquare(squareAlg) {
    if (mode === 'ai' && game.turn() === 'b') return; // giliran AI

    const movesFromSel = selected ? game.moves({ square: selected }) : [];

    // Klik tujuan legal
    if (selected && movesFromSel.some(m => m.to === squareAlg)) {
      const promo = needsPromotion(selected, squareAlg) ? 'Q' : null;
      const note = game.move({ from: selected, to: squareAlg, promotion: promo });
      if (note) {
        lastMove = { from: selected, to: squareAlg };
        selected = null;
        sync();
        if (mode === 'ai') setTimeout(aiMove, 150);
      }
      return;
    }

    // Pilih bidak
    const idx = toIdx(squareAlg);
    const P = game.board()[idx];
    if (P && P.color === game.turn()) {
      selected = squareAlg;
    } else {
      selected = null;
    }
    sync();
  }

  // Promotion check
  function needsPromotion(fromAlg, toAlg) {
    const toR   = 8 - parseInt(toAlg[1], 10);
    const piece = game.board()[toIdx(fromAlg)];
    if (!piece || piece.piece !== 'P') return false;
    return (piece.color === 'w' && toR === 0) || (piece.color === 'b' && toR === 7);
  }

  // AI move (greedy)
  function aiMove() {
    if (mode !== 'ai' || game.turn() !== 'b') return;
    const legal = game.moves();
    if (!legal.length) { sync(); return; }

    const value = { P:1, N:3, B:3, R:5, Q:9, K:100 };
    let best = null, bestScore = -1;

    for (const m of legal) {
      const target = game.board()[toIdx(m.to)];
      const s = target ? value[target.piece] : 0;
      if (s > bestScore) { best = m; bestScore = s; }
    }

    const pick = bestScore > 0 ? best : legal[Math.floor(Math.random() * legal.length)];
    const promo = needsPromotion(pick.from, pick.to) ? 'Q' : null;
    const note = game.move({ from: pick.from, to: pick.to, promotion: promo });
    if (note) lastMove = { from: pick.from, to: pick.to };
    sync();
  }

  // ================== 🔥 SYNC — logika update tampilan ==================
  function sync() {
    const legalTargets = selected ? game.moves({ square: selected }).map(m => m.to) : [];

    // --- deteksi status ---
    let status = 'ok';
    if (typeof game.gameStatus === 'function') {
      status = game.gameStatus();                       // 'ok'|'check'|'checkmate'|'stalemate'
    } else {
      // fallback kalau engine pakai API lain
      const hasMoves = (game.moves().length > 0);
      const inCheckNow = typeof game.inCheck === 'function' ? game.inCheck() : false;
      status = !hasMoves && inCheckNow ? 'checkmate'
            : !hasMoves && !inCheckNow ? 'stalemate'
            : inCheckNow ? 'check'
            : 'ok';
    }
    const sideToMove = game.turn();                     // 'w'|'b'

    // --- kirim ke UI (aktifkan marker king) ---
    const inCheckOpt = (status === 'check') ? sideToMove : undefined;
    ui.render(game.board(), { lastMove, legal: legalTargets, inCheck: inCheckOpt });

    // salin .check → .in-check supaya CSS merah kamu aktif
    mirrorCheckClass();

    // koordinat + captured bar
    injectBoardLabels();
    injectCapturedContainers();
    renderCapturedFromBoard(game.board());

    // log langkah
    if (moveLog) {
      const h = game.history();
      moveLog.textContent = h.length ? h.map((x,i)=>`${i+1}. ${x}`).join('\n') : '_';
    }

    // --- hasil akhir ---
    if (status === 'checkmate') {
      const winner = (sideToMove === 'w') ? 'Hitam' : 'Putih'; // sideToMove lagi MAT → lawannya menang
      showResult(`${winner} Menang!`);
    } else if (status === 'stalemate') {
      showResult('Seri 🤝');
    }
  }

  // Tambah koordinat a–h & 1–8 kalau belum ada
  function injectBoardLabels(){
    if (!boardEl.querySelector('.files')) {
      const files = document.createElement('div');
      files.className = 'files';
      'abcdefgh'.split('').forEach(ch => {
        const s = document.createElement('span'); s.textContent = ch; files.appendChild(s);
      });
      boardEl.appendChild(files);
    }
    if (!boardEl.querySelector('.ranks')) {
      const ranks = document.createElement('div');
      ranks.className = 'ranks';
      for (let i = 8; i >= 1; i--) {
        const s = document.createElement('span'); s.textContent = i; ranks.appendChild(s);
      });
      boardEl.appendChild(ranks);
    }
  }

  // Convert class .check (dari ChessUI) → .in-check (CSS merah)
  function mirrorCheckClass(){
    boardEl.querySelectorAll('.sq.in-check').forEach(el => el.classList.remove('in-check'));
    boardEl.querySelectorAll('.sq.check').forEach(el => el.classList.add('in-check'));
  }

  function showResult(text) {
    if (!resultPopup || !resultText) return;
    resultText.textContent = text;
    resultPopup.classList.add('show');
  }
  function hideResult() {
    if (!resultPopup) return;
    resultPopup.classList.remove('show');
  }

  function toIdx(a) {
    return (8 - parseInt(a[1],10)) * 8 + 'abcdefgh'.indexOf(a[0]);
  }

  // Init
  injectBoardLabels();
  injectCapturedContainers();
  if (startMenu) startMenu.classList.add('show');
  setMode('human'); // default mode
});
