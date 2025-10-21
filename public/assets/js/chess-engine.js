/* Azbry Chess Engine (final) */
(() => {
  const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const PIECE_VAL = { p:100, n:320, b:330, r:500, q:900, k:0 };
  const DIRS = {
    pW: [[-1,0],[-1,-1],[-1,1],[-2,0]],
    pB: [[1,0],[1,-1],[1,1],[2,0]],
    n: [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]],
    b: [[-1,-1],[-1,1],[1,-1],[1,1]],
    r: [[-1,0],[1,0],[0,-1],[0,1]],
    q: [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]
  };

  const i2rc = i => [Math.floor(i/8), i%8];
  const rc2i = (r,c) => r*8+c;
  const inside = (r,c)=> r>=0&&r<8&&c>=0&&c<8;

  class Engine {
    constructor() { this.loadFEN(START_FEN); this.stack = []; }

    loadFEN(fen){
      const [board, turn] = fen.split(" ");
      this.turn = turn || "w";
      this.squares = new Array(64).fill(".");
      let i=0;
      for(const ch of board){
        if(ch==='/') continue;
        if(/\d/.test(ch)) i+=parseInt(ch,10);
        else this.squares[i++]=ch;
      }
      this.stack.length=0;
      this.lastMove=null;
    }
    getTurn(){return this.turn}
    at(i){return this.squares[i]}

    clone(){ const e=new Engine(); e.squares=[...this.squares]; e.turn=this.turn; e.lastMove=this.lastMove?{...this.lastMove}:null; e.stack=[...this.stack]; return e; }

    makeMove(from,to,promo=null){
      const s=this.squares, piece=s[from];
      const captured=s[to]!=='.'?s[to]:null;
      // move
      s[to]=piece; s[from]='.';
      // pawn promotion (auto Queen)
      if((piece==='P' && Math.floor(to/8)===0) || (piece==='p' && Math.floor(to/8)===7)){
        s[to]=(this.turn==='w'? 'Q':'q');
      }
      this.stack.push({from,to,piece,captured, last:this.lastMove});
      this.lastMove={from,to};
      this.turn = (this.turn==='w'?'b':'w');
    }

    undo(){
      if(!this.stack.length) return;
      const {from,to,piece,captured,last}=this.stack.pop();
      this.squares[from]=piece;
      this.squares[to]=captured?captured:'.';
      this.turn=(this.turn==='w'?'b':'w');
      this.lastMove=last||null;
    }

    isOwn(ch){ return (this.turn==='w') ? /[A-Z]/.test(ch) : /[a-z]/.test(ch); }
    isOpp(ch){ return (this.turn==='w') ? /[a-z]/.test(ch) : /[A-Z]/.test(ch); }

    kingSquare(side=this.turn){
      const target = side==='w'?'K':'k';
      return this.squares.findIndex(x=>x===target);
    }

    inCheck(side=this.turn){
      const saveTurn=this.turn; this.turn=side;
      const ksq=this.kingSquare(side);
      this.turn=(side==='w'?'b':'w'); // generate opp moves that attack k
      const atk = this._attacksTo(ksq);
      this.turn=saveTurn;
      return atk;
    }

    _attacksTo(idx){
      // brute: generate opponent pseudo moves and see
      const saveTurn=this.turn; const res = this.pseudoMoves().some(m=>m.to===idx);
      this.turn=saveTurn; return res;
    }

    legalMoves(){
      const moves = this.pseudoMoves();
      const res=[];
      for(const m of moves){
        this.makeMove(m.from,m.to);
        const check = this.inCheck(this.turn==='w'?'b':'w');
        this.undo();
        if(!check) res.push(m);
      }
      return res;
    }

    pseudoMoves(){
      const s=this.squares, t=this.turn, out=[];
      for(let i=0;i<64;i++){
        const ch=s[i]; if(ch==='.' ) continue;
        if(t==='w' && /[A-Z]/.test(ch)===false) continue;
        if(t==='b' && /[a-z]/.test(ch)===false) continue;

        const [r,c]=i2rc(i);
        const lower=ch.toLowerCase();

        if(lower==='p'){
          const dirs = (t==='w')?DIRS.pW:DIRS.pB;
          for(let di=0;di<dirs.length;di++){
            const [dr,dc]=dirs[di];
            const nr=r+dr,nc=c+dc; if(!inside(nr,nc)) continue;
            const ni=rc2i(nr,nc);
            if(dc===0){ // maju
              if(s[ni]!=='.') continue;
              // langkah 2
              if(Math.abs(dr)===2){
                if((t==='w'&&r!==6)||(t==='b'&&r!==1)) continue;
                const mid=rc2i(r+(dr/2),c);
                if(s[mid]!=='*' && s[mid]!=='.') continue;
              }
              out.push({from:i,to:ni});
            }else{ // makan
              if(s[ni]!=='.' && this.isOpp(s[ni])) out.push({from:i,to:ni});
            }
          }
        }else{
          const addSlides=(vecs,repeat)=>{
            for(const [dr,dc] of vecs){
              let nr=r+dr,nc=c+dc;
              while(inside(nr,nc)){
                const ni=rc2i(nr,nc);
                if(s[ni]==='.') { out.push({from:i,to:ni}); if(!repeat) break; }
                else { if(this.isOpp(s[ni])) out.push({from:i,to:ni}); break; }
                nr+=dr; nc+=dc;
              }
            }
          };
          if(lower==='n') addSlides(DIRS.n,false);
          if(lower==='b') addSlides(DIRS.b,true);
          if(lower==='r') addSlides(DIRS.r,true);
          if(lower==='q') addSlides(DIRS.q,true);
          if(lower==='k'){
            addSlides(DIRS.q,false); // 8 arah 1 langkah
          }
        }
      }
      return out;
    }

    result(){
      const legal=this.legalMoves();
      if(legal.length===0){
        if(this.inCheck(this.turn)) return (this.turn==='w')?'# Black wins':'# White wins';
        return '½–½';
      }
      return null;
    }

    evaluate(){
      let score=0;
      for(const ch of this.squares){
        if(ch==='.') continue;
        const v=PIECE_VAL[ch.toLowerCase()];
        score += /[A-Z]/.test(ch)? v : -v;
      }
      return (this.turn==='w')? score : -score;
    }

    aiMove(depth=2){
      // minimax sangat ringan
      const best = this._minimax(depth, -1e9, 1e9).move;
      return best;
    }
    _minimax(depth,alpha,beta){
      const term = this.result();
      if(depth===0 || term){
        let val = this.evaluate();
        if(term==='½–½') val=0;
        else if(term==='# White wins') val=99999;
        else if(term==='# Black wins') val=-99999;
        return {score:val};
      }
      let bestMove=null;
      if(this.turn==='w'){
        let best=-1e9;
        for(const m of this.legalMoves()){
          this.makeMove(m.from,m.to);
          const r=this._minimax(depth-1,alpha,beta).score;
          this.undo();
          if(r>best){best=r; bestMove=m;}
          alpha=Math.max(alpha,best); if(beta<=alpha) break;
        }
        return {score:best, move:bestMove};
      }else{
        let best=1e9;
        for(const m of this.legalMoves()){
          this.makeMove(m.from,m.to);
          const r=this._minimax(depth-1,alpha,beta).score;
          this.undo();
          if(r<best){best=r; bestMove=m;}
          beta=Math.min(beta,best); if(beta<=alpha) break;
        }
        return {score:best, move:bestMove};
      }
    }
  }

  window.AZ_Engine = Engine;
})();
