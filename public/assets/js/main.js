// Azbry Chess - main.js (FIX: pieces always render + clickable when engine exists)

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // Elemen UI
  const boardEl = $('board');
  const moveLog = $('moveHistory');
  const btnHuman = $('modeHuman');
  const btnAI    = $('modeAI');
  const btnReset = $('btnReset');
  const btnUndo  = $('btnUndo');
  const btnRedo  = $('btnRedo');
  const btnFlip  = $('btnFlip');
  const btnOnly  = $('btnBoardOnly');
  const btnBack  = $('btnBack');

  // Konstanta
  const FILES = ['a','b','c','d','e','f','g','h'];
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1';
  const GLYPH = { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟', K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙' };

  // State
  let engine = (typeof window.Chess === 'function') ? new window.Chess() : null;
  let mode = 'human';
  let last = null;
  let flipped = false;
  let sel = null;

  // Build grid 8x8
  function buildGrid(){
    boardEl.innerHTML = '';
    for (let r = 8; r >= 1; r--) {
      for (let f = 0; f < 8; f++) {
        const sq = FILES[f] + r;
        const d = document.createElement('div');
        d.className = `square ${((r+f)%2===0)?'light':'dark'}`;
        d.dataset.square = sq;
        d.dataset.file = FILES[f];
        d.dataset.rank = r;
        d.addEventListener('click', () => onSquare(sq));
        boardEl.appendChild(d);
      }
    }
  }

  // Cari cell
  const cell = sq => boardEl.querySelector(`[data-square="${sq}"]`);

  // Render dari FEN (selalu jalan)
  function renderFEN(fen){
    // bersih
    boardEl.querySelectorAll('.piece').forEach(n => n.remove());
    boardEl.querySelectorAll('.sel,.src,.dst,.check').forEach(n => n.classList.remove('sel','src','dst','check'));

    const rows = fen.split(' ')[0].split('/'); // bagian papan
    for (let r=0; r<8; r++){
      let file=0;
      for (const ch of rows[r]){
        if (/\d/.test(ch)) { file += +ch; continue; }
        const sq = FILES[file] + (8-r);
        const c = cell(sq);
        if (c){
          const p = document.createElement('div');
          p.className = `piece ${ch===ch.toUpperCase() ? 'white':'black'}`;
          // Inline style untuk memastikan ukuran/warna tembus walau CSS lain override
          p.style.fontSize = 'calc(var(--cell, min(92vw,640px)/8) * 0.78)';
          p.style.zIndex = '2';
          p.style.pointerEvents = 'none';
          p.textContent = GLYPH[ch] || '?';
          c.appendChild(p);
        }
        file++;
      }
    }
  }

  // Render via engine (kalau ada)
  function renderEngine(){
    renderFEN(engine.fen());
    if (last){
      cell(last.from)?.classList.add('src');
      cell(last.to)?.classList.add('dst');
    }
    // tanda skak
    if (engine.in_check && engine.in_check()){
      const ksq = findKing(engine.turn());
      if (ksq) cell(ksq)?.classList.add('check');
    }
    // move log sederhana
    if (moveLog){
      const h = engine.history({ verbose:true });
      if (!h.length){ moveLog.textContent = '—'; return; }
      let out='', n=1;
      for (let i=0;i<h.length;i+=2){
        const w=h[i], b=h[i+1];
        out += `${n}. ${(w&&w.san)||''} ${(b&&b.san)||''}\n`;
        n++;
      }
      moveLog.textContent = out.trim();
    }
  }

  function findKing(color){
    const part = engine.fen().split(' ')[0].split('/');
    for (let r=0; r<8; r++){
      let f=0;
      for (const ch of part[r]){
        if (/\d/.test(ch)){ f += +ch; continue; }
        const sq = FILES[f] + (8-r);
        if (color==='w' && ch==='K') return sq;
        if (color==='b' && ch==='k') return sq;
        f++;
      }
    }
    return null;
  }

  // Klik kotak
  function onSquare(sq){
    // fallback tanpa engine: cuma highlight
    if (!engine){
      boardEl.querySelectorAll('.sel').forEach(n=>n.classList.remove('sel'));
      if (sel === sq){ sel=null; return; }
      cell(sq)?.classList.add('sel'); sel = sq; return;
    }

    if (mode==='ai' && engine.turn()==='b') return;

    // kalau sudah pilih, cek legal
    if (sel){
      const legals = engine.moves({ square: sel, verbose:true }).map(m=>m.to);
      if (legals.includes(sq)){
        const promo = needPromo(sel, sq) ? 'q' : undefined;
        const note = engine.move({ from: sel, to: sq, promotion: promo });
        if (note){
          last = { from: sel, to: sq };
          sel = null;
          sync();
          if (mode==='ai') setTimeout(aiMove, 250);
        }
        return;
      }
    }

    // pilih baru kalau ada bidak warna yang jalan
    const p = engine.get(sq);
    if (p && p.color === engine.turn()){
      sel = sq;
      boardEl.querySelectorAll('.sel').forEach(n=>n.classList.remove('sel'));
      cell(sq)?.classList.add('sel');
    } else {
      sel = null;
      boardEl.querySelectorAll('.sel').forEach(n=>n.classList.remove('sel'));
    }
  }

  function needPromo(from,to){
    const p = engine.get(from);
    if (!p || p.type!=='p') return false;
    const rank = +to[1];
    return (p.color==='w' && rank===8) || (p.color==='b' && rank===1);
  }

  // AI super-simple
  function aiMove(){
    if (!engine || engine.game_over && engine.game_over()) return;
    const legal = engine.moves({ verbose:true });
    if (!legal.length) return;
    const mv = legal[Math.floor(Math.random()*legal.length)];
    engine.move(mv);
    last = { from: mv.from, to: mv.to };
    sync();
  }

  function sync(){
    if (flipped) boardEl.classList.add('flipped'); else boardEl.classList.remove('flipped');
    if (engine) renderEngine();
    else renderFEN(START_FEN);
  }

  // Kontrol UI
  btnHuman && (btnHuman.onclick = ()=>{ mode='human'; sel=null; last=null; btnHuman.classList?.add('active'); btnAI?.classList?.remove('active'); sync(); });
  btnAI    && (btnAI.onclick    = ()=>{ mode='ai'; sel=null; last=null; btnAI.classList?.add('active'); btnHuman?.classList?.remove('active'); sync(); if (engine && engine.turn()==='b') setTimeout(aiMove,250); });
  btnReset && (btnReset.onclick = ()=>{ if(engine){ engine.reset(); } sel=null; last=null; sync(); });
  btnUndo  && (btnUndo.onclick  = ()=>{ if(engine && engine.undo){ engine.undo(); sel=null; last=null; sync(); } });
  btnRedo  && (btnRedo.onclick  = ()=>{ if(engine && engine.redo){ engine.redo(); sync(); } });
  btnFlip  && (btnFlip.onclick  = ()=>{ flipped=!flipped; sync(); });
  if (btnOnly && btnBack){
    btnOnly.onclick = ()=>{ document.body.classList.add('board-only'); btnOnly.style.display='none'; btnBack.style.display='inline-block'; };
    btnBack.onclick = ()=>{ document.body.classList.remove('board-only'); btnBack.style.display='none'; btnOnly.style.display='inline-block'; };
  }

  // Init
  buildGrid();
  // kalau engine ada tapi entah kenapa kosong, paksa ke start
  if (engine && typeof engine.fen==='function' && engine.fen().startsWith('8/8/8')) engine.reset();
  sync();
});
