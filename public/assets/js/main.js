/* =========================================================
   Azbry Chess — main.js (FINAL FIX + PST + SWITCH PIECE)
   ========================================================= */

const boardEl = document.getElementById('board');
const $moveHistory = document.getElementById('moveHistory');
const $capWhite = document.getElementById('capWhite');
const $capBlack = document.getElementById('capBlack');

let G = new Chess();

let vsAI = false;
let humanColor = 'w';
let aiColor = 'b';

let selected = null;
let lastMove = null;
let busy = false;

const capturedWhite = [];
const capturedBlack = [];

/* -------------------- helpers -------------------- */
const FILES = 'abcdefgh';
function idx(a){ return (8 - parseInt(a[1],10)) * 8 + FILES.indexOf(a[0]); }
function alg(i){ return FILES[i % 8] + (8 - ((i/8)|0)); }
function pieceGlyph(p){
  if(!p) return '';
  const W={P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'};
  const B={P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'};
  return p.color==='w'?W[p.piece]:B[p.piece];
}
function cellForAlg(a){ return boardEl.querySelector(`.sq[data-alg="${a}"]`); }
function centerOf(el, parent){
  const r=el.getBoundingClientRect(), rp=parent.getBoundingClientRect();
  return { x:r.left - rp.left + r.width/2, y:r.top - rp.top + r.height/2 };
}

/* -------------------- build board -------------------- */
function buildBoard(){
  boardEl.innerHTML='';
  for(let i=0;i<64;i++){
    const f = FILES[i%8], r = 8 - ((i/8)|0);
    const d = document.createElement('div');
    d.className = 'sq ' + (((i + ((i/8)|0)) % 2) ? 'dark' : 'light');
    d.dataset.i = i;
    d.dataset.file = f;
    d.dataset.rank = r;
    d.dataset.alg = f + r;
    boardEl.appendChild(d);
  }
}
buildBoard();

/* -------------------- render -------------------- */
function render(legalFromAlg=null){
  const B = G.board();
  const legalTargets = legalFromAlg ? G.moves({square:legalFromAlg}).map(m=>m.to) : [];
  const legalIdx = {};
  for(const t of legalTargets) legalIdx[idx(t)] = 1;

  for(let i=0;i<64;i++){
    const sq = boardEl.children[i];
    const P  = B[i];
    sq.innerHTML='';
    sq.classList.remove('src','last','check');
    if(P){
      const s=document.createElement('span');
      s.className='piece ' + (P.color==='w'?'white':'black');
      s.textContent=pieceGlyph(P);
      sq.appendChild(s);
    }
    if (lastMove && lastMove.from===i) sq.classList.add('src');
    if (lastMove && lastMove.to===i)   sq.classList.add('last');
    if (legalIdx[i]){ const dot=document.createElement('div'); dot.className='dot'; sq.appendChild(dot); }
  }

  if (G.inCheck(G.turn())){
    const k = G._kingIndex(G.turn());
    boardEl.children[k]?.classList.add('check');
  }

  const hist = G.history();
  $moveHistory.textContent = hist.length ? hist.map((x,i)=> (i%2?`  → ${x}`:`${Math.floor(i/2)+1}.  ${x}`)).join('\n') : '_';
}

/* -------------------- captured -------------------- */
function renderCaptures(){
  $capBlack.innerHTML='';
  for(const p of capturedBlack){
    const s=document.createElement('span');
    s.className='cap-piece';
    s.textContent=pieceGlyph(p);
    $capBlack.appendChild(s);
  }
  $capWhite.innerHTML='';
  for(const p of capturedWhite){
    const s=document.createElement('span');
    s.className='cap-piece';
    s.textContent=pieceGlyph(p);
    $capWhite.appendChild(s);
  }
}

/* -------------------- animation -------------------- */
function animateMove(fromAlg, toAlg, done){
  try{
    const src = cellForAlg(fromAlg), dst = cellForAlg(toAlg);
    if (!src || !dst) { done?.(); return; }

    const pNow = G.board()[idx(toAlg)];
    const ghost = document.createElement('span');
    ghost.className = 'anim-piece ' + (pNow && pNow.color==='b' ? 'black' : 'white');
    ghost.textContent = pieceGlyph(pNow) || '♟';
    boardEl.appendChild(ghost);

    const srcPiece = src.querySelector('.piece');
    if (srcPiece) srcPiece.style.opacity = '0';

    const c1 = centerOf(src, boardEl), c2 = centerOf(dst, boardEl);
    ghost.style.left = `${c1.x}px`; ghost.style.top = `${c1.y}px`;
    requestAnimationFrame(()=>{ ghost.style.transform = `translate(${c2.x-c1.x}px, ${c2.y-c1.y}px)`; });

    const cleanup = () => { ghost.remove(); if (srcPiece) srcPiece.style.opacity=''; done?.(); };
    ghost.addEventListener('transitionend', cleanup, { once:true });
    setTimeout(cleanup, 300);
  }catch{ done?.(); }
}

/* -------------------- capture detect -------------------- */
function detectCapture(prev, now, fromAlg, toAlg){
  const fi = idx(fromAlg), ti = idx(toAlg);
  const mover = prev[fi];
  const wasAtTo = prev[ti];
  if (wasAtTo && (!now[ti] || now[ti].color!==wasAtTo.color)) return wasAtTo;
  if (mover && mover.piece==='P' && (fi%8)!==(ti%8) && !wasAtTo){
    const capSq = ti + (mover.color==='w' ? 8 : -8);
    return prev[capSq] || null;
  }
  return null;
}

/* -------------------- click handling (FIX) -------------------- */
boardEl.addEventListener('click', (e)=>{
  if (busy) return;
  const sq = e.target.closest('.sq'); 
  if (!sq) return;

  const a = sq.dataset.alg;
  const piece = G.get(idx(a));
  const sideToMove = G.turn();

  if (vsAI && sideToMove !== humanColor) return;

  // belum pilih apa-apa
  if (!selected) {
    if (!piece || piece.color !== sideToMove) return;
    selected = a; render(a);
    return;
  }

  // klik petak sama = batal
  if (a === selected) { selected=null; render(); return; }

  // klik bidak sewarna = ganti pilihan
  if (piece && piece.color === sideToMove) {
    selected = a; render(a); return;
  }

  // eksekusi langkah
  makeMove(selected, a, ()=>{
    selected = null; render();
    if (vsAI) aiTurn();
  });
});

/* -------------------- move exec -------------------- */
function makeMove(fromAlg, toAlg, after){
  if (vsAI && G.turn() !== humanColor) return;
  const prev = JSON.parse(JSON.stringify(G.board()));
  const ok = G.move({from:fromAlg, to:toAlg}) || G.move({from:fromAlg, to:toAlg, promotion:'Q'});
  if (!ok) { render(selected); return; }
  lastMove = { from: idx(fromAlg), to: idx(toAlg) };
  busy = true;
  animateMove(fromAlg, toAlg, ()=>{
    const cap = detectCapture(prev, G.board(), fromAlg, toAlg);
    if (cap) { (cap.color==='b'?capturedBlack:capturedWhite).push(cap); renderCaptures(); }
    render();
    const st = G.gameStatus();
    if (st==='checkmate'){
      const winner = (G.turn()==='w') ? 'Hitam' : 'Putih';
      window.__azbrySetResult?.({ text:`${winner} Menang!`, subText:'Skakmat ⚔️' });
    } else if (st==='stalemate'){
      window.__azbrySetResult?.({ text:'Seri 🤝', subText:'Stalemate — tidak ada langkah sah' });
    }
    busy=false; after?.();
  });
}

/* -------------------- AI (PST) -------------------- */
const AI = { timeMs:1500, maxDepth:6, useQuiescence:true };
const VAL = {P:100,N:320,B:330,R:500,Q:900,K:0};
const PST = {
  P:[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,27,27,10,5,5,2,2,5,25,25,5,2,2,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,0,0,0,0,0,0,0,0],
  N:[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,5,5,0,-20,-40,-30,5,10,15,15,10,5,-30,-30,0,15,20,20,15,0,-30,-30,5,15,20,20,15,5,-30,-30,0,10,15,15,10,0,-30,-40,-20,0,0,0,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
  B:[-20,-10,-10,-10,-10,-10,-10,-20,-10,5,0,0,0,0,5,-10,-10,10,10,10,10,10,10,-10,-10,0,10,10,10,10,0,-10,-10,5,5,10,10,5,5,-10,-10,0,5,10,10,5,0,-10,-10,0,0,0,0,0,0,-10,-20,-10,-10,-10,-10,-10,-10,-20],
  R:[0,0,5,10,10,5,0,0,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,5,10,10,10,10,10,10,5,0,0,0,0,0,0,0,0],
  Q:[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,0,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
  K:[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20]
};
function mirror(i){ return (7 - ((i/8)|0))*8 + (i%8); }

function evaluate(){
  const B = G.board(); let score = 0;
  for(let i=0;i<64;i++){
    const p = B[i]; if(!p) continue;
    const base = VAL[p.piece];
    const pst = PST[p.piece][ p.color==='w' ? i : mirror(i) ];
    score += (p.color==='w'?1:-1)*(base+pst);
  }
  return (G.turn()==='w') ? score : -score;
}

function negamax(depth,alpha,beta,deadline){
  if((performance.now?.()??Date.now())>deadline) return evaluate();
  if(depth===0) return evaluate();
  let best=-1e9;
  const moves=G.moves();
  for(const m of moves){
    if((performance.now?.()??Date.now())>deadline) break;
    if(!G.move(m)) continue;
    const sc=-negamax(depth-1,-beta,-alpha,deadline);
    G.undo();
    if(sc>best) best=sc;
    if(sc>alpha) alpha=sc;
    if(alpha>=beta) break;
  }
  return best;
}

function searchBest(timeMs,maxDepth){
  const end=(performance.now?.()??Date.now())+timeMs;
  let best=null,bestScore=-1e9;
  const roots=G.moves();
  for(let d=1;d<=maxDepth;d++){
    for(const m of roots){
      if((performance.now?.()??Date.now())>end) break;
      if(!G.move(m)) continue;
      const sc=-negamax(d-1,-1e9,1e9,end);
      G.undo();
      if(sc>bestScore){bestScore=sc;best=m;}
    }
    if((performance.now?.()??Date.now())>end) break;
  }
  return best;
}

function aiTurn(){
  if(!vsAI||G.turn()!==aiColor||busy) return;
  busy=true;
  setTimeout(()=>{
    const m=searchBest(AI.timeMs,AI.maxDepth);
    if(!m){busy=false;render();return;}
    const prev=JSON.parse(JSON.stringify(G.board()));
    G.move(m);
    lastMove={from:idx(m.from),to:idx(m.to)};
    animateMove(m.from,m.to,()=>{
      const cap=detectCapture(prev,G.board(),m.from,m.to);
      if(cap){(cap.color==='b'?capturedBlack:capturedWhite).push(cap);renderCaptures();}
      render();
      const st=G.gameStatus();
      if(st==='checkmate'){
        const winner=(G.turn()==='w')?'Hitam':'Putih';
        window.__azbrySetResult?.({text:`${winner} Menang!`,subText:'Skakmat ⚔️'});
      }else if(st==='stalemate'){
        window.__azbrySetResult?.({text:'Seri 🤝',subText:'Stalemate — tidak ada langkah sah'});
      }
      busy=false;
    });
  },10);
}

/* -------------------- toolbar -------------------- */
document.getElementById('modeHuman')?.addEventListener('click',()=>{
  if(busy)return;
  vsAI=false;humanColor='w';aiColor='b';
  G.reset();lastMove=null;selected=null;busy=false;
  capturedWhite.length=0;capturedBlack.length=0;
  renderCaptures();render();
});

document.getElementById('modeAI')?.addEventListener('click',()=>{
  if(busy)return;
  vsAI=true;humanColor='w';aiColor='b';
  G.reset();lastMove=null;selected=null;busy=false;
  capturedWhite.length=0;capturedBlack.length=0;
  renderCaptures();render();
});

document.getElementById('btnReset')?.addEventListener('click',()=>{
  if(busy)return;
  G.reset();lastMove=null;selected=null;busy=false;
  capturedWhite.length=0;capturedBlack.length=0;
  renderCaptures();render();
});

document.getElementById('btnUndo')?.addEventListener('click',()=>{
  if(busy)return;
  if(G.undo()){lastMove=null;render();}
});

document.getElementById('btnRedo')?.addEventListener('click',()=>{
  if(busy)return;
  if(G.redo()){lastMove=null;render();}
});

document.getElementById('btnFlip')?.addEventListener('click',()=>{
  if(busy)return;
  boardEl.classList.toggle('flipped');
});

/* -------------------- init -------------------- */
render();
renderCaptures();
