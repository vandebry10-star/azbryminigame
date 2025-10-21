<script>
// ===== MAIN.JS (no ChessUI, self-render) =====
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // Elemen UI dari HTML kamu
  const boardWrap   = $('boardWrap') || document.body;     // opsional
  let   boardEl     = $('board');
  const btnHuman    = $('modeHuman');
  const btnAI       = $('modeAI');
  const btnReset    = $('btnReset');
  const btnUndo     = $('btnUndo');
  const btnRedo     = $('btnRedo');
  const btnFlip     = $('btnFlip');
  const btnOnly     = $('btnBoardOnly');
  const btnBack     = $('btnBack');
  const moveLog     = $('moveHistory');

  // State game + UI
  const game = new Chess();          // pakai engine kamu
  let flipped  = false;              // papan dibalik?
  let selected = null;               // kotak yang dipilih
  let lastMove = null;               // {from,to}
  let mode     = 'human';            // 'human' | 'ai'

  // Map bidak -> Unicode (rapi di semua device)
  const PIECE_CHAR = {
    'wp':'♙','wn':'♘','wb':'♗','wr':'♖','wq':'♕','wk':'♔',
    'bp':'♟','bn':'♞','bb':'♝','br':'♜','bq':'♛','bk':'♚',
  };

  // ===== Build papan sekali =====
  if (!boardEl) {
    boardEl = document.createElement('div');
    boardEl.id = 'board';
    boardEl.className = 'board';
    boardWrap.appendChild(boardEl);
  }
  boardEl.classList.add('board'); // pastikan class

  // Buat 64 kotak + label koordinat
  const files = ['a','b','c','d','e','f','g','h'];
  function idxToSq(i){
    const r = Math.floor(i/8), c = i%8;
    const rr = flipped ? r : (7 - r);
    const cc = flipped ? (7 - c) : c;
    return files[cc] + (rr + 1);
  }
  function sqToIdx(sq){
    const f = files.indexOf(sq[0]);
    const r = parseInt(sq[1],10) - 1;
    const rr = flipped ? r : (7 - r);
    const cc = flipped ? (7 - f) : f;
    return rr*8 + cc;
  }

  function buildGrid(){
    boardEl.innerHTML = '';
    for (let i=0;i<64;i++){
      const sq = idxToSq(i);
      const d  = document.createElement('div');
      d.className = 'sq ' + ((Math.floor(i/8)+i)%2 ? 'dark' : 'light');
      d.dataset.sq = sq;
      d.addEventListener('click', () => onSquare(sq));
      boardEl.appendChild(d);
    }
  }

  // ===== Render bidak + highlight =====
  function clearMarks(){
    for (const el of boardEl.querySelectorAll('.sq')) {
      el.classList.remove('sel','move','src','dst','in-check');
      el.innerHTML = ''; // bersihkan isi, nanti isi ulang bidak / label
    }
  }

  function renderPieces(){
    // Render bidak berdasarkan engine
    // Prefer chess.board() (matrix 8x8)
    try {
      const mat = game.board();
      for (let r=0;r<8;r++){
        for (let c=0;c<8;c++){
          const p = mat[r][c];
          if (!p) continue;
          const file = files[c];
          const rank = 8 - r;
          const sq   = file + rank;
          const idx  = sqToIdx(sq);
          const cell = boardEl.children[idx];
          const span = document.createElement('span');
          span.className = 'piece';
          span.textContent = PIECE_CHAR[p.color + p.type] || '?';
          cell.appendChild(span);
        }
      }
    } catch {
      // fallback via FEN parsing
      const fen = game.fen().split(' ')[0];
      let r=8,c=1;
      for (const ch of fen){
        if (ch==='/'){ r--; c=1; continue; }
        if (/\d/.test(ch)){ c += parseInt(ch,10); continue; }
        const color = (ch===ch.toUpperCase())?'w':'b';
        const type  = ch.toLowerCase();
        const sq    = files[c-1] + r;
        const idx   = sqToIdx(sq);
        const cell  = boardEl.children[idx];
        const span  = document.createElement('span');
        span.className='piece';
        span.textContent = PIECE_CHAR[color+type]||'?';
        cell.appendChild(span);
        c++;
      }
    }
  }

  function highlight(){
    // selected + legal moves
    if (selected){
      const idx = sqToIdx(selected);
      boardEl.children[idx].classList.add('sel');
      const legal = legalTargets(selected);
      for (const to of legal){
        const id2 = sqToIdx(to);
        boardEl.children[id2].classList.add('move');
      }
    }
    // last move src/dst
    if (lastMove){
      boardEl.children[sqToIdx(lastMove.from)].classList.add('src');
      boardEl.children[sqToIdx(lastMove.to)].classList.add('dst');
    }
    // in check → outline raja
    try {
      if (game.in_check && game.in_check()){
        const kingSq = findKingSquare(game.turn());
        if (kingSq){
          boardEl.children[sqToIdx(kingSq)].classList.add('in-check');
        }
      }
    } catch {}
    // label koordinat (di rank 1 & file a)
    for (let i=0;i<64;i++){
      const sq = idxToSq(i);
      const f  = sq[0], r = sq[1];
      const el = boardEl.children[i];
      if (f==='a'){
        const lab = document.createElement('em');
        lab.className='rank';
        lab.textContent=r;
        el.appendChild(lab);
      }
      if (r==='1'){
        const lab = document.createElement('i');
        lab.className='file';
        lab.textContent=f;
        el.appendChild(lab);
      }
    }
  }

  function sync(){
    clearMarks();
    renderPieces();
    highlight();
    updateLog();
    checkResult();
  }

  // ===== Interaksi papan =====
  function onSquare(sq){
    // kalau mode AI dan giliran AI (hitam) → abaikan klik
    if (mode==='ai' && game.turn()==='b') return;

    const legal = legalTargets(selected||sq);

    // jika sudah seleksi dan sq adalah tujuan legal
    if (selected && legal.includes(sq)){
      const promo = needsPromotion(selected, sq) ? 'Q' : null; // sementara auto-Queen
      const note  = tryMove({from:selected,to:sq,promotion:promo});
      if (note){
        lastMove = {from:selected, to:sq};
        selected = null;
        sync();
        // giliran AI?
        if (mode==='ai') aiMoveSoon();
      }
      return;
    }

    // pilih / batalkan
    if (squareHasColorPiece(sq, game.turn())){
      selected = sq;
    } else {
      selected = null;
    }
    sync();
  }

  function legalTargets(from){
    if (!from) return [];
    try {
      const arr = game.moves({ square: from, verbose: true }) || [];
      return arr.map(m => m.to);
    } catch { return []; }
  }

  function needsPromotion(from,to){
    try{
      const p = game.get(from);
      if (!p || p.type!=='p') return false;
      const rank = parseInt(to[1],10);
      return (p.color==='w' && rank===8) || (p.color==='b' && rank===1);
    }catch{ return false; }
  }

  function tryMove(m){
    try { return game.move(m); }
    catch {
      const san = (m.from||'') + (m.to||'') + (m.promotion?m.promotion.toLowerCase():'');
      try { return game.move(san); } catch { return null; }
    }
  }

  function squareHasColorPiece(sq, color){
    try { const p = game.get(sq); return p && p.color===color; }
    catch { return false; }
  }

  // ===== AI (Azbry-MD) =====
  function aiMoveSoon(){ setTimeout(aiMove, 220); }
  function aiMove(){
    if (game.game_over && game.game_over()) return;
    if (game.turn()!=='b') return;

    const best = chooseAIMove(game, 2) || randomLegal(game);
    if (!best) return;
    tryMove(best);
    lastMove = {from:best.from, to:best.to};
    sync();
  }
  function chooseAIMove(chess, depth=2){
    const moves = safeMoves(chess, {verbose:true});
    let best=null, score=-Infinity;
    for (const m of moves){
      chess.move(m);
      const s = -nega(chess, depth-1, -Infinity, Infinity, 'w');
      chess.undo();
      if (s>score){ score=s; best=m; }
    }
    return best;
  }
  function nega(chess, depth, a, b, pov){
    if (depth===0 || (chess.game_over&&chess.game_over())) return evalPos(chess,pov);
    let v=-Infinity;
    for (const m of safeMoves(chess,{verbose:true})){
      chess.move(m);
      const s = -nega(chess, depth-1, -b, -a, pov==='w'?'b':'w');
      chess.undo();
      v = Math.max(v,s); a = Math.max(a,s);
      if (a>=b) break;
    }
    return v;
  }
  function evalPos(chess,pov){
    const val = {p:100,n:320,b:330,r:500,q:900,k:0};
    let sc=0;
    try{
      const mat = chess.board();
      for (let r=0;r<8;r++){
        for (let c=0;c<8;c++){
          const p = mat[r][c]; if(!p) continue;
          sc += (p.color===pov?1:-1) * (val[p.type]||0);
        }
      }
    }catch{
      const fen = chess.fen().split(' ')[0];
      for (const ch of fen){
        if (ch==='/' || /\d/.test(ch)) continue;
        const t=ch.toLowerCase(), isW=(ch===ch.toUpperCase());
        sc += (isW?1:-1)*(val[t]||0);
      }
    }
    return sc/1000;
  }
  function safeMoves(chess,opts){ try{ return chess.moves(opts)||[]; }catch{ return []; } }
  function randomLegal(chess){ const l=safeMoves(chess,{verbose:true}); return l[~~(Math.random()*l.length)]||null; }

  // ===== Log & hasil =====
  function updateLog(){
    if (!moveLog) return;
    let hist=[];
    try{ hist = game.history({verbose:true})||[]; }catch{}
    if (!hist.length){ moveLog.textContent='—'; return; }
    let out='', n=1;
    for(let i=0;i<hist.length;i+=2){
      const w = hist[i], b = hist[i+1];
      out += `${n}. ${(w&&w.san)||''} ${(b&&b.san)||''}\n`; n++;
    }
    moveLog.textContent = out.trim();
  }

  function checkResult(){
    let over=false, msg='';
    try{
      if (game.in_checkmate && game.in_checkmate()){
        over=true;
        const winner = (game.turn()==='w')?'Hitam':'Putih';
        msg = (mode==='ai')
          ? (winner==='Hitam' ? 'Azbry-MD menang!\n“Thanks sudah jadi sparring.”'
                              : 'Kamu menang!\n“Duh, salah hitung.” — Azbry-MD')
          : `${winner} menang (Checkmate)`;
      } else if (game.in_stalemate && game.in_stalemate()){ over=true; msg='Seri (Stalemate)'; }
      else if (game.in_draw && game.in_draw()){ over=true; msg='Seri'; }
      else if (game.in_threefold_repetition && game.in_threefold_repetition()){ over=true; msg='Seri (3x pengulangan)'; }
      else if (game.insufficient_material && game.insufficient_material()){ over=true; msg='Seri (Material kurang)'; }
    }catch{}
    if (over) alert(msg); // simple popup (bisa ganti overlay custom kamu)
  }

  function findKingSquare(color){
    try{
      const mat = game.board();
      for (let r=0;r<8;r++){
        for (let c=0;c<8;c++){
          const p = mat[r][c];
          if (p && p.type==='k' && p.color===color){
            return files[c] + (8-r);
          }
        }
      }
    }catch{}
    return null;
  }

  // ===== Controls =====
  btnHuman && btnHuman.addEventListener('click', ()=>{ mode='human'; setActiveMode(); selected=null; lastMove=null; sync(); });
  btnAI    && btnAI.addEventListener('click',    ()=>{ mode='ai';    setActiveMode(); selected=null; lastMove=null; sync(); aiMoveSoon(); });
  btnReset && btnReset.addEventListener('click', ()=>{ game.reset(); selected=null; lastMove=null; sync(); if(mode==='ai') aiMoveSoon(); });
  btnUndo  && btnUndo .addEventListener('click', ()=>{ game.undo(); selected=null; lastMove=null; sync(); });
  btnRedo  && btnRedo .addEventListener('click', ()=>{ game.redo && game.redo(); selected=null; lastMove=null; sync(); });
  btnFlip  && btnFlip .addEventListener('click', ()=>{ flipped=!flipped; buildGrid(); sync(); });
  btnOnly  && btnOnly .addEventListener('click', ()=>{
    document.body.classList.add('board-only');
    if (btnBack) btnBack.style.display='inline-block';
    btnOnly.style.display='none';
  });
  btnBack  && btnBack .addEventListener('click', ()=>{
    document.body.classList.remove('board-only');
    btnOnly.style.display='inline-block';
    btnBack.style.display='none';
  });

  function setActiveMode(){
    if (btnHuman) btnHuman.classList.toggle('active', mode==='human');
    if (btnAI)    btnAI.classList.toggle('active',   mode==='ai');
  }

  // ===== Start =====
  buildGrid();
  setActiveMode();
  sync();
});
</script>
