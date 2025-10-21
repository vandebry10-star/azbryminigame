/* Azbry Chess Engine – compact, full rules (check, mate, stalemate,
   castling, en passant, promotion=Q), undo/redo.
   Board indexing: 0..63 (0=a8 ... 63=h1)
*/
(function (global) {
  const EMPTY = null;
  const WHITE = 'w', BLACK = 'b';
  const PAWN='P', KNIGHT='N', BISHOP='B', ROOK='R', QUEEN='Q', KING='K';

  const startFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";

  function clone(x){ return JSON.parse(JSON.stringify(x)); }
  function file(i){ return i % 8; }
  function rank(i){ return Math.floor(i/8); }
  function inBoard(i){ return i>=0 && i<64; }
  function algebraic(i){ return "abcdefgh"[file(i)] + (8-rank(i)); }
  function idxFromAlg(a){
    const f="abcdefgh".indexOf(a[0]);
    const r=8-parseInt(a[1],10);
    return r*8+f;
  }

  class Chess {
    constructor(fen=startFEN){ this.load(fen); }

    load(fen){
      // parse minimal FEN (pieces/side/castling/enpassant)
      const [pieces, side, cast, ep] = fen.split(' ');
      this.boardArr = new Array(64).fill(EMPTY);
      let i=0;
      for(const ch of pieces.replace(/\//g,'')){
        if(/\d/.test(ch)) i+=parseInt(ch,10);
        else{
          const color = ch===ch.toUpperCase()?WHITE:BLACK;
          const piece = ch.toUpperCase();
          this.boardArr[i++] = {color, piece};
        }
      }
      this.side = side==='w'?WHITE:BLACK;
      this.castling = {wK:cast.includes('K'), wQ:cast.includes('Q'), bK:cast.includes('k'), bQ:cast.includes('q')};
      this.enPassant = ep==='-'? null : idxFromAlg(ep);
      this.halfmove=0;
      this.historyStack=[];
      this.redoStack=[];
    }

    reset(){ this.load(startFEN); }

    board(){ return this.boardArr; }
    turn(){ return this.side; }
    history(){ return this.historyStack.map(m => m.notation); }

    _isOwn(c){ return c===this.side; }
    _enemy(){ return this.side===WHITE?BLACK:WHITE; }

    get(i){ return this.boardArr[i]; }
    set(i,v){ this.boardArr[i]=v; }

    _kingIndex(color){
      for(let i=0;i<64;i++){ const p=this.get(i); if(p && p.piece===KING && p.color===color) return i; }
      return -1;
    }

    _attacksFrom(i, color){
      // returns set of squares attacked by piece at i (for check detection)
      const P=this.get(i); if(!P) return [];
      const res=[]; const c=P.color, t=P.piece;
      const push=(d,ray=false)=>{
        let s=i+d;
        while(inBoard(s) && Math.abs(file(s)-file(s-d))<=2){
          const q=this.get(s);
          res.push(s);
          if(q) { break; }
          if(!ray) break;
          s+=d;
        }
      };
      if(t===PAWN){
        const dir = (c===WHITE?-8:8);
        const caps = [dir-1, dir+1];
        for(const d of caps){
          const s=i+d; if(!inBoard(s)) continue;
          if(Math.abs(file(s)-file(i))===1) res.push(s);
        }
      }
      if(t===KNIGHT){
        [15,17,-15,-17,10,-10,6,-6].forEach(d=>{
          const s=i+d;
          if(!inBoard(s)) return;
          if(Math.max(Math.abs(file(s)-file(i)),Math.abs(rank(s)-rank(i)))<=2) res.push(s);
        });
      }
      if(t===BISHOP || t===QUEEN){ [9,7,-9,-7].forEach(d=>push(d,true)); }
      if(t===ROOK   || t===QUEEN){ [8,-8,1,-1].forEach(d=>push(d,true)); }
      if(t===KING){ [-1,1,-8,8,-9,-7,9,7].forEach(d=>{
        const s=i+d; if(!inBoard(s)) return;
        if(Math.abs(file(s)-file(i))<=1 && Math.abs(rank(s)-rank(i))<=1) res.push(s);
      });}
      return res;
    }

    _squareAttackedBy(i, colorAttacker){
      for(let s=0;s<64;s++){
        const p=this.get(s);
        if(p && p.color===colorAttacker){
          const atks=this._attacksFrom(s, colorAttacker);
          if(atks.includes(i)){
            // handle pawn forward-not-attack glitch: already handled since _attacksFrom for pawn adds only diagonals
            return true;
          }
        }
      }
      return false;
    }

    inCheck(color=this.side){
      const k=this._kingIndex(color);
      return this._squareAttackedBy(k, color===WHITE?BLACK:WHITE);
    }

    _pushMove(list, from, to, flags={}){
      const fromP=this.get(from), toP=this.get(to);
      // prevent wrap horizontally for rook/bishop/queen rays is handled by generator before calling here
      // will filter legality later
      const promo = flags.promotion || null;
      list.push({from, to, piece:fromP, capture:toP||null, promotion:promo,
                 castle:flags.castle||null, enPassant:flags.enPassant||false});
    }

    _genMovesColor(color){
      const moves=[];
      for(let i=0;i<64;i++){
        const p=this.get(i);
        if(!p || p.color!==color) continue;
        const f=file(i), r=rank(i);
        if(p.piece===PAWN){
          const dir = (color===WHITE?-8:8);
          const one = i+dir;
          const startRank = (color===WHITE?6:1);
          const lastRank = (color===WHITE?0:7);

          // forward
          if(inBoard(one) && !this.get(one)){
            if(rank(one)===lastRank) this._pushMove(moves,i,one,{promotion:QUEEN});
            else this._pushMove(moves,i,one);
            // double
            const two = i+dir*2;
            if(r===startRank && !this.get(two)) this._pushMove(moves,i,two,{double:true});
          }
          // captures
          for(const df of [-1,1]){
            const t=i+dir+df;
            if(!inBoard(t) || Math.abs(file(t)-f)!==1) continue;
            if(this.get(t)?.color===(color===WHITE?BLACK:WHITE)){
              if(rank(t)===lastRank) this._pushMove(moves,i,t,{promotion:QUEEN});
              else this._pushMove(moves,i,t);
            }
          }
          // en passant
          if(this.enPassant!==null){
            const ep=this.enPassant;
            if(Math.abs(file(ep)-f)===1 && rank(ep)===r+(color===WHITE?-1:1)){
              this._pushMove(moves,i,ep,{enPassant:true});
            }
          }
        } else if(p.piece===KNIGHT){
          [15,17,-15,-17,10,-10,6,-6].forEach(d=>{
            const t=i+d; if(!inBoard(t)) return;
            if(Math.max(Math.abs(file(t)-f),Math.abs(rank(t)-r))>2) return;
            const q=this.get(t);
            if(!q || q.color!==color) this._pushMove(moves,i,t);
          });
        } else if(p.piece===BISHOP || p.piece===ROOK || p.piece===QUEEN){
          const dirs = [];
          if(p.piece!==ROOK)  dirs.push(9,7,-9,-7);
          if(p.piece!==BISHOP)dirs.push(8,-8,1,-1);
          for(const d of dirs){
            let t=i+d;
            while(inBoard(t) && Math.abs(file(t)-file(t-d))<=1){
              const q=this.get(t);
              if(!q){ this._pushMove(moves,i,t); }
              else { if(q.color!==color) this._pushMove(moves,i,t); break; }
              t+=d;
            }
          }
        } else if(p.piece===KING){
          [-1,1,-8,8,-9,-7,9,7].forEach(d=>{
            const t=i+d; if(!inBoard(t)) return;
            if(Math.abs(file(t)-f)<=1 && Math.abs(rank(t)-r)<=1){
              const q=this.get(t); if(!q || q.color!==color) this._pushMove(moves,i,t);
            }
          });
          // castling
          if(color===WHITE){
            if(this.castling.wK && !this.get(61) && !this.get(62) &&
               !this._squareAttackedBy(60,BLACK) && !this._squareAttackedBy(61,BLACK) && !this._squareAttackedBy(62,BLACK)){
              this._pushMove(moves,60,62,{castle:'K'});
            }
            if(this.castling.wQ && !this.get(57) && !this.get(58) && !this.get(59) &&
               !this._squareAttackedBy(60,BLACK) && !this._squareAttackedBy(59,BLACK) && !this._squareAttackedBy(58,BLACK)){
              this._pushMove(moves,60,58,{castle:'Q'});
            }
          } else {
            if(this.castling.bK && !this.get(5) && !this.get(6) &&
               !this._squareAttackedBy(4,WHITE) && !this._squareAttackedBy(5,WHITE) && !this._squareAttackedBy(6,WHITE)){
              this._pushMove(moves,4,6,{castle:'k'});
            }
            if(this.castling.bQ && !this.get(1) && !this.get(2) && !this.get(3) &&
               !this._squareAttackedBy(4,WHITE) && !this._squareAttackedBy(3,WHITE) && !this._squareAttackedBy(2,WHITE)){
              this._pushMove(moves,4,2,{castle:'q'});
            }
          }
        }
      }
      return moves;
    }

    _make(move){
      const st = {
        move: clone(move),
        castling: clone(this.castling),
        enPassant: this.enPassant,
        halfmove: this.halfmove
      };

      const {from,to,piece, promotion, enPassant, castle} = move;
      const target = this.get(to);

      // en passant capture removal
      let captured = target;
      if(enPassant){
        const dir = (piece.color===WHITE?1:-1);
        const capSq = to + (8*dir); // behind the moved pawn
        captured = this.get(capSq);
        this.set(capSq, EMPTY);
      }

      // move piece
      this.set(from, EMPTY);
      this.set(to, {color:piece.color, piece: promotion?promotion:piece.piece});

      // castling rook move
      if(castle==='K') { this.set(63,EMPTY); this.set(61,{color:WHITE,piece:ROOK}); }
      if(castle==='Q') { this.set(56,EMPTY); this.set(59,{color:WHITE,piece:ROOK}); }
      if(castle==='k') { this.set(7, EMPTY); this.set(5, {color:BLACK,piece:ROOK}); }
      if(castle==='q') { this.set(0, EMPTY); this.set(3, {color:BLACK,piece:ROOK}); }

      // update castling rights
      if(piece.piece===KING){
        if(piece.color===WHITE){ this.castling.wK=false; this.castling.wQ=false; }
        else{ this.castling.bK=false; this.castling.bQ=false; }
      }
      if(piece.piece===ROOK){
        if(from===63) this.castling.wK=false;
        if(from===56) this.castling.wQ=false;
        if(from===7)  this.castling.bK=false;
        if(from===0)  this.castling.bQ=false;
      }
      if(captured && captured.piece===ROOK){
        if(to===63) this.castling.wK=false;
        if(to===56) this.castling.wQ=false;
        if(to===7)  this.castling.bK=false;
        if(to===0)  this.castling.bQ=false;
      }

      // set enPassant square
      this.enPassant = null;
      if(piece.piece===PAWN && Math.abs(from-to)===16){
        this.enPassant = (from+to)/2;
      }

      // halfmove
      this.halfmove = (piece.piece===PAWN || captured)?0:this.halfmove+1;

      // save extra info
      st.captured = captured || null;

      return st; // for unmake
    }

    _unmake(state){
      const {move, castling, enPassant, halfmove, captured} = state;
      const {from,to,piece, promotion, enPassant:ep, castle} = move;

      // undo castling rook
      if(castle==='K') { this.set(63,{color:WHITE,piece:ROOK}); this.set(61,EMPTY); }
      if(castle==='Q') { this.set(56,{color:WHITE,piece:ROOK}); this.set(59,EMPTY); }
      if(castle==='k') { this.set(7,{color:BLACK,piece:ROOK}); this.set(5,EMPTY); }
      if(castle==='q') { this.set(0,{color:BLACK,piece:ROOK}); this.set(3,EMPTY); }

      // move back
      this.set(from, {color:piece.color, piece:piece.piece});
      this.set(to, EMPTY);

      // restore captured
      if(ep){
        const dir = (piece.color===WHITE?1:-1);
        const capSq = to + (8*dir);
        this.set(capSq, captured);
      }else if(captured){
        this.set(to, captured);
      }

      this.castling = castling;
      this.enPassant = enPassant;
      this.halfmove = halfmove;
    }

    _legalMoves(){
      const pseudo = this._genMovesColor(this.side);
      const legal=[];
      for(const m of pseudo){
        const st=this._make(m);
        const illegal = this.inCheck(this.side);
        this._unmake(st);
        if(!illegal) legal.push(m);
      }
      return legal;
    }

    moves(opt={}){
      if(opt.square){
        const idx = typeof opt.square==='number'?opt.square:idxFromAlg(opt.square);
        return this._legalMoves().filter(m => m.from===idx).map(m => ({
          from: algebraic(m.from), to: algebraic(m.to), promotion: m.promotion||null
        }));
      }
      return this._legalMoves().map(m=>({from:algebraic(m.from),to:algebraic(m.to),promotion:m.promotion||null}));
    }

    move(m){
      // m: {from:'e2', to:'e4', promotion?}
      const from = typeof m.from==='number'? m.from : idxFromAlg(m.from);
      const to   = typeof m.to  ==='number'? m.to   : idxFromAlg(m.to);
      const legal = this._legalMoves().find(x => x.from===from && x.to===to && (x.promotion||null)===(m.promotion||x.promotion||null));
      if(!legal) return null;

      const st = this._make(legal);
      const notation = `${algebraic(legal.from)} → ${algebraic(legal.to)}` + (legal.promotion?`=${legal.promotion}`:'');
      this.historyStack.push({ ...legal, notation, snapshot:st });
      this.redoStack.length=0; // clear redo
      this.side = this._enemy();
      return notation;
    }

    undo(){
      const last = this.historyStack.pop();
      if(!last) return null;
      this._unmake(last.snapshot);
      this.side = this._enemy();
      this.redoStack.push(last);
      return last.notation;
    }

    redo(){
      const m = this.redoStack.pop();
      if(!m) return null;
      const st = this._make(m);
      this.historyStack.push({ ...m, notation:m.notation, snapshot:st });
      this.side = this._enemy();
      return m.notation;
    }

    gameStatus(){
      const legal = this._legalMoves();
      const inC = this.inCheck(this.side);
      if(legal.length===0){
        return inC ? 'checkmate' : 'stalemate';
      }
      return inC ? 'check' : 'ok';
    }
  }

  // UI helper class (grid + render)
  class ChessUI {
    constructor(boardEl, onSquareClick){
      this.el = boardEl;
      this.onSquareClick = onSquareClick || (()=>{});
      this.flipped=false;
      this.squares=[];
      this._build();
    }
    _build(){
      this.el.innerHTML='';
      this.squares = new Array(64);
      for(let i=0;i<64;i++){
        const d = document.createElement('div');
        d.className = `sq ${(i + Math.floor(i/8))%2 ? 'dark':'light'}`;
        d.dataset.idx=i;
        d.addEventListener('click',()=>this.onSquareClick(this._toAlg(i)));
        this.el.appendChild(d);
        this.squares[i]=d;
      }
    }
    _toAlg(i){ return "abcdefgh"[i%8] + (8-Math.floor(i/8)); }
    _fromAlg(a){ return (8-parseInt(a[1]))*8 + "abcdefgh".indexOf(a[0]); }
    toggleFlip(){ this.flipped=!this.flipped; }
    render(board, opts={}){
      const {lastMove=null, legal=[]} = opts;
      const legalIdx = new Set(legal.map(a=>typeof a==='string'? this._fromAlg(a):a));
      const lastFrom = lastMove? (typeof lastMove.from==='string'? this._fromAlg(lastMove.from):lastMove.from) : null;
      const lastTo   = lastMove? (typeof lastMove.to  ==='string'? this._fromAlg(lastMove.to):lastMove.to) : null;

      for(let i=0;i<64;i++){
        const idx = this.flipped? (63-i) : i;
        const sq = this.squares[i];
        const P = board[idx];

        sq.innerHTML='';
        sq.classList.remove('src','last');

        if(P){
          const span=document.createElement('span');
          span.className = `piece ${P.color===WHITE?'white':'black'}`;
          span.textContent = this._glyph(P);
          sq.appendChild(span);
        }
        if(lastFrom===idx) sq.classList.add('src');
        if(lastTo===idx) sq.classList.add('last');
        if(legalIdx.has(idx)){
          const dot=document.createElement('div'); dot.className='dot'; sq.appendChild(dot);
        }
      }
    }
    _glyph(p){
      // crisp, bold-like unicode; will look great bigger
      const mapW = {P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'};
      const mapB = {P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'};
      return p.color===WHITE ? mapW[p.piece] : mapB[p.piece];
    }
  }

  global.Chess = Chess;
  global.ChessUI = ChessUI;
})(window);
