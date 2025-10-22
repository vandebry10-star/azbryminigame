// assets/js/main.js — Azbry Chess (match HTML v12)
// Render via FEN (pasti muncul), check merah, popup menang (pakai __azbrySetResult), kompatibel toolbar & menu HTML.

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // Elemen yang ADA di HTML lo
  let boardEl     = $('board');
  const modeHuman = $('modeHuman');   // hidden proxy
  const modeAI    = $('modeAI');      // hidden proxy
  const btnReset  = $('btnReset');
  const btnUndo   = $('btnUndo');
  const btnRedo   = $('btnRedo');
  const btnFlip   = $('btnFlip');
  const moveLog   = $('moveHistory');

  // Pastikan #board ada
  if (!boardEl) {
    boardEl = document.createElement('div');
    boardEl.id = 'board';
    boardEl.className = 'board';
    document.body.prepend(boardEl);
  }

  // Engine & UI
  const game = new Chess();
  const ui   = new ChessUI(boardEl, onSquare);

  // FEN start (fallback)
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // State
  let mode     = 'human';   // 'human' | 'ai'
  let selected = null;
  let lastMove = null;

  // --- Controls ----------------------------------------------------------------
  btnFlip?.addEventListener('click', () => { ui.toggleFlip(); sync(); });
  btnReset?.addEventListener('click', () => { game.reset?.(); selected=null; lastMove=null; sync(); });
  btnUndo ?.addEventListener('click', () => { game.undo?.();  selected=null; lastMove=null; sync(); });
  btnRedo ?.addEventListener('click', () => { game.redo?.();  selected=null; lastMove=null; sync(); });

  // Hidden proxy mode (dipanggil oleh HTML glue)
  modeHuman?.addEventListener('click', () => setMode('human'));
  modeAI   ?.addEventListener('click', () => setMode('ai'));

  function setMode(m){
    mode = m; selected = null; lastMove = null; sync();
    // broadcast (optional)
    try { window.dispatchEvent(new CustomEvent('azbry:modeChanged',{detail:{mode}})); } catch {}
    // expose API (optional, dipanggil dari glue HTML)
    window.AzbryChess = window.AzbryChess || {};
    window.AzbryChess.setMode = setMode;
  }

  // --- Interaksi papan ---------------------------------------------------------
  function onSquare(sq) {
    if (mode === 'ai' && (game.turn?.() === 'b')) return; // player = putih

    const moves = selected ? (game.moves?.({ square: selected }) || []) : [];

    if (selected && moves.some(m => m.to === sq)) {
      const promo = needsPromotion(selected, sq) ? 'Q' : null;
      const mv = game.move?.({ from: selected, to: sq, promotion: promo });
      if (mv) {
        lastMove = { from: selected, to: sq };
        selected = null;
        sync();
        if (mode === 'ai') setTimeout(aiMove, 140);
      }
      return;
    }

    const P = safeBoardCell(sq);
    selected = (P && P.color === (game.turn?.() || 'w')) ? sq : null;
    sync();
  }

  function needsPromotion(from, to){
    const toR = 8 - parseInt(to[1],10);
    const p = safeBoardCell(from);
    if (!p || p.piece !== 'P') return false;
    return (p.color==='w' && toR===0) || (p.color==='b' && toR===7);
  }

  function safeBoardCell(sq){
    try{
      const arr = game.board?.();
      if (!Array.isArray(arr) || arr.length !== 64) return null;
      const idx = (8 - parseInt(sq[1],10)) * 8 + 'abcdefgh'.indexOf(sq[0]);
      return arr[idx] || null;
    }catch{ return null; }
  }

  // --- AI greedy ---------------------------------------------------------------
  function aiMove(){
    if (mode !== 'ai' || (game.turn?.() !== 'b')) return;
    const legal = game.moves?.() || [];
    if (!legal.length) { sync(); return; }
    const val = { P:1,N:3,B:3,R:5,Q:9,K:100 };
    let best=null, bestScore=-1;
    for (const m of legal){
      const t = safeBoardCell(m.to);
      const s = t ? val[t.piece] : 0;
      if (s > bestScore) { best = m; bestScore = s; }
    }
    const pick  = bestScore>0 ? best : legal[(Math.random()*legal.length)|0];
    const promo = needsPromotion(pick.from, pick.to) ? 'Q' : null;
    const note  = game.move?.({ from: pick.from, to: pick.to, promotion: promo });
    if (note) lastMove = { from: pick.from, to: pick.to };
    sync();
  }

  // --- Status universal --------------------------------------------------------
  function getStatus(){
    let hasMoves=true; try{ hasMoves = (game.moves?.().length > 0); }catch{}
    let inCheck=false; try{
      if (typeof game.inCheck === 'function') inCheck = !!game.inCheck();
      else if (typeof game.in_check === 'function') inCheck = !!game.in_check();
    }catch{}
    let isMate=false; try{
      if (typeof game.inCheckmate === 'function') isMate = !!game.inCheckmate();
      else if (typeof game.in_checkmate === 'function') isMate = !!game.in_checkmate();
      else if (!hasMoves && inCheck) isMate = true;
    }catch{}
    let isStale=false; try{
      if (typeof game.inStalemate === 'function') isStale = !!game.inStalemate();
      else if (typeof game.in_stalemate === 'function') isStale = !!game.in_stalemate();
      else if (!hasMoves && !inCheck) isStale = true;
    }catch{}
    let status = 'ok';
    if (isMate) status = 'checkmate';
    else if (isStale) status = 'stalemate';
    else if (inCheck) status = 'check';
    return { status, inCheck };
  }

  // --- Label koordinat & efek check -------------------------------------------
  function injectBoardLabels(){
    if (!boardEl.querySelector('.files')){
      const files = document.createElement('div'); files.className='files';
      'abcdefgh'.split('').forEach(ch=>{ const s=document.createElement('span'); s.textContent=ch; files.appendChild(s); });
      boardEl.appendChild(files);
    }
    if (!boardEl.querySelector('.ranks')){
      const ranks = document.createElement('div'); ranks.className='ranks';
      for (let i=8;i>=1;i--){ const s=document.createElement('span'); s.textContent=i; ranks.appendChild(s); }
      boardEl.appendChild(ranks);
    }
  }
  function mirrorCheckClass(){
    boardEl.querySelectorAll('.sq.in-check').forEach(el=>el.classList.remove('in-check'));
    boardEl.querySelectorAll('.sq.check').forEach(el=>el.classList.add('in-check'));
  }

  // --- Overlay hasil (pakai util dari HTML: window.__azbrySetResult) -----------
  function showResult(text, subText=''){
    if (typeof window.__azbrySetResult === 'function') {
      window.__azbrySetResult({ text, subText });
    }
  }

  // --- RENDER / SYNC (FEN FIRST → bidak PASTI muncul) --------------------------
  function sync(){
    const legal = selected ? (game.moves?.({ square:selected }) || []).map(m=>m.to) : [];

    // status & turn
    const { status, inCheck } = getStatus();
    const turn = game.turn?.() || 'w';
    const inCheckOpt = inCheck ? turn : undefined;

    // render via FEN (engine punya fen(); kalau ga, pakai start)
    const fen = (typeof game.fen === 'function') ? game.fen() : START_FEN;
    ui.renderFEN(fen, { lastMove, legal, inCheck: inCheckOpt });

    // aktivasi CSS merah
    mirrorCheckClass();

    // koordinat
    injectBoardLabels();

    // log sederhana
    if (moveLog) {
      try {
        const h = game.history?.() || [];
        moveLog.textContent = h.length ? h.map((x,i)=>`${i+1}. ${x}`).join('\n') : '_';
      } catch { moveLog.textContent = '_'; }
    }

    // popup hasil
    if (status === 'checkmate') {
      const winner = (turn === 'w') ? 'Hitam' : 'Putih';
      showResult(`${winner} Menang!`);
    } else if (status === 'stalemate') {
      showResult('Seri 🤝');
    }
  }

  // --- Boot --------------------------------------------------------------------
  game.reset?.();     // pastikan posisi awal
  sync();

  // Optional: expose API ke glue HTML
  window.AzbryChess = window.AzbryChess || {};
  window.AzbryChess.setMode = setMode;
});
