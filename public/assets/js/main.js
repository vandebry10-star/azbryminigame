// assets/js/main.js — Controller + Renderer (Azbry Chess Final)
// Support: check highlight (raja merah) + popup menang

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // Root UI
  let boardEl = $('board');
  const moveLog = $('moveHistory');
  const startMenu = $('startMenu');
  const btnStartHuman = $('btnStartHuman');
  const btnStartAI = $('btnStartAI');
  const resultPopup = $('resultPopup');
  const resultText = $('resultText');
  const btnRestart = $('btnRestart');

  // Game state
  const game = new Chess();
  const ui = new ChessUI(boardEl, onSquare);
  let mode = 'human';
  let selected = null;
  let lastMove = null;

  // Start menu
  if (btnStartHuman) btnStartHuman.addEventListener('click', () => startGame('human'));
  if (btnStartAI) btnStartAI.addEventListener('click', () => startGame('ai'));
  if (btnRestart) btnRestart.addEventListener('click', () => {
    hideResult();
    if (startMenu) startMenu.classList.add('show');
    hardReset();
  });

  function startGame(m) {
    mode = m;
    selected = null;
    lastMove = null;
    if (startMenu) startMenu.classList.remove('show');
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
    if (mode === 'ai' && game.turn() === 'b') return;

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

  function needsPromotion(fromAlg, toAlg) {
    const toR = 8 - parseInt(toAlg[1], 10);
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
    const status = game.gameStatus(); // 'ok' | 'check' | 'checkmate' | 'stalemate'
    const turn = game.turn();          // 'w' | 'b'

    // render
    ui.render(game.board(), {
      lastMove,
      legal: legalTargets,
      inCheck: (status === 'check') ? turn : undefined
    });

    // tambahin class .in-check ke kotak raja yang lagi di-check
    mirrorCheckClass();

    injectBoardLabels();
    injectCapturedContainers?.();
    renderCapturedFromBoard?.(game.board());

    if (moveLog) {
      const h = game.history();
      moveLog.textContent = h.length ? h.map((x,i)=>`${i+1}. ${x}`).join('\n') : '_';
    }

    // kondisi hasil
    if (status === 'checkmate') {
      const winner = (turn === 'w') ? 'Hitam' : 'Putih';
      showResult(`${winner} Menang!`);
    } else if (status === 'stalemate') {
      showResult('Seri 🤝');
    }
  }

  // Tambah koordinat kalau belum ada
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
      }
      boardEl.appendChild(ranks);
    }
  }

  // Convert class .check → .in-check
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
  if (startMenu) startMenu.classList.add('show');
  sync();
});
