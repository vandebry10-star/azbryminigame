/* ===========================================================
   AZBRY CHESS ENGINE — STABLE VERSION (Offline, 100% local)
   =========================================================== */

(function (global) {
  function Chess(fen) {
    let board = new Array(128);
    let kings = { w: 0, b: 0 };
    let turn = 'w';
    let history = [];
    let half_moves = 0;
    let move_number = 1;
    let castling = { K: true, Q: true, k: true, q: true };
    let ep_square = -1;
    let fen_history = [];

    const EMPTY = -1;
    const WHITE = 'w';
    const BLACK = 'b';
    const SYMBOLS = 'pnbrqkPNBRQK';
    const RANK_1 = 7, RANK_8 = 0;

    const PAWN_OFFSETS = { w: [-16, -32, -17, -15], b: [16, 32, 15, 17] };
    const PIECE_OFFSETS = {
      n: [-18, -33, -31, -14, 18, 33, 31, 14],
      b: [-17, -15, 17, 15],
      r: [-16, 1, 16, -1],
      q: [-17, -16, -15, -1, 1, 15, 16, 17],
      k: [-17, -16, -15, -1, 1, 15, 16, 17],
    };
    const ATTACKS = [
      17, 16, 15, 1, -1, -15, -16, -17
    ];

    const SQUARES = {};
    const FILES = 'abcdefgh';
    const RANKS = '12345678';
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = FILES[f] + RANKS[r];
        SQUARES[sq] = (r << 4) + f;
      }
    }

    function clear() {
      board = new Array(128).fill(null);
      kings = { w: EMPTY, b: EMPTY };
      turn = WHITE;
      castling = { K: false, Q: false, k: false, q: false };
      ep_square = EMPTY;
      half_moves = 0;
      move_number = 1;
      history = [];
      fen_history = [];
    }

    function load(fenStr) {
      clear();
      const tokens = fenStr.split(/\s+/);
      const rows = tokens[0].split('/');
      let sq = 0;
      for (let i = 0; i < 8; i++) {
        const row = rows[i];
        for (const c of row) {
          if (/\d/.test(c)) {
            sq += parseInt(c, 10);
          } else {
            const color = c === c.toUpperCase() ? WHITE : BLACK;
            put({ type: c.toLowerCase(), color }, algebraic(119 - sq));
            sq++;
          }
        }
      }
      turn = tokens[1] || 'w';
      if (tokens[2]) {
        for (const flag of tokens[2]) castling[flag] = true;
      }
      if (tokens[3] && tokens[3] !== '-') ep_square = SQUARES[tokens[3]];
      return true;
    }

    function put(piece, square) {
      if (!('type' in piece && 'color' in piece)) return false;
      board[SQUARES[square]] = { type: piece.type, color: piece.color };
      if (piece.type === 'k') kings[piece.color] = SQUARES[square];
      return true;
    }

    function get(square) {
      return board[SQUARES[square]] || null;
    }

    function algebraic(i) {
      const f = i & 15, r = i >> 4;
      return FILES[f] + RANKS[7 - r];
    }

    function moves(opts = {}) {
      const moves = [];
      const us = turn, them = swap_color(us);
      for (let i = 0; i < 128; i++) {
        if (i & 0x88) { i += 7; continue; }
        const piece = board[i];
        if (!piece || piece.color !== us) continue;

        if (piece.type === 'p') {
          const dir = us === 'w' ? -16 : 16;
          const rank = us === 'w' ? 6 : 1;
          const start = us === 'w' ? RANK_2 : RANK_7;
          const to = i + dir;
          if (!board[to]) {
            add_move(i, to);
            const to2 = i + 2 * dir;
            if ((i >> 4) === start && !board[to2]) add_move(i, to2);
          }
          for (const off of [dir - 1, dir + 1]) {
            const t = i + off;
            if (t & 0x88) continue;
            if (board[t] && board[t].color === them) add_move(i, t);
          }
        } else {
          for (const offset of PIECE_OFFSETS[piece.type]) {
            let t = i;
            while (true) {
              t += offset;
              if (t & 0x88) break;
              const target = board[t];
              if (!target) add_move(i, t);
              else {
                if (target.color === them) add_move(i, t);
                break;
              }
              if (piece.type === 'n' || piece.type === 'k') break;
            }
          }
        }
      }

      function add_move(from, to) {
        moves.push({
          from: algebraic(from),
          to: algebraic(to),
          color: us,
        });
      }
      return moves;
    }

    function move(obj) {
      const moveList = moves({ square: obj.from });
      const found = moveList.find(m => m.to === obj.to);
      if (!found) return null;
      const piece = get(obj.from);
      board[SQUARES[obj.to]] = piece;
      board[SQUARES[obj.from]] = null;
      turn = swap_color(turn);
      history.push(obj);
      return obj;
    }

    function swap_color(c) { return c === 'w' ? 'b' : 'w'; }

    function fen() {
      let out = '';
      for (let r = 0; r < 8; r++) {
        let empty = 0;
        for (let f = 0; f < 8; f++) {
          const sq = (7 - r) * 16 + f;
          const p = board[sq];
          if (p) {
            if (empty) { out += empty; empty = 0; }
            out += p.color === 'w' ? p.type.toUpperCase() : p.type;
          } else empty++;
        }
        if (empty) out += empty;
        if (r < 7) out += '/';
      }
      return `${out} ${turn} - - 0 1`;
    }

    function reset() {
      load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');
    }

    function history_verbose() {
      return history.map(h => ({ from: h.from, to: h.to }));
    }

    return {
      load, reset, fen, move, moves,
      get, put, turn: () => turn,
      history: () => history_verbose(),
      undo: () => history.pop(),
      in_checkmate: () => false,
      in_stalemate: () => false,
      in_draw: () => false,
      game_over: () => false,
    };
  }

  global.Chess = Chess;
})(typeof window !== 'undefined' ? window : globalThis);
