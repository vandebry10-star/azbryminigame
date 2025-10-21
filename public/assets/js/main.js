// QUICK-BOOT + CLICK FIX — stabil sebelum fitur lanjutan
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

  // safety net: klik/touch/pointer pasti nembak ke onSquareClick
  ['click','touchend','pointerup'].forEach(evt => {
    boardEl.addEventListener(evt, (e) => {
      const sqEl = e.target.closest?.('.square');
      if (!sqEl) return;
      e.preventDefault();
      const sq = sqEl.dataset.square;
      if (sq) onSquareClick(sq);
    }, { passive:false });
  });

  // --- CONST ---
  const FILES = ['a','b','c','d','e','f','g','h'];
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1';
  const PIECE = { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟', K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙' };
  let flipped = false;

  // build 64 petak
  function buildGrid(){
    boardEl.innerHTML = '';
    for (let r=8; r>=1; r--){
      for (let f=0; f<8; f++){
        const sq = FILES[f]+r;
        const d = document.createElement('div');
        d.className = `square ${((r+f)%2===0)?'light':'dark'}`;
        d.dataset.square = sq;
        // handler langsung per-square juga dipasang
        d.addEventListener('click', () => onSquareClick(sq), { passive:true });
        boardEl.appendChild(d);
      }
    }
  }

  // render dari FEN (tanpa engine pun tampil)
  function renderFromFEN(fen){
    boardEl.querySelectorAll('.piece').forEach(n => n.remove());
    boardEl.querySelectorAll('.highlight, .check, .sel, .move, .src, .dst').forEach(n=>{
      n.classList.remove('highlight','check','sel','move','src','dst');
    });

    const rows = fen.split(' ')[0].split('/');
    for (let r=0; r<8; r++){
      let file = 0;
      for (const ch of rows[r]){
        if (/\d/.test(ch)) { file += parseInt(ch,10); continue; }
        const sq = FILES[file] + (8-r);
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
  function findCell(sq){ return boardEl.querySelector(`[data-square="${sq}"]`); }

  // click handler
  let sel = null;
  function onSquareClick(sq){
    if (!engine) {
      // fallback: hanya select visual
      boardEl.querySelectorAll('.sel').forEach(n=>n.classList.remove('sel'));
      const el = findCell(sq);
      if (sel === sq) { sel = null; return; }
      if (el) { el.classList.add('sel'); sel = sq; }
      return;
    }
    // engine mode
    if (mode==='ai' && engine.turn()==='b') return;
    const legals = engine.moves({ square: sel||sq, verbose:true }).map(m=>m.to);
    if (sel && legals.includes(sq)){
      const promo = needsPromotion(sel, sq) ? 'q' : undefined;
      const note = engine.move({ from: sel, to: sq, promotion: promo });
      if (note){
        last = {from: sel, to: sq};
        sel = null;
        sync();
        if (mode==='ai') setTimeout(aiMove, 300);
      }
      return;
    }
    const hasMine = hasColorPiece(sq, engine.turn());
    sel = hasMine ? sq : null;
    sync();
  }

  // engine
  let engine = (typeof window.Chess === 'function') ? new window.Chess() : null;
  let mode = 'human';
  let last = null;

  function needsPromotion(from, to){
    if (!engine?.get) return false;
    const p = engine.get(from);
    if (!p || p.type !== 'p') return false;
    const rank = parseInt(to[1],10);
    return (p.color==='w' && rank===8) || (p.color==='b' && rank===1);
  }
  function hasColorPiece(sq, color){
    const p = engine?.get ? engine.get(sq) : null;
    return p && p.color === color;
  }

  function renderEngine(){
    renderFromFEN(engine.fen());
    if (last){
      findCell(last.from)?.classList.add('src');
      findCell(last.to)?.classList.add('dst');
    }
    if (engine.in_check && engine.in_check()){
      const kingSq = findKingSq(engine.turn());
      if (kingSq) findCell(kingSq)?.classList.add('check');
    }
    if (moveLog){
      const h = engine.history({ verbose:true });
      if (!h.length){ moveLog.textContent = '—'; return; }
      let out='', n=1;
      for (let i=0;i<h.length;i+=2){
        const w=h[i], b=h[i+1];
        out += `${n}. ${(w&&w.san)||''} ${(b&&b.san)||''}\n`; n++;
      }
      moveLog.textContent = out.trim();
    }
  }
  function findKingSq(color){
    const fen = engine.fen().split(' ')[0];
    const rows = fen.split('/');
    for (let r=0;r<8;r++){
      let file=0;
      for (const ch of rows[r]){
        if (/\d/.test(ch)){ file += parseInt(ch,10); continue; }
        const sq = FILES[file] + (8-r);
        if (color==='w' && ch==='K') return sq;
        if (color==='b' && ch==='k') return sq;
        file++;
      }
    }
    return null;
  }

  function aiMove(){
    if (engine.game_over && engine.game_over()) return;
    const legal = engine.moves({ verbose:true });
    if (!legal.length) { checkEnd(); return; }
    const mv = legal[Math.floor(Math.random()*legal.length)];
    engine.move(mv);
    last = {from: mv.from, to: mv.to};
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
    if (typeof window.Chess === 'function' && !engine) engine = new window.Chess();
    if (engine) renderEngine();
    else renderFromFEN(START_FEN);
  }

  // controls
  btnHuman && (btnHuman.onclick = ()=>{ mode='human'; sel=null; last=null; btnHuman.classList.add('active'); btnAI?.classList.remove('active'); sync(); });
  btnAI    && (btnAI.onclick    = ()=>{ mode='ai';    sel=null; last=null; btnAI.classList.add('active');    btnHuman?.classList.remove('active'); sync(); if (engine && engine.turn()==='b') setTimeout(aiMove, 300); });
  btnReset && (btnReset.onclick = ()=>{ if(engine){ engine.reset(); } sel=null; last=null; sync(); });
  btnUndo  && (btnUndo.onclick  = ()=>{ if(engine?.undo){ engine.undo(); sel=null; last=null; sync(); } });
  btnRedo  && (btnRedo.onclick  = ()=>{ if(engine?.redo){ engine.redo(); sync(); } });
  btnFlip  && (btnFlip.onclick  = ()=>{ flipped=!flipped; boardEl.classList.toggle('flipped', flipped); });

  if (btnOnly && btnBack){
    btnOnly.onclick = ()=>{ document.body.classList.add('board-only'); btnOnly.style.display='none'; btnBack.style.display='inline-block'; };
    btnBack.onclick = ()=>{ document.body.classList.remove('board-only'); btnBack.style.display='none'; btnOnly.style.display='inline-block'; };
  }

  // init
  buildGrid();
  sync();
});
