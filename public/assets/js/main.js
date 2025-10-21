// assets/js/main.js
// Controller: konek engine -> UI, klik, mode, undo/redo, AI sederhana.

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  const boardEl   = $('board');
  const moveLog   = $('moveHistory');
  const btnHuman  = $('modeHuman');
  const btnAI     = $('modeAI');
  const btnReset  = $('btnReset');
  const btnUndo   = $('btnUndo');
  const btnRedo   = $('btnRedo');
  const btnFlip   = $('btnFlip');
  const btnOnly   = $('btnBoardOnly');
  const btnBack   = $('btnBack');

  // pastikan engine ada
  if (typeof window.Chess !== 'function') {
    console.error('Chess engine tidak ter-load. Pastikan <script chess.min.js> ada sebelum main.js');
    return;
  }

  // state
  const engine = new window.Chess();
  const ui = new window.ChessUI(boardEl, onSquareClick);
  let mode = 'human';     // 'human' | 'ai'
  let sel = null;
  let last = null;

  // helper
  function legalTargets(from) {
    return engine.moves({ square: from, verbose: true }).map(m => m.to);
  }
  function needsPromotion(from, to) {
    const p = engine.get(from);
    if (!p || p.type !== 'p') return false;
    const r = parseInt(to[1], 10);
    return (p.color === 'w' && r === 8) || (p.color === 'b' && r === 1);
  }
  function kingSquare(color) {
    const fen = engine.fen().split(' ')[0].split('/');
    const files = ['a','b','c','d','e','f','g','h'];
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of fen[r]) {
        if (/\d/.test(ch)) { f += parseInt(ch, 10); continue; }
        const sq = files[f] + (8 - r);
        if (color === 'w' && ch === 'K') return sq;
        if (color === 'b' && ch === 'k') return sq;
        f++;
      }
    }
    return null;
  }

  // render
  function sync() {
    const opts = {};
    if (sel) opts.sel = sel;
    if (sel) opts.legal = legalTargets(sel);
    if (last) opts.last = last;
    if (engine.in_check && engine.in_check()) {
      const ksq = kingSquare(engine.turn());
      if (ksq) opts.checkSquare = ksq;
    }
    ui.renderFEN(engine.fen(), opts);

    // log
    if (moveLog) {
      const h = engine.history({ verbose: true });
      if (!h.length) { moveLog.textContent = '—'; return; }
      let out = '';
      for (let i = 0, n = 1; i < h.length; i += 2, n++) {
        const w = h[i], b = h[i + 1];
        out += `${n}. ${(w && w.from) || ''} → ${(w && w.to) || ''}${b ? `\n${n}… ${(b.from)} → ${(b.to)}` : ''}\n`;
      }
      moveLog.textContent = out.trim();
    }
  }

  // click handler
  function onSquareClick(sq) {
    // kalau mode AI, user main putih; tunggu giliran putih
    if (mode === 'ai' && engine.turn() === 'b') return;

    // pilih bidak sendiri
    if (!sel) {
      const p = engine.get(sq);
      if (!p || p.color !== engine.turn()) return;
      sel = sq;
      return sync();
    }

    // kalau klik kotak legal -> geser
    const legals = legalTargets(sel);
    if (legals.includes(sq)) {
      const promotion = needsPromotion(sel, sq) ? 'q' : undefined;
      const mv = engine.move({ from: sel, to: sq, promotion });
      if (mv) {
        last = { from: sel, to: sq };
        sel = null;
        sync();
        checkOver();
        if (mode === 'ai' && !engine.game_over()) {
          setTimeout(aiMove, 250);
        }
      }
      return;
    }

    // klik ulang bidak sendiri -> ganti seleksi
    const p2 = engine.get(sq);
    if (p2 && p2.color === engine.turn()) {
      sel = sq;
    } else {
      sel = null;
    }
    sync();
  }

  // AI sangat sederhana (random legal)
  function aiMove() {
    const legal = engine.moves({ verbose: true });
    if (!legal.length) return checkOver();
    const mv = legal[Math.floor(Math.random() * legal.length)];
    engine.move(mv);
    last = { from: mv.from, to: mv.to };
    sync();
    checkOver();
  }

  function checkOver() {
    if (engine.in_checkmate && engine.in_checkmate()) {
      alert(mode === 'ai' ? 'Azbry-MD menang 😏' : 'Checkmate!');
    } else if (engine.in_stalemate && engine.in_stalemate()) {
      alert('Stalemate.');
    } else if (engine.in_draw && engine.in_draw()) {
      alert('Seri.');
    }
  }

  // controls
  btnHuman && (btnHuman.onclick = () => { mode = 'human'; sel = last = null; btnHuman.classList.add('active'); btnAI?.classList.remove('active'); sync(); });
  btnAI    && (btnAI.onclick    = () => { mode = 'ai';    sel = last = null; btnAI.classList.add('active');    btnHuman?.classList.remove('active'); sync(); if (engine.turn()==='b') setTimeout(aiMove,250); });
  btnReset && (btnReset.onclick = () => { engine.reset(); sel = last = null; sync(); });
  btnUndo  && (btnUndo.onclick  = () => { engine.undo();  sel = last = null; sync(); });
  btnRedo  && (btnRedo.onclick  = () => { if (engine.redo) engine.redo(); sync(); });
  btnFlip  && (btnFlip.onclick  = () => { ui.toggleFlip(); });

  if (btnOnly && btnBack) {
    btnOnly.onclick = () => { document.body.classList.add('board-only'); btnOnly.style.display='none'; btnBack.style.display='inline-block'; };
    btnBack.onclick = () => { document.body.classList.remove('board-only'); btnBack.style.display='none'; btnOnly.style.display='inline-block'; };
  }

  // init
  sync();
});
