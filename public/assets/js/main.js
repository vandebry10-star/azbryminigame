// Controller + Renderer (delegated click). Pastikan engine sudah diload.
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

  function buildGrid(){
    if (!boardEl) return;
    boardEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let r=8;r>=1;r--){
      for (let f=0; f<8; f++){
        const sq = FILES[f]+r;
        const d = document.createElement('div');
        d.className = `square ${((r+f)%2===0)?'light':'dark'}`;
        d.dataset.square = sq;
        frag.appendChild(d);
      }
    }
    boardEl.appendChild(frag);

    // Labels (pointer-events: none di CSS)
    const layer = document.createElement('div');
    layer.className = 'labels';
    for (let r=8; r>=1; r--){
      const s = document.createElement('span');
      s.className = 'rank'; s.textContent = r;
      s.style.top = `${(8-r)*12.5}%`; layer.appendChild(s);
    }
    for (let i=0;i<8;i++){
      const s = document.createElement('span');
      s.className = 'file'; s.textContent = FILES[i];
      s.style.left = `${i*12.5}%`; layer.appendChild(s);
    }
    boardEl.appendChild(layer);
  }
  // Expose untuk fallback HTML
  window.buildGrid = buildGrid;

  function findCell(sq){ return boardEl.querySelector(`[data-square="${sq}"]`); }

  function renderFromFEN(fen){
    boardEl.querySelectorAll('.piece').forEach(n=>n.remove());
    boardEl.querySelectorAll('.sel,.src,.dst,.check').forEach(n=>n.classList.remove('sel','src','dst','check'));
    const part = fen.split(' ')[0], rows = part.split('/');
    for (let r=0;r<8;r++){
      let file=0;
      for (const ch of rows[r]){
        if (/\d/.test(ch)){ file += +ch; continue; }
        const sq = FILES[file] + (8-r);
        const cell = findCell(sq);
        if (cell){
          const p = document.createElement('div');
          p.className = `piece ${ch===ch.toUpperCase()?'white':'black'}`;
          p.textContent = PIECE[ch] || '?';
          cell.appendChild(p);
        }
        file++;
      }
    }
  }

  function renderEngine(){
    renderFromFEN(engine.fen());
    if (last){ findCell(last.from)?.classList.add('src'); findCell(last.to)?.classList.add('dst'); }
    if (moveLog){
      const h = engine.history({ verbose:true });
      if (!h.length){ moveLog.textContent='—'; return; }
      let out='', n=1;
      for (let i=0; i<h.length; i+=2){
        const w=h[i], b=h[i+1];
        out += `${n}. ${(w&&w.san)||''} ${(b&&b.san)||''}\n`; n++;
      }
      moveLog.textContent = out.trim();
    }
  }

  function sync(){ if (engine) renderEngine(); }

  function needsPromotion(from,to){
    if (!engine) return false;
    const p = engine.get(from); if (!p || p.type!=='p') return false;
    const rank = parseInt(to[1],10);
    return (p.color==='w' && rank===8) || (p.color==='b' && rank===1);
  }
  function hasMine(sq){ const p=engine.get(sq); return p && p.color===engine.turn(); }

  // Delegated click (tembus layer)
  boardEl.addEventListener('click', (e)=>{
    const cell = e.target.closest('.square');
    if (!cell || !boardEl.contains(cell)) return;
    const sq = cell.dataset.square;

    if (!engine){ // fallback highlight saja
      boardEl.querySelectorAll('.sel').forEach(n=>n.classList.remove('sel'));
      cell.classList.add('sel'); sel=sq; return;
    }

    if (mode==='ai' && engine.turn()==='b') return;

    if (sel){
      const legal = engine.moves({ square: sel, verbose:true }).map(m=>m.to);
      if (legal.includes(sq)){
        const mv = engine.move({ from: sel, to: sq, promotion: needsPromotion(sel,sq)?'q':undefined });
        if (mv){ last={from:sel,to:sq}; sel=null; sync(); if (mode==='ai') setTimeout(()=>{ const L=engine.moves({verbose:true}); if(L.length){ const r=L[Math.floor(Math.random()*L.length)]; engine.move(r); last={from:r.from,to:r.to}; sync(); } }, 220); }
        return;
      }
    }
    sel = hasMine(sq) ? sq : null;
    boardEl.querySelectorAll('.sel').forEach(n=>n.classList.remove('sel'));
    if (sel) findCell(sel)?.classList.add('sel');
  });

  // Controls
  btnHuman && (btnHuman.onclick = ()=>{ mode='human'; sel=null; last=null; btnHuman.classList.add('active'); btnAI?.classList.remove('active'); sync(); });
  btnAI    && (btnAI.onclick    = ()=>{ mode='ai';    sel=null; last=null; btnAI.classList.add('active');    btnHuman?.classList.remove('active'); sync(); });
  btnReset && (btnReset.onclick = ()=>{ engine?.reset?.(); sel=null; last=null; sync(); });
  btnUndo  && (btnUndo.onclick  = ()=>{ engine?.undo?.();  sel=null; last=null; sync(); });
  btnRedo  && (btnRedo.onclick  = ()=>{}); // engine slim belum ada redo
  btnFlip  && (btnFlip.onclick  = ()=>{ flipped=!flipped; boardEl.classList.toggle('flipped', flipped); });

  if (btnOnly && btnBack){
    btnOnly.onclick = ()=>{ document.body.classList.add('board-only'); btnOnly.style.display='none'; btnBack.style.display='inline-block'; };
    btnBack.onclick = ()=>{ document.body.classList.remove('board-only'); btnBack.style.display='none'; btnOnly.style.display='inline-block'; };
  }

  // init
  buildGrid();
  sync();
});
