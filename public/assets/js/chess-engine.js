/* ==============================
 *  AZBRY CHESS – ENGINE (CORE)
 *  Feb 2025
 *  Fitur: basic legal move, check & checkmate, promotion
 *  ============================== */

window.boardState = [];        // 8x8 array of {type,color,symbol,hasMoved}
const W = "white", B = "black";

const SYMBOLS = {
  white: { king:"♔", queen:"♕", rook:"♖", bishop:"♗", knight:"♘", pawn:"♙" },
  black: { king:"♚", queen:"♛", rook:"♜", bishop:"♝", knight:"♞", pawn:"♟" },
};

function piece(type, color) {
  return { type, color, symbol: SYMBOLS[color][type], hasMoved: false };
}

function inBounds(x, y) { return x >= 0 && x < 8 && y >= 0 && y < 8; }

function cloneBoard(b = boardState) {
  return b.map(row => row.map(p => (p ? { ...p } : null)));
}

function initBoard() {
  // Empty
  boardState = Array.from({ length: 8 }, () => Array(8).fill(null));

  // Black (top, y=0,1)
  boardState[0] = [
    piece("rook", B), piece("knight", B), piece("bishop", B), piece("queen", B),
    piece("king", B), piece("bishop", B), piece("knight", B), piece("rook", B),
  ];
  boardState[1] = Array(8).fill(null).map(() => piece("pawn", B));

  // White (bottom, y=7,6)
  boardState[7] = [
    piece("rook", W), piece("knight", W), piece("bishop", W), piece("queen", W),
    piece("king", W), piece("bishop", W), piece("knight", W), piece("rook", W),
  ];
  boardState[6] = Array(8).fill(null).map(() => piece("pawn", W));
}

/* ------- PSEUDO MOVES (tanpa filter check) ------- */
function rayMoves(board, x, y, dirs) {
  const res = [];
  const me = board[y][x];
  for (const [dx, dy] of dirs) {
    let nx = x + dx, ny = y + dy;
    while (inBounds(nx, ny)) {
      const t = board[ny][nx];
      if (!t) {
        res.push([nx, ny]);
      } else {
        if (t.color !== me.color) res.push([nx, ny]);
        break;
      }
      nx += dx; ny += dy;
    }
  }
  return res;
}

function pseudoMoves(board, x, y) {
  const res = [];
  const p = board[y][x];
  if (!p) return res;

  const forward = p.color === W ? -1 : 1;
  const startRank = p.color === W ? 6 : 1;
  const promoRank = p.color === W ? 0 : 7;

  switch (p.type) {
    case "pawn": {
      const f1y = y + forward;
      if (inBounds(x, f1y) && !board[f1y][x]) {
        res.push([x, f1y]);
        const f2y = y + 2 * forward;
        if (y === startRank && !board[f2y][x]) res.push([x, f2y]);
      }
      // captures
      for (const dx of [-1, 1]) {
        const nx = x + dx, ny = y + forward;
        if (!inBounds(nx, ny)) continue;
        const t = board[ny][nx];
        if (t && t.color !== p.color) res.push([nx, ny]);
      }
      // (en passant belum)
      break;
    }
    case "knight": {
      const jumps = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
      for (const [dx, dy] of jumps) {
        const nx = x+dx, ny = y+dy;
        if (!inBounds(nx, ny)) continue;
        const t = board[ny][nx];
        if (!t || t.color !== p.color) res.push([nx, ny]);
      }
      break;
    }
    case "bishop":
      return rayMoves(board, x, y, [[1,1],[-1,1],[1,-1],[-1,-1]]);
    case "rook":
      return rayMoves(board, x, y, [[1,0],[-1,0],[0,1],[0,-1]]);
    case "queen":
      return rayMoves(board, x, y, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]);
    case "king": {
      for (let dx=-1; dx<=1; dx++) for (let dy=-1; dy<=1; dy++) {
        if (dx===0 && dy===0) continue;
        const nx=x+dx, ny=y+dy;
        if (!inBounds(nx,ny)) continue;
        const t=board[ny][nx];
        if (!t || t.color!==p.color) res.push([nx,ny]);
      }
      // (castling belum)
      break;
    }
  }
  return res;
}

/* ------- CHECK & LEGAL FILTER ------- */
function findKing(board, color) {
  for (let yy=0; yy<8; yy++) for (let xx=0; xx<8; xx++) {
    const p = board[yy][xx];
    if (p && p.type==="king" && p.color===color) return [xx, yy];
  }
  return null;
}

function isSquareAttacked(board, x, y, byColor) {
  // cek semua buah lawan: kalau pseudo move-nya menyentuh (x,y) → attacked
  for (let yy=0; yy<8; yy++) for (let xx=0; xx<8; xx++) {
    const p = board[yy][xx];
    if (!p || p.color !== byColor) continue;

    // khusus pion: serangan diagonal saja
    if (p.type === "pawn") {
      const forward = p.color === W ? -1 : 1;
      for (const dx of [-1, 1]) {
        const nx = xx + dx, ny = yy + forward;
        if (nx === x && ny === y) {
          // valid jika dalam papan dan ada target (untuk serangan ke raja kita, cukup arah serang)
          if (inBounds(nx, ny)) return true;
        }
      }
      continue;
    }

    const list = pseudoMoves(board, xx, yy);
    if (list.some(([mx, my]) => mx === x && my === y)) return true;
  }
  return false;
}

function isCheck(board, color) {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  const [kx, ky] = kingPos;
  const opp = color === W ? B : W;
  return isSquareAttacked(board, kx, ky, opp);
}

function applyMove(board, from, to) {
  const nb = cloneBoard(board);
  const [fx, fy] = from, [tx, ty] = to;
  const p = nb[fy][fx];
  nb[fy][fx] = null;
  if (p) p.hasMoved = true;
  nb[ty][tx] = p;

  // promotion
  if (p && p.type === "pawn") {
    const promoRank = p.color === W ? 0 : 7;
    if (ty === promoRank) {
      p.type = "queen";
      p.symbol = SYMBOLS[p.color]["queen"];
    }
  }
  return nb;
}

function getLegalMoves(x, y, board = boardState) {
  const p = board[y][x];
  if (!p) return [];
  const raw = pseudoMoves(board, x, y);
  const legal = [];

  for (const mv of raw) {
    const nb = applyMove(board, [x, y], mv);
    if (!isCheck(nb, p.color)) legal.push(mv);
  }
  return legal;
}

function hasAnyLegalMoves(color, board = boardState) {
  for (let y=0; y<8; y++) for (let x=0; x<8; x++) {
    const p = board[y][x];
    if (p && p.color === color) {
      if (getLegalMoves(x, y, board).length) return true;
    }
  }
  return false;
}

/* ------- PUBLIC API dipakai UI ------- */
function makeMove(from, to, turnColor) {
  const [fx, fy] = from, [tx, ty] = to;
  const p = boardState[fy][fx];
  if (!p || p.color !== turnColor) return false;

  const legal = getLegalMoves(fx, fy, boardState);
  if (!legal.some(([mx, my]) => mx === tx && my === ty)) return false;

  boardState = applyMove(boardState, from, to);

  // status akhir (optional – bisa dipakai UI)
  const opp = turnColor === W ? B : W;
  const check = isCheck(boardState, opp);
  const mate  = check && !hasAnyLegalMoves(opp, boardState);
  const stalemate = !check && !hasAnyLegalMoves(opp, boardState);

  window.__lastStatus = { check, mate, stalemate, turnColor, next: opp };
  return true;
}

function getGameStatus(forColor) {
  // Convenience untuk UI polling status
  const check = isCheck(boardState, forColor);
  const mate = check && !hasAnyLegalMoves(forColor, boardState);
  const stalemate = !check && !hasAnyLegalMoves(forColor, boardState);
  return { check, mate, stalemate };
}

// Expose ke global
window.initBoard = initBoard;
window.getLegalMoves = getLegalMoves;
window.makeMove = makeMove;
window.getGameStatus = getGameStatus;
