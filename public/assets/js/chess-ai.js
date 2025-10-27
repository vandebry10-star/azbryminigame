<script>
/* =========================================================
   Azbry Chess — chess-ai.js (Strong, Stable, No Null-Move)
   API: const AI = AzbryAI(G);  AI.chooseBest(timeMs) -> move | null
   ========================================================= */
function AzbryAI(G){
  // ---------- utils ----------
  const FILES="abcdefgh";
  const idx = a => (8 - parseInt(a.charAt(1),10)) * 8 + FILES.indexOf(a.charAt(0));
  const alg = i => FILES.charAt(i%8) + (8 - ((i/8)|0));

  // ---------- piece values & PST ----------
  const VAL = {P:100,N:305,B:325,R:500,Q:900,K:0};
  const PST = {
    P:[ 0,5,5,0,0,5,5,0,  0,10,10,5,5,10,10,0,  0,10,20,20,20,20,10,0,  5,10,10,25,25,10,10,5,  5,10,10,20,20,10,10,5,  0,10,10,0,0,10,10,0,  0,5,5,-10,-10,5,5,0,  0,0,0,0,0,0,0,0 ],
    N:[-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,5,5,0,-20,-40, -30,5,15,10,10,15,5,-30, -30,0,15,15,15,15,0,-30, -30,5,10,15,15,10,5,-30, -30,0,10,15,15,10,0,-30, -40,-20,0,0,0,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    B:[-20,-10,-10,-10,-10,-10,-10,-20, -10,5,0,0,0,0,5,-10, -10,10,10,10,10,10,10,-10, -10,0,10,10,10,10,0,-10, -10,5,5,10,10,5,5,-10, -10,0,5,10,10,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    R:[0,0,0,5,5,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 5,5,5,10,10,5,5,5, 0,0,0,0,0,0,0,0],
    Q:[-20,-10,-10,-5,-5,-10,-10,-20, -10,0,5,0,0,0,0,-10, -10,5,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,0,5,5,5,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    K:[-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-30,-30,-40,-40,-30,-30,-30, -20,-20,-20,-20,-20,-20,-20,-20, -10,-10,-10,-10,-10,-10,-10,-10, 5,5,0,0,0,0,5,5, 10,10,10,10,10,10,10,10, 20,20,20,20,20,20,20,20]
  };

  // ---------- zobrist lite ----------
  const Z = (()=>{ const r=()=> (Math.random()*2**32)|0; const z={};
    ['w','b'].forEach(c=>['P','N','B','R','Q','K'].forEach(p=>{
      for(let i=0;i<64;i++) z[`${c}${p}${i}`]=r();
    }));
    z.turn=r();
    return z;
  })();

  function hash(){
    let h=0|0;
    for(let i=0;i<64;i++){
      const p=G.get(i); if(!p) continue;
      h ^= (Z[`${p.color}${p.piece}${i}`]||0);
    }
    if (G.turn()==='w') h ^= Z.turn;
    return h>>>0;
  }

  // ---------- eval ----------
  function evaluate(){
    let s=0;
    for(let i=0;i<64;i++){
      const p=G.get(i); if(!p) continue;
      const sign = (p.color==='w'? 1 : -1);
      s += sign * VAL[p.piece];
      s += sign * ((PST[p.piece] && PST[p.piece][i])||0);
    }
    // score dari sisi side to move
    return (G.turn()==='w'? s : -s);
  }

  // ---------- move ordering ----------
  const MVV={P:1,N:3,B:3,R:5,Q:9,K:100};
  function captureScore(m){
    const to=idx(m.to); const cap=G.get(to); if(!cap) return 0;
    const from=idx(m.from); const pc=G.get(from)||m.piece;
    return 10*MVV[cap.piece] - MVV[pc?.piece||'P'];
  }
  function orderedMoves(){
    const ms=G.moves();
    ms.forEach(m=>{
      const f=idx(m.from), t=idx(m.to);
      const P=G.get(f);
      let sc=0;
      const cap=G.get(t);
      if (cap) sc+=1000+captureScore(m);
      if (m.promotion) sc+=900;
      sc+= ((PST[P.piece]?.[t]||0)-(PST[P.piece]?.[f]||0));
      m.__s=sc;
    });
    ms.sort((a,b)=>b.__s-a.__s);
    return ms;
  }

  // ---------- TT ----------
  const TT = new Map();
  function ttGet(key, depth, alpha, beta){
    const t=TT.get(key); if(!t || t.depth<depth) return null;
    if (t.flag===0) return t.score;
    if (t.flag===-1 && t.score<=alpha) return alpha;
    if (t.flag=== 1 && t.score>=beta ) return beta;
    return t.score;
  }
  function ttPut(key, depth, score, flag){ TT.set(key,{depth,score,flag}); }

  // ---------- quiescence ----------
  function qsearch(alpha,beta,depth,deadline){
    if (performance.now()>deadline) throw new Error('TIME');
    const stand = evaluate();
    if (stand>=beta) return beta;
    if (alpha<stand) alpha=stand;
    if (depth<=0) return stand;

    const caps = G.moves().filter(m=>{
      const to=idx(m.to); return !!G.get(to) || m.promotion;
    }).sort((a,b)=> (captureScore(b)+(b.promotion?900:0)) - (captureScore(a)+(a.promotion?900:0)));

    for (const m of caps){
      const ok=G.move(m); if(!ok) continue;
      const sc = -qsearch(-beta,-alpha,depth-1,deadline);
      G.undo();
      if (sc>=beta) return beta;
      if (sc>alpha) alpha=sc;
    }
    return alpha;
  }

  // ---------- alpha-beta (STABLE: tanpa null-move) ----------
  function alphabeta(depth,alpha,beta,deadline){
    if (performance.now()>deadline) throw new Error('TIME');

    const key = hash();
    const tt  = ttGet(key,depth,alpha,beta);
    if (tt!=null && depth>0) return tt;

    if (depth===0) return qsearch(alpha,beta,8,deadline);

    const moves=orderedMoves();
    if (!moves.length){
      const st=G.gameStatus();
      if (st==='checkmate') return -99999+(50-depth);
      return 0; // stalemate
    }

    let best=-Infinity, flag=1;
    for (const m of moves){
      const ok=G.move(m); if(!ok) continue;
      let sc;
      try{
        sc = -alphabeta(depth-1,-beta,-alpha,deadline);
      }catch(e){ G.undo(); if(e.message==='TIME') throw e; throw e; }
      G.undo();

      if (sc>best) best=sc;
      if (sc>alpha){ alpha=sc; flag=0; }
      if (alpha>=beta){ flag=-1; break; }
    }
    ttPut(key,depth,best,flag);
    return best;
  }

  function searchDepth(depth, deadline){
    let best=null, bestScore=-Infinity;
    const ms=orderedMoves();
    for (const m of ms){
      const ok=G.move(m); if(!ok) continue;
      let sc;
      try{
        sc = -alphabeta(depth-1,-Infinity,Infinity,deadline);
      }catch(e){ G.undo(); if(e.message==='TIME') throw e; throw e; }
      G.undo();
      if (sc>bestScore){ bestScore=sc; best=m; }
    }
    return {move:best, score:bestScore};
  }

  function chooseBest(timeMs){
    const start=performance.now();
    const deadline=start+timeMs;
    let best=null, depth=1;

    try{
      while(true){
        const res = searchDepth(depth, deadline);
        if (res && res.move) best=res.move;
        depth++;
      }
    }catch(e){ /* TIME reached */ }

    // Normalisasi move agar aman dipakai G.move()
    if (best && typeof best.from!=='string'){
      best = { from: alg(best.from), to: alg(best.to), promotion: best.promotion||null };
    }
    return best;
  }

  return { chooseBest };
}
</script>
