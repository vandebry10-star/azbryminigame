/* AZBRY CHESS – UI (FIX)
   - build board, render pieces
   - highlight legal moves
   - kirim snapshot papan "sebelum langkah" ke main.js agar Undo/Redo jalan
*/
(() => {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;

  // ---- inject style kecil (hint/select) ----
  if (!document.getElementById('az-chess-ui-style')) {
    const st = document.createElement('style');
    st.id = 'az-chess-ui-style';
    st.textContent = `
      #board{display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1/1;user-select:none}
      #board.flip{transform:rotate(180deg)}
      #board.flip .pc{transform:rotate(180deg)}
      .sq{position:relative;display:flex;align-items:center;justify-content:center;border:0;background:transparent;font-size:clamp(18px,3.2vw,28px)}
      .sq.light{background:var(--azSquareLight,#e6eaee)}
      .sq.dark{background:var(--azSquareDark,#3c3f44)}
      .sq.selected{outline:3px solid #9BE27A;outline-offset:-3px}
      .sq.hint::after{content:"";position:absolute;width:28%;height:28%;border-radius:50%;background:rgba(155,226,122,.9);box-shadow:0 0 0 6px rgba(155,226,122,.18) inset}
      .sq.capture::after{width:70%;height:70%;border:4px solid rgba(155,226,122,.9);background:transparent}
      .pc{line-height:1;pointer-events:none}
    `;
    document.head.appendChild(st);
  }

  const id = (x,y)=>`sq-${x}-${y}`;
  let selected=null, legal=[];

  function build(){
    boardEl.innerHTML='';
    for(let y=0;y<8;y++){
      for(let x=0;x<8;x++){
        const b=document.createElement('button');
        b.type='button';
        b.className=`sq ${(x+y)%2?'dark':'light'}`;
        b.dataset.x=x;b.dataset.y=y;b.id=id(x,y);
        b.addEventListener('click',onClick);
        boardEl.appendChild(b);
      }
    }
  }
  function render(){
    for(let y=0;y<8;y++){
      for(let x=0;x<8;x++){
        const p=window.boardState?.[y]?.[x]||null;
        const s=document.getElementById(id(x,y));
        s.innerHTML=p?`<span class="pc">${p.symbol}</span>`:'';
      }
    }
  }
  function clearHints(){
    legal=[];
    document.querySelectorAll('#board .sq.hint,#board .sq.capture,#board .sq.selected')
      .forEach(n=>n.classList.remove('hint','capture','selected'));
  }
  function showHints(x,y){
    clearHints();
    document.getElementById(id(x,y))?.classList.add('selected');
    legal = window.getLegalMoves(x,y) || [];
    for(const [tx,ty] of legal){
      const t=document.getElementById(id(tx,ty));
      const piece=window.boardState?.[ty]?.[tx]||null;
      t.classList.add(piece?'capture':'hint');
    }
  }
  const turn=()=>window.currentTurnColor||'white';
  const clone=b=>b.map(r=>r.map(p=>p?{...p}:null));

  function onClick(e){
    const x=+e.currentTarget.dataset.x, y=+e.currentTarget.dataset.y;
    const piece=window.boardState?.[y]?.[x]||null;

    // klik target hint -> jalankan langkah
    if(selected && legal.some(([tx,ty])=>tx===x&&ty===y)){
      const prev = clone(window.boardState); // snapshot SEBELUM langkah
      const ok = window.makeMove([selected.x,selected.y],[x,y],turn());
      if(ok){
        window.onMoveApplied?.([selected.x,selected.y],[x,y], prev); // kirim snapshot ke main
        selected=null; clearHints(); render();
      }
      return;
    }
    // pilih buah milik yang jalan
    if(piece && piece.color===turn()){
      selected={x,y}; showHints(x,y);
    }else{
      selected=null; clearHints();
    }
  }

  window.UIChess = {
    rebuild(){ build(); render(); selected=null; clearHints(); },
    render, clearHints
  };

  if(!window.boardState?.length) window.initBoard?.();
  UIChess.rebuild();
})();
