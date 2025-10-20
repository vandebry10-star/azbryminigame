// ================================
// AZBRY CHESS ENGINE (ESM)
// ================================

/*
  Representasi:
  - Papan: array 64 (0..63), rank 8..1 dari atas ke bawah (a8 index 0).
  - Bidak: { t:'p|n|b|r|q|k', c:'w|b' }
  - Warna: 'w' putih, 'b' hitam.
  - Koordinat algebraic: 'a1'..'h8'
*/

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w";

const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const DIRS = {
  n: [-17, -15, -10, -6, 6, 10, 15, 17], // knight (pakai grid 8x8 guard)
};

function inBounds(i){ return i>=0 && i<64; }
function file(i){ return i % 8; }
function rank(i){ return Math.floor(i/8); }
function sameFile(a,b){ return file(a)===file(b); }
function sameRank(a,b){ return rank(a)===rank(b); }

function idxFromAlg(alg){
  const f = alg.charCodeAt(0)-97; // a->0
  const r = parseInt(alg[1],10)-1; // 1 -> 0
  return (7-r)*8 + f;
}
function algFromIdx(i){
  const f = String.fromCharCode(97 + (i%8));
  const r = 8 - Math.floor(i/8);
  return f + r;
}

// ---------------- Game ----------------

export function createGame(fen = START_FEN){
  const [rows, side] = fen.split(" ");
  const board = new Array(64).fill(null);
  let r = 0, c = 0;
  for (const ch of rows){
    if (ch === "/"){ r++; c = 0; continue; }
    if (/\d/.test(ch)){ c += parseInt(ch,10); continue; }
    const color = ch === ch.toUpperCase() ? 'w' : 'b';
    const t = ch.toLowerCase();
    board[r*8 + c] = { t, c: color };
    c++;
  }
  return {
    board,
    turn: side || 'w',
    history: [],
    future: [],
    winner: null,
    draw: false,
    // opsional flags (castling/en-passant) bisa ditambah kelak
  };
}

export function cloneState(s){
  return {
    board: s.board.map(p=>p?{...p}:null),
    turn: s.turn,
    history: s.history.slice(),
    future: s.future.slice(),
    winner: s.winner,
    draw: s.draw,
  };
}

export function getTurn(s){ return s.turn; }
export function getBoard(s){ return s.board; }

// ---------- Move generation ----------

function pushMove(moves, from, to, capture=false, promo=null){
  moves.push({ from, to, capture, promo });
}

function genPawn(s, i, moves){
  const p = s.board[i];
  const dir = p.c === 'w' ? -1 : 1;
  const startRank = p.c === 'w' ? 6 : 1;
  const r = rank(i), f = file(i);

  // maju 1
  const fwd1 = i + dir*8;
  if (inBounds(fwd1) && !s.board[fwd1]){
    // promosi
    if ((p.c==='w' && rank(fwd1)===0) || (p.c==='b' && rank(fwd1)===7)){
      for (const promo of ['q','r','b','n']) pushMove(moves,i,fwd1,false,promo);
    } else pushMove(moves, i, fwd1);
    // maju 2
    const fwd2 = i + dir*16;
    if (rank(i)===startRank && !s.board[fwd2] && !s.board[fwd1]){
      pushMove(moves, i, fwd2);
    }
  }
  // makan kiri/kanan
  for (const df of [-1, 1]){
    const nf = f + df;
    if (nf<0 || nf>7) continue;
    const to = i + dir*8 + df;
    if (!inBounds(to)) continue;
    const tgt = s.board[to];
    if (tgt && tgt.c !== p.c){
      // promosi
      if ((p.c==='w' && rank(to)===0) || (p.c==='b' && rank(to)===7)){
        for (const promo of ['q','r','b','n']) pushMove(moves,i,to,true,promo);
      } else pushMove(moves, i, to, true);
    }
  }
  // (en-passant belum diaktifkan di versi ini)
}

function ray(s, i, df, dr, moves, color){
  let f=file(i), r=rank(i);
  while (true){
    f+=df; r+=dr;
    if (f<0||f>7||r<0||r>7) break;
    const to = r*8 + f;
    if (!s.board[to]){ pushMove(moves, i, to); continue; }
    if (s.board[to].c !== color){ pushMove(moves, i, to, true); }
    break;
  }
}

function genMovesForIndex(s, i){
  const p = s.board[i];
  if (!p) return [];
  const moves = [];
  switch (p.t){
    case 'p':
      genPawn(s,i,moves);
      break;
    case 'n': {
      for (const d of DIRS.n){
        const to = i + d;
        if (!inBounds(to)) continue;
        // guard tepi papan knight
        const df = Math.abs(file(to)-file(i));
        const dr = Math.abs(rank(to)-rank(i));
        if (!((df===1 && dr===2) || (df===2 && dr===1))) continue;
        const tgt = s.board[to];
        if (!tgt || tgt.c!==p.c) pushMove(moves, i, to, !!tgt);
      }
      break;
    }
    case 'b':
      ray(s,i,1,1,moves,p.c);
      ray(s,i,1,-1,moves,p.c);
      ray(s,i,-1,1,moves,p.c);
      ray(s,i,-1,-1,moves,p.c);
      break;
    case 'r':
      ray(s,i,1,0,moves,p.c);
      ray(s,i,-1,0,moves,p.c);
      ray(s,i,0,1,moves,p.c);
      ray(s,i,0,-1,moves,p.c);
      break;
    case 'q':
      ray(s,i,1,0,moves,p.c); ray(s,i,-1,0,moves,p.c);
      ray(s,i,0,1,moves,p.c); ray(s,i,0,-1,moves,p.c);
      ray(s,i,1,1,moves,p.c); ray(s,i,1,-1,moves,p.c);
      ray(s,i,-1,1,moves,p.c); ray(s,i,-1,-1,moves,p.c);
      break;
    case 'k': {
      for (let df=-1; df<=1; df++){
        for (let dr=-1; dr<=1; dr++){
          if (df===0 && dr===0) continue;
          const nf=file(i)+df, nr=rank(i)+dr;
          if (nf<0||nf>7||nr<0||nr>7) continue;
          const to=nr*8+nf;
          const tgt=s.board[to];
          if (!tgt || tgt.c!==p.c) pushMove(moves,i,to,!!tgt);
        }
      }
      // (castling belum diaktifkan di versi ini)
      break;
    }
  }
  return moves;
}

export function generateMoves(s){
  const side = s.turn;
  let pseudo = [];
  for (let i=0;i<64;i++){
    const p = s.board[i];
    if (p && p.c===side){
      const mv = genMovesForIndex(s,i);
      for (const m of mv) pseudo.push(m);
    }
  }
  // saring yang bikin raja sendiri terserang
  const legal = [];
  for (const m of pseudo){
    const ns = cloneState(s);
    makeMoveNoRecord(ns,m);
    if (!isKingAttacked(ns, side)) legal.push(m);
  }
  return legal;
}

// ---------- Checks ----------

function locateKing(s, color){
  for (let i=0;i<64;i++){
    const p=s.board[i];
    if (p && p.t==='k' && p.c===color) return i;
  }
  return -1;
}

function squaresAttackedBy(s, color){
  // generate pseudo moves semua bidak color tanpa filter self-check
  const attacks = new Set();
  for (let i=0;i<64;i++){
    const p=s.board[i];
    if (!p || p.c!==color) continue;
    const mv=genMovesForIndex(s,i);
    for (const m of mv) attacks.add(m.to);
  }
  return attacks;
}

function isKingAttacked(s, color){
  const k = locateKing(s,color);
  if (k<0) return true; // safety
  const opp = color==='w'?'b':'w';
  const att = squaresAttackedBy(s,opp);
  return att.has(k);
}

export function inCheck(s, color=s.turn){
  return isKingAttacked(s,color);
}

export function isCheckmate(s){
  if (!inCheck(s,s.turn)) return false;
  const legal = generateMoves(s);
  return legal.length===0;
}

export function isStalemate(s){
  if (inCheck(s,s.turn)) return false;
  const legal = generateMoves(s);
  return legal.length===0;
}

// ---------- Make/Undo ----------

function makeMoveNoRecord(s, m){
  const piece = s.board[m.from];
  // promosi
  if (m.promo){
    s.board[m.to] = { t:m.promo, c: piece.c };
    s.board[m.from] = null;
  } else {
    s.board[m.to] = piece;
    s.board[m.from] = null;
  }
  s.turn = s.turn==='w'?'b':'w';
}

export function makeMove(s, m){
  const before = {
    board: s.board.map(p=>p?{...p}:null),
    turn: s.turn,
  };
  makeMoveNoRecord(s,m);
  s.history.push(before);
  s.future.length = 0;

  // set status akhir
  s.winner = null; s.draw = false;
  if (isCheckmate(s)){
    s.winner = s.turn==='w' ? 'b' : 'w'; // karena turn sudah dibalik
  } else if (isStalemate(s)){
    s.draw = true;
  }
}

export function undo(s){
  if (!s.history.length) return false;
  const prev = s.history.pop();
  s.future.push({ board:s.board.map(p=>p?{...p}:null), turn:s.turn });
  s.board = prev.board;
  s.turn = prev.turn;
  s.winner = null; s.draw = false;
  return true;
}

export function redo(s){
  if (!s.future.length) return false;
  const next = s.future.pop();
  s.history.push({ board:s.board.map(p=>p?{...p}:null), turn:s.turn });
  s.board = next.board;
  s.turn = next.turn;
  s.winner = null; s.draw = false;
  return true;
}

// ---------- Evaluation & AI ----------

function evaluate(s){
  // material simple
  let score = 0;
  for (const p of s.board){
    if (!p) continue;
    score += (p.c==='w' ? 1 : -1) * (PIECE_VALUE[p.t]||0);
  }
  return score;
}

function minimax(s, depth, alpha, beta, maximizing){
  if (depth===0){
    return { score: evaluate(s) };
  }
  if (isCheckmate(s)){
    // jika checkmate saat turn s.turn, maka side lawan menang
    const val = s.turn==='w' ? -Infinity : Infinity;
    return { score: val };
  }
  if (isStalemate(s)) return { score: 0 };

  const moves = generateMoves(s);
  if (moves.length===0){
    // redundan, sudah di-handle di atas, tapi jaga-jaga
    return { score: evaluate(s) };
  }

  let best = null;

  if (maximizing){
    let bestScore = -Infinity;
    for (const m of moves){
      const ns = cloneState(s);
      makeMoveNoRecord(ns,m);
      const val = minimax(ns, depth-1, alpha, beta, false).score;
      if (val > bestScore){ bestScore = val; best = m; }
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return { score: bestScore, move: best };
  } else {
    let bestScore = Infinity;
    for (const m of moves){
      const ns = cloneState(s);
      makeMoveNoRecord(ns,m);
      const val = minimax(ns, depth-1, alpha, beta, true).score;
      if (val < bestScore){ bestScore = val; best = m; }
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return { score: bestScore, move: best };
  }
}

export function aiBestMove(s, depth=2){
  // AI jalan untuk side s.turn (anggap putih = maximizing)
  const maximizing = s.turn==='w';
  const { move } = minimax(s, depth, -Infinity, Infinity, maximizing);
  return move || null;
}

// ---------- Helpers untuk UI ----------

export function legalMovesFrom(s, fromIdx){
  const legal = generateMoves(s);
  return legal.filter(m => m.from === fromIdx);
}

export function tryMoveAlg(s, fromAlg, toAlg, promo=null){
  const from = idxFromAlg(fromAlg);
  const to = idxFromAlg(toAlg);
  const legal = generateMoves(s).find(m => m.from===from && m.to===to && (m.promo? m.promo===promo : true));
  if (!legal) return false;
  makeMove(s, legal);
  return true;
}

export function getStatus(s){
  if (s.winner) return { type:"mate", winner: s.winner };
  if (s.draw) return { type:"draw" };
  if (inCheck(s)) return { type:"check", turn: s.turn };
  return { type:"running", turn: s.turn };
}

export function algebraic(i){ return algFromIdx(i); }
export function indexOfAlg(a){ return idxFromAlg(a); }
