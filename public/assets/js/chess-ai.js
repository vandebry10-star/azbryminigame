/* =========================================================
   Azbry Chess — chess-ai.js
   Modul AI murni (tanpa DOM). Dipakai oleh main.js
   API:
     const ai = createAzbryAI(G, {timeMs?:1500, qDepth?:8, useTT?:true});
     const best = ai.thinkOnce(timeMs?); // -> move {from,to,promotion?} | null
   ========================================================= */
function createAzbryAI(G, cfg){
  const AI = Object.assign({ timeMs:1500, qDepth:8, useTT:true }, cfg||{});

  // Zobrist-lite
  const Z_KEYS = (() => {
    const rnd = () => (Math.random() * 2 ** 32) | 0;
    const m = {};
    ['w','b'].forEach(c=>{
      ['P','N','B','R','Q','K'].forEach(p=>{
        for(let i=0;i<64;i++) m[`${c}${p}${i}`]=rnd();
      });
    });
    m.turn=rnd();
    return m;
  })();

  function positionHash(){
    let h=0|0;
    for (let i=0;i<64;i++){
      const p=G.get(i); if(!p) continue;
      h ^= Z_KEYS[`${p.color}${p.piece}${i}`]||0;
    }
    if (G.turn()==='w') h ^= Z_KEYS.turn;
    return h>>>0;
  }

  // piece values + PST
  const VAL = {P:100,N:305,B:325,R:500,Q:900,K:0};
  const PST = {
    P:[ 0,5,5,0,0,5,5,0,  0,10,10,5,5,10,10,0,  0,10,20,20,20,20,10,0,  5,10,10,25,25,10,10,5,  5,10,10,20,20,10,10,5,  0,10,10,0,0,10,10,0,  0,5,5,-10,-10,5,5,0,  0,0,0,0,0,0,0,0 ],
    N:[-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,5,5,0,-20,-40, -30,5,15,10,10,15,5,-30, -30,0,15,15,15,15,0,-30, -30,5,10,15,15,10,5,-30, -30,0,10,15,15,10,0,-30, -40,-20,0,0,0,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    B:[-20,-10,-10,-10,-10,-10,-10,-20, -10,5,0,0,0,0,5,-10, -10,10,10,10,10,10,10,-10, -10,0,10,10,10,10,0,-10, -10,5,5,10,10,5,5,-10, -10,0,5,10,10,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    R:[0,0,0,5,5,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 5,5,5,10,10,5,5,5, 0,0,0,0,0,0,0,0],
    Q:[-20,-10,-10,-5,-5,-10,-10,-20, -10,0,5,0,0,0,0,-10, -10,5,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,0,5,5,5,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    K:[-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-30,-30,-40,-40,-30,-30,-30, -20,-20,-20,-20,-20,-20,-20,-20, -10,-10,-10,-10,-10,-10,-10,-10, 5,5,0,0,0,0,5,5, 10,10,10,10,10,10,10,10, 20,20,20,20,20,20,20,20]
  };

  const MVV={P:1,N:3,B:3,R:5,Q:9,K:100};

  const TT = new Map();
  function ttGet(key, depth, alpha, beta){
    const t=TT.get(key); if(!t || t.depth<depth) return null;
    if (t.flag===0) return t.score;
    if (t.flag===-1 && t.score<=alpha) return alpha;
    if (t.flag=== 1 && t.score>=beta ) return beta;
    return t.score;
  }
  function ttPut(key, depth, score, flag){ TT.set(key,{depth,score,flag}); }

  function evalBoard(){
    let s=0;
    for (let i=0;i<64;i++){
      const p=G.get(i); if(!p) continue;
      const k=(p.color==='w'?1:-1);
      s += k*VAL[p.piece];
      s += k*((PST[p.piece]&&PST[p.piece][i])||0);
    }
    return (G.turn()==='w'? s : -s);
  }

  const FILES = "abcdefgh";
  function idx(a){ return (8 - parseInt(a.charAt(1),10)) * 8 + FILES.indexOf(a.charAt(0)); }

  function captureScore(m){
    const to = idx(m.to);
    const cap= G.get(to);
    if(!cap) return 0;
    const from= idx(m.from);
    const pc = G.get(from) || m.piece; // fallback
    return 10*(MVV[cap.piece]||0) - (MVV[pc.piece||'P']||0);
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

  function qsearch(alpha,beta,depth){
    const stand = evalBoard();
    if (stand>=beta) return beta;
    if (alpha<stand) alpha=stand;
    if (depth<=0) return stand;

    const caps = G.moves().filter(m=>{
      const to=idx(m.to); return !!G.get(to) || m.promotion;
    }).sort((a,b)=> (captureScore(b)+(b.promotion?900:0)) - (captureScore(a)+(a.promotion?900:0)));

    for (const m of caps){
      const ok=G.move(m); if(!ok) continue;
      const sc = -qsearch(-beta,-alpha,depth-1);
      G.undo();
      if (sc>=beta) return beta;
      if (sc>alpha) alpha=sc;
    }
    return alpha;
  }

  function alphabeta(depth,alpha,beta,deadline){
    if (performance.now()>deadline) throw new Error('TIME');

    const key = AI.useTT ? positionHash() : 0;
    const tt  = AI.useTT ? ttGet(key,depth,alpha,beta) : null;
    if (tt!=null && depth>0) return tt;

    if (depth===0) return qsearch(alpha,beta,AI.qDepth);

    let best=-Infinity, flag=1;
    const moves=orderedMoves();
    if (!moves.length){
      const st=(typeof G.gameStatus==='function') ? G.gameStatus() : 'ok';
      if (st==='checkmate') return -99999+(50-depth);
      return 0; // stalemate
    }

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
    if (AI.useTT) ttPut(key,depth,best,flag);
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

  function thinkOnce(timeOverrideMs){
    const timeMs = timeOverrideMs || AI.timeMs;
    const start=performance.now();
    const deadline=start+timeMs;

    let best=null, depth=1;
    try{
      // iterative deepening sampai waktu habis
      while(true){
        const res = searchDepth(depth, deadline);
        if (res && res.move){ best=res.move; }
        depth++;
      }
    }catch(e){ /* TIME */ }
    return best;
  }

  return { thinkOnce };
}
