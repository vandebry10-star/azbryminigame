// /assets/js/main.js — Final Fix (check + checkmate alert)
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

  const capturedWhite = [];
  const capturedBlack = [];

  // helper: symbol bidak
  function glyph(p){
    const W={P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'};
    const B={P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'};
    return p.color==='w'?W[p.piece]:B[p.piece];
  }

  // render captured trays
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

  // convert algebraic ke index papan
  function algToIdx(a){ return (8 - parseInt(a[1],10))*8 + 'abcdefgh'.indexOf(a[0]); }

  function detectCapture(prev,next,fromAlg,toAlg){
    const fromIdx=algToIdx(fromAlg),toIdx=algToIdx(toAlg);
    for(let i=0;i<64;i++){
      if(i===fromIdx||i===toIdx)continue;
      const before=prev[i],after=next[i];
      if(before&&!after)return before;
    }
    return null;
  }

  function legalTargetsFrom(a){ return G.moves({square:a}).map(m=>m.to); }

  function render(highlights=[]){
    ui.render(G.board(),{legal:highlights,lastMove});

    // highlight jika sedang check
    if(G.inCheck(G.turn())){
      const kingIdx=G._kingIndex(G.turn());
      const cell=ui.cells[ui.flip?(63-kingIdx):kingIdx];
      if(cell)cell.classList.add('check');
    }

    // tampilkan history
    const h=G.history();
    let out='';
    for(let i=0;i<h.length;i+=2){
      out+=`${(i/2)+1}. ${h[i]??''} ${h[i+1]??''}\n`;
    }
    if($hist)$hist.textContent=out||'_';
  }

  // eksekusi langkah
  function tryMove(from,to){
    const prev=JSON.parse(JSON.stringify(G.board()));
    let ok=G.move({from,to})||G.move({from,to,promotion:'Q'});
    if(!ok)return false;

    const cap=detectCapture(prev,G.board(),from,to);
    if(cap){
      (cap.color==='w'?capturedWhite:capturedBlack).push(cap);
      renderCaptures();
    }

    lastMove={from,to};
    selected=null;
    render([]);

    // cek status permainan
    const status=G.gameStatus();
    if(status==='checkmate'){
      const winner=(G.turn()==='w')?'Hitam':'Putih';
      window.__azbrySetResult({
        text:`${winner} Menang!`,
        subText:'Skakmat ⚔️'
      });
    }else if(status==='stalemate'){
      window.__azbrySetResult({
        text:'Seri 🤝',
        subText:'Stalemate — tidak ada langkah sah'
      });
    }

    // AI (jika aktif)
    if(vsAI&&!['checkmate','stalemate'].includes(status)){
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

  // tombol toolbar
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

  render([]);renderCaptures();
})();
