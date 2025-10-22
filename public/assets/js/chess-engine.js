/* ===========================================================
   AZBRY CHESS ENGINE — v3-slim (offline, 0x88 board)
   Cukup untuk main lokal + AI random. Lengkap: gerak legal dasar.
   =========================================================== */
(function (global) {
  const FILES = "abcdefgh", RANKS = "12345678";

  // 0x88 helpers
  const SQUARES = {};
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    SQUARES[FILES[f] + RANKS[r]] = (r << 4) | f;
  }
  const toAlg = (i) => FILES[i & 7] + RANKS[i >> 4];
  const onBoard = (i) => !(i & 0x88);

  const OFFS = {
    n: [-33, -31, -18, -14, 14, 18, 31, 33],
    b: [-17, -15, 15, 17],
    r: [-16, -1, 1, 16],
    q: [-17, -16, -15, -1, 1, 15, 16, 17],
    k: [-17, -16, -15, -1, 1, 15, 16, 17],
  };

  function Chess(fenStr) {
    let board = new Array(128).fill(null); // {type,color}
    let turn = 'w';
    const hist = [];

    function clear() { board.fill(null); turn = 'w'; hist.length = 0; }

    function put(piece, sqAlg) {
      const i = SQUARES[sqAlg];
      board[i] = { type: piece.type, color: piece.color };
    }

    function get(sqAlg) {
      const p = board[SQUARES[sqAlg]];
      return p ? { type: p.type, color: p.color } : null;
    }

    function load(fen) {
      clear();
      const [piecePart, t] = fen.split(' ');
      const rows = piecePart.split('/');
      let idx = 0;
      for (let r = 0; r < 8; r++) {
        for (const ch of rows[r]) {
          if (/\d/.test(ch)) { idx += parseInt(ch, 10); continue; }
          const color = ch === ch.toUpperCase() ? 'w' : 'b';
          const type  = ch.toLowerCase();
          const sq    = toAlg(((7 - r) << 4) | (idx & 7));
          put({ type, color }, sq);
          idx++;
        }
      }
      turn = (t || 'w');
      return true;
    }

    function reset() {
      load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');
    }

    function swap(c){ return c === 'w' ? 'b' : 'w'; }

    function moves(opts = {}) {
      const ms = [];
      const us = turn, them = swap(us);
      const onlyFrom = opts.square ? SQUARES[opts.square] : -1;

      for (let i = 0; i < 128; i++) {
        if (!onBoard(i)) { i += 7; continue; }
        const p = board[i];
        if (!p || p.color !== us) continue;
        if (onlyFrom !== -1 && i !== onlyFrom) continue;

        if (p.type === 'p') {
          const dir = us === 'w' ? -16 : 16;
          const startRank = us === 'w' ? 6 : 1; // rank index in 0x88
          const one = i + dir;
          if (onBoard(one) && !board[one]) {
            push(i, one);
            const two = i + dir + dir;
            if ((i >> 4) === startRank && !board[two]) push(i, two);
          }
          // captures
          for (const d of [dir - 1, dir + 1]) {
            const t = i + d;
            if (onBoard(t) && board[t] && board[t].color === them) push(i, t);
          }
        } else {
          const slide = (p.type !== 'n' && p.type !== 'k');
          for (const d of OFFS[p.type]) {
            let t = i;
            while (true) {
              t += d;
              if (!onBoard(t)) break;
              if (!board[t]) { push(i, t); if (!slide) break; }
              else {
                if (board[t].color === them) push(i, t);
                break;
              }
              if (!slide) break;
            }
          }
        }
      }

      function push(fromI, toI) {
        const from = toAlg(fromI), to = toAlg(toI);
        ms.push(opts.verbose ? { from, to, color: us, san: `${from}${to}` } : to);
      }
      return ms;
    }

    function move(m) {
      const list = moves({ square: m.from, verbose: true });
      const found = list.find(x => x.to === m.to);
      if (!found) return null;
      // do move
      const fi = SQUARES[m.from], ti = SQUARES[m.to];
      const piece = board[fi];
      board[ti] = piece;
      board[fi] = null;
      hist.push({ from: m.from, to: m.to, san: `${m.from}${m.to}` });
      turn = swap(turn);
      return { from: m.from, to: m.to, san: `${m.from}${m.to}` };
    }

    function fen() {
      let out = '';
      for (let r = 7; r >= 0; r--) {
        let empty = 0;
        for (let f = 0; f < 8; f++) {
          const p = board[(r << 4) | f];
          if (!p) { empty++; continue; }
          if (empty) { out += empty; empty = 0; }
          out += p.color === 'w' ? p.type.toUpperCase() : p.type;
        }
        if (empty) out += empty;
        if (r) out += '/';
      }
      return `${out} ${turn} - - 0 1`;
    }

    function history(opts = {}) {
      return opts.verbose ? hist.slice() : hist.map(h => h.san);
    }

    function undo(){
      const last = hist.pop();
      if (!last) return null;
      const fi = SQUARES[last.from], ti = SQUARES[last.to];
      board[fi] = board[ti];
      board[ti] = null;
      turn = swap(turn);
      return last;
    }

    // minimal API
    return {
      load, reset, fen, move, moves, get,
      turn: () => turn,
      history, undo,
      // stubs:
      in_check: () => false,
      in_checkmate: () => false,
      in_stalemate: () => false,
      in_draw: () => false,
      game_over: () => false,
    };
  }

  global.Chess = Chess;
})(typeof window !== 'undefined' ? window : globalThis);
