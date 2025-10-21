// main.js (FINAL)
document.addEventListener('DOMContentLoaded', () => {
  const boardEl = document.getElementById('board');
  const modeHuman = document.getElementById('modeHuman');
  const modeAI    = document.getElementById('modeAI');
  const btnReset  = document.getElementById('btnReset');
  const btnUndo   = document.getElementById('btnUndo');
  const btnRedo   = document.getElementById('btnRedo');
  const btnFlip   = document.getElementById('btnFlip');
  const moveLog   = document.getElementById('moveHistory');

  const game = new Chess();
  const ui   = new ChessUI(boardEl, onSquare);

  let mode = 'human';
  let selected = null;

  modeHuman.addEventListener('click', () => setMode('human'));
  modeAI.addEventListener('click',    () => setMode('ai'));
  btnReset.addEventListener('click',  () => { game.reset(); selected = null; sync(); });
  btnUndo.addEventListener('click',   () => { game.undo();  selected = null; sync(); });
  btnRedo.addEventListener('click',   () => { game.redo();  selected = null; sync(); });
  btnFlip.addEventListener('click',   () => { ui.toggleFlip(); sync(); });

  function setMode(m) {
    mode = m;
    modeHuman.classList.toggle('active', m === 'human');
    modeAI.classList.toggle('active',   m === 'ai');
    selected = null;
    sync();
  }

  function onSquare(squareAlg) {
    // kalau mode AI: user = putih, AI = hitam
    if (mode === 'ai' && game.turn() === 'b') return;

    const idx = toIdx(squareAlg);
    const piece = game.board()[idx];

    // klik target legal dari selected ⇒ jalankan move
    const legalFromSel = selected ? game.moves({ square: selected }) : [];
    if (selected && legalFromSel.some(m => m.to === squareAlg)) {
      game.move({ from: selected, to: squareAlg, promotion: 'Q' });
      selected = null;
      sync();
      if (mode === 'ai') setTimeout(aiMove, 160);
      return;
    }

    // pilih bidak milik sendiri
    if (piece && piece.color === game.turn()) {
      selected = squareAlg;
    } else {
      selected = null;
    }
    sync();
  }

  function aiMove() {
    if (mode !== 'ai' || game.turn() !== 'b') return;
    const legal = game.moves();
    if (!legal.length) { sync(); return; }

    // Greedy capture > random
    const b = game.board();
    const val = { P:1, N:3, B:3, R:5, Q:9, K:100 };
    let best = null, bestScore = -1;
    for (const m of legal) {
      const cap = b[toIdx(m.to)];
      const s = cap ? val[cap.piece] : 0;
      if (s > bestScore) { best = m; bestScore = s; }
    }
    const pick = bestScore > 0 ? best : legal[Math.floor(Math.random()*legal.length)];
    game.move(pick);
    sync();
  }

  function toIdx(a) { return (8 - parseInt(a[1])) * 8 + 'abcdefgh'.indexOf(a[0]); }

  function sync() {
    const legalTargets = selected ? game.moves({ square: selected }).map(m => m.to) : [];
    ui.render(game.board(), { legal: legalTargets });

    const hist = game.history();
    moveLog.textContent = hist.length ? hist.map((x,i)=>`${i+1}. ${x}`).join('\n') : '_';

    const st = game.gameStatus();
    if (st === 'checkmate') { /* bisa munculin toast/kemenangan */ }
    if (st === 'stalemate') { /* seri */ }
  }

  sync();
});
