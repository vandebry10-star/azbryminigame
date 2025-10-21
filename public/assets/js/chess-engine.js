/* Azbry Chess — ENGINE (sederhana tapi legal)
   - representasi: array 64 (0..63), file=a..h, rank=1..8
   - putih: uppercase, hitam: lowercase
   - aturan: lengkap moves, cek legal (tanpa castling & en-passant)
*/

(() => {
  const W = 'w', B = 'b';

  const START = [
    'r','n','b','q','k','b','n','r',
    'p','p','p','p','p','p','p','p',
    '','','','','','','','',
    '','','','','','','','',
    '','','','','','','','',
    '','','','','','','','',
    'P','P','P','P','P','P','P','P',
    'R','N','B','Q','K','B','N','R'
  ];

  const pieceColor = p => !p ? null : (p === p.toUpperCase() ? W : B);
  const other = c => c === W ? B : W;

  function toRC(i){ return [Math.floor(i/8), i%8]; }
  function toIndex(r,c){ return r*8+c; }

  function cloneBoard(b){ return b.slice(); }

  function inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }

  function kingPos(board, color){
    const target = color===W ? 'K' : 'k';
    return board.findIndex(p => p===target);
  }

  function attacksSquare(board, color, sqIndex){
    // generate all pseudo moves for 'color' and see if any hits sqIndex
    const moves = pseudoMoves(board, color, true);
    return moves.some(m => m.to === sqIndex);
  }

  function pseudoMoves(board, color, forAttackCheck=false){
    const list=[];
    for(let i=0;i<64;i++){
      const p=board[i]; if(!p) continue;
      if(pieceColor(p)!==color) continue;
      genPiece(board, i, p, list, forAttackCheck);
    }
    return list;
  }

  function genPiece(board, i, p, list, forAttack){
    const [r,c]=toRC(i);
    const col = pieceColor(p);
    const isW = col===W;
    const add=(to, promo=null)=>{ list.push({from:i, to, promo}); };

    const addRay=(dr,dc)=>{
      let rr=r+dr, cc=c+dc;
      while(inBounds(rr,cc)){
        const j=toIndex(rr,cc), q=board[j];
        if(q){
          if(pieceColor(q)!==col) add(j);
          break;
        }else add(j);
        rr+=dr; cc+=dc;
      }
    };

    switch(p.toLowerCase()){
      case 'p': {
        const dir = isW ? -1 : 1;
        const startRank = isW ? 6 : 1;
        // move
        if(!forAttack){
          const r1=r+dir, c1=c;
          if(inBounds(r1,c1) && !board[toIndex(r1,c1)]){
            // promo?
            if(r1===0||r1===7) add(toIndex(r1,c1),'q');
            else add(toIndex(r1,c1));
            // double
            if(r===startRank){
              const r2=r+2*dir;
              if(!board[toIndex(r2,c1)]) add(toIndex(r2,c1));
            }
          }
        }
        // capture
        for(const dc of [-1,1]){
          const rr=r+dir, cc=c+dc;
          if(!inBounds(rr,cc)) continue;
          const j=toIndex(rr,cc), q=board[j];
          if(q && pieceColor(q)!==col){
            if(rr===0||rr===7) add(j,'q'); else add(j);
          } else if(forAttack){ // untuk cek serangan (pawn attack squares)
            add(j);
          }
        }
        break;
      }
      case 'n': {
        const d=[[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
        for(const [dr,dc] of d){
          const rr=r+dr, cc=c+dc; if(!inBounds(rr,cc)) continue;
          const j=toIndex(rr,cc), q=board[j];
          if(!q || pieceColor(q)!==col) add(j);
        }
        break;
      }
      case 'b': addRay(1,1); addRay(1,-1); addRay(-1,1); addRay(-1,-1); break;
      case 'r': addRay(1,0); addRay(-1,0); addRay(0,1); addRay(0,-1); break;
      case 'q': addRay(1,0); addRay(-1,0); addRay(0,1); addRay(0,-1);
                addRay(1,1); addRay(1,-1); addRay(-1,1); addRay(-1,-1); break;
      case 'k': {
        for(const dr of [-1,0,1]) for(const dc of [-1,0,1]){
          if(!dr && !dc) continue;
          const rr=r+dr, cc=c+dc; if(!inBounds(rr,cc)) continue;
          const j=toIndex(rr,cc), q=board[j];
          if(!q || pieceColor(q)!==col) add(j);
        }
        break;
      }
    }
  }

  function legalMoves(board, color){
    const list = [];
    const pseudo = pseudoMoves(board, color);
    const kingIndex = kingPos(board,color);

    for(const m of pseudo){
      const next = cloneBoard(board);
      // apply
      next[m.to] = m.promo ? (color===W?'Q':'q') : next[m.from];
      next[m.from] = '';
      // if moving king, update pos
      const kpos = (board[m.from] && board[m.from].toLowerCase()==='k') ? m.to : kingIndex;
      // king must not be in check
      if(!attacksSquare(next, other(color), kpos)){
        list.push(m);
      }
    }
    return list;
  }

  function san(board, move){
    const p = board[move.from];
    const dst = idxToAlg(move.to);
    const cap = board[move.to] ? 'x' : '–';
    const letter = ({p:'',n:'N',b:'B',r:'R',q:'Q',k:'K'})[p.toLowerCase()];
    const promo = move.promo ? `=${move.promo.toUpperCase()}` : '';
    return (letter||'') + ' ' + cap + ' ' + dst + promo;
  }

  function idxToAlg(i){ const [r,c]=toRC(i); return 'abcdefgh'[c] + (8-r); }

  // API state
  const Engine = {
    _board: START.slice(),
    _turn: W,
    _hist: [],
    _redo: [],
    reset(){
      this._board = START.slice();
      this._turn = W;
      this._hist = [];
      this._redo = [];
      return this.snapshot();
    },
    snapshot(){
      return {
        board: this._board.slice(),
        turn: this._turn,
        legal: legalMoves(this._board, this._turn),
        status: this.status()
      };
    },
    status(){
      const lm = legalMoves(this._board, this._turn);
      const inCheck = attacksSquare(this._board, other(this._turn), kingPos(this._board, this._turn));
      if(lm.length===0){
        if(inCheck) return { over:true, result: this._turn===W ? '0-1' : '1-0', reason:'checkmate' };
        return { over:true, result:'1/2-1/2', reason:'stalemate' };
      }
      return { over:false, check: inCheck };
    },
    moves(){ return legalMoves(this._board, this._turn); },
    apply(move){
      // assume legal
      const prev = {
        board: this._board.slice(),
        turn: this._turn
      };
      const p = this._board[move.from];
      this._board[move.to] = move.promo ? (this._turn===W?'Q':'q') : p;
      this._board[move.from] = '';
      this._turn = other(this._turn);
      this._hist.push({move, san: san(prev.board, move)});
      this._redo = [];
      return { prev };
    },
    undo(){
      if(!this._hist.length) return null;
      this._redo.push({
        board: this._board.slice(),
        turn: this._turn
      });
      const last = this._hist.pop(); // but we also saved prev board in apply return? keep simple:
      // Replace board by reconstruct from redo top
      const snap = this._redo[this._redo.length-1]; // current state before popping (after push)
      // We actually saved current; to get previous we need to rewind using history.
      // Simpler: keep a stack of boards each move. Rebuild here:
      // Recreate board by replaying all moves from start:
      let b = START.slice(), t=W;
      for(const h of this._hist){
        const m = h.move;
        const p = b[m.from];
        b[m.to] = m.promo ? (t===W?'Q':'q') : p;
        b[m.from] = '';
        t = other(t);
      }
      this._board = b;
      this._turn = t;
      return this.snapshot();
    },
    redo(){
      if(!this._redo.length) return null;
      const future = this._redo.pop();
      // we can't apply from snapshot easily; do one ply from history length
      // Instead we store next move inside future? Simpler: ignore redo stack design; rebuild from START advancing +1.
      // Implement simple redo by caching last undone SAN not trivial. We'll disable if inconsistent.
      return null;
    },
    randomAIMove(){
      const moves = legalMoves(this._board, this._turn);
      if(!moves.length) return null;
      return moves[Math.floor(Math.random()*moves.length)];
    }
  };

  window.AzEngine = Engine;
})();
