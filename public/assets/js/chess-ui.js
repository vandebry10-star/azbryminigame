/* Azbry Chess UI (minimal) */
/* Membangun grid 8x8, render bidak, highlight legal & last move, flip */

(function () {
  // Unicode bidak biar kontras & gede
  const GLYPH = {
    wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
    bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟"
  };

  // util posisi
  function idxToRC(i){ return {r: Math.floor(i / 8), c: i % 8}; }
  function rcToIdx(r,c){ return r*8 + c; }

  class ChessUI {
    constructor(boardEl, onSquareClick){
      if(!boardEl) throw new Error("ChessUI: boardEl kosong");
      this.boardEl = boardEl;
      this.onSquareClick = onSquareClick || (()=>{});
      this.flipped = false;
      this.sqEls = [];
      this._build();
    }

    _build(){
      // pastikan class untuk styling sudah ada
      if(!this.boardEl.classList.contains("board")){
        this.boardEl.classList.add("board");
      }
      this.boardEl.innerHTML = "";
      this.sqEls = [];

      // 64 kotak
      for(let i=0;i<64;i++){
        const s = document.createElement("div");
        s.className = "sq " + (((Math.floor(i/8)+i)&1) ? "dark" : "light");
        s.dataset.idx = i;
        s.addEventListener("click", () => this.onSquareClick(i));
        this.boardEl.appendChild(s);
        this.sqEls.push(s);
      }
    }

    setFlip(v){
      this.flipped = !!v;
      this.boardEl.classList.toggle("flip", this.flipped);
    }

    clearMarks(){
      this.sqEls.forEach(el => el.classList.remove("src","move","last"));
    }

    markSource(i){
      const d = this._displayIdx(i);
      this.sqEls[d]?.classList.add("src");
    }

    markMoves(list){
      (list||[]).forEach(i=>{
        const d = this._displayIdx(i);
        this.sqEls[d]?.classList.add("move");
      });
    }

    markLast(from,to){
      if(from!=null){
        const df = this._displayIdx(from);
        this.sqEls[df]?.classList.add("last");
      }
      if(to!=null){
        const dt = this._displayIdx(to);
        this.sqEls[dt]?.classList.add("last");
      }
    }

    // Render array 64: null atau 'wP'/'bK' dst.
    render(boardArr){
      // bersihkan isi & marks ringan (kecuali last biar kelihatan)
      this.sqEls.forEach(s=>{
        s.innerHTML = "";
        s.classList.remove("src","move");
      });

      for(let i=0;i<64;i++){
        const disp = this._displayIdx(i);
        const sq = this.sqEls[disp];
        const piece = boardArr[i];
        if(!piece) continue;

        const span = document.createElement("span");
        span.className = "piece " + piece;
        span.textContent = GLYPH[piece] || "?";
        sq.appendChild(span);
      }
    }

    // convert indeks logika -> indeks tampilan kalau dibalik
    _displayIdx(i){
      if(!this.flipped) return i;
      const {r,c} = idxToRC(i);
      const rr = 7 - r, cc = 7 - c;
      return rcToIdx(rr, cc);
    }
  }

  // export global
  window.ChessUI = ChessUI;
})();
