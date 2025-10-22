// assets/js/main.js — Azbry Chess (robust)
// Fitur: koordinat, captured bar, check merah, popup menang

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

  // Pastikan board ada
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

  // safety: kalau entah kenapa grid belum kebangun, force build
  try {
    if (!ui.squares || ui.squares.length !== 64) ui._buildGrid();
  } catch(_) {/* noop */}

  let mode     = 'human';
  let selected = null;
  let lastMove = null;

  // -----------------------------------------------------------------------
  // Captured bar utils
  const PIECE_CHAR = {
    k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟',
    K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙'
  };
  const INITIAL_COUNTS = {
    w: { P:8, R:2, N:2, B:2, Q:1, K:1 },
    b: { P:8, R:2, N:2, B:2, Q:1, K:1 },
  };

  function injectCapturedContainers(){
    try{
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
    }catch(_){}
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
    try{
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
    }catch(_){}
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
  // Interaksi papan
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

  // AI
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
  // SYNC — render & status
  function sync() {
    // safety: kalau grid hilang, rebuild
    try { if (!ui.squares || ui.squares.length !== 64) ui._buildGrid(); } catch(_){}

    const legalTargets = selected ? game.moves({ square: selected }).map(m => m.to) : [];

    // deteksi status
    let status = 'ok';
    try {
      status = typeof game.gameStatus === 'function'
        ? game.gameStatus()
        : (() => {
            const hasMoves = (game.moves().length > 0);
            const inChk = typeof game.inCheck === 'function' ? game.inCheck() : false;
            return !hasMoves && inChk ? 'checkmate'
                 : !hasMoves && !inChk ? 'stalemate'
                 : inChk ? 'check' : 'ok';
          })();
    } catch(_) {}

    const sideToMove = game.turn(); // 'w'|'b'
    const inCheckOpt = (status === 'check') ? sideToMove : undefined;

    // render board
    ui.render(game.board(), { lastMove, legal: legalTargets, inCheck: inCheckOpt });

    // salin .check → .in-check (CSS merah)
    mirrorCheckClass();

    // UI tambahan
    injectBoardLabels();
    injectCapturedContainers();
    renderCapturedFromBoard(game.board());

    // log
    if (moveLog) {
      const h = game.history();
      moveLog.textContent = h.length ? h.map((x,i)=>`${i+1}. ${x}`).join('\n') : '_';
    }

    // hasil akhir
    if (status === 'checkmate') {
      const winner = (sideToMove === 'w') ? 'Hitam' : 'Putih';
      showResult(`${winner} Menang!`);
    } else if (status === 'stalemate') {
      showResult('Seri 🤝');
    }
  }

  // koordinat
  function injectBoardLabels(){
    try{
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
        }
        boardEl.appendChild(ranks);
      }
    }catch(_){}
  }

  // convert .check → .in-check
  function mirrorCheckClass(){
    try{
      boardEl.querySelectorAll('.sq.in-check').forEach(el => el.classList.remove('in-check'));
      boardEl.querySelectorAll('.sq.check').forEach(el => el.classList.add('in-check'));
    }catch(_){}
  }

  // overlay result
  function showResult(text) {
    if (!resultPopup || !resultText) return;
    resultText.textContent = text;
    resultPopup.classList.add('show');
  }
  function hideResult() {
    if (!resultPopup) return;
    resultPopup.classList.remove('show');
  }

  // utils
  function toIdx(a) { return (8 - parseInt(a[1],10)) * 8 + 'abcdefgh'.indexOf(a[0]); }

  // -----------------------------------------------------------------------
  // Boot
  injectCapturedContainers();
  injectBoardLabels();
  if (startMenu) startMenu.classList.add('show');
  // render awal
  sync();
});
