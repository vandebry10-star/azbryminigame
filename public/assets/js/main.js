// assets/js/main.js — FINAL FIX VERSION
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  const boardEl   = $('board');
  const btnHuman  = $('modeHuman');
  const btnAI     = $('modeAI');
  const btnReset  = $('btnReset');
  const btnUndo   = $('btnUndo');
  const btnRedo   = $('btnRedo');
  const btnFlip   = $('btnFlip');
  const btnOnly   = $('btnBoardOnly');
  const btnBack   = $('btnBack');
  const moveLog   = $('moveHistory');

  const game = new Chess();
  let flipped = false, selected = null, lastMove = null, mode = 'human';

  const PIECE_CHAR = {
    wp:'♙', wn:'♘', wb:'♗', wr:'♖', wq:'♕', wk:'♔',
    bp:'♟', bn:'♞', bb:'♝', br:'♜', bq:'♛', bk:'♚'
  };

  const files = ['a','b','c','d','e','f','g','h'];

  function idxToSq(i){
    const r=Math.floor(i/8),c=i%8;
    const rr=flipped?r:(7-r),cc=flipped?(7-c):c;
    return files[cc]+(rr+1);
  }
  function sqToIdx(sq){
    const f=files.indexOf(sq[0]);
    const r=parseInt(sq[1],10)-1;
    const rr=flipped?r:(7-r),cc=flipped?(7-f):f;
    return rr*8+cc;
  }

  function buildGrid(){
    boardEl.innerHTML='';
    for(let i=0;i<64;i++){
      const sq=idxToSq(i);
      const d=document.createElement('div');
      d.className='square '+((Math.floor(i/8)+i)%2?'dark':'light');
      d.dataset.sq=sq;
      d.addEventListener('click',()=>onSquare(sq));
      boardEl.appendChild(d);
    }
  }

  function clearMarks(){
    for(const el of boardEl.querySelectorAll('.square')){
      el.classList.remove('sel','move','src','dst','in-check');
      el.innerHTML='';
    }
  }

  function renderPieces() {
  const fen = game.fen();
  const rows = fen.split(' ')[0].split('/');

  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) {
        file += parseInt(ch, 10);
        continue;
      }
      const rank = 8 - r;
      const f = files[file];
      const sq = `${f}${rank}`;
      const idx = sqToIdx(sq);
      const cell = boardEl.children[idx];
      const span = document.createElement('span');
      span.className = 'piece';
      const key = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toLowerCase();
      span.textContent = PIECE_CHAR[key] || '?';
      if (ch === ch.toUpperCase()) span.classList.add('white');
      else span.classList.add('black');
      cell.appendChild(span);
      file++;
    }
  }
  }

  function highlight(){
    if(selected){
      const idx=sqToIdx(selected);
      boardEl.children[idx].classList.add('sel');
      const legal=legalTargets(selected);
      for(const to of legal){
        boardEl.children[sqToIdx(to)].classList.add('move');
      }
    }
    if(lastMove){
      boardEl.children[sqToIdx(lastMove.from)].classList.add('src');
      boardEl.children[sqToIdx(lastMove.to)].classList.add('dst');
    }
    if(game.in_check&&game.in_check()){
      const kingSq=findKingSquare(game.turn());
      if(kingSq){
        boardEl.children[sqToIdx(kingSq)].classList.add('in-check');
      }
    }
    for(let i=0;i<64;i++){
      const sq=idxToSq(i);
      const f=sq[0],r=sq[1];
      const el=boardEl.children[i];
      if(f==='a'){
        const lab=document.createElement('em');
        lab.className='rank';
        lab.textContent=r;
        el.appendChild(lab);
      }
      if(r==='1'){
        const lab=document.createElement('i');
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

  function onSquare(sq){
    if(mode==='ai'&&game.turn()==='b')return;
    const legal=legalTargets(selected||sq);
    if(selected&&legal.includes(sq)){
      const promo=needsPromotion(selected,sq)?'Q':null;
      const note=tryMove({from:selected,to:sq,promotion:promo});
      if(note){
        lastMove={from:selected,to:sq};
        selected=null;sync();
        if(mode==='ai')setTimeout(aiMove,350);
      }return;
    }
    if(squareHasColorPiece(sq,game.turn()))selected=sq;
    else selected=null;
    sync();
  }

  function legalTargets(from){
    if(!from)return[];
    try{return game.moves({square:from,verbose:true}).map(m=>m.to);}catch{return[];}
  }

  function needsPromotion(from,to){
    const p=game.get(from);if(!p||p.type!=='p')return false;
    const rank=parseInt(to[1],10);
    return(p.color==='w'&&rank===8)||(p.color==='b'&&rank===1);
  }

  function tryMove(m){
    try{return game.move(m);}catch{return null;}
  }
  function squareHasColorPiece(sq,c){try{const p=game.get(sq);return p&&p.color===c;}catch{return false;}}
  function findKingSquare(c){const mat=game.board();for(let r=0;r<8;r++){for(let k=0;k<8;k++){const p=mat[r][k];if(p&&p.type==='k'&&p.color===c)return files[k]+(8-r);}}}

  // ==== AI ====
  function aiMove(){
    if(game.game_over&&game.game_over())return;
    const move=randomLegal(game);
    if(!move)return;
    game.move(move);
    lastMove={from:move.from,to:move.to};
    sync();
  }
  function randomLegal(ch){const l=ch.moves({verbose:true});return l[~~(Math.random()*l.length)];}

  // ==== LOG ====
  function updateLog(){
    const hist=game.history({verbose:true});
    if(!hist.length){moveLog.textContent='—';return;}
    let out='',n=1;
    for(let i=0;i<hist.length;i+=2){
      const w=hist[i],b=hist[i+1];
      out+=`${n}. ${(w&&w.san)||''} ${(b&&b.san)||''}\n`;n++;
    }
    moveLog.textContent=out.trim();
  }

  // ==== HASIL ====
  function checkResult(){
    if(game.in_checkmate&&game.in_checkmate()){
      const winner=(game.turn()==='w')?'Hitam':'Putih';
      const msg=(mode==='ai')
        ?(winner==='Hitam'?'Azbry-MD menang!\n“Thanks udah sparring.”':'Kamu menang!\n“Duh, salah hitung.” — Azbry-MD')
        :`${winner} menang (Checkmate)`;
      alert(msg);
    }else if(game.in_stalemate&&game.in_stalemate())alert('Seri (Stalemate)');
  }

  // ==== CONTROL ====
  btnHuman.onclick=()=>{mode='human';setMode();}
  btnAI.onclick=()=>{mode='ai';setMode();if(game.turn()==='b')setTimeout(aiMove,350);}
  btnReset.onclick=()=>{game.reset();selected=null;lastMove=null;sync();}
  btnUndo.onclick=()=>{game.undo();selected=null;sync();}
  btnRedo.onclick=()=>{if(game.redo)game.redo();sync();}
  btnFlip.onclick=()=>{flipped=!flipped;buildGrid();sync();}
  btnOnly.onclick=()=>{document.body.classList.add('board-only');btnOnly.style.display='none';btnBack.style.display='inline-block';}
  btnBack.onclick=()=>{document.body.classList.remove('board-only');btnBack.style.display='none';btnOnly.style.display='inline-block';}

  function setMode(){
    btnHuman.classList.toggle('active',mode==='human');
    btnAI.classList.toggle('active',mode==='ai');
    selected=null;lastMove=null;sync();
  }

  buildGrid(); setMode(); sync();
});
