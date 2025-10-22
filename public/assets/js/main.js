// /assets/js/main.js — solid check highlight + captures + result modal
(function () {
  if (typeof window.Chess !== 'function' || typeof window.ChessUI !== 'function') {
    console.error('Chess / ChessUI tidak ditemukan.');
    return;
  }

  const G  = new Chess();
  const boardEl = document.getElementById('board');
  const ui = new ChessUI(boardEl, onSquareClick);
  const $hist = document.getElementById('moveHistory');

  // Trays: "Hitam tertangkap" = capBlack, "Putih tertangkap" = capWhite
  const $capBlack = document.getElementById('capBlack');
  const $capWhite = document.getElementById('capWhite');

  let selected = null;
  let lastMove = null;
  let vsAI = false;

  // ===== coordinates (a–h & 8–1) =====
  (function stampCoordinates(){
    const files = 'abcdefgh';
    const cells = boardEl.querySelectorAll('.sq');
    for (let i = 0; i < cells.length; i++) {
      const f = i % 8, r = (i/8)|0;
      cells[i].setAttribute('data-file', files[f]);
      cells[i].setAttribute('data-rank', String(8 - r));
    }
  })();

  // ===== captured trays =====
  const capturedBlack = []; // korban hitam
  const capturedWhite = []; // korban putih
  function glyph(p){
    const W={P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'};
    const B={P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'};
    return p.color==='w'?W[p.piece]:B[p.piece];
  }
  function renderCaptures(){
    if ($capBlack){ $capBlack.innerHTML=''; for(const p of capturedBlack){ const s=document.createElement('span'); s.className='cap-piece'; s.textContent=glyph(p); $capBlack.appendChild(s);} }
    if ($capWhite){ $capWhite.innerHTML=''; for(const p of capturedWhite){ const s=document.createElement('span'); s.className='cap-piece'; s.textContent=glyph(p); $capWhite.appendChild(s);} }
  }

  // ===== helpers =====
  function algToIdx(a){ return (8 - parseInt(a[1],10))*8 + 'abcdefgh'.indexOf(a[0]); }
  function legalTargetsFrom(a){ return G.moves({square:a}).map(m=>m.to); }

  // deteksi bidak tertangkap (normal + en-passant)
  function detectCapture(prevBoard, nextBoard, fromAlg, toAlg){
    const fromIdx = algToIdx(fromAlg);
    const toIdx   = algToIdx(toAlg);
    const mover   = prevBoard[fromIdx];

    const prevTo = prevBoard[toIdx];
    const nowTo  = nextBoard[toIdx];
    // capture normal: to berisi lawan, sekarang berganti warna
    if (prevTo && nowTo && prevTo.color !== nowTo.color) return prevTo;

    // en-passant: pion diagonal ke kotak kosong, korban di belakang 'to'
    if (mover && mover.piece === 'P' && prevTo == null) {
      const fromFile = fromIdx % 8, toFile = toIdx % 8;
      if (fromFile !== toFile) {
        const capSq = toIdx + (mover.color === 'w' ? 8 : -8);
        const victim = prevBoard[capSq];
        if (victim) return victim;
      }
    }
    return null;
  }

  function clearCheckHighlight(){
    if (!ui || !ui.cells) return;
    for (const c of ui.cells) c.classList.remove('check');
  }

  // highlight check yang AKURAT: cek kedua sisi, tandai raja sisi yang benar
  function markCheckIfAny(){
    clearCheckHighlight();
    let sideChecked = null;
    if (G.inCheck('w')) sideChecked = 'w';
    else if (G.inCheck('b')) sideChecked = 'b';
    if (!sideChecked) return;

    const k = G._kingIndex(sideChecked);
    const cell = ui.cells[ui.flip ? (63 - k) : k];
    if (cell) cell.classList.add('check');
  }

  function render(highlights=[]){
    ui.render(G.board(), { legal:highlights, lastMove });
    markCheckIfAny();

    // history
    const h=G.history();
    let out=''; for (let i=0;i<h.length;i+=2){ out+=`${(i/2)+1}. ${h[i]??''} ${h[i+1]??''}\n`; }
    if ($hist) $hist.textContent = out || '_';
  }

  function tryMove(from,to){
    const prev=JSON.parse(JSON.stringify(G.board()));
    const moved = G.move({from,to}) || G.move({from,to,promotion:'Q'});
    if(!moved) return false; // engine otomatis nolak langkah yang tak menghilangkan check

    // tray korban
    const cap = detectCapture(prev, G.board(), from, to);
    if (cap) { (cap.color==='b'?capturedBlack:capturedWhite).push(cap); renderCaptures(); }

    lastMove={from,to};
    selected=null;
    render([]);

    // status game
    const status=G.gameStatus();
    if(status==='checkmate'){
      const winner=(G.turn()==='w')?'Hitam':'Putih';
      window.__azbrySetResult?.({ text:`${winner} Menang!`, subText:'Skakmat ⚔️' });
    }else if(status==='stalemate'){
      window.__azbrySetResult?.({ text:'Seri 🤝', subText:'Stalemate — tidak ada langkah sah' });
    }

    // AI sederhana
    if (vsAI && !['checkmate','stalemate'].includes(status)) {
      const moves=G.moves();
      if (moves.length) {
        const m=moves[Math.floor(Math.random()*moves.length)];
        const prev2=JSON.parse(JSON.stringify(G.board()));
        G.move(m);
        const cap2=detectCapture(prev2, G.board(), m.from, m.to);
        if (cap2) { (cap2.color==='b'?capturedBlack:capturedWhite).push(cap2); renderCaptures(); }
        lastMove={from:m.from,to:m.to};
        render([]);
      }
    }
    return true;
  }

  function onSquareClick(a){
    if(!selected){
      const targets=legalTargetsFrom(a);
      if(!targets.length){render([]);return;}
      selected=a;render(targets);return;
    }
    if(a===selected){selected=null;render([]);return;}
    const ok=tryMove(selected,a);
    if(!ok){
      const maybe=legalTargetsFrom(a);
      if(maybe.length){selected=a;render(maybe);} else {selected=null;render([]);}
    }
  }

  // toolbar
  document.getElementById('btnReset')?.addEventListener('click',()=>{
    G.reset(); lastMove=null; selected=null;
    capturedBlack.length=0; capturedWhite.length=0;
    renderCaptures(); render([]);
  });
  document.getElementById('btnUndo')?.addEventListener('click',()=>{ if(G.undo()){ lastMove=null; render([]);} });
  document.getElementById('btnRedo')?.addEventListener('click',()=>{ if(G.redo()){ lastMove=null; render([]);} });
  document.getElementById('btnFlip')?.addEventListener('click',()=>{ ui.toggleFlip(); render(selected?legalTargetsFrom(selected):[]); });
  document.getElementById('modeHuman')?.addEventListener('click',()=>{
    vsAI=false; G.reset(); lastMove=null; selected=null;
    capturedBlack.length=0; capturedWhite.length=0;
    renderCaptures(); render([]);
  });
  document.getElementById('modeAI')?.addEventListener('click',()=>{
    vsAI=true; G.reset(); lastMove=null; selected=null;
    capturedBlack.length=0; capturedWhite.length=0;
    renderCaptures(); render([]);
  });

  render([]); renderCaptures();
})();
