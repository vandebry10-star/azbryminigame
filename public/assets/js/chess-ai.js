/* =========================================================
   Azbry Chess — chess-ai.js (AI Module)
   ========================================================= */
function createAzbryAI(G, cfg){
  const AI = Object.assign({ timeMs:1500, qDepth:8, useTT:true }, cfg||{});

  // --- Zobrist-lite ---
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

  const VAL = {P:100,N:305,B:325,R:500,Q:900,K:0};
  const PST = {
    P:[ 0,5,5,0,0,5,5,0, 0,10,10,5,5,10,10,0, 0,10,20,20,20,20,10,0, 5,10,10,25,25,10,10,5, 5,10,10,20,20,10,10,5, 0,10,10,0,0,10,10,0, 0,5,5,-10,-10,5,5,0, 0,0,0,0,0,0,0,0],
    N:[-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,5,5,0,-20,-40, -30,5,15,10,10,15,5,-30, -30,0,15,15,15,15,0,-30, -30,5,10,15,15,10,5,-30, -30,0,10,15,15,10,0,-30, -40,-20,0,0,0,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    B:[-20,-10,-10,-10,-10,-10,-10,-20, -10,5,0,0,0,0,5,-10, -10,10,10,10,10,10,10,-10, -10,0,10,10,10,10,0,-10, -10,5,5,10,10,5,5,-10, -10,0,5,10,10,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    R:[0,0,0,5,5,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 5,5,5,10,10,5,5,5, 0,0,0,0,0,0,0,0],
    Q:[-20,-10,-10,-5,-5,-10,-10,-20, -10,0,5,0,0,0,0,-10, -10,5,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,0,5,5,5,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    K:[-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-30,-30,-40,-40,-30,-30,-30, -20,-20,-20,-20,-20,-20,-20,-20, -10,-10,-10,-10,-10,-10,-10,-10, 5,5,0,0,0,0,5,5, 10,10,10,10,10,10,10,10, 20,20,20,20,20,20,20,20]
  };

  const TT = new Map();
  const FILES = "abcdefgh";
  const MVV={P:1,N:3,B:3,R:5,Q:9,K:100};
  const idx = a => (8 - parseInt(a.charAt(1),10)) * 8 + FILES.indexOf(a.charAt(0));

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

  function captureScore(m){
    const to=idx(m.to); const cap=G.get(to); if(!cap) return 0;
    const from=idx(m.from); const pc=G.get(from)||m.piece;
    return 10*MVV[cap.piece] - MVV[pc.piece||'P'];
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
    const tt  = AI.useTT ? TT.get(key) : null;
    if (tt && tt.depth>=depth) return tt.score;

    if (depth===0) return qsearch(alpha,beta,AI.qDepth);

    let best=-Infinity;
    const moves=orderedMoves();
    if (!moves.length){
      const st=G.gameStatus();
      if (st==='checkmate') return -99999+(50-depth);
      return 0;
    }

    for (const m of moves){
      const ok=G.move(m); if(!ok) continue;
      let sc;
      try{
        sc = -alphabeta(depth-1,-beta,-alpha,deadline);
      }catch(e){ G.undo(); if(e.message==='TIME') throw e; throw e; }
      G.undo();
      if (sc>best) best=sc;
      if (sc>alpha) alpha=sc;
      if (alpha>=beta) break;
    }
    if (AI.useTT) TT.set(key,{depth,score:best});
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
      while(true){
        const res = searchDepth(depth, deadline);
        if (res && res.move) best=res.move;
        depth++;
      }
    }catch(e){ /* TIME */ }
    return best;
  }

  return { thinkOnce };
}
