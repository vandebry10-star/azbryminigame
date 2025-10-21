/* Azbry Chess UI (final) */
(() => {
  const PIECE_GLYPH = {
    K:"♔", Q:"♕", R:"♖", B:"♗", N:"♘", P:"♙",
    k:"♚", q:"♛", r:"♜", b:"♝", n:"♞", p:"♟"
  };
  const i2rc = i => [Math.floor(i/8), i%8];

  class UI {
    constructor(boardEl, onSquareClick){
      if(!boardEl) throw new Error("boardEl required");
      this.boardEl = boardEl;
      this.onSquareClick = onSquareClick || (()=>{});
      this.squares = new Array(64);
      this.flipped=false;
      this._build();
    }
    _build(){
      this.boardEl.innerHTML="";
      for(let i=0;i<64;i++){
        const sq=document.createElement("div");
        const [,c]=i2rc(i);
        sq.className = "square " + ((c%2) ? "dark":"light");
        sq.dataset.idx=i;
        sq.addEventListener("click", e => this.onSquareClick(parseInt(sq.dataset.idx,10)));
        this.boardEl.appendChild(sq);
        this.squares[i]=sq;
      }
    }
    render(pos, lastMove=null, legal=[], srcIdx=null){
      // clear
      for(let i=0;i<64;i++){
        const sq=this.squares[i];
        sq.classList.remove("src","last");
        const old= sq.querySelector(".piece"); if(old) old.remove();
        const hint = sq.querySelector(".hint"); if(hint) hint.remove();
      }
      // pieces
      for(let i=0;i<64;i++){
        const mapIdx = this.flipped ? (63-i) : i;
        const p = pos[mapIdx];
        if(p==='.'||!p) continue;
        const span=document.createElement("span");
        span.className="piece "+(/[A-Z]/.test(p)?"w":"b");
        span.textContent = PIECE_GLYPH[p] || "?";
        this.squares[i].appendChild(span);
      }
      // last move highlight
      if(lastMove){
        const a = this.flipped ? 63-lastMove.from : lastMove.from;
        const b = this.flipped ? 63-lastMove.to   : lastMove.to;
        this.squares[a]?.classList.add("last");
        this.squares[b]?.classList.add("last");
      }
      // legal hints
      if(srcIdx!=null){
        const srcMapped = this.flipped ? 63-srcIdx : srcIdx;
        this.squares[srcMapped]?.classList.add("src");
      }
      for(const m of legal){
        const t = this.flipped ? 63-m.to : m.to;
        const dot=document.createElement("span");
        dot.className="hint";
        this.squares[t]?.appendChild(dot);
      }
    }
    flip(){ this.flipped=!this.flipped; }
  }

  window.AZ_UI = UI;
})();
