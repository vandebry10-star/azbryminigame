/* =========================================================
   Azbry Chess — chess-ai.js (Reformatted & Stable)
   Ekspor global: window.AzbryAI.think(G, {timeMs?, maxDepth?})
   - Tidak memodifikasi UI atau memanggil G.move() di luar pencarian.
   - Mengembalikan objek langkah: { from:'e2', to:'e4', promotion:null|'Q' }
   - Default: timeMs=2000, maxDepth=8 (naik-turun sesuai performa)
   ========================================================= */
(function (global) {
  "use strict";

  // ---------- Helpers ----------
  const FILES = "abcdefgh";
  function idx(a){ return (8 - parseInt(a.charAt(1),10)) * 8 + FILES.indexOf(a.charAt(0)); }
  function alg(i){ return FILES.charAt(i%8) + (8 - ((i/8)|0)); }

  // ---------- Zobrist-lite untuk Transposition Table ----------
  const Z_KEYS = (() => {
    const rnd = () => (Math.random() * 2 ** 32) | 0;
    const m = {};
    ['w','b'].forEach(c=>{
      ['P','N','B','R','Q','K'].forEach(p=>{
        for(let i=0;i<64;i++) m[`${c}${p}${i}`]=rnd();
      });
    });
    m.turn = rnd();
    return m;
  })();

  function positionHash(G){
    let h = 0|0;
    for (let i=0;i<64;i++){
      const p = G.get(i); if(!p) continue;
      h ^= Z_KEYS[`${p.color}${p.piece}${i}`] || 0;
    }
    if (G.turn()==='w') h ^= Z_KEYS.turn;
    return h>>>0;
  }

  // ---------- Evaluasi (material + PST sederhana) ----------
  const VAL = {P:100,N:305,B:325,R:500,Q:900,K:0};
  const PST = {
    // index 0..63 = a8..h1 (sama seperti engine)
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
        -10,-10,-10,-10,-10,-10,-10,-10,   5, 5, 0, 0, 0, 0, 5, 5,  10,10,10,10,10,10,10,10,  20,20,20,20,20,20,20,20]
  };

  function evalBoard(G){
    let s=0;
    for (let i=0;i<64;i++){
      const p=G.get(i); if(!p) continue;
      const k=(p.color==='w'?1:-1);
      s += k*VAL[p.piece];
      s += k*((PST[p.piece]&&PST[p.piece][i])||0);
    }
    // evaluasi dari sisi side-to-move
    return (G.turn()==='w'? s : -s);
  }

  // ---------- TT ----------
  const TT = new Map();
  function ttGet(key, depth, alpha, beta){
    const t=TT.get(key); if(!t || t.depth<depth) return null;
    if (t.flag===0) return t.score;          // exact
    if (t.flag===-1 && t.score<=alpha) return alpha; // upper bound
    if (t.flag=== 1 && t.score>=beta ) return beta;  // lower bound
    return t.score;
  }
  function ttPut(key, depth, score, flag){ TT.set(key,{depth,score,flag}); }

  // ---------- Move ordering ----------
  const MVV={P:1,N:3,B:3,R:5,Q:9,K:100};
  function captureScore(G, m){
    const to=idx(m.to); const cap=G.get(to); if(!cap) return 0;
    const from=idx(m.from); const pc=G.get(from) || m.piece; // fallback
    return 10*MVV[cap.piece] - MVV[pc.piece||'P'];
  }
  function orderedMoves(G){
    const ms=G.moves();
    ms.forEach(m=>{
      const f=idx(m.from), t=idx(m.to);
      const P=G.get(f);
      let sc=0;
      const cap=G.get(t);
      if (cap) sc+=1000+captureScore(G,m);
      if (m.promotion) sc+=900;
      sc+= ((PST[P.piece]?.[t]||0)-(PST[P.piece]?.[f]||0));
      m.__s=sc;
    });
    ms.sort((a,b)=>b.__s-a.__s);
    return ms;
  }

  // ---------- Quiescence (hanya capture/promotion) ----------
  function qsearch(G, alpha, beta, depth, deadline){
    if (performance.now() > deadline) throw new Error("TIME");
    const stand = evalBoard(G);
    if (stand>=beta) return beta;
    if (alpha<stand) alpha=stand;
    if (depth<=0) return stand;

    const caps = G.moves().filter(m=>{
      const to=idx(m.to); return !!G.get(to) || m.promotion;
    }).sort((a,b)=> (captureScore(G,b)+(b.promotion?900:0)) - (captureScore(G,a)+(a.promotion?900:0)));

    for (const m of caps){
      const ok=G.move(m); if(!ok) continue;
      const sc = -qsearch(G, -beta, -alpha, depth-1, deadline);
      G.undo();
      if (sc>=beta) return beta;
      if (sc>alpha) alpha=sc;
    }
    return alpha;
  }

  // ---------- Alpha-Beta ----------
  function alphabeta(G, depth, alpha, beta, deadline){
    if (performance.now()>deadline) throw new Error('TIME');

    const key = positionHash(G);
    const tt  = ttGet(key, depth, alpha, beta);
    if (tt!=null && depth>0) return tt;

    if (depth===0) return qsearch(G, alpha, beta, 8, deadline);

    const moves=orderedMoves(G);
    if (!moves.length){
      const st=G.gameStatus();
      if (st==='checkmate') return -99999 + (50-depth);
      return 0; // stalemate
    }

    let best=-Infinity, flag=1; // default upper bound
    for (const m of moves){
      const ok=G.move(m); if(!ok) continue;
      let sc;
      try{
        sc = -alphabeta(G, depth-1, -beta, -alpha, deadline);
      } catch(e){ G.undo(); if(e.message==='TIME') throw e; throw e; }
      G.undo();

      if (sc>best) best=sc;
      if (sc>alpha){ alpha=sc; flag=0; }  // exact
      if (alpha>=beta){ flag=-1; break; } // lower bound (cut)
    }

    ttPut(key, depth, best, flag);
    return best;
  }

  // ---------- Iterative Deepening ----------
  function searchBest(G, timeMs, maxDepth){
    const deadline = performance.now() + timeMs;
    let bestMove = null, bestScore = -Infinity;

    // gunakan urutan awal utk move pertama
    let rootMoves = orderedMoves(G);
    let d=1;
    while (true){
      // deepening
      let localBest = null, localScore = -Infinity;

      for (const m of rootMoves){
        const ok=G.move(m); if(!ok) continue;
        let sc;
        try{
          sc = -alphabeta(G, d-1, -Infinity, Infinity, deadline);
        } catch(e) {
          G.undo();
          if (e.message==='TIME') {
            // pakai hasil terbaik yang sudah ada
            return bestMove ? {move:bestMove, score:bestScore} : {move:rootMoves[0]||null, score:localScore};
          }
          throw e;
        }
        G.undo();

        // principal variation reordering
        if (sc > localScore){
          localScore = sc; localBest = m;
        }
      }

      if (localBest){
        bestMove = localBest;
        bestScore = localScore;

        // taruh PV di depan untuk kedalaman berikutnya
        rootMoves = [localBest].concat(rootMoves.filter(x => x!==localBest));
      }

      d++;
      if (d>maxDepth) break;
      if (performance.now() > deadline) break;
    }

    return { move: bestMove, score: bestScore };
  }

  // ---------- API ----------
  const AzbryAI = {
    /**
     * Hitung langkah terbaik.
     * @param {Chess} G - instance engine
     * @param {{timeMs?:number, maxDepth?:number}} cfg
     * @returns {{from:string,to:string,promotion:null|string}|null}
     */
    think(G, cfg){
      const timeMs  = (cfg && cfg.timeMs)  || 2000; // default 2s
      const maxDepth= (cfg && cfg.maxDepth)|| 8;

      // Jika tidak ada langkah legal, balikin null
      const legal = G.moves();
      if (!legal || !legal.length) return null;

      // Cari
      try{
        const { move } = searchBest(G, timeMs, maxDepth);
        if (!move) return null;

        // Normalisasi output: string algebraic
        const from = typeof move.from==='string' ? move.from : alg(move.from);
        const to   = typeof move.to  ==='string' ? move.to   : alg(move.to);
        const promotion = move.promotion || null;

        return { from, to, promotion };
      }catch(e){
        // fallback aman (ambil langkah pertama)
        const m = legal[0];
        return { from: m.from, to: m.to, promotion: m.promotion||null };
      }
    }
  };

  global.AzbryAI = AzbryAI;
})(window);
