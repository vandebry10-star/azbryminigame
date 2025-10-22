<!-- assets/js/main.js -->
<script>
// QUICK-BOOT compatible (engine verbose / non-verbose)

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

  let engine = (typeof window.Chess === 'function') ? new window.Chess() : null;
  let mode   = 'human';
  let sel    = null;
  let last   = null;
  let flipped = false;

  /* ---------- GRID & RENDER ---------- */
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
    layer.className = 'labels';
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

  function renderEngine(){
    if (!engine) return;
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
      try {
        const h = engine.history({ verbose:true });
        if (!h.length){ moveLog.textContent = '—'; return; }
        let out = '', n=1;
        for (let i=0; i<h.length; i+=2){
          const w=h[i], b=h[i+1];
          out += `${n}. ${(w&&w.san)||''} ${(b&&b.san)||''}\n`; n++;
        }
        moveLog.textContent = out.trim();
      } catch {
        // engine ringan (tanpa SAN)
        const h = engine.history ? engine.history() : [];
        moveLog.textContent = h.map((m,i)=>`${i+1}. ${m.from}→${m.to}`).join('\n') || '—';
      }
    }
  }

  function findKingSq(color){
    if (!engine) return null;
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

  /* ---------- COMPAT HELPERS (intinya perbaikan) ---------- */
  function movesFrom(square){
    // Prefer engine verbose
    try {
      const mv = engine.moves({ square, verbose:true });
      if (Array.isArray(mv) && mv.length) return mv.map(m=>m.to);
    } catch {}
    // Fallback: filter dari semua moves
    try {
      const all = engine.moves();
      if (Array.isArray(all)) return all.filter(m=>m.from===square).map(m=>m.to);
    } catch {}
    return [];
  }

  function doMove(from, to, promotion){
    // Prefer object form
    try {
      return engine.move({ from, to, promotion });
    } catch {}
    // Fallback string form ("e2e4")
    try {
      return engine.move(from + to);
    } catch {}
    return null;
  }

  function hasColorPiece(sq, color){
    try {
      const p = engine.get(sq);
      return p && p.color === color;
    } catch { return false; }
  }

  function needsPromotion(from, to){
    try {
      const p = engine.get(from);
      if (!p || p.type!=='p') return false;
      const rank = parseInt(to[1],10);
      return (p.color==='w' && rank===8) || (p.color==='b' && rank===1);
    } catch { return false; }
  }

  /* ---------- CLICK (delegated) ---------- */
  boardEl.addEventListener('click', (e) => {
    const sqEl = e.target.closest('.square');
    if (!sqEl || !boardEl.contains(sqEl) || !engine) return;
    const sq = sqEl.dataset.square;

    if (mode==='ai' && engine.turn()==='b') return;

    if (sel){
      const legalTargets = movesFrom(sel);
      if (legalTargets.includes(sq)){
        const promo = needsPromotion(sel, sq) ? 'q' : undefined;
        const mv = doMove(sel, sq, promo);
        if (mv){
          last = { from: sel, to: sq };
          sel = null;
          renderEngine();
          if (mode==='ai') setTimeout(aiMove, 250);
          return;
        }
      }
    }

    sel = hasColorPiece(sq, engine.turn()) ? sq : null;
    boardEl.querySelectorAll('.sel').forEach(n=>n.classList.remove('sel'));
    if (sel) findCell(sel)?.classList.add('sel');
  });

  /* ---------- AI super simple ---------- */
  function aiMove(){
    try {
      if (engine.game_over && engine.game_over()) return;
      let legal;
      try { legal = engine.moves({ verbose:true }); } catch { legal = engine.moves(); }
      if (!legal || !legal.length) return;
      const mv = legal[Math.floor(Math.random()*legal.length)];
      const from = mv.from || mv.slice(0,2);
      const to   = mv.to   || mv.slice(2,4);
      engine.move(mv.from ? mv : (from+to));
      last = { from, to };
      renderEngine();
    } catch {}
  }

  /* ---------- Controls ---------- */
  btnHuman && (btnHuman.onclick = ()=>{ mode='human'; sel=null; last=null;
    btnHuman.classList.add('active'); btnAI?.classList.remove('active'); renderEngine(); });

  btnAI && (btnAI.onclick = ()=>{ mode='ai'; sel=null; last=null;
    btnAI.classList.add('active'); btnHuman?.classList.remove('active'); renderEngine();
    if (engine && engine.turn()==='b') setTimeout(aiMove, 250); });

  btnReset && (btnReset.onclick = ()=>{ try{ engine.reset(); }catch{} sel=null; last=null; renderEngine(); });

  btnUndo && (btnUndo.onclick = ()=>{ try{ engine.undo(); }catch{} sel=null; last=null; renderEngine(); });

  btnRedo && (btnRedo.onclick = ()=>{ try{ engine.redo(); }catch{} renderEngine(); });

  btnFlip && (btnFlip.onclick = ()=>{ flipped=!flipped; boardEl.classList.toggle('flipped', flipped); });

  if (btnOnly && btnBack){
    btnOnly.onclick = ()=>{ document.body.classList.add('board-only'); btnOnly.style.display='none'; btnBack.style.display='inline-block'; };
    btnBack.onclick = ()=>{ document.body.classList.remove('board-only'); btnBack.style.display='none'; btnOnly.style.display='inline-block'; };
  }

  /* ---------- Init ---------- */
  buildGrid();
  if (engine) renderEngine();
});
</script>
