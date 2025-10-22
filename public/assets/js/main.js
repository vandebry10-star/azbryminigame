/* =========================================================
   Azbry Chess Main.js — PRO MAX FIXED VERSION
   Versi: 3.5 (AI 3000, animasi, fix tray duplikat)
   ========================================================= */

const boardEl = document.getElementById('board');
const $moveHistory = document.getElementById('moveHistory');
const $capWhite = document.getElementById('capWhite');
const $capBlack = document.getElementById('capBlack');

let G = new Chess();
let vsAI = false;
let lastMove = null;
let capturedWhite = [];
let capturedBlack = [];

/* ============ Helper kecil ============ */
function idx(a){ return (8 - parseInt(a.charAt(1),10))*8 + "abcdefgh".indexOf(a.charAt(0)); }
function cellForAlg(a){ return boardEl.querySelector(`.sq[data-alg="${a}"]`); }
function glyph(p){
  if(!p) return '';
  return (p.color==='w' ? {P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'} : {P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'})[p.piece];
}
function glyphAtPrev(board,i){
  const p=board[i]; if(!p) return null;
  return glyph(p);
}

/* ============ Build papan ============ */
function buildBoard(){
  boardEl.innerHTML='';
  for(let i=0;i<64;i++){
    const sq=document.createElement('div');
    const f="abcdefgh"[i%8], r=8-Math.floor(i/8);
    sq.className='sq '+(((i+Math.floor(i/8))%2)?'dark':'light');
    sq.dataset.i=i;
    sq.dataset.file=f;
    sq.dataset.rank=r;
    sq.dataset.alg=f+r;
    boardEl.appendChild(sq);
  }
}
buildBoard();

/* ============ Render papan ============ */
function render(legalMoves=[]){
  const B = G.board();
  const legalIdx = {};
  legalMoves.forEach(m => legalIdx[idx(m.to)] = 1);

  for(let i=0;i<64;i++){
    const sq = boardEl.children[i];
    const piece = B[i];
    sq.innerHTML='';
    sq.classList.remove('src','last','check');

    if(piece){
      const span=document.createElement('span');
      span.className='piece '+(piece.color==='w'?'white':'black');
      span.textContent=glyph(piece);
      sq.appendChild(span);
    }
    if(lastMove && lastMove.from===i) sq.classList.add('src');
    if(lastMove && lastMove.to===i) sq.classList.add('last');
    if(legalIdx[i]){ const d=document.createElement('div'); d.className='dot'; sq.appendChild(d); }
  }

  const turn=G.turn();
  const kingI=G._kingIndex(turn);
  if(G.inCheck(turn)){
    const sq=boardEl.children[kingI];
    if(sq) sq.classList.add('check');
  }

  const hist = G.history();
  $moveHistory.textContent = hist.length ? hist.join('\n') : '_';
}

/* ============ Tray bidak mati ============ */
function renderCaptures(){
  if ($capBlack){
    $capBlack.innerHTML='';
    for(const p of capturedBlack){
      const s=document.createElement('span');
      s.className='cap-piece';
      s.textContent=glyph(p);
      $capBlack.appendChild(s);
    }
  }
  if ($capWhite){
    $capWhite.innerHTML='';
    for(const p of capturedWhite){
      const s=document.createElement('span');
      s.className='cap-piece';
      s.textContent=glyph(p);
      $capWhite.appendChild(s);
    }
  }
}

/* ============ Animasi ============ */
function centerOf(el, parent){
  const r=el.getBoundingClientRect(), rp=parent.getBoundingClientRect();
  return { x:r.left - rp.left + r.width/2, y:r.top - rp.top + r.height/2 };
}
function animateMove(fromAlg, toAlg, pieceChar, done){
  try{
    const src=cellForAlg(fromAlg), dst=cellForAlg(toAlg);
    if(!src||!dst||!pieceChar){ done?.(); return; }
    const pData=G.board()[idx(toAlg)]||null;
    const colorClass=(pData&&pData.color==='b')?'anim-piece black':'anim-piece white';
    const ghost=document.createElement('span');
    ghost.className=colorClass;
    ghost.textContent=pieceChar;
    boardEl.appendChild(ghost);
    const srcP=src.querySelector('.piece'); if(srcP) srcP.style.opacity='0';
    const c1=centerOf(src,boardEl), c2=centerOf(dst,boardEl);
    ghost.style.left=`${c1.x}px`; ghost.style.top=`${c1.y}px`;
    requestAnimationFrame(()=>{ghost.style.transform=`translate(${c2.x-c1.x}px,${c2.y-c1.y}px)`;});
    const cleanup=()=>{try{ghost.remove(); if(srcP) srcP.style.opacity='';}catch{} done?.();};
    ghost.addEventListener('transitionend',cleanup,{once:true});
    setTimeout(cleanup,300);
  }catch(e){console.warn('anim error',e); done?.();}
}

/* ============ Deteksi makan bidak ============ */
function detectCapture(prev, now, from, to){
  for(let i=0;i<64;i++){
    if(prev[i] && (!now[i] || prev[i].color!==now[i].color || prev[i].piece!==now[i].piece)){
      if(i!==from && i!==to && !now[i]) return prev[i];
    }
  }
  return null;
}

/* ============ Interaksi papan ============ */
let selected=null;
boardEl.addEventListener('click', e=>{
  const sq=e.target.closest('.sq'); if(!sq) return;
  const a=sq.dataset.alg;
  const piece=G.get(idx(a));

  // kalau belum pilih
  if(!selected){
    if(!piece || piece.color!==G.turn()) return;
    selected=a;
    const legal=G.moves({square:a});
    render(legal);
    return;
  }

  // kalau klik sama, batal
  if(selected===a){ selected=null; render(); return; }

  // kalau klik ke target
  const mv=G.move({from:selected,to:a});
  if(mv){
    const prev2=JSON.parse(JSON.stringify(G.board()));
    lastMove={from:idx(selected),to:idx(a)};
    render();
    const cap=detectCapture(prev2,G.board(),idx(selected),idx(a));
    if(cap){ (cap.color==='b'?capturedBlack:capturedWhite).push(cap); renderCaptures(); }

    const st=G.gameStatus();
    if(st==='checkmate'){
      const winner=(G.turn()==='w')?'Hitam':'Putih';
      window.__azbrySetResult?.({ text:`${winner} Menang!`, subText:'Skakmat ⚔️' });
    }else if(st==='stalemate'){
      window.__azbrySetResult?.({ text:'Seri 🤝', subText:'Stalemate — tidak ada langkah sah' });
    }else if(vsAI){ aiTurn(); }
  }
  selected=null; render();
});

/* ============ AI ============ */
const AI_PROFILE={timeMs:900,maxDepth:3};
let nodes=0;

function pieceValue(p){
  const val={P:100,N:320,B:330,R:500,Q:900,K:20000}[p.piece];
  return p.color==='w'?val:-val;
}
function evaluate(){
  let sum=0; const B=G.board();
  for(const p of B){ if(p) sum+=pieceValue(p); }
  return (G.turn()==='w')?sum:-sum;
}
function negamax(depth,alpha,beta,endTime){
  if(depth===0||(performance.now()>endTime)) return evaluate();
  const moves=G.moves(); if(!moves.length) return evaluate();
  let best=-1e9;
  for(const m of moves){
    if(performance.now()>endTime) break;
    G.move(m);
    const sc=-negamax(depth-1,-beta,-alpha,endTime);
    G.undo();
    if(sc>best) best=sc;
    if(best>alpha) alpha=best;
    if(alpha>=beta) break;
  }
  return best;
}
function bestMoveWithTime(timeMs,maxDepth){
  try{
    const end=performance.now()+Math.max(100,timeMs|0);
    const root=G.moves(); if(!root.length) return null;
    let best=null,bestScore=-1e9;
    for(let d=1;d<=Math.max(1,maxDepth|0);d++){
      if(performance.now()>end) break;
      for(const m of root){
        if(performance.now()>end) break;
        G.move(m);
        const sc=-negamax(d-1,-1e9,1e9,end);
        G.undo();
        if(sc>bestScore){bestScore=sc;best=m;}
      }
    }
    return best||root[0];
  }catch(e){console.warn('AI error',e);return null;}
}

function aiTurn(){
  setTimeout(()=>{
    const m=bestMoveWithTime(AI_PROFILE.timeMs,AI_PROFILE.maxDepth);
    if(!m)return;
    const prev2=JSON.parse(JSON.stringify(G.board()));
    const pChar=glyph(G.get(idx(m.from)))||'';
    const ok=G.move(m);
    if(!ok){render();return;}
    animateMove(m.from,m.to,pChar,()=>{
      const cap2=detectCapture(prev2,G.board(),idx(m.from),idx(m.to));
      if(cap2){(cap2.color==='b'?capturedBlack:capturedWhite).push(cap2);renderCaptures();}
      lastMove={from:idx(m.from),to:idx(m.to)};
      render();
      const st=G.gameStatus();
      if(st==='checkmate'){
        const winner=(G.turn()==='w')?'Hitam':'Putih';
        window.__azbrySetResult?.({ text:`${winner} Menang!`, subText:'Skakmat ⚔️' });
      }else if(st==='stalemate'){
        window.__azbrySetResult?.({ text:'Seri 🤝', subText:'Stalemate — tidak ada langkah sah' });
      }
    });
  },100);
}

/* ============ Tombol Toolbar ============ */
document.getElementById('modeHuman').addEventListener('click',()=>{vsAI=false;});
document.getElementById('modeAI').addEventListener('click',()=>{vsAI=true;});
document.getElementById('btnFlip').addEventListener('click',()=>boardEl.classList.toggle('flipped'));
document.getElementById('btnUndo').addEventListener('click',()=>{G.undo();render();});
document.getElementById('btnRedo').addEventListener('click',()=>{G.redo();render();});
document.getElementById('btnReset').addEventListener('click',()=>{
  G.reset();
  capturedWhite.length=0;
  capturedBlack.length=0;
  renderCaptures();
  render();
});

/* ============ Inisialisasi ============ */
render();
renderCaptures();
