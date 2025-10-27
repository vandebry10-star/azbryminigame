/* =========================================================
   Azbry Chess — chess-ai.js (FULL, Stabil, Kuat)
   Public API:
     window.AzbryAI.chooseMove(G, { timeMs?: number })
   - G = instance dari Chess (chess-engine.js kamu)
   - return { from, to, promotion? } (algebraic: 'e2','e4', dll)
   ========================================================= */
(function (global) {
  'use strict';

  // ---------- Utils ----------
  var FILES = "abcdefgh";
  function idx(a){ return (8 - parseInt(a.charAt(1),10)) * 8 + FILES.indexOf(a.charAt(0)); }
  function alg(i){ return FILES.charAt(i%8) + (8 - ((i/8)|0)); }

  function normalizeMove(m){
    // pastikan move berbentuk algebraic {from:'e2', to:'e4', promotion?}
    var from = (typeof m.from==='number') ? alg(m.from) : m.from;
    var to   = (typeof m.to  ==='number') ? alg(m.to)   : m.to;
    var out = { from: from, to: to };
    if (m.promotion) out.promotion = m.promotion;
    return out;
  }

  // ---------- Zobrist (hash posisi) ----------
  var ZKEYS = (function(){
    function rnd(){ return (Math.random()*0xFFFFFFFF)>>>0; }
    var z={}, colors=['w','b'], pcs=['P','N','B','R','Q','K'];
    for (var c=0;c<colors.length;c++){
      for (var p=0;p<pcs.length;p++){
        for (var i=0;i<64;i++){
          z[colors[c]+pcs[p]+i] = rnd();
        }
      }
    }
    z.turn = rnd();
    return z;
  })();

  function hashPosition(G){
    var B = G.board();
    var h = 0|0;
    for (var i=0;i<64;i++){
      var P = B[i];
      if (!P) continue;
      h ^= (ZKEYS[P.color + P.piece + i] || 0);
    }
    if (G.turn()==='w') h ^= ZKEYS.turn;
    return h>>>0;
  }

  // ---------- Evaluasi (material + PST + mobilitas ringan) ----------
  var VAL = {P:100,N:305,B:325,R:500,Q:900,K:0};
  var PST = {
    P:[ 0,5,5,0,0,5,5,0,  0,10,10,5,5,10,10,0,  0,10,20,20,20,20,10,0,  5,10,10,25,25,10,10,5,  5,10,10,20,20,10,10,5,  0,10,10,0,0,10,10,0,  0,5,5,-10,-10,5,5,0,  0,0,0,0,0,0,0,0 ],
    N:[-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,5,5,0,-20,-40, -30,5,15,10,10,15,5,-30, -30,0,15,15,15,15,0,-30, -30,5,10,15,15,10,5,-30, -30,0,10,15,15,10,0,-30, -40,-20,0,0,0,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    B:[-20,-10,-10,-10,-10,-10,-10,-20, -10,5,0,0,0,0,5,-10, -10,10,10,10,10,10,10,-10, -10,0,10,10,10,10,0,-10, -10,5,5,10,10,5,5,-10, -10,0,5,10,10,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    R:[0,0,0,5,5,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 0,0,0,10,10,0,0,0, 5,5,5,10,10,5,5,5, 0,0,0,0,0,0,0,0],
    Q:[-20,-10,-10,-5,-5,-10,-10,-20, -10,0,5,0,0,0,0,-10, -10,5,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,0,5,5,5,5,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    K:[-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-30,-30,-40,-40,-30,-30,-30, -20,-20,-20,-20,-20,-20,-20,-20, -10,-10,-10,-10,-10,-10,-10,-10, 5,5,0,0,0,0,5,5, 10,10,10,10,10,10,10,10, 20,20,20,20,20,20,20,20]
  };

  // skor cepat: + untuk white, - untuk black; dikonversi ke side-to-move di akhir
  function evalBoard(G){
    var B = G.board(), sum=0, i, P, k;
    for (i=0;i<64;i++){
      P=B[i]; if(!P) continue;
      k = (P.color==='w'? 1 : -1);
      sum += k*VAL[P.piece];
      if (PST[P.piece]) sum += k*PST[P.piece][i];
    }
    // mobilitas ringan
    var ms = G.moves();
    var mob = ms.length * 2;
    sum += (G.turn()==='w' ? mob : -mob);

    // konversi ke sudut pandang side-to-move (STM)
    return (G.turn()==='w' ? sum : -sum);
  }

  // ---------- Transposition Table ----------
  var TT = new Map(); // key -> {depth, score, flag(0=exact,-1=upper,1=lower), best?: move}
  function ttGet(key, depth, alpha, beta){
    var t = TT.get(key);
    if (!t || t.depth < depth) return null;
    if (t.flag===0) return t;                 // exact
    if (t.flag===-1 && t.score <= alpha) return t; // upper bound
    if (t.flag=== 1 && t.score >= beta ) return t; // lower bound
    return t;
  }
  function ttPut(key, depth, score, flag, best){
    TT.set(key, {depth:depth, score:score, flag:flag, best:best||null});
  }

  // ---------- Move ordering ----------
  var MVV={P:1,N:3,B:3,R:5,Q:9,K:100};
  function captureScore(G, m){
    var toI = idx(m.to);
    var cap = G.get(toI);
    if (!cap) return 0;
    var fromI = idx(m.from);
    var pc = G.get(fromI);
    var a = 10 * (MVV[cap.piece]||0) - (MVV[pc && pc.piece || 'P']||0);
    return a;
  }

  function orderedMoves(G, ttMove){
    var ms = G.moves();
    for (var i=0;i<ms.length;i++){
      var m = ms[i], fI=idx(m.from), tI=idx(m.to), P=G.get(fI), cap=G.get(tI);
      var sc = 0;
      if (ttMove && m.from===ttMove.from && m.to===ttMove.to && (m.promotion||null)===(ttMove.promotion||null)) sc += 50000;
      if (cap) sc += 1000 + captureScore(G, m);
      if (m.promotion) sc += 900;
      if (P && PST[P.piece]) sc += (PST[P.piece][tI] - PST[P.piece][fI]);
      m.__s = sc;
    }
    ms.sort(function(a,b){ return (b.__s|0) - (a.__s|0); });
    return ms;
  }

  // ---------- Quiescence ----------
  function qsearch(G, alpha, beta, depthLeft, deadline){
    if (performance.now()>deadline) throw new Error('TIME');
    var stand = evalBoard(G);
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;
    if (depthLeft<=0) return stand;

    // hanya tangkap & promosi untuk menstabilkan evaluasi
    var ms = G.moves().filter(function(m){
      var toI = idx(m.to);
      return !!G.get(toI) || !!m.promotion;
    });
    // urutkan capture paling baik dulu
    ms.sort(function(a,b){
      var sa = captureScore(G,a)+(a.promotion?900:0);
      var sb = captureScore(G,b)+(b.promotion?900:0);
      return sb-sa;
    });

    for (var i=0;i<ms.length;i++){
      var ok = G.move(ms[i]);
      if (!ok) continue;
      var sc = -qsearch(G, -beta, -alpha, depthLeft-1, deadline);
      G.undo();
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  // ---------- Alpha-Beta (tanpa null-move -> stabil) ----------
  function alphabeta(G, depth, alpha, beta, deadline){
    if (performance.now()>deadline) throw new Error('TIME');

    var key = hashPosition(G);
    var t = ttGet(key, depth, alpha, beta);
    var ttBest = t && t.best ? normalizeMove(t.best) : null;
    if (t && depth>0){
      // bisa langsung pakai score dari TT jika cukup
      if (t.flag===0 || t.flag===-1 || t.flag===1) return t.score;
    }

    if (depth === 0) {
      return qsearch(G, alpha, beta, 8, deadline); // qDepth=8
    }

    var bestScore = -Infinity, bestMove = null, flag = -1; // -1 = upper bound, 0 = exact, 1 = lower
    var moves = orderedMoves(G, ttBest);

    if (!moves.length){
      var st = G.gameStatus();
      if (st==='checkmate') return -99999;  // STM no legal -> mate
      return 0; // stalemate
    }

    for (var i=0;i<moves.length;i++){
      var ok = G.move(moves[i]);
      if (!ok) continue;
      var sc;
      try {
        sc = -alphabeta(G, depth-1, -beta, -alpha, deadline);
      } catch(e){
        G.undo();
        if (e && e.message==='TIME') throw e;
        throw e;
      }
      G.undo();

      if (sc > bestScore){
        bestScore = sc;
        bestMove = moves[i];
      }
      if (sc > alpha){
        alpha = sc;
        flag = 0;             // exact
      }
      if (alpha >= beta){
        flag = 1;             // lower bound
        break;
      }
    }

    ttPut(key, depth, bestScore, flag, bestMove&&normalizeMove(bestMove));
    return bestScore;
  }

  // ---------- Iterative deepening ----------
  function searchBest(G, timeMs){
    var start = performance.now();
    var deadline = start + (timeMs||3000);

    var bestMove = null, bestScore = -Infinity, depth = 1;

    // simpang PV dari TT untuk ordering makin baik
    while (true){
      if (performance.now()>deadline) break;
      try{
        var moves = orderedMoves(G, null); // seed awal
        var localBest = null, localScore = -Infinity;
        for (var i=0;i<moves.length;i++){
          var ok = G.move(moves[i]);
          if (!ok) continue;
          var sc = -alphabeta(G, depth-1, -Infinity, Infinity, deadline);
          G.undo();
          if (sc > localScore){
            localScore = sc;
            localBest = moves[i];
          }
          if (performance.now()>deadline) break;
        }
        if (localBest){
          bestMove = localBest;
          bestScore = localScore;
        }
        depth++;
      }catch(e){
        // habis waktu -> pakai best yang terakhir diketahui
        break;
      }
    }

    return bestMove ? normalizeMove(bestMove) : null;
  }

  // ---------- Public API ----------
  global.AzbryAI = {
    /**
     * Pilih langkah terbaik untuk sisi yang sedang jalan.
     * @param {Chess} G
     * @param {{timeMs?:number}} opts
     * @returns {{from:string,to:string,promotion?:string}|null}
     */
    chooseMove: function(G, opts){
      try{
        // safety: jika tidak ada langkah, return null
        var ms = G.moves();
        if (!ms || !ms.length) return null;

        // waktu cari
        var t = (opts && opts.timeMs!=null) ? opts.timeMs : 5000; // default 5 detik
        // flush TT biar tidak bawa-bawa posisi lama antar game panjang
        TT.clear();

        var best = searchBest(G, t);
        if (best) return best;

        // fallback: langkah pertama legal (tidak blunder berat, tapi pasti legal)
        return normalizeMove(ms[0]);
      }catch(e){
        // emergency fallback
        var mms = G.moves();
        return mms && mms.length ? normalizeMove(mms[0]) : null;
      }
    }
  };

})(window);
