/* =========================================================
   Azbry Chess — main.js (PRO MAX + PST)
   - Board manual (tanpa chess-ui.js)
   - AI: negamax + alpha-beta + PST + time cutoff
   - Busy lock (anti double-move), tray bersih, animasi
   ========================================================= */

const boardEl = document.getElementById('board');
const $moveHistory = document.getElementById('moveHistory');
const $capWhite = document.getElementById('capWhite'); // putih modar (korban putih → ditaruh di tray hitam)
const $capBlack = document.getElementById('capBlack'); // hitam modar (korban hitam → ditaruh di tray putih)

let G = new Chess();

// mode
let vsAI = false;
let humanColor = 'w';
let aiColor = 'b';

// state UI
let selected = null;
let lastMove = null; // {from:idx,to:idx}
let busy = false;

// trays (disimpan sebagai objek piece {color,piece})
const capturedWhite = []; // bidak putih yang mati
const capturedBlack = []; // bidak hitam yang mati

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

/* -------------------- build board DOM -------------------- */
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

  // highlight check
  if (G.inCheck(G.turn())){
    const k = G._kingIndex(G.turn());
    boardEl.children[k]?.classList.add('check');
  }

  // history
  const hist = G.history();
  $moveHistory.textContent = hist.length ? hist.map((x,i)=> (i%2?`  → ${x}`:`${Math.floor(i/2)+1}.  ${x}`)).join('\n') : '_';
}

/* -------------------- trays -------------------- */
function renderCaptures(){
  if ($capBlack){
    $capBlack.innerHTML='';
    for(const p of capturedBlack){
      const s=document.createElement('span');
      s.className='cap-piece';
      s.textContent=pieceGlyph(p);
      $capBlack.appendChild(s);
    }
  }
  if ($capWhite){
    $capWhite.innerHTML='';
    for(const p of capturedWhite){
      const s=document.createElement('span');
      s.className='cap-piece';
      s.textContent=pieceGlyph(p);
      $capWhite.appendChild(s);
    }
  }
}

/* -------------------- animation -------------------- */
function animateMove(fromAlg, toAlg, done){
  try{
    const src = cellForAlg(fromAlg), dst = cellForAlg(toAlg);
    if (!src || !dst) { done?.(); return; }

    // warna ghost ikut piece di kotak tujuan pada state SEKARANG
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

    const cleanup = () => { try{ ghost.remove(); if (srcPiece) srcPiece.style.opacity=''; }catch{} done?.(); };
    ghost.addEventListener('transitionend', cleanup, { once:true });
    setTimeout(cleanup, 280);
  }catch(e){ console.warn('anim err', e); done?.(); }
}

/* -------------------- capture detect -------------------- */
// dibandingkan dengan papan sebelum move (prev) dan sesudah (now)
function detectCapture(prev, now, fromAlg, toAlg){
  const fi = idx(fromAlg), ti = idx(toAlg);
  const mover = prev[fi];
  const wasAtTo = prev[ti];
  // capture biasa
  if (wasAtTo && (!now[ti] || now[ti].color!==wasAtTo.color)) return wasAtTo;
  // en-passant: pion diagonal ke kotak kosong
  if (mover && mover.piece==='P' && (fi%8)!==(ti%8) && !wasAtTo){
    const capSq = ti + (mover.color==='w' ? 8 : -8);
    return prev[capSq] || null;
  }
  return null;
}



function makeMove(fromAlg, toAlg, after){
  // giliran valid?
  if (vsAI && G.turn() !== humanColor) return;

  const prev = JSON.parse(JSON.stringify(G.board()));
  // coba gerak (auto-queen)
  const ok = G.move({from:fromAlg, to:toAlg}) || G.move({from:fromAlg, to:toAlg, promotion:'Q'});
  if (!ok) { render(selected); return; }

/* -------------------- click handling (FIX: bisa ganti pilihan bidak) -------------------- */
boardEl.addEventListener('click', (e)=>{
  if (busy) return;
  const sq = e.target.closest('.sq'); 
  if (!sq) return;

  const a = sq.dataset.alg;
  const piece = G.get(idx(a));
  const sideToMove = G.turn();

  // MODE AI: player cuma bisa interaksi saat gilirannya dan untuk bidaknya sendiri
  if (vsAI && sideToMove !== humanColor) return;

  // belum ada yang dipilih -> pilih kalau bidak milik sideToMove
  if (!selected) {
    if (!piece || piece.color !== sideToMove) return;
    selected = a;
    render(a);            // highlight legal dari bidak yang dipilih
    return;
  }

  // klik petak yang sama -> batal
  if (a === selected) {
    selected = null;
    render();
    return;
  }

  // ⬇️ FIX: kalau klik bidak lain yang sewarna, ganti pilihan (bukan coba jalan)
  if (piece && piece.color === sideToMove) {
    selected = a;
    render(a);
    return;
  }

  // selain itu: coba jalankan langkah dari selected -> a
  makeMove(selected, a, ()=> {
    selected = null;
    render();
    if (vsAI) aiTurn();
  });
});
   lastMove = { from: idx(fromAlg), to: idx(toAlg) };
  // animasi dari state LAMA → ke state BARU (papan sudah berubah)
  busy = true;
  animateMove(fromAlg, toAlg, ()=>{
    // update tray
    const cap = detectCapture(prev, G.board(), fromAlg, toAlg);
    if (cap) { (cap.color==='b'?capturedBlack:capturedWhite).push(cap); renderCaptures(); }

    // render akhir
    render();

    // cek status
    const st = G.gameStatus();
    if (st==='checkmate'){
      const winner = (G.turn()==='w') ? 'Hitam' : 'Putih';
      window.__azbrySetResult?.({ text:`${winner} Menang!`, subText:'Skakmat ⚔️' });
      busy = false; after?.(); return;
    } else if (st==='stalemate'){
      window.__azbrySetResult?.({ text:'Seri 🤝', subText:'Stalemate — tidak ada langkah sah' });
      busy = false; after?.(); return;
    }
    busy = false;
    after?.();
  });
}

/* -------------------- AI with PST -------------------- */
const AI = { timeMs: 1500, maxDepth: 6, useQuiescence: true };

// material values
const VAL = { P:100, N:320, B:330, R:500, Q:900, K:0 };

// PST putih (a8..h1). Hitam → mirror vertikal.
const PST = {
  P:[0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,27,27,10,5,5, 2,2,5,25,25,5,2,2, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 0,0,0,0,0,0,0,0],
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
    const pst  = PST[p.piece][ p.color==='w' ? i : mirror(i) ];
    score += (p.color==='w'? 1 : -1) * (base + pst);
  }
  // normalisasi untuk side-to-move
  return (G.turn()==='w') ? score : -score;
}

let nodes = 0;
function qsearch(alpha, beta, deadline){
  nodes++;
  let stand = evaluate();
  if (stand >= beta) return beta;
  if (alpha < stand) alpha = stand;

  const moves = G.moves(); // ambil hanya capture
  for (const m of moves){
    if ((performance.now?.() ?? Date.now()) > deadline) break;
    const toPiece = G.board()[idx(m.to)];
    if (!toPiece) continue; // bukan capture
    if (!G.move(m)) continue;
    const sc = -qsearch(-beta, -alpha, deadline);
    G.undo();
    if (sc >= beta) return beta;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

function negamax(depth, alpha, beta, deadline){
  if ((performance.now?.() ?? Date.now()) > deadline) return evaluate();
  if (depth === 0) return AI.useQuiescence ? qsearch(alpha, beta, deadline) : evaluate();

  nodes++;
  let best = -1e9, legal = false;
  let moves = G.moves();

  // move ordering: capture & promo dulu (MVV-LVA kasar)
  moves.sort((a,b)=>{
    const A = G.board()[idx(a.to)], Bp = G.board()[idx(b.to)];
    const vA = A ? (10*VAL[A.piece] - VAL[(G.board()[idx(a.from)]||{piece:'P'}).piece]) : 0;
    const vB = Bp? (10*VAL[Bp.piece] - VAL[(G.board()[idx(b.from)]||{piece:'P'}).piece]) : 0;
    return vB - vA;
  });

  for (const m of moves){
    if ((performance.now?.() ?? Date.now()) > deadline) break;
    if (!G.move(m)) continue;
    legal = true;
    const sc = -negamax(depth-1, -beta, -alpha, deadline);
    G.undo();
    if (sc > best) best = sc;
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) break;
  }

  if (!legal){
    const st = G.gameStatus();
    if (st==='checkmate') return -999999 + depth; // prefer cepat mat
    return 0; // stalemate
  }
  return best;
}

function searchBest(timeMs, maxDepth){
  try{
    const end = (performance.now?.() ?? Date.now()) + Math.max(150, timeMs|0);
    let best=null, bestScore=-1e9;
    let roots = G.moves();
    if (!roots.length) return null;

    // iterative deepening
    for (let d=1; d<=Math.max(1, maxDepth|0); d++){
      if ((performance.now?.() ?? Date.now()) > end) break;
      let localBest = null, localScore = -1e9;

      for (const m of roots){
        if ((performance.now?.() ?? Date.now()) > end) break;
        if (!G.move(m)) continue;
        const sc = -negamax(d-1, -1e9, 1e9, end);
        G.undo();
        if (sc > localScore){ localScore=sc; localBest=m; }
      }

      if (localBest){ best=localBest; bestScore=localScore;
        // PV move to front
        roots.sort((a,b)=> (a.from===best.from && a.to===best.to) ? -1 :
                           (b.from===best.from && b.to===best.to) ? 1 : 0);
      } else break;
    }
    return best || roots[0] || null;
  }catch(e){ console.warn('AI search error', e); return null; }
}

function aiTurn(){
  if (!vsAI || G.turn() !== aiColor) return;
  if (busy) return;
  busy = true;

  setTimeout(()=>{
    const m = searchBest(AI.timeMs, AI.maxDepth);
    if (!m) { busy=false; render(); return; }
    const prev = JSON.parse(JSON.stringify(G.board()));
    const ok = G.move(m);
    if (!ok) { busy=false; render(); return; }

    lastMove = { from: idx(m.from), to: idx(m.to) };
    animateMove(m.from, m.to, ()=>{
      const cap = detectCapture(prev, G.board(), m.from, m.to);
      if (cap){ (cap.color==='b'?capturedBlack:capturedWhite).push(cap); renderCaptures(); }
      render();

      const st = G.gameStatus();
      if (st==='checkmate'){
        const winner = (G.turn()==='w') ? 'Hitam' : 'Putih';
        window.__azbrySetResult?.({ text:`${winner} Menang!`, subText:'Skakmat ⚔️' });
      } else if (st==='stalemate'){
        window.__azbrySetResult?.({ text:'Seri 🤝', subText:'Stalemate — tidak ada langkah sah' });
      }
      busy = false;
    });
  }, 10);
}

/* -------------------- toolbar -------------------- */
document.getElementById('modeHuman')?.addEventListener('click',()=>{
  if (busy) return;
  vsAI=false; humanColor='w'; aiColor='b';
  G.reset(); lastMove=null; selected=null; busy=false;
  capturedWhite.length=0; capturedBlack.length=0;
  renderCaptures(); render();
});

document.getElementById('modeAI')?.addEventListener('click',()=>{
  if (busy) return;
  vsAI=true; humanColor='w'; aiColor='b'; // player putih vs AI hitam
  G.reset(); lastMove=null; selected=null; busy=false;
  capturedWhite.length=0; capturedBlack.length=0;
  renderCaptures(); render();
  // kalau mau AI jalan dulu (AI putih): humanColor='b'; aiColor='w'; aiTurn();
});

document.getElementById('btnReset')?.addEventListener('click',()=>{
  if (busy) return;
  G.reset(); lastMove=null; selected=null; busy=false;
  capturedWhite.length=0; capturedBlack.length=0;
  renderCaptures(); render();
});

document.getElementById('btnUndo')?.addEventListener('click',()=>{
  if (busy) return;
  if (G.undo()){ lastMove=null; render(); }
});

document.getElementById('btnRedo')?.addEventListener('click',()=>{
  if (busy) return;
  if (G.redo()){ lastMove=null; render(); }
});

document.getElementById('btnFlip')?.addEventListener('click',()=>{
  if (busy) return;
  boardEl.classList.toggle('flipped');
});

/* -------------------- init -------------------- */
render();
renderCaptures();
