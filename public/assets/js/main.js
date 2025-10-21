document.addEventListener('DOMContentLoaded', () => {
  const boardEl = document.getElementById('board');
  const modeHuman = document.getElementById('modeHuman');
  const modeAI    = document.getElementById('modeAI');
  const btnReset  = document.getElementById('btnReset');
  const btnUndo   = document.getElementById('btnUndo');
  const btnRedo   = document.getElementById('btnRedo');
  const btnFlip   = document.getElementById('btnFlip');
  const moveLog   = document.getElementById('moveHistory');

  const game = new Chess();
  const ui   = new ChessUI(boardEl, onSquare);
  let mode = 'human';
  let selected = null;

  modeHuman.addEventListener('click', ()=>setMode('human'));
  modeAI.addEventListener('click',    ()=>setMode('ai'));
  btnReset.addEventListener('click',  ()=>{ game.reset(); selected=null; sync(); });
  btnUndo.addEventListener('click',   ()=>{ game.undo(); selected=null; sync(); });
  btnRedo.addEventListener('click',   ()=>{ game.redo(); selected=null; sync(); });
  btnFlip.addEventListener('click',   ()=>{ ui.toggleFlip(); sync(); });

  function setMode(m){
    mode=m;
    modeHuman.classList.toggle('active', m==='human');
    modeAI.classList.toggle('active', m==='ai');
    selected=null; sync();
  }

  function onSquare(a){
    if(mode==='ai' && game.turn()==='b') return;
    const mine = game.board()[toIdx(a)]?.color===game.turn();
    const legalFrom = game.moves({square:a});

    if(selected && legalFrom.find(x=>x.to===a)){
      game.move({from:selected,to:a,promotion:'Q'});
      selected=null; sync();
      if(mode==='ai') setTimeout(aiMove, 180);
      return;
    }

    selected = mine ? a : null;
    sync();
  }

  function aiMove(){
    if(mode!=='ai' || game.turn()!=='b') return;
    const legal = game.moves();
    if(!legal.length){ sync(); return; }
    // greedy capture, else random
    const b=game.board();
    const score={P:1,N:3,B:3,R:5,Q:9,K:100};
    const sorted = legal.map(m=>{
      const cap=b[toIdx(m.to)];
      return {m, s: cap?score[cap.piece]:0};
    }).sort((a,b)=>b.s-a.s);
    const pick = sorted[0].s>0 ? sorted[0].m : legal[Math.floor(Math.random()*legal.length)];
    game.move(pick); sync();
  }

  function lastMove(){
    const h=game.historyStack; if(!h.length) return null;
    const L=h[h.length-1]; return {from:L.from,to:L.to};
  }
  function toIdx(a){ return (8-parseInt(a[1]))*8 + 'abcdefgh'.indexOf(a[0]); }

  function sync(){
    const leg = selected ? game.moves({square:selected}).map(m=>m.to) : [];
    ui.render(game.board(), { lastMove:lastMove(), legal:leg });
    const h = game.history(); moveLog.textContent = h.length? h.map((x,i)=>`${i+1}. ${x}`).join('\n') : '_';

    const st = game.gameStatus();
    if(st==='checkmate'){ console.log('Checkmate'); }
    else if(st==='stalemate'){ console.log('Stalemate'); }
  }

  sync();
});
