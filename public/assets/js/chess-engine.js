/* Azbry Chess Engine – full rules, compact & fast
   - Legal move generation dengan pin & check awareness
   - Check / Checkmate / Stalemate
   - Castling (K/Q; syarat: tidak lewat/masuk dalam check & jalur kosong)
   - En passant
   - Promotion (auto Queen – bisa disesuaikan)
   - Undo / Redo stack
   - FEN load/save (startpos default)
*/

(function (global) {
  const EMPTY = '.';
  const STARTFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const PIECE_VALUES = { p:100, n:320, b:330, r:500, q:900, k:0 };

  // Helpers
  const file = i => i % 8, rank = i => (i / 8) | 0;
  const idx = (r,c) => r*8 + c;
  const inBoard = (r,c)=> r>=0 && r<8 && c>=0 && c<8;
  const isWhite = pc => pc && pc===pc.toUpperCase();
  const isBlack = pc => pc && pc===pc.toLowerCase();

  class AzbryChess {
    constructor() {
      this.loadFEN(STARTFEN);
    }

    start() { this.loadFEN(STARTFEN); }

    loadFEN(fen) {
      const [board, toMove, castle, ep, half, full] = fen.split(' ');
      this.board = new Array(64).fill(EMPTY);
      let s = board.split('/'), k=0;
      for (let r=0;r<8;r++){
        for (let ch of s[r]){
          if (/\d/.test(ch)) { k += +ch; }
          else { this.board[k++] = ch; }
        }
      }
      this.turnSide = toMove;       // 'w' | 'b'
      this.castle = castle;         // e.g. "KQkq"
      this.epSquare = (ep==='-'? -1 : sqFromAlgebraic(ep));
      this.halfmove = +half || 0;
      this.fullmove = +full || 1;
      this.history = [];
      this.redoStack = [];
      this._recomputeKings();
    }

    fen() {
      let rows=[];
      for (let r=0;r<8;r++){
        let row='', cnt=0;
        for (let c=0;c<8;c++){
          const pc = this.board[idx(r,c)];
          if (pc===EMPTY) cnt++;
          else { if (cnt){ row+=cnt; cnt=0; } row+=pc; }
        }
        if (cnt) row+=cnt;
        rows.push(row);
      }
      const ep = this.epSquare<0? '-' : algebraicFromSq(this.epSquare);
      return `${rows.join('/')}`+
             ` ${this.turnSide} ${this.castle||'-'} ${ep} ${this.halfmove} ${this.fullmove}`;
    }

    turn() { return this.turnSide; }

    // ---------- Legal move generation ----------
    // Move format: {from,to,pc,capture,promo,flag}  flag: 'ep','castleK','castleQ'
    legalMoves() {
      const side = this.turnSide;
      const moves = [];
      const kingSq = side==='w' ? this.wKing : this.bKing;

      const add = (m)=>{
        // sim move; reject if own king in check
        const st = this._do(m);
        const inChk = this._inCheck(side);
        this._undo();
        if (!inChk) moves.push(m);
      };

      for (let i=0;i<64;i++){
        const pc = this.board[i];
        if (pc===EMPTY) continue;
        if (side==='w' && !isWhite(pc)) continue;
        if (side==='b' && !isBlack(pc)) continue;

        const r=rank(i), c=file(i);
        const lower = pc.toLowerCase();

        if (lower==='p'){
          const dir = (side==='w'? -1 : +1);
          const startRank = (side==='w'? 6 : 1);
          const promoRank = (side==='w'? 0 : 7);
          // advance 1
          if (inBoard(r+dir,c) && this.board[idx(r+dir,c)]===EMPTY){
            const to = idx(r+dir,c);
            if (rank(to)===promoRank) add({from:i,to,pc,capture:null,promo: side==='w'?'Q':'q'});
            else add({from:i,to,pc});
            // advance 2
            if (r===startRank && this.board[idx(r+2*dir,c)]===EMPTY){
              add({from:i,to:idx(r+2*dir,c),pc,flag:'dbl'});
            }
          }
          // captures
          for (let dc of [-1,1]){
            const rr=r+dir, cc=c+dc;
            if (!inBoard(rr,cc)) continue;
            const to = idx(rr,cc);
            const tgt = this.board[to];
            if (tgt!==EMPTY && ((side==='w' && isBlack(tgt)) || (side==='b' && isWhite(tgt)))){
              if (rank(to)===promoRank) add({from:i,to,pc,capture:tgt,promo: side==='w'?'Q':'q'});
              else add({from:i,to,pc,capture:tgt});
            }
          }
          // en passant
          if (this.epSquare>=0){
            for (let dc of [-1,1]){
              const cc=c+dc;
              if (!inBoard(r+dir,cc)) continue;
              if (idx(r+dir,cc)===this.epSquare){
                add({from:i,to:this.epSquare,pc,capture: side==='w'?'p':'P', flag:'ep'});
              }
            }
          }
        }
        else if (lower==='n'){
          const steps=[[+2,+1],[+2,-1],[-2,+1],[-2,-1],[+1,+2],[+1,-2],[-1,+2],[-1,-2]];
          for (let [dr,dc] of steps){
            const rr=r+dr, cc=c+dc; if(!inBoard(rr,cc)) continue;
            const to=idx(rr,cc), tgt=this.board[to];
            if (tgt===EMPTY || (side==='w'? isBlack(tgt) : isWhite(tgt)))
              add({from:i,to,pc,capture: tgt===EMPTY? null : tgt});
          }
        }
        else if (lower==='b' || lower==='r' || lower==='q'){
          const dirs = (lower==='b')? [[1,1],[1,-1],[-1,1],[-1,-1]]
                     : (lower==='r')? [[1,0],[-1,0],[0,1],[0,-1]]
                                     : [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
          for (let [dr,dc] of dirs){
            let rr=r+dr, cc=c+dc;
            while (inBoard(rr,cc)){
              const to=idx(rr,cc), tgt=this.board[to];
              if (tgt===EMPTY){ add({from:i,to,pc}); }
              else {
                if (side==='w'? isBlack(tgt) : isWhite(tgt))
                  add({from:i,to,pc,capture:tgt});
                break;
              }
              rr+=dr; cc+=dc;
            }
          }
        }
        else if (lower==='k'){
          const steps=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
          for (let [dr,dc] of steps){
            const rr=r+dr, cc=c+dc; if(!inBoard(rr,cc)) continue;
            const to=idx(rr,cc), tgt=this.board[to];
            if (tgt===EMPTY || (side==='w'? isBlack(tgt) : isWhite(tgt)))
              add({from:i,to,pc,capture: tgt===EMPTY? null : tgt});
          }
          // castling
          if (this._canCastle(side,'K')) {
            add({from:i,to:i+2,pc,flag:'castleK'});
          }
          if (this._canCastle(side,'Q')) {
            add({from:i,to:i-2,pc,flag:'castleQ'});
          }
        }
      }
      return moves;
    }

    // status for UI
    status(){
      const side=this.turnSide;
      const moves=this.legalMoves();
      const inCheck=this._inCheck(side);
      if (moves.length===0){
        return { inCheck, checkmate: inCheck, stalemate: !inCheck, draw:false, moves:0 };
      }
      return { inCheck, checkmate:false, stalemate:false, draw:false, moves:moves.length };
    }

    getLegalFrom(fromIdx){
      const res=[];
      for (const m of this.legalMoves()) if (m.from===fromIdx) res.push(m);
      return res;
    }

    makeMove(move) {
      // try match object {from,to,promo}
      const list = this.legalMoves();
      const same = list.find(m => m.from===move.from && m.to===move.to && (m.promo||'')===(move.promo||''));
      if (!same) return false;
      this._do(same);
      this.redoStack.length=0; // clear redo
      return true;
    }

    undo(){
      if (!this.history.length) return false;
      this._undo();
      return true;
    }
    redo(){
      const mv = this.redoStack.pop();
      if (!mv) return false;
      this._do(mv, true); // reapply recorded move
      return true;
    }

    // ---------- internals ----------
    _recomputeKings(){
      this.wKing = this.board.indexOf('K');
      this.bKing = this.board.indexOf('k');
    }

    _squareAttackedBy(sq, attackerSide){
      // Use pseudo moves of opposite side king/knight/slider/pawn to see attack
      const r=rank(sq), c=file(sq);

      // pawns
      const dir = attackerSide==='w'? -1 : +1;
      for (let dc of [-1,1]){
        const rr=r+dir, cc=c+dc;
        if (inBoard(rr,cc)){
          const p = this.board[idx(rr,cc)];
          if (p === (attackerSide==='w' ? 'P' : 'p')) return true;
        }
      }
      // knights
      const kSteps=[[+2,+1],[+2,-1],[-2,+1],[-2,-1],[+1,+2],[+1,-2],[-1,+2],[-1,-2]];
      for (let [dr,dc] of kSteps){
        const rr=r+dr, cc=c+dc; if(!inBoard(rr,cc)) continue;
        const p=this.board[idx(rr,cc)];
        if (p === (attackerSide==='w' ? 'N' : 'n')) return true;
      }
      // kings
      const s8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      for (let [dr,dc] of s8){
        const rr=r+dr, cc=c+dc; if(!inBoard(rr,cc)) continue;
        const p=this.board[idx(rr,cc)];
        if (p === (attackerSide==='w' ? 'K' : 'k')) return true;
      }
      // sliders
      const scan = (dirs, targets)=>{
        for (let [dr,dc] of dirs){
          let rr=r+dr, cc=c+dc;
          while (inBoard(rr,cc)){
            const q=this.board[idx(rr,cc)];
            if (q!==EMPTY){
              if (targets.includes(q)) return true;
              break;
            }
            rr+=dr; cc+=dc;
          }
        }
        return false;
      };
      if (scan([[1,0],[-1,0],[0,1],[0,-1]],
               attackerSide==='w'? ['R','Q'] : ['r','q'])) return true;
      if (scan([[1,1],[1,-1],[-1,1],[-1,-1]],
               attackerSide==='w'? ['B','Q'] : ['b','q'])) return true;

      return false;
    }

    _inCheck(side){
      const ksq = (side==='w'? this.wKing : this.bKing);
      const opp = side==='w' ? 'b' : 'w';
      return this._squareAttackedBy(ksq, opp);
    }

    _canCastle(side, wing){ // wing: 'K' or 'Q'
      const rights = this.castle || '';
      const want = (side==='w'? wing : wing.toLowerCase());
      if (!rights.includes(want)) return false;
      const ksq = (side==='w'? this.wKing : this.bKing);
      const rookSq = (side==='w'?
        (wing==='K'? 63 : 56) : (wing==='K'? 7 : 0));

      const step = wing==='K'? +1 : -1;
      const to1 = ksq+step, to2 = ksq+2*step, to3 = (wing==='Q'? ksq-3 : ksq);
      // squares between king & rook must be empty
      const path = wing==='K' ? [ksq+1, ksq+2] : [ksq-1, ksq-2, ksq-3];
      for (const s of path) if (this.board[s]!==EMPTY) return false;
      // king may not be in check, pass through check, or land in check
      if (this._squareAttackedBy(ksq, side==='w'?'b':'w')) return false;
      if (this._squareAttackedBy(to1, side==='w'?'b':'w')) return false;
      if (this._squareAttackedBy(to2, side==='w'?'b':'w')) return false;
      // rook present?
      const rook = (side==='w'?'R':'r');
      if (this.board[rookSq]!==rook) return false;
      return true;
    }

    _do(m, fromRedo=false){
      // save snapshot
      const snap = {
        from: m.from, to: m.to, pc: m.pc,
        captured: this.board[m.to]!==EMPTY? this.board[m.to] : (m.flag==='ep'? (this.turnSide==='w'?'p':'P') : null),
        castle: this.castle, ep: this.epSquare, half: this.halfmove, full: this.fullmove,
        promo: m.promo||null, flag: m.flag||null,
        wKing: this.wKing, bKing: this.bKing
      };
      if (!fromRedo) this.history.push(snap); else this.history.push(snap); // same stack

      // move piece
      this.board[m.to] = m.promo? m.promo : m.pc;
      this.board[m.from] = EMPTY;

      // en passant remove captured pawn
      if (m.flag==='ep'){
        const dir = (this.turnSide==='w'? +1 : -1);
        const capSq = m.to + 8*dir; // square behind move destination
        this.board[capSq] = EMPTY;
      }

      // castling – move rook too
      if (m.flag==='castleK'){
        const rFrom = (this.turnSide==='w'? 63 : 7);
        const rTo   = m.to-1;
        this.board[rTo] = this.board[rFrom];
        this.board[rFrom] = EMPTY;
      } else if (m.flag==='castleQ'){
        const rFrom = (this.turnSide==='w'? 56 : 0);
        const rTo   = m.to+1;
        this.board[rTo] = this.board[rFrom];
        this.board[rFrom] = EMPTY;
      }

      // update kings
      const lower = m.pc.toLowerCase();
      if (lower==='k'){
        if (this.turnSide==='w') this.wKing = m.to; else this.bKing = m.to;
      }

      // castle rights update
      const killCastle = (s, letters) => {
        for (const L of letters) s = s.replace(L,'');
        return s;
      };
      let cs = this.castle||'';
      if (lower==='k') cs = (this.turnSide==='w'? cs.replace('K','').replace('Q','') : cs.replace('k','').replace('q',''));
      if (lower==='r'){
        // if rook moved from initial squares, remove right
        if (m.from===63) cs = cs.replace('K','');
        if (m.from===56) cs = cs.replace('Q','');
        if (m.from===7)  cs = cs.replace('k','');
        if (m.from===0)  cs = cs.replace('q','');
      }
      // if rook captured on initial squares
      if (m.to===63) cs = cs.replace('K','');
      if (m.to===56) cs = cs.replace('Q','');
      if (m.to===7)  cs = cs.replace('k','');
      if (m.to===0)  cs = cs.replace('q','');
      this.castle = cs;

      // ep square set
      this.epSquare = -1;
      if (lower==='p' && Math.abs(m.to - m.from)===16){
        this.epSquare = (m.from + m.to)/2;
      }

      // clocks
      if (lower==='p' || snap.captured) this.halfmove = 0;
      else this.halfmove++;
      if (this.turnSide==='b') this.fullmove++;

      // switch side
      this.turnSide = (this.turnSide==='w'? 'b' : 'w');

      // store for redo
      if (!fromRedo) this.redoStack.length=0;
      this.redoStack.push(m);

      return snap;
    }

    _undo(){
      const h = this.history.pop();
      if (!h) return;
      // switch side back
      this.turnSide = (this.turnSide==='w'? 'b' : 'w');
      if (this.turnSide==='b') this.fullmove--;
      this.halfmove = h.half;
      this.castle = h.castle;
      this.epSquare = h.ep;

      // revert board
      this.board[h.from] = h.pc;
      // capture restore
      if (h.flag==='ep'){
        this.board[h.to] = EMPTY;
        const dir = (this.turnSide==='w'? +1 : -1);
        const capSq = h.to + 8*dir;
        this.board[capSq] = h.captured;
      } else {
        this.board[h.to] = h.captured? h.captured : EMPTY;
      }

      // undo rook move in castling
      if (h.flag==='castleK'){
        const rFrom = (this.turnSide==='w'? 63 : 7);
        const rTo   = h.to-1;
        this.board[rFrom] = this.board[rTo];
        this.board[rTo] = EMPTY;
      } else if (h.flag==='castleQ'){
        const rFrom = (this.turnSide==='w'? 56 : 0);
        const rTo   = h.to+1;
        this.board[rFrom] = this.board[rTo];
        this.board[rTo] = EMPTY;
      }

      // undo king location cache
      this.wKing = h.wKing; this.bKing = h.bKing;
    }

    // ---------- AI (minimax depth 2, alpha-beta) ----------
    bestMove(depth=2){
      const side = this.turnSide;
      const moves = this.legalMoves();
      if (!moves.length) return null;

      let best=null, bestScore = (side==='w'? -1e9 : +1e9);

      // simple move ordering: captures first
      moves.sort((a,b)=>{
        const ca = this.board[b.to]!==EMPTY || a.captcha? -1 : 1;
        const cb = this.board[a.to]!==EMPTY || b.captcha? -1 : 1;
        return ca-cb;
      });

      for (const m of moves){
        const snap = this._do(m);
        const sc = this._search(depth-1, -1e9, 1e9);
        this._undo();
        if (side==='w'){
          if (sc>bestScore){ bestScore=sc; best=m; }
        } else {
          if (sc<bestScore){ bestScore=sc; best=m; }
        }
      }
      return best;
    }

    _search(depth, alpha, beta){
      const side = this.turnSide;
      const st = this.status();
      if (depth===0 || st.checkmate || st.stalemate) return this._eval();

      let val = (side==='w'? -1e9 : +1e9);
      const moves = this.legalMoves();
      // shallow ordering: captures first
      moves.sort((a,b)=>{
        const va = (a.captcha||this.board[a.to]!==EMPTY)?1:0;
        const vb = (b.captcha||this.board[b.to]!==EMPTY)?1:0;
        return vb-va;
      });

      for (const m of moves){
        this._do(m);
        const sc = this._search(depth-1, alpha, beta);
        this._undo();
        if (side==='w'){
          if (sc>val) val=sc;
          if (val>alpha) alpha=val;
          if (alpha>=beta) break;
        } else {
          if (sc<val) val=sc;
          if (val<beta) beta=val;
          if (alpha>=beta) break;
        }
      }
      return val;
    }

    _eval(){
      // material + basic piece-square
      let s=0;
      for (let i=0;i<64;i++){
        const p=this.board[i]; if (p===EMPTY) continue;
        const v = PIECE_VALUES[p.toLowerCase()] || 0;
        s += isWhite(p)? +v : -v;
      }
      // mobility tiny bonus
      const m = this.legalMoves().length;
      s += (this.turnSide==='w'? 0.1*m : -0.1*m);
      return s;
    }
  }

  function sqFromAlgebraic(a){
    const f=a.charCodeAt(0)-97, r=8-(a.charCodeAt(1)-48);
    return r*8+f;
  }
  function algebraicFromSq(s){
    const f = String.fromCharCode(97 + file(s));
    const r = String(8 - rank(s));
    return f+r;
  }

  global.AzbryChessEngine = AzbryChess;
  global._azbry_sq = { idx, rank, file }; // optional helpers

})(window);
