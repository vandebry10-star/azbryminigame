// /assets/js/main.js — Capture fix + clean check highlight + result modal
(function () {
  if (typeof window.Chess !== 'function' || typeof window.ChessUI !== 'function') {
    console.error('Chess / ChessUI tidak ditemukan.');
    return;
  }

  const G  = new Chess();                                   // engine
  const boardEl = document.getElementById('board');
  const ui = new ChessUI(boardEl, onSquareClick);           // UI klik handler
  const $hist = document.getElementById('moveHistory');

  const $capWhite = document.getElementById('capWhite');
  const $capBlack = document.getElementById('capBlack');

  let selected = null;
  let lastMove = null;
  let vsAI = false;

  // trays (tidak di-undo/redo untuk simple UX)
  const capturedWhite = [];
  const capturedBlack = [];

  // --- helpers ---
  function glyph(p){
    const W={P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'};
    const B={P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'};
    return p.color==='w'?W[p.piece]:B[p.piece];
  }

  function renderCaptures(){
    if ($capWhite){
      $capWhite.innerHTML='';
      for(const p of capturedWhite){
        const s=document.createElement('span');
        s.className='cap-piece'; s.textContent=glyph(p);
        $capWhite.appendChild(s);
      }
    }
    if ($capBlack){
      $capBlack.innerHTML='';
      for(const p of capturedBlack){
        const s=document.createElement('span');
        s.className='cap-piece'; s.textContent=glyph(p);
        $capBlack.appendChild(s);
      }
    }
  }

  function algToIdx(a){ return (8 - parseInt(a[1],10))*8 + 'abcdefgh'.indexOf(a[0]); }

  // FIX: deteksi bidak tertangkap (capture biasa & en-passant)
  function detectCapture(prevBoard, nextBoard, fromAlg, toAlg){
    const fromIdx = algToIdx(fromAlg);
    const toIdx   = algToIdx(toAlg);
    const mover   = prevBoard[fromIdx];          // {color, piece}

    // 1) capture normal: sebelum di 'to' ada bidak lawan, sekarang diganti bidak kita
    const prevTo = prevBoard[toIdx];
    const nowTo  = nextBoard[toIdx];
    if (prevTo && nowTo && prevTo.color !== nowTo.color) {
      return prevTo; // yang hilang adalah prevTo
    }

    // 2) en-passant: pion bergerak diagonal ke petak kosong (prevTo==null)
    //    maka bidak lawan hilang di belakang 'to'
    if (mover && mover.piece === 'P' && prevTo == null) {
      const fromFile = fromIdx % 8;
      const toFile   = toIdx % 8;
      if (fromFile !== toFile) {
        const capSq = toIdx + (mover.color === 'w' ? 8 : -8);
        const victim = prevBoard[capSq];
        if (victim) return victim;
      }
    }

    // default: tidak ada capture
    return null;
  }

  function legalTargetsFrom(a){ return G.moves({square:a}).map(m=>m.to); }

  function clearCheckHighlight(){
    if (!ui || !ui.cells) return;
    for (const cell of ui.cells) cell.classList.remove('check');
  }

  function render(highlights=[]){
    ui.render(G.board(),{legal:highlights,lastMove});

    // bersihkan lalu set highlight check (biar gak nempel)
    clearCheckHighlight();
    if(G.inCheck(G.turn())){
      const kingIdx=G._kingIndex(G.turn());
      const cell=ui.cells[ui.flip?(63-kingIdx):kingIdx];
      if(cell)cell.classList.add('check');
    }

    // history -> <pre>
    const h=G.history();
    let out='';
    for(let i=0;i<h.length;i+=2){
      out+=`${(i/2)+1}. ${h[i]??''} ${h[i+1]??''}\n`;
    }
    if($hist)$hist.textContent=out||'_';
  }

  // eksekusi langkah satu sisi
  function tryMove(from,to){
    const prev=JSON.parse(JSON.stringify(G.board()));

    // jalankan (pakai promosi default 'Q' bila perlu)
    const played = G.move({from,to}) || G.move({from,to,promotion:'Q'});
    if(!played)return false;

    // deteksi & simpan capture
    const cap=detectCapture(prev,G.board(),from,to);
    if(cap){
      (cap.color==='w'?capturedWhite:capturedBlack).push(cap);
      renderCaptures();
    }

    lastMove={from,to};
    selected=null;
    render([]);

    // cek status game & tampilkan modal
    const status=G.gameStatus();
    if(status==='checkmate'){
      const winner=(G.turn()==='w')?'Hitam':'Putih';
      window.__azbrySetResult?.({
        text:`${winner} Menang!`,
        subText:'Skakmat ⚔️'
      });
    }else if(status==='stalemate'){
      window.__azbrySetResult?.({
        text:'Seri 🤝',
        subText:'Stalemate — tidak ada langkah sah'
      });
    }

    // AI sederhana (opsional)
    if(vsAI && !['checkmate','stalemate'].includes(status)){
      const moves=G.moves();
      if(moves.length){
        const m=moves[Math.floor(Math.random()*moves.length)];
        const prev2=JSON.parse(JSON.stringify(G.board()));
        G.move(m);
        const cap2=detectCapture(prev2,G.board(),m.from,m.to);
        if(cap2){(cap2.color==='w'?capturedWhite:capturedBlack).push(cap2);renderCaptures();}
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
      if(maybe.length){selected=a;render(maybe);}
      else{selected=null;render([]);}
    }
  }

  // toolbar
  document.getElementById('btnReset')?.addEventListener('click',()=>{
    G.reset();lastMove=null;selected=null;
    capturedWhite.length=0;capturedBlack.length=0;
    renderCaptures();render([]);
  });
  document.getElementById('btnUndo')?.addEventListener('click',()=>{
    if(G.undo()){lastMove=null;render([]);}
  });
  document.getElementById('btnRedo')?.addEventListener('click',()=>{
    if(G.redo()){lastMove=null;render([]);}
  });
  document.getElementById('btnFlip')?.addEventListener('click',()=>{
    ui.toggleFlip();render(selected?legalTargetsFrom(selected):[]);
  });
  document.getElementById('modeHuman')?.addEventListener('click',()=>{
    vsAI=false;G.reset();lastMove=null;selected=null;
    capturedWhite.length=0;capturedBlack.length=0;
    renderCaptures();render([]);
  });
  document.getElementById('modeAI')?.addEventListener('click',()=>{
    vsAI=true;G.reset();lastMove=null;selected=null;
    capturedWhite.length=0;capturedBlack.length=0;
    renderCaptures();render([]);
  });

  // first paint
  render([]);renderCaptures();
})();
