// assets/js/main.js — Azbry Chess (Final Stable Build)
// Full fix: board render, koordinat, captured, check merah, checkmate popup.

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // Root UI
  let boardEl = $('board');
  const modeHuman  = $('modeHuman');
  const modeAI     = $('modeAI');
  const btnReset   = $('btnReset');
  const btnUndo    = $('btnUndo');
  const btnRedo    = $('btnRedo');
  const btnFlip    = $('btnFlip');
  const btnOnly    = $('btnBoardOnly');
  const btnBack    = $('btnBack');
  const moveLog    = $('moveHistory');

  const startMenu     = $('startMenu');
  const btnStartHuman = $('btnStartHuman');
  const btnStartAI    = $('btnStartAI');
  const resultPopup   = $('resultPopup');
  const resultText    = $('resultText');
  const btnRestart    = $('btnRestart');

  if (!boardEl) {
    boardEl = document.createElement('div');
    boardEl.id = 'board';
    boardEl.className = 'board';
    document.body.prepend(boardEl);
  }

  // Game engine & UI
  const game = new Chess();
  const ui   = new ChessUI(boardEl, onSquare);
  if (!ui.squares || ui.squares.length !== 64) ui._buildGrid();

  let mode     = 'human';
  let selected = null;
  let lastMove = null;

  // Bidak tertangkap
  const PIECE_CHAR = {
    k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟',
    K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙'
  };
  const INITIAL_COUNTS = {
    w: { P:8, R:2, N:2, B:2, Q:1, K:1 },
    b: { P:8, R:2, N:2, B:2, Q:1, K:1 },
  };

  function injectCapturedContainers(){
    if (document.querySelector('.captured-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'captured-wrap';
    const cw = document.createElement('div');
    cw.id = 'capturedWhite';
    cw.className = 'captured captured-white';
    const spacer = document.createElement('div');
    spacer.className = 'captured-spacer';
    const cb = document.createElement('div');
    cb.id = 'capturedBlack';
    cb.className = 'captured captured-black';
    wrap.appendChild(cw);
    wrap.appendChild(spacer);
    wrap.appendChild(cb);
    boardEl.insertAdjacentElement('afterend', wrap);
  }

  function computeCaptured(boardArr){
    const remain = { w: { P:0,R:0,N:0,B:0,Q:0,K:0 }, b: { P:0,R:0,N:0,B:0,Q:0,K:0 } };
    for (let i=0;i<64;i++){
      const c = boardArr[i];
      if (!c) continue;
      const clr = c.color, p = c.piece.toUpperCase();
      remain[clr][p] += 1;
    }
    const captured = { w:[], b:[] };
    for (const clr of ['w','b']){
      for (const p of ['Q','R','B','N','P']){
        const dead = Math.max(0, INITIAL_COUNTS[clr][p] - remain[clr][p]);
        for (let k=0;k<dead;k++) captured[clr].push(p);
      }
    }
    return captured;
  }

  function renderCaptured(boardArr){
    const cw = document.getElementById('capturedWhite');
    const cb = document.getElementById('capturedBlack');
    if (!cw || !cb) return;
    const caps = computeCaptured(boardArr);
    cw.innerHTML = '';
    caps.w.forEach(p => {
      const el = document.createElement('span');
      el.className = 'cap cap-w';
      el.textContent = PIECE_CHAR[p];
      cw.appendChild(el);
    });
    cb.innerHTML = '';
    caps.b.forEach(p => {
      const el = document.createElement('span');
      el.className = 'cap cap-b';
      el.textContent = PIECE_CHAR[p.toLowerCase()];
      cb.appendChild(el);
    });
  }

  // Controls
  if (modeHuman) modeHuman.addEventListener('click', () => setMode('human'));
  if (modeAI)    modeAI.addEventListener('click',    () => setMode('ai'));
  if (btnReset)  btnReset.addEventListener('click',  () => hardReset());
  if (btnUndo)   btnUndo.addEventListener('click',   () => { game.undo(); sync(); });
  if (btnRedo)   btnRedo.addEventListener('click',   () => { game.redo(); sync(); });
  if (btnFlip)   btnFlip.addEventListener('click',   () => { ui.toggleFlip(); sync(); });

  if (btnOnly && btnBack) {
    btnOnly.addEventListener('click', () => {
      document.body.classList.add('board-only');
      btnOnly.style.display = 'none';
      btnBack.style.display = 'inline-block';
    });
    btnBack.addEventListener('click', () => {
      document.body.classList.remove('board-only');
      btnBack.style.display = 'none';
      btnOnly.style.display = 'inline-block';
    });
  }

  if (btnStartHuman) btnStartHuman.addEventListener('click', () => startGame('human'));
  if (btnStartAI)    btnStartAI.addEventListener('click',    () => startGame('ai'));
  if (btnRestart) btnRestart.addEventListener('click', () => {
    hideResult();
    if (startMenu) startMenu.classList.add('show');
    hardReset();
  });

  function startGame(m){
    setMode(m);
    if (startMenu) startMenu.classList.remove('show');
  }

  function setMode(m){
    mode = m;
    if (modeHuman) modeHuman.classList.toggle('active', m==='human');
    if (modeAI)    modeAI.classList.toggle('active',   m==='ai');
    selected = null;
    lastMove = null;
    sync();
  }

  function hardReset(){
    game.reset();
    selected = null;
    lastMove = null;
    sync();
  }

  // Klik papan
  function onSquare(sq){
    if (mode === 'ai' && game.turn() === 'b') return;
    const moves = selected ? game.moves({ square: selected }) : [];
    if (selected && moves.some(m => m.to === sq)){
      const promo = needsPromotion(selected, sq) ? 'Q' : null;
      const mv = game.move({ from:selected, to:sq, promotion:promo });
      if (mv){
        lastMove = { from:selected, to:sq };
        selected = null;
        sync();
        if (mode === 'ai') setTimeout(aiMove, 150);
      }
      return;
    }
    const P = game.board()[toIdx(sq)];
    selected = (P && P.color === game.turn()) ? sq : null;
    sync();
  }

  function needsPromotion(from,to){
    const toR = 8 - parseInt(to[1]);
    const p = game.board()[toIdx(from)];
    if (!p || p.piece !== 'P') return false;
    return (p.color==='w' && toR===0) || (p.color==='b' && toR===7);
  }

  // AI move
  function aiMove(){
    if (mode!=='ai'||game.turn()!=='b')return;
    const legal = game.moves(); if(!legal.length){sync();return;}
    const val={P:1,N:3,B:3,R:5,Q:9,K:100};
    let best=null,bestV=-1;
    for(const m of legal){
      const t=game.board()[toIdx(m.to)];
      const s=t?val[t.piece]:0;
      if(s>bestV){best=m;bestV=s;}
    }
    const pick=bestV>0?best:legal[Math.random()*legal.length|0];
    const promo=needsPromotion(pick.from,pick.to)?'Q':null;
    const mv=game.move({from:pick.from,to:pick.to,promotion:promo});
    if(mv)lastMove={from:pick.from,to:pick.to};
    sync();
  }

  // Status universal
  function getStatus(){
    let hasMoves=true;try{hasMoves=(game.moves().length>0);}catch{}
    let inCheck=false;
    try{
      if(game.inCheck)inCheck=!!game.inCheck();
      else if(game.in_check)inCheck=!!game.in_check();
    }catch{}
    let isMate=false;
    try{
      if(game.inCheckmate)isMate=!!game.inCheckmate();
      else if(game.in_checkmate)isMate=!!game.in_checkmate();
      else if(!hasMoves&&inCheck)isMate=true;
    }catch{}
    let isStale=false;
    try{
      if(game.inStalemate)isStale=!!game.inStalemate();
      else if(game.in_stalemate)isStale=!!game.in_stalemate();
      else if(!hasMoves&&!inCheck)isStale=true;
    }catch{}
    let status='ok';
    if(isMate)status='checkmate';
    else if(isStale)status='stalemate';
    else if(inCheck)status='check';
    return{status,inCheck};
  }

  // Sinkronisasi papan
  function sync(){
    const legal = selected ? game.moves({ square:selected }).map(m=>m.to):[];
    const {status,inCheck}=getStatus();
    const turn=game.turn();
    const checkOpt=inCheck?turn:undefined;

    ui.render(game.board(),{lastMove,legal,inCheck:checkOpt});
    mirrorCheckClass();
    injectBoardLabels();
    injectCapturedContainers();
    renderCaptured(game.board());

    if(moveLog){
      const h=game.history();
      moveLog.textContent=h.length?h.map((x,i)=>`${i+1}. ${x}`).join('\n'):'_';
    }

    if(status==='checkmate'){
      const winner=(turn==='w')?'Hitam':'Putih';
      showResult(`${winner} Menang!`);
    }else if(status==='stalemate'){
      showResult('Seri 🤝');
    }
  }

  function injectBoardLabels(){
    if(!boardEl.querySelector('.files')){
      const files=document.createElement('div');
      files.className='files';
      'abcdefgh'.split('').forEach(ch=>{
        const s=document.createElement('span');
        s.textContent=ch;
        files.appendChild(s);
      });
      boardEl.appendChild(files);
    }
    if(!boardEl.querySelector('.ranks')){
      const ranks=document.createElement('div');
      ranks.className='ranks';
      for(let i=8;i>=1;i--){
        const s=document.createElement('span');
        s.textContent=i;
        ranks.appendChild(s);
      }
      boardEl.appendChild(ranks);
    }
  }

  function mirrorCheckClass(){
    boardEl.querySelectorAll('.sq.in-check').forEach(el=>el.classList.remove('in-check'));
    boardEl.querySelectorAll('.sq.check').forEach(el=>el.classList.add('in-check'));
  }

  function showResult(text){
    if(!resultPopup||!resultText)return;
    resultText.textContent=text;
    resultPopup.classList.add('show');
  }

  function hideResult(){
    if(!resultPopup)return;
    resultPopup.classList.remove('show');
  }

  function toIdx(a){return(8-parseInt(a[1]))*8+'abcdefgh'.indexOf(a[0]);}

  // Boot
  game.reset(); // <-- posisi awal langsung dibuat
  injectCapturedContainers();
  injectBoardLabels();
  if(startMenu)startMenu.classList.add('show');
  sync();
});
