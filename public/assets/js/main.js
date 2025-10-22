// Main controller v3 — tanpa dependensi helper eksternal.
// Mode: vs Human / vs Azbry-MD (random AI), Undo/Redo, Flip, Board Only.

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // elemen
  const boardEl  = $('board');
  const moveLog  = $('moveHistory');
  const btnHuman = $('modeHuman');
  const btnAI    = $('modeAI');
  const btnReset = $('btnReset');
  const btnUndo  = $('btnUndo');
  const btnRedo  = $('btnRedo');
  const btnFlip  = $('btnFlip');
  const btnOnly  = $('btnBoardOnly');
  const btnBack  = $('btnBack');

  // init UI
  const ui = new window.ChessUI(boardEl, onSquareClick);

  // coba engine (CDN chess.js)
  let engine = (typeof window.Chess === 'function') ? new window.Chess() : null;

  // state
  let mode = 'human';
  let selected = null;
  let lastMove = null;

  // render awal (fallback jika engine null)
  sync();

  // tombol2
  btnHuman && (btnHuman.onclick = () => { mode='human'; toggleActive(btnHuman, btnAI); selected=null; lastMove=null; sync(); });
  btnAI    && (btnAI.onclick    = () => { mode='ai';    toggleActive(btnAI, btnHuman); selected=null; lastMove=null; sync(); if (engine && engine.turn()==='b') setTimeout(aiMove, 250); });
  btnReset && (btnReset.onclick = () => { if (engine) engine.reset(); selected=null; lastMove=null; sync(); });
  btnUndo  && (btnUndo.onclick  = () => { if (engine && engine.undo){ engine.undo(); selected=null; lastMove=null; sync(); }});
  btnRedo  && (btnRedo.onclick  = () => { if (engine && engine.redo){ engine.redo(); sync(); }});
  btnFlip  && (btnFlip.onclick  = () => { ui.toggleFlip(); sync(); });

  if (btnOnly && btnBack) {
    btnOnly.onclick = () => { document.body.classList.add('board-only'); btnOnly.style.display='none'; btnBack.style.display='inline-block'; };
    btnBack.onclick = () => { document.body.classList.remove('board-only'); btnBack.style.display='none'; btnOnly.style.display='inline-block'; };
  }

  function toggleActive(on, off){
    on && on.classList.add('active');
    off && off.classList.remove('active');
  }

  function onSquareClick(sq) {
    if (!engine) return; // fallback: hanya view

    // kalau AI: user = putih
    if (mode === 'ai' && engine.turn() === 'b') return;

    const legals = selected ? engine.moves({ square: selected, verbose: true }) : [];
    const legalTo = new Set(legals.map(m => m.to));

    // klik tujuan dari selected
    if (selected && legalTo.has(sq)) {
      const promo = needsPromotion(selected, sq) ? 'q' : undefined;
      const mv = engine.move({ from: selected, to: sq, promotion: promo });
      if (mv) {
        lastMove = { from: mv.from, to: mv.to };
        selected = null;
        sync();
        setTimeout(() => {
          if (mode === 'ai' && engine && !engine.game_over()) aiMove();
        }, 200);
      }
      return;
    }

    // pilih kotak baru
    const myPiece = engine.get(sq);
    if (myPiece && myPiece.color === engine.turn()) {
      selected = sq;
    } else {
      selected = null;
    }
    sync();
  }

  function needsPromotion(from, to){
    const p = engine.get(from);
    if (!p || p.type !== 'p') return false;
    const rank = parseInt(to[1],10);
    return (p.color === 'w' && rank === 8) || (p.color === 'b' && rank === 1);
  }

  function aiMove() {
    if (!engine) return;
    const legal = engine.moves({ verbose: true });
    if (!legal.length) { sync(); return; }
    const mv = legal[Math.floor(Math.random() * legal.length)];
    engine.move(mv);
    lastMove = { from: mv.from, to: mv.to };
    sync();
  }

  function sync() {
    // fallback kalau engine gak ada
    if (!engine) {
      ui.renderFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');
      moveLog && (moveLog.textContent = '—');
      return;
    }

    const fen = engine.fen();
    const turn = engine.turn();
    const legals = selected ? engine.moves({ square: selected, verbose: true }).map(m => m.to) : [];
    const inCheck = (engine.in_check && engine.in_check()) ? turn : null;

    ui.renderFEN(fen, {
      selected,
      legal: legals,
      lastMove,
      inCheck
    });

    // log langkah
    if (moveLog) {
      const h = engine.history({ verbose: true });
      if (!h.length) {
        moveLog.textContent = '—';
      } else {
        let out = '';
        for (let i = 0, n = 1; i < h.length; i += 2, n++) {
          const w = h[i], b = h[i + 1];
          out += `${n}. ${fmt(w)} ${fmt(b)}\n`;
        }
        moveLog.textContent = out.trim();
      }
    }
  }

  function fmt(m){ return m ? `${m.from} → ${m.to}` : ''; }
});
