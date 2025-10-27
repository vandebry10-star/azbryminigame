/* =========================================================
   Azbry Chess — main.js (Hard AI + Anti-Desync Guards)
   ========================================================= */
(function () {
  // ---------- DOM ----------
  const $board    = document.getElementById('board');
  const $hist     = document.getElementById('moveHistory');
  const $btnUndo  = document.getElementById('btnUndo');
  const $btnRedo  = document.getElementById('btnRedo');
  const $btnReset = document.getElementById('btnReset');
  const $btnFlip  = document.getElementById('btnFlip');
  const $modeHuman= document.getElementById('modeHuman');
  const $modeAI   = document.getElementById('modeAI');
  const $capBlack = document.getElementById('capBlack');
  const $capWhite = document.getElementById('capWhite');
  if (!$board) return;

  // ---------- Engine & UI ----------
  const G  = new Chess();
  const UI = new ChessUI($board, onSquareClick);

  // ---------- State ----------
  let mode = 'human';            // 'human' | 'ai'
  let selected = null;           // 'e2'
  let legalForSelected = [];     // moves for selected
  let lastMove = null;           // {from,to}
  let animLock = false;
  let aiThinking = false;
  let searchToken = 0;           // invalidasi hasil AI yang telat

  // ---------- Helpers ----------
  const FILES = "abcdefgh";
  function idx(a){ return (8 - parseInt(a.charAt(1),10)) * 8 + FILES.indexOf(a.charAt(0)); }
  function alg(i){ return FILES.charAt(i%8) + (8 - ((i/8)|0)); }
  function pieceAtAlg(a){ return G.get(idx(a)); }
  function glyph(p){
    const W={P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'};
    const B={P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'};
    return p.color==='w'? W[p.piece] : B[p.piece];
  }
  function sameMove(a,b){
    if(!a||!b) return false;
    const af = typeof a.from==='string'?a.from:alg(a.from);
    const at = typeof a.to  ==='string'?a.to  :alg(a.to);
    const bf = typeof b.from==='string'?b.from:alg(b.from);
    const bt = typeof b.to  ==='string'?b.to  :alg(b.to);
    const ap = a.promotion||null, bp=b.promotion||null;
    return af===bf && at===bt && ap===bp;
  }
  function currentLegal(){ return G.moves(); }
  function includesMove(L,m){ return L.some(x=>sameMove(x,m)); }

  // ---------- Coordinates (ikut flip) ----------
  function stampCoordinates(){
    for (let i=0;i<64;i++){
      const cell = UI.cells[i];
      const file = i%8, rank=(i/8)|0;
      const visFile = UI.flip ? (7-file) : file;
      const visRank = UI.flip ? rank : (7-rank);
      cell.dataset.file = FILES.charAt(visFile);
      cell.dataset.rank = (visRank+1)+'';
    }
  }

  // ---------- Render ----------
  function render(opt){
    const legalSquares = (opt && opt.legalSquares) || [];
    UI.render(G.board(), {legal: legalSquares, lastMove});
    highlightCheck();
    stampCoordinates();
    renderHistory();
    rebuildCaptures();
  }

  function highlightCheck(){
    UI.cells.forEach(c=>c.classList.remove('check'));
    if (G.inCheck('w')) { const k = kingIndex('w'); if (k>=0) markCheck(k); }
    if (G.inCheck('b')) { const k = kingIndex('b'); if (k>=0) markCheck(k); }
  }
  function kingIndex(color){
    for (let i=0;i<64;i++){ const p=G.get(i); if (p && p.color===color && p.piece==='K') return i; }
    return -1;
  }
  function markCheck(iBoard){
    for (let v=0; v<64; v++){
      const mapped = UI.flip ? (63 - v) : v;
      if (mapped===iBoard){ UI.cells[v].classList.add('check'); break; }
    }
  }

  function renderHistory(){
    const H = G.history();
    if (!H.length){ $hist.textContent = '_'; return; }
    let out = '';
    for (let i=0;i<H.length;i+=2){
      const t = Math.floor(i/2)+1;
      out += `${t}.  ${H[i]||''}\n    ${H[i+1]||''}\n`;
    }
    $hist.textContent = out.trim();
  }

  // ---------- Captured (rebuild dari history: anti-duplikat) ----------
  function rebuildCaptures(){
    const deadB = [], deadW = [];
    for (const h of G.hist){
      const cap = h.snap && h.snap.cap;
      if (!cap) continue;
      if (cap.color==='w') deadW.push(cap); else deadB.push(cap);
    }
    if ($capBlack){
      $capBlack.innerHTML='';
      for (const p of deadB){
        const s=document.createElement('span');
        s.className='cap-piece black';
        s.textContent=glyph(p);
        $capBlack.appendChild(s);
      }
    }
    if ($capWhite){
      $capWhite.innerHTML='';
      for (const p of deadW){
        const s=document.createElement('span');
        s.className='cap-piece white';
        s.textContent=glyph(p);
        $capWhite.appendChild(s);
      }
    }
  }

  // ---------- Input ----------
  function onSquareClick(a){
    if (animLock || aiThinking) return;
    if (mode==='ai' && G.turn()==='b') return; // giliran AI (hitam)
    const side = G.turn();
    const p = pieceAtAlg(a);

    if (!selected){
      if (!p || p.color!==side) return;
      selected = a;
      legalForSelected = G.moves({square:a});
      render({legalSquares: legalForSelected.map(m=>m.to)});
      markSrc(a);
      return;
    }

    if (p && p.color===side && a!==selected){
      selected = a;
      legalForSelected = G.moves({square:a});
      render({legalSquares: legalForSelected.map(m=>m.to)});
      markSrc(a);
      return;
    }

    const mv = legalForSelected.find(m=>m.to===a);
    if (!mv){ clearSelection(); render(); return; }

    // sebelum eksekusi, revalidasi terhadap posisi TERKINI
    const leg = currentLegal();
    if (!includesMove(leg, mv)){ clearSelection(); render(); return; }

    playMove(mv);
  }

  function markSrc(a){
    UI.cells.forEach(c=>c.classList.remove('src'));
    const i = idx(a);
    for (let v=0;v<64;v++){
      const mapped = UI.flip ? (63 - v) : v;
      if (mapped===i){ UI.cells[v].classList.add('src'); break; }
    }
  }
  function clearSelection(){
    selected=null; legalForSelected=[];
    UI.cells.forEach(c=>c.classList.remove('src'));
  }

  // ---------- Animasi + Move ----------
  function playMove(m){
    const from = typeof m.from==='string'? m.from : alg(m.from);
    const to   = typeof m.to  ==='string'? m.to   : alg(m.to);

    // hard lock input
    animLock = true;

    animateMove(from,to, ()=>{
      // sebelum apply, pastikan MASIH legal (anti race)
      const legNow = currentLegal();
      if (!includesMove(legNow, {from,to,promotion:m.promotion||null})){
        animLock = false;
        clearSelection();
        render();
        return;
      }

      const did = G.move({from,to,promotion:m.promotion||null});
      animLock = false;

      if (!did){ clearSelection(); render(); return; }

      lastMove = {from,to};
      clearSelection();
      render();

      const status = G.gameStatus();
      if (status==='checkmate' || status==='stalemate'){ showResult(status); return; }

      if (mode==='ai' && G.turn()==='b' && !aiThinking){
        // start AI dengan token baru (untuk invalidasi hasil lama)
        searchToken++;
        const tok = searchToken;
        setTimeout(()=>aiPlay(tok), 20);
      }
    });
  }

  function cellByAlg(a){
    const i = idx(a);
    for (let v=0; v<64; v++){
      const mapped = UI.flip ? (63 - v) : v;
      if (mapped===i) return UI.cells[v];
    }
    return null;
  }

  function animateMove(fromAlg,toAlg,done){
    try{
      const fromCell = cellByAlg(fromAlg);
      const toCell   = cellByAlg(toAlg);
      if (!fromCell || !toCell){ done(); return; }
      const piece = pieceAtAlg(fromAlg);
      if (!piece){ done(); return; }

      const ghost = document.createElement('span');
      ghost.className = 'anim-piece ' + (piece.color==='w'?'white':'black');
      ghost.textContent = glyph(piece);

      const br = $board.getBoundingClientRect();
      const fr = fromCell.getBoundingClientRect();
      const tr = toCell.getBoundingClientRect();

      const sx = fr.left - br.left + fr.width/2;
      const sy = fr.top  - br.top  + fr.height/2;
      const ex = tr.left - br.left + tr.width/2;
      const ey = tr.top  - br.top  + tr.height/2;

      ghost.style.transform = `translate(${sx}px, ${sy}px)`;
      $board.appendChild(ghost);

      let cleared = false;
      const clear = () => {
        if (cleared) return;
        cleared = true;
        try { ghost.remove(); } catch(_) {}
        done();
      };

      requestAnimationFrame(()=>{
        ghost.style.transform = `translate(${ex}px, ${ey}px)`;
        const tId = setTimeout(clear, 450);
        ghost.addEventListener('transitionend', ()=>{
          clearTimeout(tId);
          clear();
        }, {once:true});
      });
    }catch(e){ done(); }
  }

  // ---------- Result ----------
  function showResult(status){
    const winner = (status==='checkmate')
      ? (G.turn()==='w' ? 'Hitam' : 'Putih')
      : null;
    const text = status==='checkmate' ? `${winner} Menang!` : 'Stalemate';
    const sub  = status==='checkmate'
      ? `Skakmat setelah ${G.history().length} langkah.`
      : `Tidak ada langkah legal tersisa.`;
    window.__azbrySetResult && window.__azbrySetResult({text, subText:sub});
  }

  // ---------- Controls ----------
  $btnUndo && $btnUndo.addEventListener('click', ()=>{
    if (animLock || aiThinking) return;
    // undo 1 ply (human) + 1 ply (AI) kalau mode AI
    if (mode==='ai'){
      const a=G.undo(); const b=G.undo(); if(!a && !b) return;
    }else{
      if(!G.undo()) return;
    }
    lastMove=null; clearSelection(); render();
  });

  $btnRedo && $btnRedo.addEventListener('click', ()=>{
    if (animLock || aiThinking) return;
    if (!G.redo()) return;
    lastMove=null; clearSelection(); render();
  });

  $btnReset && $btnReset.addEventListener('click', ()=>{
    if (animLock || aiThinking) return;
    G.reset(); lastMove=null; clearSelection(); render();
    // jika mode AI dan giliran hitam (selalu), biarkan AI mikir dulu
    if (mode==='ai' && G.turn()==='b'){
      searchToken++; const tok=searchToken;
      setTimeout(()=>aiPlay(tok), 20);
    }
  });

  $btnFlip && $btnFlip.addEventListener('click', ()=>{
    if (animLock || aiThinking) return;
    UI.toggleFlip(); render();
  });

  $modeHuman && $modeHuman.addEventListener('click', ()=>{
    if (animLock || aiThinking) return;
    mode='human';
    $modeHuman.classList.add('accent');
    $modeAI && $modeAI.classList.remove('accent');
  });

  $modeAI && $modeAI.addEventListener('click', ()=>{
    if (animLock || aiThinking) return;
    mode='ai';
    $modeAI.classList.add('accent');
    $modeHuman && $modeHuman.classList.remove('accent');
    if (G.turn()==='b'){
      searchToken++; const tok=searchToken;
      setTimeout(()=>aiPlay(tok), 20);
    }
  });

  // ========================================================
  //                      A I   P L A Y
  // ========================================================
  const AI_TIME_MS = 7000; // naikin buat makin gahar

  function aiPlay(tok){
    // batal kalau sudah ada pencarian baru
    if (tok !== searchToken) return;
    if (aiThinking || animLock) return;
    if (mode!=='ai' || G.turn()!=='b') return;

    aiThinking = true;
    clearSelection(); // bersihin seleksi agar gak ‘klik nyasar’

    setTimeout(()=>{
      try{
        if (!window.AzbryAI || typeof AzbryAI.chooseMove!=='function'){
          const ms = currentLegal();
          if (tok===searchToken && ms && ms.length) playMove(ms[0]);
          return;
        }

        const best = AzbryAI.chooseMove(G, { timeMs: AI_TIME_MS });

        // invalidasi hasil lama
        if (tok !== searchToken) return;

        // revalidasi ke posisi TERKINI
        const legalNow = currentLegal();
        if (!best || !includesMove(legalNow, best)){
          // fallback: ambil first legal (biar nggak crash)
          if (legalNow.length) playMove(legalNow[0]);
          else render();
          return;
        }

        playMove(best);
      }catch(e){
        console.error('[AI ERROR]', e);
        const ms = currentLegal();
        if (tok===searchToken && ms && ms.length) playMove(ms[0]);
      }finally{
        aiThinking = false;
      }
    }, 0);
  }

  // ---------- Boot ----------
  render();
})();
