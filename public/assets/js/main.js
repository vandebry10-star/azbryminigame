// assets/js/main.js — Robust click + engine-compat
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

  const FILES = ['a','b','c','d','e','f','g','h'];
  const PIECE = { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟', K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙' };
  const EMPTY_FEN = /^8\/8\/8\/8\/8\/8\/8\/8/;

  // --- Engine
  let engine = (typeof window.Chess === 'function') ? new window.Chess() : null;
  if (engine && (!engine.fen || !engine.fen() || EMPTY_FEN.test(engine.fen()))) {
    engine.reset?.();
  }

  let mode   = 'human';
  let sel    = null;
  let last   = null;
  let flipped = false;

  // === Utilities ===
  function buildGrid(){
    boardEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let r = 8; r >= 1; r--) {
      for (let f = 0; f < 8; f++) {
        const sq = FILES[f] + r;
        const d = document.createElement('div');
        d.className = `square ${((r+f)%2===0)?'light':'dark'}`;
        d.dataset.square = sq;
        frag.appendChild(d);
      }
    }
    boardEl.appendChild(frag);
    buildLabels();
  }

  function buildLabels(){
    const layer = document.createElement('div');
    layer.className = 'labels'; // pastikan di CSS: pointer-events:none
    for (let r=8; r>=1; r--){
      const lab = document.createElement('span');
      lab.className = 'rank';
      lab.textContent = r;
      lab.style.top = `${(8 - r) * 12.5}%`;
      layer.appendChild(lab);
    }
    for (let i=0; i<8; i++){
      const lab = document.createElement('span');
      lab.className = 'file';
      lab.textContent = FILES[i];
      lab.style.left = `${i * 12.5}%`;
      layer.appendChild(lab);
    }
    boardEl.appendChild(layer);
  }

  function findCell(sq){
    return boardEl.querySelector(`[data-square="${sq}"]`);
  }

  function renderFromFEN(fen){
    boardEl.querySelectorAll('.piece').forEach(n => n.remove());
    boardEl.querySelectorAll('.sel,.src,.dst,.check').forEach(n => n.classList.remove('sel','src','dst','check'));

    const part = fen.split(' ')[0];
    const rows = part.split('/');
    for (let r=0; r<8; r++){
      let file = 0;
      for (const ch of rows[r]){
        if (/\d/.test(ch)) { file += parseInt(ch,10); continue; }
        const sq = FILES[file] + (8 - r);
        const cell = findCell(sq);
        if (cell){
          const span = document.createElement('div');
          span.className = `piece ${ch===ch.toUpperCase()?'white':'black'}`;
          span.textContent = PIECE[ch] || '?';
          cell.appendChild(span);
        }
        file++;
      }
    }
  }

  function hasColorPiece(sq, color){
    const p = engine?.get ? engine.get(sq) : null;
    return p && p.color === color;
  }
  function needsPromotion(from, to){
    const p = engine?.get ? engine.get(from) : null;
    if (!p || p.type!=='p') return false;
    const rank = parseInt(to[1],10);
    return (p.color==='w' && rank===8) || (p.color==='b' && rank===1);
  }

  // === INTI FIX: ambil legal moves yang kompatibel ke berbagai engine ===
  function legalMovesFrom(square) {
    if (!engine?.moves) return [];
    let list = [];
    // 1) coba API modern
    try { list = engine.moves({ square, verbose:true }) || []; } catch(_) { list = []; }
    // 2) kalau kosong, ambil semua lalu filter
    if (!list.length) {
      let all;
      try { all = engine.moves({ verbose:true }) || []; } catch(_) {
        // 3) engine lama: mungkin return simple array SAN atau {from,to} tanpa verbose
        try { all = engine.moves() || []; } catch(_) { all = []; }
      }
      // normalisasi ke bentuk {from,to}
      list = all
        .map(m => {
          if (!m) return null;
          if (typeof m === 'string') return null; // SAN tanpa info from/to -> skip
          if (m.from && m.to) return m;
          return null;
        })
        .filter(Boolean)
        .filter(m => m.from === square);
    }
    // kembalikan hanya daftar tujuan
    return list.map(m => m.to);
  }

  function findKingSq(color){
    if (!engine?.fen) return null;
    const fen = engine.fen().split(' ')[0];
    const rows = fen.split('/');
    for (let r=0;r<8;r++){
      let f=0;
      for (const ch of rows[r]){
        if (/\d/.test(ch)){ f += parseInt(ch,10); continue; }
        const sq = FILES[f] + (8-r);
        if (color==='w' && ch==='K') return sq;
        if (color==='b' && ch==='k') return sq;
        f++;
      }
    }
    return null;
  }

  function renderEngine(){
    if (engine && EMPTY_FEN.test(engine.fen())) engine.reset?.();
    renderFromFEN(engine.fen());
    if (last){
      findCell(last.from)?.classList.add('src');
      findCell(last.to)?.classList.add('dst');
    }
    if (engine.in_check && engine.in_check()){
      const king = findKingSq(engine.turn());
      if (king) findCell(king)?.classList.add('check');
    }
    if (moveLog && engine.history){
      const h = engine.history({ verbose:true }) || [];
      if (!h.length){ moveLog.textContent = '—'; return; }
      let out = '', n=1;
      for (let i=0; i<h.length; i+=2){
        const w=h[i], b=h[i+1];
        out += `${n}. ${(w&&w.san)||''} ${(b&&b.san)||''}\n`; n++;
      }
      moveLog.textContent = out.trim();
    }
  }

  function aiMove(){
    if (!engine) return;
    if (engine.game_over && engine.game_over()) return;
    let legal = [];
    try { legal = engine.moves({ verbose:true }) || []; } catch(_) { legal = engine.moves() || []; }
    if (!legal.length) return;
    const mv = legal[Math.floor(Math.random()*legal.length)];
    engine.move(mv);
    last = { from: mv.from, to: mv.to };
    sync();
  }

  function checkEnd(){
    if (!engine) return;
    if (engine.in_checkmate && engine.in_checkmate()){
      alert(mode==='ai' ? 'Azbry-MD menang! 😏' : 'Checkmate');
    } else if (engine.in_stalemate && engine.in_stalemate()){
      alert('Seri (Stalemate)');
    } else if (engine.in_draw && engine.in_draw()){
      alert('Seri');
    }
  }

  function sync(){
    if (engine) renderEngine();
  }

  // === Delegated click (tetap tembus meski ada label layer)
  boardEl.addEventListener('click', (e) => {
    const sqEl = e.target.closest('.square');
    if (!sqEl || !boardEl.contains(sqEl)) return;
    const sq = sqEl.dataset.square;

    if (!engine){
      boardEl.querySelectorAll('.sel').forEach(n=>n.classList.remove('sel'));
      sqEl.classList.add('sel'); sel = sq; return;
    }

    if (mode==='ai' && engine.turn && engine.turn()==='b') return;

    if (sel){
      const legalTo = legalMovesFrom(sel);
      if (legalTo.includes(sq)){
        const promo = needsPromotion(sel, sq) ? 'q' : undefined;
        const mv = engine.move({ from: sel, to: sq, promotion: promo });
        if (mv){
          last = { from: sel, to: sq };
          sel = null;
          sync();
          if (mode==='ai') setTimeout(aiMove, 250);
          checkEnd();
          return;
        }
      }
    }

    sel = hasColorPiece(sq, engine.turn ? engine.turn() : 'w') ? sq : null;
    boardEl.querySelectorAll('.sel').forEach(n=>n.classList.remove('sel'));
    if (sel) findCell(sel)?.classList.add('sel');
  });

  // Controls
  btnHuman && (btnHuman.onclick = ()=>{ mode='human'; sel=null; last=null;
    btnHuman.classList.add('active'); btnAI?.classList.remove('active'); sync(); });

  btnAI && (btnAI.onclick = ()=>{ mode='ai'; sel=null; last=null;
    btnAI.classList.add('active'); btnHuman?.classList.remove('active'); sync();
    if (engine && engine.turn && engine.turn()==='b') setTimeout(aiMove, 250); });

  btnReset && (btnReset.onclick = ()=>{ engine?.reset?.(); sel=null; last=null; sync(); });
  btnUndo  && (btnUndo.onclick  = ()=>{ if (engine?.undo){ engine.undo(); sel=null; last=null; sync(); } });
  btnRedo  && (btnRedo.onclick  = ()=>{ if (engine?.redo){ engine.redo(); sync(); } });
  btnFlip  && (btnFlip.onclick  = ()=>{ flipped=!flipped; boardEl.classList.toggle('flipped', flipped); });

  if (btnOnly && btnBack){
    btnOnly.onclick = ()=>{ document.body.classList.add('board-only'); btnOnly.style.display='none'; btnBack.style.display='inline-block'; };
    btnBack.onclick = ()=>{ document.body.classList.remove('board-only'); btnBack.style.display='none'; btnOnly.style.display='inline-block'; };
  }

  // init
  buildGrid();
  sync();
});
