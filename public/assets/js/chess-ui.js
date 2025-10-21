/* Azbry Chess — UI */
(() => {
  const boardEl = () => document.getElementById('board');
  const histEl  = () => document.getElementById('moveHistory');
  const toastEl = () => document.getElementById('resultToast');

  const PIECE_UNI = {
    'K':'♔','Q':'♕','R':'♖','B':'♗','N':'♘','P':'♙',
    'k':'♚','q':'♛','r':'♜','b':'♝','n':'♞','p':'♟'
  };

  let flipped = false;
  let selection = null; // index
  let legalMap = new Map(); // fromIndex -> [toIndex]
  let lastMove = null;

  function rc(i){ return [Math.floor(i/8), i%8]; }
  function idx(r,c){ return r*8+c; }
  function alg(i){ const [r,c]=rc(i); return 'abcdefgh'[c]+(8-r); }

  function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }

  function buildSquares(){
    const el = boardEl();
    clearChildren(el);
    const order = [...Array(64).keys()];
    // flip mapping (simply reverse display)
    const display = flipped ? order.slice().reverse() : order;
    display.forEach(i=>{
      const [r,c]=rc(i);
      const sq = document.createElement('div');
      sq.className = `square ${(r+c)%2===0?'light':'dark'}`;
      sq.dataset.i = i;
      sq.addEventListener('click', onSquareClick);
      el.appendChild(sq);
    });
  }

  function drawPieces(board){
    const el = boardEl();
    [...el.children].forEach(sq=>{
      const i = +sq.dataset.i;
      const p = board[i];
      sq.innerHTML='';
      if(p){
        const span = document.createElement('span');
        span.className='piece';
        span.textContent = PIECE_UNI[p];
        sq.appendChild(span);
      }
      sq.classList.remove('src','move','last');
      if(lastMove && (i===lastMove.from || i===lastMove.to)) sq.classList.add('last');
      if(selection===i) sq.classList.add('src');
      const legals = legalMap.get(selection)||[];
      if(legals.includes(i)) sq.classList.add('move');
    });
  }

  function setHistory(list){
    if(!list.length){ histEl().textContent = '–'; return; }
    histEl().textContent = list.map((h,idx)=>`${idx+1}. ${h.san}`).join('\n');
  }

  function toast(msg){
    const el = toastEl();
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 1800);
  }

  // Public hooks for MAIN
  window.AzUI = {
    reset(board, turn, legal, hist=[]){
      selection=null; lastMove=null; legalMap.clear();
      buildSquares(); drawPieces(board);
      setHistory(hist);
    },
    update(board, turn, legal, hist, last){
      lastMove = last || null;
      // rebuild legal map for selected source
      legalMap.clear();
      if(selection!=null){
        const srcMoves = legal.filter(m=>m.from===selection).map(m=>m.to);
        legalMap.set(selection, srcMoves);
      }
      drawPieces(board);
      setHistory(hist);
    },
    setFlipped(v){
      flipped = v;
      buildSquares();
    }
  };

  // Click handling (dispatch ke MAIN)
  function onSquareClick(e){
    const i = +e.currentTarget.dataset.i;
    if(window.onSquareClick) window.onSquareClick(i);
  }
})();
