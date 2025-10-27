/* =========================================================
   Azbry Chess — chess-ai.js (Stabil, no double move)
   - Alpha-Beta + Quiescence + Transposition Table
   - Tanpa null-move pruning (lebih stabil)
   - Iterative deepening sampai batas waktu
   ========================================================= */
const AZBRY_AI = (function(){
  // ===== Config =====
  const VAL = {P:100,N:305,B:325,R:500,Q:900,K:0};
  const MVV = {P:1,N:3,B:3,R:5,Q:9,K:100};
  const PST = {
    P:[ 0,5,5,0,0,5,5,0,  0,10,10,5,5,10,10,0,  0,10,20,20,20,20,10,0,  5,10,10,25,25,10,10,5,
        5,10,10,20,20,10,10,5,  0,10,10,0,0,10,10,0,  0,5,5,-10,-10,5,5,0,  0,0,0,0,0,0,0,0 ],
    N:[-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,5,5,0,-20,-40, -30,5,15,10,10,15,5,-30, -30,0,15,15,15,15,0,-30,
       -30,5,10,15,15,10,5,-30, -30,0,10,15,15,10,0,-30, -40,-20,0,0,0,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    B:[-20,-10,-10,-10,-10,-10,-10,-20, -10,5,0,0,0,0,5,-10, -10,10,10,10,10,10,10,-10, -10,0,10,10,10,10,0,-10,
       -10,5,5,10,10,5,5,-10, -10,0,5,10,10,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    R:[0,0,0,5,5,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0,
       0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 5,5,5,10,10,5,5,5, 0,0,0,0,0,0,0,0],
    Q:[-20,-10,-10,-5,-5,-10,-10,-20, -10,0,5,0,0,0,0,-10, -10,5,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
       0,0,5,5,5,5,0,-5, -10,0,5,5,5,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    K:[-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-30,-30,-40,-40,-30,-30,-30, -20,-20,-20,-20,-20,-20,-20,-20,
       -10,-10,-10,-10,-10,-10,-10,-10, 5,5,0,0,0,0,5,5, 10,10,10,10,10,10,10,10, 20,20,20,20,20,20,20,20]
  };

  // Zobrist-lite buat TT
  const Z = (() => {
    const rnd = () => (Math.random()*2**32)|0;
    const m={};
    ['w','b'].forEach(c=>{
      ['P','N','B','R','Q','K'].forEach(p=>{
        for(let i=0;i<64;i++) m[`${c}${p}${i}`]=rnd();
      });
    });
    m.turn=rnd();
    return m;
  })();

  const FILES = "abcdefgh";
  const sqToIndex = (s) => (8-+s[1])*8 + FILES.indexOf(s[0]);

  function posHash(G){
    let h=0|0;
    for (let i=0;i<64;i++){
      const p=G.get(i); if(!p) continue;
      h ^= (Z[`${p.color}${p.piece}${i}`]||0);
    }
    if (G.turn()==='w') h ^= Z.turn;
    return h>>>0;
  }

  function evalBoard(G){
    let s=0;
    for (let i=0;i<64;i++){
      const p=G.get(i); if(!p) continue;
      const k=(p.color==='w'?1:-1);
      s += k*VAL[p.piece];
      s += k*((PST[p.piece]&&PST[p.piece][i])||0);
    }
    return (G.turn()==='w'? s : -s);
  }

  function capScore(G, m){
    const toIndex = typeof m.to==='string' ? sqToIndex(m.to) : m.to;
    const cap = G.get(toIndex);
    if (!cap) return 0;
    const fromIndex = typeof m.from==='string' ? sqToIndex(m.from) : m.from;
    const atk = G.get(fromIndex);
    return 10*(MVV[cap.piece]||0) - (MVV[atk?.piece]||1);
  }

  function orderedMoves(G){
    const ms = G.moves();
    ms.forEach(m=>{
      let sc = 0;
      const fi = typeof m.from==='string'? sqToIndex(m.from):m.from;
      const ti = typeof m.to  ==='string'? sqToIndex(m.to)  :m.to;
      const P = G.get(fi);
      const cap = G.get(ti);
      if (cap) sc += 1000 + capScore(G,m);
      if (m.promotion) sc += 900;
      if (P && PST[P.piece]) sc += (PST[P.piece][ti] - PST[P.piece][fi]);
      m.__s = sc;
    });
    ms.sort((a,b)=>b.__s - a.__s);
    return ms;
  }

  function qsearch(G, alpha, beta, depthQ){
    const stand = evalBoard(G);
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;
    if (depthQ <= 0) return stand;

    const caps = G.moves().filter(m=>{
      const ti = typeof m.to==='string'? sqToIndex(m.to):m.to;
      return !!G.get(ti) || m.promotion;
    }).sort((a,b)=> capScore(G,b) - capScore(G,a));

    for (const m of caps){
      const ok = G.move(m); if(!ok) continue;
      const sc = -qsearch(G, -beta, -alpha, depthQ-1);
      G.undo();
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  function alphabeta(G, depth, alpha, beta, deadline, TT){
    if (performance.now() > deadline) throw 1; // TIME

    if (depth === 0) return qsearch(G, alpha, beta, 8);

    const key = posHash(G);
    const t = TT.get(key);
    if (t && t.depth >= depth){
      if (t.flag === 0) return t.score;
      if (t.flag === -1 && t.score <= alpha) return alpha;
      if (t.flag ===  1 && t.score >= beta ) return beta;
    }

    const moves = orderedMoves(G);
    if (!moves.length){
      const st = G.gameStatus();
      if (st==='checkmate') return -99999 + (50 - depth);
      return 0;
    }

    let best = -Infinity, flag = 1;
    for (const m of moves){
      const ok = G.move(m); if(!ok) continue;
      let sc;
      try{
        sc = -alphabeta(G, depth-1, -beta, -alpha, deadline, TT);
      } finally {
        G.undo();
      }
      if (sc > best) best = sc;
      if (sc > alpha){ alpha = sc; flag = 0; }
      if (alpha >= beta){ flag = -1; break; }
    }
    TT.set(key, {depth, score: best, flag});
    return best;
  }

  async function findBestMove(G, {timeMs=2000, maxDepth=10}={}){
    const start = performance.now();
    const deadline = start + timeMs;
    const TT = new Map();

    let bestMove = null;
    let bestScore = -Infinity;

    try{
      for (let depth=1; depth<=maxDepth; depth++){
        let localBest = null, localBestScore = -Infinity;
        const moves = orderedMoves(G);
        for (const m of moves){
          const ok = G.move(m); if(!ok) continue;
          let sc;
          try{
            sc = -alphabeta(G, depth-1, -Infinity, Infinity, deadline, TT);
          } finally {
            G.undo();
          }
          if (sc > localBestScore){ localBestScore = sc; localBest = m; }
          if (performance.now() > deadline) throw 1; // TIME
        }
        if (localBest){ bestMove = localBest; bestScore = localBestScore; }
      }
    }catch(_t){ /* timeout, pakai best so far */ }

    // Sisa waktu → tunggu agar terasa “mikir”
    const left = deadline - performance.now();
    if (left > 0) await new Promise(r=>setTimeout(r, left));

    return bestMove;
  }

  return { findBestMove };
})();
