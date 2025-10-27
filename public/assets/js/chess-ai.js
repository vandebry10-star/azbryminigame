/* =========================================================
   Azbry Chess — chess-ai.js (Engine-agnostic "DEWA" AI)
   - API:
       const best = AzAI.getBestMove(G, {
         timeMs: 4500, qDepth: 12, nullMove: true, useTT: true,
         lmr: true, pvs: true, asp: true
       });
   - G: instance dari Chess() (chess-engine.js kamu)
   ========================================================= */
(function (global) {
  // ---------- Helpers dari engine ----------
  const FILES = "abcdefgh";
  function idx(a){ return (8 - parseInt(a.charAt(1),10)) * 8 + FILES.indexOf(a.charAt(0)); }
  function alg(i){ return FILES.charAt(i%8) + (8 - ((i/8)|0)); }

  // ---------- Default settings ----------
  const DEF = {
    timeMs: 4500,
    qDepth: 12,
    nullMove: true,
    useTT: true,
    lmr: true,
    pvs: true,
    asp: true
  };

  // ---------- Zobrist-lite ----------
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

  function positionHash(G){
    let h=0|0;
    for (let i=0;i<64;i++){
      const p=G.get(i); if(!p) continue;
      h ^= Z_KEYS[`${p.color}${p.piece}${i}`]||0;
    }
    if (G.turn()==='w') h ^= Z_KEYS.turn;
    return h>>>0;
  }

  // ---------- Evaluasi sederhana tapi tajam ----------
  const VAL = {P:100,N:320,B:330,R:500,Q:900,K:0};
  const PST = {
    P:[ 0,5,5,0,0,5,5,0,  0,10,10,5,5,10,10,0,  0,10,20,20,20,20,10,0,  5,10,10,25,25,10,10,5,  5,10,10,20,20,10,10,5,  0,10,10,0,0,10,10,0,  0,5,5,-10,-10,5,5,0,  0,0,0,0,0,0,0,0 ],
    N:[-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,5,5,0,-20,-40, -30,5,15,10,10,15,5,-30, -30,0,15,15,15,15,0,-30, -30,5,10,15,15,10,5,-30, -30,0,10,15,15,10,0,-30, -40,-20,0,0,0,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    B:[-20,-10,-10,-10,-10,-10,-10,-20, -10,5,0,0,0,0,5,-10, -10,10,10,10,10,10,10,-10, -10,0,10,10,10,10,0,-10, -10,5,5,10,10,5,5,-10, -10,0,5,10,10,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    R:[0,0,0,5,5,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 5,5,5,10,10,5,5,5, 0,0,0,0,0,0,0,0],
    Q:[-20,-10,-10,-5,-5,-10,-10,-20, -10,0,5,0,0,0,0,-10, -10,5,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,0,5,5,5,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    K:[-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-30,-30,-40,-40,-30,-30,-30, -20,-20,-20,-20,-20,-20,-20,-20, -10,-10,-10,-10,-10,-10,-10,-10, 5,5,0,0,0,0,5,5, 10,10,10,10,10,10,10,10, 20,20,20,20,20,20,20,20]
  };

  function evalBoard(G){
    let s=0, mob=0;
    for (let i=0;i<64;i++){
      const p=G.get(i); if(!p) continue;
      const k=(p.color==='w'?1:-1);
      s += k*VAL[p.piece];
      s += k*((PST[p.piece]&&PST[p.piece][i])||0);
    }
    // mobilitas kasar: beda jumlah langkah
    const me = G.moves().length;
    G.side = (G.side==='w'?'b':'w');
    const opp = G.moves().length;
    G.side = (G.side==='w'?'b':'w');
    mob = (me - opp)*2;
    s += mob;

    return (G.turn()==='w'? s : -s);
  }

  // ---------- TT / Ordering ----------
  const TT = new Map();
  function ttGet(key, depth, alpha, beta){
    const t=TT.get(key); if(!t || t.depth<depth) return null;
    if (t.flag===0) return t.score;
    if (t.flag===-1 && t.score<=alpha) return alpha;
    if (t.flag=== 1 && t.score>=beta ) return beta;
    return t.score;
  }
  function ttPut(key, depth, score, flag){ TT.set(key,{depth,score,flag}); if (TT.size>500000) TT.clear(); }

  const MVV={P:1,N:3,B:3,R:5,Q:9,K:100};
  const KILLER = Array.from({length:64},()=>[null,null]);
  const HISTORY = {};
  function keyFT(m){ 
    const f=(typeof m.from==='string'?m.from:alg(m.from));
    const t=(typeof m.to  ==='string'?m.to  :alg(m.to));
    return f+"-"+t;
  }
  function bumpHistory(m, depth){ const k=keyFT(m); HISTORY[k]=(HISTORY[k]||0)+depth*depth; }
  function pushKiller(depth, m){
    const k=keyFT(m);
    if (KILLER[depth][0]!==k){
      KILLER[depth][1]=KILLER[depth][0];
      KILLER[depth][0]=k;
    }
  }
  function isCapture(G,m){ const to=idx(m.to); return !!G.get(to); }
  function captureScore(G,m){
    const to=idx(m.to); const cap=G.get(to); if(!cap) return 0;
    const from=idx(m.from); const pc=G.get(from)||m.piece;
    return 10*MVV[cap.piece] - MVV[pc.piece||'P'];
  }

  function orderedMoves(G, depth, pvMove){
    const ms=G.moves();
    ms.forEach(m=>{
      const f=idx(m.from), t=idx(m.to);
      const P=G.get(f);
      let sc=0;
      const cap=G.get(t);
      if (pvMove && m.from===pvMove.from && m.to===pvMove.to) sc+=100000;
      if (cap) sc+=50000+captureScore(G,m);
      if (m.promotion) sc+=40000;
      const kft=keyFT(m);
      if (KILLER[depth][0]===kft) sc+=30000;
      else if (KILLER[depth][1]===kft) sc+=20000;
      sc += (HISTORY[kft]||0);
      sc += ((PST[P.piece]?.[t]||0)-(PST[P.piece]?.[f]||0));
      m.__s=sc;
    });
    ms.sort((a,b)=>b.__s-a.__s);
    return ms;
  }

  // ---------- Quiescence ----------
  function qsearch(G, alpha, beta, depth){
    const stand = evalBoard(G);
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;
    if (depth <= 0) return stand;

    const caps = G.moves().filter(m=>{
      const to=idx(m.to); return !!G.get(to) || m.promotion;
    }).sort((a,b)=> (captureScore(G,b)+(b.promotion?900:0)) - (captureScore(G,a)+(a.promotion?900:0)));

    for (const m of caps){
      const ok=G.move(m); if(!ok) continue;
      const sc = -qsearch(G, -beta, -alpha, depth-1);
      G.undo();
      if (sc>=beta) return beta;
      if (sc>alpha) alpha=sc;
    }
    return alpha;
  }

  // ---------- Alpha-Beta (PVS, LMR, Null-move, Check ext) ----------
  function alphabeta(G, depth, alpha, beta, ply, deadline, S){
    if (performance.now()>deadline) throw new Error('TIME');

    const key = S.useTT ? positionHash(G) : 0;
    const tt  = S.useTT ? ttGet(key, depth, alpha, beta) : null;
    if (tt!=null && depth>0) return tt;

    if (depth===0) return qsearch(G, alpha, beta, S.qDepth);

    // null-move (kalau tidak sedang skak)
    if (S.nullMove && depth>=3 && !G.inCheck()){
      G.side = (G.side==='w'?'b':'w');
      const score = -alphabeta(G, depth-3, -beta, -beta+1, ply+1, deadline, S);
      G.side = (G.side==='w'?'b':'w');
      if (score >= beta) return beta;
    }

    let origAlpha=alpha, best = -Infinity, bestMove=null;
    const moves = orderedMoves(G, ply, null);

    if (!moves.length){
      const st=G.gameStatus();
      if (st==='checkmate') return -99999+(50-depth);
      return 0;
    }

    let first = true;
    for (let i=0;i<moves.length;i++){
      const m = moves[i];
      const ok = G.move(m); if(!ok) continue;

      const checkExt = G.inCheck() ? 1 : 0;

      let score;
      try{
        if (S.pvs && !first){
          score = -alphabeta(G, depth-1+checkExt, -alpha-1, -alpha, ply+1, deadline, S);
          if (score > alpha && score < beta){
            score = -alphabeta(G, depth-1+checkExt, -beta, -alpha, ply+1, deadline, S);
          }
        } else {
          // LMR
          let dRed = 0;
          if (S.lmr && !isCapture(G,m) && !checkExt && depth>=3 && i>=3){
            dRed = 1;
          }
          score = -alphabeta(G, depth-1-dRed+checkExt, -beta, -alpha, ply+1, deadline, S);
          if (dRed && score > alpha){
            score = -alphabeta(G, depth-1+checkExt, -beta, -alpha, ply+1, deadline, S);
          }
        }
      }catch(e){ G.undo(); if(e.message==='TIME') throw e; throw e; }

      G.undo();
      first=false;

      if (score > best){ best = score; bestMove = m; }
      if (score > alpha){
        alpha = score;
        if (alpha >= beta){
          pushKiller(ply, m);
          if (!isCapture(G,m)) bumpHistory(m, depth);
          break;
        }
      }
    }

    let flag=0;
    if (best <= origAlpha) flag = -1;
    else if (best >= beta) flag = 1;
    if (S.useTT) ttPut(key, depth, best, flag);

    return best;
  }

  // ---------- Public API ----------
  function getBestMove(G, opt){
    const S = Object.assign({}, DEF, opt||{});
    const start=performance.now();
    const deadline=start+S.timeMs;

    let best=null, bestScore=-Infinity, depth=1;
    let alpha = -Infinity, beta = Infinity;

    try{
      while(true){
        if (S.asp && isFinite(bestScore)){
          const margin = 50;
          alpha = bestScore - margin;
          beta  = bestScore + margin;
        } else {
          alpha = -Infinity; beta = Infinity;
        }

        let localBest=null, localScore=-Infinity;
        const ms = orderedMoves(G, 0, best);
        for (const m of ms){
          const ok=G.move(m); if(!ok) continue;
          let sc;
          try{
            sc = -alphabeta(G, depth-1, -beta, -alpha, 1, deadline, S);
          }catch(e){ G.undo(); if(e.message==='TIME') throw e; throw e; }
          G.undo();
          if (sc>localScore){ localScore=sc; localBest=m; }
        }

        if (localBest){
          best = localBest; bestScore = localScore;
        }
        depth++;
      }
    }catch(e){ /* TIME */ }

    return best; // {from,to,promotion?}
  }

  global.AzAI = { getBestMove };
})(window);
