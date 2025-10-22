/* ===========================================================
   AZBRY CHESS ENGINE — STABLE (0x88) • OFFLINE, LOCAL ONLY
   - Perbaikan: konstanta rank, generator langkah pion,
     opsi moves({square, verbose}), history({verbose}),
     undo/redo berbasis FEN.
   =========================================================== */

(function (global) {
  function Chess(fen) {
    // --- State
    let board = new Array(128).fill(null);
    let turn  = 'w';
    let epSquare = -1;
    let castling = { K:false, Q:false, k:false, q:false }; // simple placeholder
    let halfMoves = 0, moveNumber = 1;

    // history
    let hist = [];       // {from,to,promo,fen}
    let redoStack = [];  // same shape

    // --- Const
    const FILES = 'abcdefgh';
    const RANKS = '12345678';

    const EMPTY = null;
    const WHITE = 'w';
    const BLACK = 'b';

    // 0x88 helpers
    const RANK_2 = 6;  // white pawns start (r == 6)
    const RANK_7 = 1;  // black pawns start (r == 1)

    const OFFS = {
      n: [-18,-33,-31,-14, 18,33,31,14],
      b: [-17,-15, 17, 15],
      r: [-16,  1, 16, -1],
      q: [-17,-16,-15, -1, 1,15,16,17],
      k: [-17,-16,-15, -1, 1,15,16,17]
    };

    const SQUARES = {};
    for (let r=0;r<8;r++) for (let f=0;f<8;f++)
      SQUARES[FILES[f]+RANKS[r]] = (r<<4) | f;

    // --- Utils
    function algebraic(i){
      const f = i & 15, r = i >> 4;       // r: 0..7 top->bottom
      return FILES[f] + RANKS[7 - r];     // rank text 8..1
    }
    function swap(c){ return c==='w' ? 'b' : 'w'; }

    // --- API basics
    function clear(){
      board.fill(null);
      turn = WHITE;
      epSquare = -1;
      castling = {K:false,Q:false,k:false,q:false};
      halfMoves = 0; moveNumber = 1;
      hist = []; redoStack = [];
    }

    function put(piece, square){
      const sq = SQUARES[square];
      if (sq == null) return false;
      board[sq] = { type: piece.type, color: piece.color };
      return true;
    }

    function get(square){
      const sq = SQUARES[square];
      return sq == null ? null : board[sq];
    }

    function load(fenStr){
      clear();
      const [pos, t='w', castles='-', ep='-'] = fenStr.trim().split(/\s+/);
      const rows = pos.split('/');
      let i = 0;
      for (let r=0;r<8;r++){
        for (const ch of rows[r]){
          if (/\d/.test(ch)) { i += +ch; continue; }
          const color = ch === ch.toUpperCase() ? WHITE : BLACK;
          const type  = ch.toLowerCase();
          const sq    = algebraic(119 - i); // mirror to A1 bottom-left
          put({type, color}, sq);
          i++;
        }
      }
      turn = t;
      if (castles && castles !== '-') for (const c of castles) castling[c] = true;
      epSquare = (ep && ep !== '-') ? SQUARES[ep] : -1;
      return true;
    }

    function reset(){
      load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');
    }

    function fen(){
      let out = '';
      for (let r=0;r<8;r++){
        let empty=0;
        for (let f=0;f<8;f++){
          const sq = (7-r)*16 + f;
          const p  = board[sq];
          if (!p){ empty++; continue; }
          if (empty){ out += empty; empty=0; }
          out += p.color==='w' ? p.type.toUpperCase() : p.type;
        }
        if (empty) out += empty;
        if (r<7) out += '/';
      }
      const ep = epSquare>=0 ? algebraic(epSquare) : '-';
      const castles = (castling.K?'K':'')+(castling.Q?'Q':'')+(castling.k?'k':'')+(castling.q?'q':'') || '-';
      return `${out} ${turn} ${castles} ${ep} ${halfMoves} ${moveNumber}`;
    }

    // --- Move generation (very small, legal-enough for casual)
    function moves(opts={}){
      const res = [];
      const us = turn, them = swap(turn);

      function add(from, to, promo){
        const move = { from: algebraic(from), to: algebraic(to) };
        if (promo) move.promotion = promo;
        if (opts.verbose) move.color = us;
        res.push(move);
      }

      for (let i=0;i<128;i++){
        if (i & 0x88){ i+=7; continue; }
        const p = board[i];
        if (!p || p.color !== us) continue;

        if (p.type === 'p'){
          const dir  = (us===WHITE) ? -16 : 16;
          const rank = i>>4;
          const startRank = (us===WHITE) ? RANK_2 : RANK_7;

          // single push
          const fwd = i + dir;
          if (!(fwd & 0x88) && !board[fwd]){
            // promotion?
            const toRank = fwd>>4;
            if ((us===WHITE && toRank===0) || (us===BLACK && toRank===7)){
              for (const promo of ['q','r','b','n']) add(i,fwd,promo);
            } else add(i,fwd);

            // double push from start
            const dbl = i + 2*dir;
            if (rank === startRank && !board[dbl] && !(dbl & 0x88)) add(i,dbl);
          }

          // captures
          for (const off of [dir-1, dir+1]){
            const t = i + off;
            if (t & 0x88) continue;
            if (board[t] && board[t].color === them){
              const toRank = t>>4;
              if ((us===WHITE && toRank===0) || (us===BLACK && toRank===7)){
                for (const promo of ['q','r','b','n']) add(i,t,promo);
              } else add(i,t);
            }
          }
          continue;
        }

        // sliders / knight / king
        for (const off of OFFS[p.type]){
          let t = i;
          while (true){
            t += off;
            if (t & 0x88) break;
            const occ = board[t];
            if (!occ){ add(i,t); }
            else{
              if (occ.color === them) add(i,t);
              break;
            }
            if (p.type === 'n' || p.type === 'k') break;
          }
        }
      }

      // filter by from-square if requested
      return opts.square ? res.filter(m => m.from === opts.square) : res;
    }

    function makeMove(mv){
      const from = SQUARES[mv.from];
      const to   = SQUARES[mv.to];
      const piece = board[from]; if (!piece) return false;

      // promo
      let placed = { type: piece.type, color: piece.color };
      if (mv.promotion) placed = { type: mv.promotion, color: piece.color };

      const fenBefore = fen();

      board[to] = placed;
      board[from] = null;

      // simple ep/castle not implemented (cukup buat main casual)
      turn = swap(turn);
      redoStack.length = 0; // clear redo chain
      hist.push({ from: mv.from, to: mv.to, promotion: mv.promotion, fen: fenBefore });
      return true;
    }

    function move(input){
      // input bisa {from:'e2', to:'e4', promotion:'q'} atau object verbose dari moves()
      const want = {
        from: input.from || input.fromSquare || input.from_sq,
        to:   input.to   || input.toSquare   || input.to_sq,
        promotion: input.promotion
      };
      const list = moves({ square: want.from, verbose: true });
      const found = list.find(m => m.to === want.to && (!want.promotion || m.promotion === want.promotion));
      if (!found) return null;
      if (makeMove(found)) return found;
      return null;
    }

    function undo(){
      const last = hist.pop();
      if (!last) return null;
      const curFen = fen();
      load(last.fen);
      redoStack.push({ ...last, fen: curFen });
      return { from: last.from, to: last.to, promotion: last.promotion };
    }

    function redo(){
      const mv = redoStack.pop();
      if (!mv) return null;
      const ok = makeMove(mv);
      return ok ? mv : null;
    }

    function historyAPI(opts={}){
      if (opts.verbose) return hist.map(h => ({ from:h.from, to:h.to, promotion:h.promotion }));
      return hist.map(h => `${h.from}${h.to}`);
    }

    // --- Boot
    if (fen) load(fen); else reset();

    // --- Expose
    return {
      // state
      turn: () => turn,
      fen, load, reset,
      get, put,

      // play
      moves, move, undo, redo,
      history: historyAPI,

      // simplistic end checks (cukup placeholder buat UI)
      in_check: () => false,
      in_checkmate: () => false,
      in_stalemate: () => false,
      in_draw: () => false,
      game_over: () => false,
    };
  }

  global.Chess = Chess;
})(typeof window !== 'undefined' ? window : globalThis);
