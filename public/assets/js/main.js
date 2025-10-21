// Azbry Chess – glue UI + Engine + simple AI
document.addEventListener('DOMContentLoaded', () => {
  const boardEl = document.getElementById('board');
  const btnHuman = document.getElementById('modeHuman');
  const btnAI = document.getElementById('modeAI');
  const btnReset = document.getElementById('btnReset') || document.getElementById('btnReset'); // keep
  const btnUndo  = document.getElementById('btnUndo');
  const btnRedo  = document.getElementById('btnRedo');
  const btnFlip  = document.getElementById('btnFlip');
  const moveHistory = document.getElementById('moveHistory') || document.getElementById('move-history') || document.getElementById('moveHistory');

  const game = new Chess();
  const ui = new ChessUI(boardEl, onSquareClick);

  let mode = 'human'; // 'human' | 'ai'
  let selected = null;

  function setMode(m){
    mode = m;
    btnHuman.classList.toggle('active', m==='human');
    btnAI.classList.toggle('active', m==='ai');
    selected = null;
    sync();
  }

  function sync(){
    const last = game.history().length ? lastMoveObj() : null;
    const legal = selected ? game.moves({ square: selected }).map(m=>m.to) : [];
    ui.render(game.board(), { lastMove: last, legal });
    renderHistory();
    const status = game.gameStatus();
    if(status==='checkmate'){
      toast(`Checkmate! ${game.turn()==='w'?'Hitam':'Putih'} menang.`);
    } else if(status==='stalemate'){
      toast('Stalemate (seri).');
    } else if(status==='check'){
      // optional indicator
    }
  }

  function lastMoveObj(){
    const h = game.history();
    if(!h.length) return null;
    // we stored in engine the raw move object; use historyStack
    const last = game.historyStack[ game.historyStack.length-1 ];
    return { from:last.from, to:last.to };
  }

  function renderHistory(){
    const h = game.history();
    moveHistory.textContent = h.length ? h.map((m,i)=>`${i+1}. ${m}`).join('\n') : '_';
  }

  function onSquareClick(alg){
    // if AI turn, ignore clicks
    if(mode==='ai' && game.turn()==='b') return;

    const movesFrom = game.moves({ square: alg });
    const isOwn = game.board()[ algebraicToIdx(alg) ]?.color === game.turn();

    if(selected && movesFrom.find(m=>m.to===alg)){
      const notation = game.move({ from: selected, to: alg, promotion:'Q' });
      selected = null;
      sync();
      if(mode==='ai') setTimeout(aiMove, 250);
      return;
    }

    if(isOwn){
      selected = alg;
    }else{
      selected = null;
    }
    sync();
  }

  function aiMove(){
    if(mode!=='ai' || game.turn()!=='b') return;
    // very simple AI: prefer capture, otherwise random legal
    const legal = game.moves();
    if(!legal.length) { sync(); return; }
    const board = game.board();
    const scored = legal.map(m=>{
      const toIdx = algebraicToIdx(m.to);
      const cap = board[toIdx];
      const score = cap ? pieceScore(cap.piece) : 0;
      return {m, score};
    }).sort((a,b)=>b.score-a.score);
    const best = (scored[0].score>0) ? scored[0].m : legal[Math.floor(Math.random()*legal.length)];
    game.move(best);
    sync();
  }

  function pieceScore(p){ return {P:1,N:3,B:3,R:5,Q:9,K:100}[p]||0; }
  function algebraicToIdx(a){ return (8-parseInt(a[1]))*8 + 'abcdefgh'.indexOf(a[0]); }

  // controls
  btnHuman.addEventListener('click', ()=>setMode('human'));
  btnAI.addEventListener('click',   ()=>setMode('ai'));
  document.getElementById('btnReset')?.addEventListener('click', ()=>{ game.reset(); selected=null; sync(); });
  document.getElementById('btnUndo')?.addEventListener('click',  ()=>{ game.undo(); selected=null; sync(); });
  document.getElementById('btnRedo')?.addEventListener('click',  ()=>{ game.redo(); selected=null; sync(); });
  document.getElementById('btnFlip')?.addEventListener('click',  ()=>{ ui.toggleFlip(); sync(); });

  // first paint
  sync();

  // tiny toast
  function toast(msg){
    console.log(msg);
  }
});
