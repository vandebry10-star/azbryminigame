/* =====================================================
   Azbry Chess Engine — Offline Standalone (based on chess.js)
   Compatible with main.js and chess-ui.js
   ===================================================== */

(function (global) {
  function Chess(fen) {
    const WHITE = 'w';
    const BLACK = 'b';
    const EMPTY = -1;

    let board = new Array(128);
    let kings = { w: EMPTY, b: EMPTY };
    let turn = WHITE;
    let move_history = [];
    let redo_stack = [];

    const piece_map = {
      p: 'pawn',
      n: 'knight',
      b: 'bishop',
      r: 'rook',
      q: 'queen',
      k: 'king'
    };

    function clear() {
      board.fill(null);
      kings = { w: EMPTY, b: EMPTY };
      move_history = [];
      redo_stack = [];
      turn = WHITE;
    }

    function reset() {
      load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w');
    }

    function load(fenStr) {
      clear();
      const parts = fenStr.split(/\s+/);
      const rows = parts[0].split('/');
      let sq = 0;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          const p = rows[r][c];
          if (isNaN(p)) {
            const color = p === p.toUpperCase() ? WHITE : BLACK;
            const piece = p.toLowerCase();
            const index = (7 - r) * 8 + c;
            put({ type: piece, color }, index);
          } else {
            sq += parseInt(p) - 1;
          }
          sq++;
        }
      }
      turn = parts[1] || WHITE;
    }

    function put(piece, index) {
      board[index] = piece;
      if (piece.type === 'k') kings[piece.color] = index;
    }

    function get(square) {
      return board[square];
    }

    function moves(opts = {}) {
      const legal = [];
      for (let i = 0; i < 64; i++) {
        const p = board[i];
        if (!p || p.color !== turn) continue;
        const squareName = algebraic(i);
        if (opts.square && opts.square !== squareName) continue;
        // very simple: only pawns and knights
        if (p.type === 'p') {
          const dir = p.color === WHITE ? 8 : -8;
          const fwd = i + dir;
          if (!board[fwd]) legal.push({ from: squareName, to: algebraic(fwd) });
        }
        if (p.type === 'n') {
          const deltas = [33, 31, 18, 14, -33, -31, -18, -14];
          for (let d of deltas) {
            const target = i + d;
            if (onBoard(target)) {
              const t = board[target];
              if (!t || t.color !== p.color)
                legal.push({ from: squareName, to: algebraic(target) });
            }
          }
        }
      }
      return legal;
    }

    function move(mv) {
      const list = moves({ square: mv.from });
      const found = list.find(m => m.to === mv.to);
      if (!found) return null;
      const from = algebraicToIndex(mv.from);
      const to = algebraicToIndex(mv.to);
      const piece = board[from];
      const captured = board[to];
      board[to] = piece;
      board[from] = null;
      redo_stack = [];
      move_history.push({ from, to, piece, captured });
      turn = turn === WHITE ? BLACK : WHITE;
      return { from: mv.from, to: mv.to, color: piece.color, captured };
    }

    function undo() {
      const last = move_history.pop();
      if (!last) return null;
      redo_stack.push(last);
      board[last.from] = last.piece;
      board[last.to] = last.captured;
      turn = turn === WHITE ? BLACK : WHITE;
      return last;
    }

    function redo() {
      const next = redo_stack.pop();
      if (!next) return null;
      board[next.to] = next.piece;
      board[next.from] = null;
      move_history.push(next);
      turn = turn === WHITE ? BLACK : WHITE;
      return next;
    }

    function turnOf() {
      return turn;
    }

    function in_checkmate() { return false; }
    function in_stalemate() { return false; }
    function in_draw() { return false; }

    function fen() {
      let out = '';
      for (let r = 7; r >= 0; r--) {
        let empty = 0;
        for (let c = 0; c < 8; c++) {
          const sq = r * 8 + c;
          const p = board[sq];
          if (!p) empty++;
          else {
            if (empty) { out += empty; empty = 0; }
            out += p.color === WHITE ? p.type.toUpperCase() : p.type;
          }
        }
        if (empty) out += empty;
        if (r) out += '/';
      }
      return out + ' ' + turn;
    }

    function algebraic(i) {
      const file = 'abcdefgh'[i % 8];
      const rank = Math.floor(i / 8) + 1;
      return file + rank;
    }

    function algebraicToIndex(sq) {
      const file = 'abcdefgh'.indexOf(sq[0]);
      const rank = parseInt(sq[1], 10) - 1;
      return rank * 8 + file;
    }

    function onBoard(i) {
      return i >= 0 && i < 64;
    }

    // API export
    return {
      reset, load, move, moves, undo, redo, turn: turnOf,
      in_checkmate, in_stalemate, in_draw, fen
    };
  }

  // export global
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Chess;
  } else {
    global.Chess = Chess;
  }
})(typeof window !== "undefined" ? window : global);
