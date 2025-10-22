/* ===========================================================
   AZBRY CHESS ENGINE — STABLE MINI (0x88) 100% Lokal
   - Support: start/reset, get/put, move(), moves({square})
   - History + undo via FEN snapshot (redo opsional)
   - Cukup buat VS Human & VS Azbry-MD (random)
   =========================================================== */
(function (global) {
  function Chess(startFen) {
    // ---------- State ----------
    let board = new Array(128).fill(null);   // 0x88
    let turn  = 'w';
    let history = [];         // {from,to,piece,capture?}
    let fenStack = [];        // snapshot untuk undo

    // castling/ep disiapkan sebagai placeholder (tidak dipakai penuh di mini engine)
    let castling = { K:false, Q:false, k:false, q:false };
    let ep_square = -1;

    // ---------- Const ----------
    const FILES = 'abcdefgh';
    const RANKS = '12345678';
    const WHITE = 'w', BLACK = 'b';
    const OFFS = {
      n: [-18,-33,-31,-14, 18,33,31,14],
      b: [-17,-15, 17, 15],
      r: [-16,  1, 16, -1],
      q: [-17,-16,-15, -1, 1,15,16,17],
      k: [-17,-16,-15, -1, 1,15,16,17],
    };
    // rank awal pawns pada papan 0x88:
    // r = i >> 4 (0 paling atas = rank 8)
    const RANK_2 = 6; // white pawns start row
    const RANK_7 = 1; // black pawns start row

    // mapping algebraic -> index 0x88
    const SQUARES = {};
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        SQUARES[FILES[f] + RANKS[r]] = (r << 4) + f; // r:0..7 (0 atas)
      }
    }

    // ---------- Helpers ----------
    function idxToAlg(i){
      const f = i & 15, r = i >> 4;               // r:0..7 (0=rank8)
      return FILES[f] + (8 - r);                  // tampilkan 8..1
    }
    function put(piece, squareAlg){
      const i = SQUARES[squareAlg];
      if (i == null) return false;
      board[i] = { type: piece.type, color: piece.color };
      return true;
    }
    function get(squareAlg){
      const i = SQUARES[squareAlg];
      return i == null ? null : (board[i] ? {...board[i]} : null);
    }
    function swap(c){ return c === 'w' ? 'b' : 'w'; }

    function clear(){
      board.fill(null);
      turn = 'w';
      history = [];
      fenStack = [];
      castling = { K:false, Q:false, k:false, q:false };
      ep_square = -1;
    }

    function load(fen){
      clear();
      const [piecePart, side /* , castle, ep */] = fen.split(/\s+/);
      const rows = piecePart.split('/');
      let sq = 0; // berjalan dari a8 -> h1 (120 kotak virtual, 64 efektif)
      for (let r = 0; r < 8; r++){
        for (const ch of rows[r]){
          if (/\d/.test(ch)){
            sq += parseInt(ch,10);
          } else {
            const color = ch === ch.toUpperCase() ? WHITE : BLACK;
            const type  = ch.toLowerCase();
            // terjemahkan “sq dari 0..63” ke index 0x88
            const file = sq % 8, rankFromTop = r; // r=0 baris atas (rank8)
            const i = (rankFromTop << 4) + file;
            board[i] = { type, color };
            sq++;
          }
        }
      }
      turn = side || 'w';
      return true;
    }

    function reset(){
      load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');
    }

    // FEN writer mini (tanpa castling/ep/hm/movenum akurat)
    function fen(){
      let out = '';
      for (let r = 0; r < 8; r++){
        let empty = 0;
        for (let f = 0; f < 8; f++){
          const i = (r << 4) + f;
          const p = board[i];
          if (p){
            if (empty){ out += empty; empty = 0; }
            out += (p.color === 'w') ? p.type.toUpperCase() : p.type;
          } else empty++;
        }
        if (empty) out += empty;
        if (r < 7) out += '/';
      }
      return `${out} ${turn} - - 0 1`;
    }

    // ---------- Move gen ----------
    function moves(opts = {}){
      const only = opts.square ? SQUARES[opts.square] : null;
      const us = turn, them = swap(us);
      const res = [];

      for (let i = 0; i < 128; i++){
        if (i & 0x88) { i += 7; continue; }
        if (only != null && i !== only) continue;

        const p = board[i];
        if (!p || p.color !== us) continue;

        if (p.type === 'p'){
          const forward = (us === 'w') ? -16 : 16;
          const startR  = (us === 'w') ? RANK_2 : RANK_7;
          const one = i + forward;

          // maju 1
          if (!(one & 0x88) && !board[one]){
            push(i, one);
            // maju 2 dari rank awal
            const two = i + 2*forward;
            if ((i>>4) === startR && !board[two]) push(i, two);
          }
          // makan kiri/kanan
          for (const off of [forward-1, forward+1]){
            const t = i + off;
            if (t & 0x88) continue;
            if (board[t] && board[t].color === them) push(i, t);
          }
          // (en passant tidak diimplement dulu pada mini)
        } else {
          for (const d of OFFS[p.type]){
            let t = i;
            while (true){
              t += d;
              if (t & 0x88) break;
              const q = board[t];
              if (!q){ push(i, t); }
              else {
                if (q.color === them) push(i, t);
                break;
              }
              if (p.type === 'n' || p.type === 'k') break;
            }
          }
        }
      }

      function push(fromIdx, toIdx){
        res.push({
          from: idxToAlg(fromIdx),
          to  : idxToAlg(toIdx),
          color: us
        });
      }
      return res;
    }

    // ---------- Make/Undo ----------
    function move(m){
      // filter legal dari kotak yang dipilih
      const legal = moves({ square: m.from });
      const found = legal.find(x => x.to === m.to);
      if (!found) return null;

      // snapshot sebelum jalan (buat undo)
      fenStack.push(fen());

      const fromI = SQUARES[m.from];
      const toI   = SQUARES[m.to];
      const piece = board[fromI];
      const capture = board[toI] ? {...board[toI]} : null;

      // promosi simpel (opsional)
      if (piece.type === 'p'){
        const rankTo = toI >> 4;     // 0..7 dari atas
        const isPromoW = (piece.color==='w' && rankTo===0);
        const isPromoB = (piece.color==='b' && rankTo===7);
        if (m.promotion && (isPromoW || isPromoB)){
          piece.type = m.promotion.toLowerCase();
        }
      }

      board[toI] = piece;
      board[fromI] = null;

      history.push({ from:m.from, to:m.to, piece:{...piece}, capture });
      turn = swap(turn);
      return { from:m.from, to:m.to };
    }

    function undo(){
      const snap = fenStack.pop();
      if (!snap) return null;
      history.pop();
      load(snap);
      return true;
    }

    // --------- Public API ----------
    // Constructor: otomatis set start position
    if (startFen) load(startFen); else reset();

    return {
      // state
      turn : () => turn,
      fen,
      load, reset, clear,
      get, put,

      // play
      moves,
      move,
      undo,
      redo: () => null, // placeholder biar nggak error dipanggil dari UI
      history: () => history.slice(),

      // compatibility flags (dipakai UI tapi boleh kosong)
      in_check      : () => false,
      in_checkmate  : () => false,
      in_stalemate  : () => false,
      in_draw       : () => false,
      game_over     : () => false,
    };
  }

  global.Chess = Chess;
})(typeof window !== 'undefined' ? window : globalThis);
