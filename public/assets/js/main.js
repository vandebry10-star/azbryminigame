// assets/js/main.js — Azbry Chess (vFinal)
// Fitur: check merah, popup menang, koordinat, captured bar

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // -----------------------------------------------------------------------
  // Root UI
  let boardEl = $('board');
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
  const resultPopup   = $('resultPopup');
  const resultText    = $('resultText');
  const btnRestart    = $('btnRestart');

  if (!boardEl) {
    boardEl = document.createElement('div');
    boardEl.id = 'board';
    boardEl.className = 'board';
    document.body.prepend(boardEl);
  }

  // -----------------------------------------------------------------------
  // Game state
  const game = new Chess();
  const ui   = new ChessUI(boardEl, onSquare);
  if (!ui.squares || ui.squares.length !== 64) ui._buildGrid();

  let mode     = 'human';
  let selected = null;
  let lastMove = null;

  // -----------------------------------------------------------------------
  // Captured pieces
  const PIECE_CHAR = {
    k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟',
    K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙'
  };
  const INITIAL_COUNTS = {
    w: { P:8, R:2, N:2, B:2, Q:1, K:1 },
    b: { P:8, R:2, N:2, B:2, Q:1, K:1 },
  };

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
      for (const p of ['Q','R','B','N','P']){
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

    capW.innerHTML = '';
    caps.w.forEach(p => {
      const el = document.createElement('span');
      el.className = 'cap cap-w new';
      el.textContent = PIECE_CHAR[p];
      capW.appendChild(el);
      requestAnimationFrame(()=> el.classList.remove('new'));
    });

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

  // -----------------------------------------------------------------------
  // Mode & Buttons
  if (modeHuman) modeHuman.addEventListener('click', () => setMode('human'));
  if (modeAI)    modeAI.addEventListener('click',    () => setMode('ai'));
  if (btnReset)  btnReset.addEventListener('click',  () => hardReset());
  if (btnUndo)   btnUndo.addEventListener('click',   () => { game.undo(); selected=null; lastMove=null; sync(); });
  if (btnRedo)   btnRedo.addEventListener('click',   () => { game.redo(); selected=null; lastMove=null; sync(); });
  if (btnFlip)   btnFlip.addEventListener('click',   () => { ui.toggleFlip(); sync(); });

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

  if (btnStartHuman) btnStartHuman.addEventListener('click', () => startGame('human'));
  if (btnStartAI)    btnStartAI.addEventListener('click',    () => startGame('ai'));
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

  // -----------------------------------------------------------------------
  // Klik papan
  function onSquare(squareAlg) {
    if (mode === 'ai' && game.turn() === 'b') return;
    const movesFromSel = selected ? game.moves({ square: selected }) : [];
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
    const idx = toIdx(squareAlg);
    const P = game.board()[idx];
    if (P && P.color === game.turn()) selected = squareAlg;
    else selected = null;
    sync();
  }

  function needsPromotion(fromAlg, toAlg) {
    const toR   = 8 - parseInt(toAlg[1], 10);
    const piece = game.board()[toIdx(fromAlg)];
    if (!piece || piece.piece !== 'P') return false;
    return (piece.color === 'w' && toR === 0) || (piece.color === 'b' && toR === 7);
  }

  // -----------------------------------------------------------------------
  // AI move
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

  // -----------------------------------------------------------------------
  // Universal status detector
  function getStatus() {
    let hasMoves = true;
    try { hasMoves = (Array.isArray(game.moves()) ? game.moves().length > 0 : true); } catch {}
    let inCheck = false;
    try {
      if (typeof game.inCheck === 'function')      inCheck = !!game.inCheck();
      else if (typeof game.in_check === 'function') inCheck = !!game.in_check();
      else if (typeof game.isCheck === 'function')  inCheck = !!game.isCheck();
      else if (typeof game.check === 'boolean')     inCheck = game.check;
    } catch {}
    let isMate = false;
    try {
      if (typeof game.inCheckmate === 'function')      isMate = !!game.inCheckmate();
      else if (typeof game.in_checkmate === 'function') isMate = !!game.in_checkmate();
      else if (!hasMoves && inCheck)                   isMate = true;
    } catch {}
    let isStale = false;
    try {
      if (typeof game.inStalemate === 'function')      isStale = !!game.inStalemate();
      else if (typeof game.in_stalemate === 'function') isStale = !!game.in_stalemate();
      else if (!hasMoves && !inCheck)                  isStale = true;
    } catch {}
    let status = 'ok';
    if (isMate) status = 'checkmate';
    else if (isStale) status = 'stalemate';
    else if (inCheck) status = 'check';
    return { status, inCheck, hasMoves };
  }

  // -----------------------------------------------------------------------
  // SYNC
  function sync() {
    const legalTargets = selected ? game.moves({ square: selected }).map(m => m.to) : [];
    const { status, inCheck } = getStatus();
    const sideToMove = game.turn();
    const inCheckOpt = inCheck ? sideToMove : undefined;

    ui.render(game.board(), { lastMove, legal: legalTargets, inCheck: inCheckOpt });
    mirrorCheckClass();
    injectBoardLabels();
    injectCapturedContainers();
    renderCapturedFromBoard(game.board());

    if (moveLog) {
      const h = game.history();
      moveLog.textContent = h.length ? h.map((x,i)=>`${i+1}. ${x}`).join('\n') : '_';
    }

    if (status === 'checkmate') {
      const winner = (sideToMove === 'w') ? 'Hitam' : 'Putih';
      showResult(`${winner} Menang!`);
    } else if (status === 'stalemate') {
      showResult('Seri 🤝');
    }
  }

  function injectBoardLabels(){
    if (!boardEl.querySelector('.files')) {
      const files = document.createElement('div');
      files.className = 'files';
      'abcdefgh'.split('').forEach(ch => {
        const s = document.createElement('span');
        s.textContent = ch;
        files.appendChild(s);
      });
      boardEl.appendChild(files);
    }
    if (!boardEl.querySelector('.ranks')) {
      const ranks = document.createElement('div');
      ranks.className = 'ranks';
      for (let i = 8; i >= 1; i--) {
        const s = document.createElement('span');
        s.textContent = i;
        ranks.appendChild(s);
      }
      boardEl.appendChild(ranks);
    }
  }

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

  // -----------------------------------------------------------------------
  // Boot
  injectCapturedContainers();
  injectBoardLabels();
  if (startMenu) startMenu.classList.add('show');
  sync();
});
