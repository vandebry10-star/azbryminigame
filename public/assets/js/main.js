// /assets/js/main.js — VS Azbry-MD (Negamax + AlphaBeta + QSearch)
// Fitur: koordinat, tray capture, highlight check, result modal, AI kuat.
(function () {
  if (typeof window.Chess !== 'function' || typeof window.ChessUI !== 'function') {
    console.error('Chess / ChessUI tidak ditemukan.');
    return;
  }

  // ==================== KONFIGURASI AI ====================
  const AI_PROFILE = {
    name: 'ELO3000',
    timeMs: 2000,         // target waktu berpikir per langkah
    maxDepth: 7,          // kedalaman maksimum (iterative deepening)
    useQuiescence: true
  };

  // ===== util algebra <-> index (samakan dengan engine) =====
  const filesStr = 'abcdefgh';
  function idx(a){ return (8 - parseInt(a[1],10)) * 8 + filesStr.indexOf(a[0]); }
  function alg(i){ return filesStr[i % 8] + (8 - ((i/8)|0)); }

  // ==================== BOOTSTRAP UI/ENGINE ====================
  const G  = new Chess();
  const boardEl = document.getElementById('board');
  const ui = new ChessUI(boardEl, onSquareClick);
  const $hist = document.getElementById('moveHistory');
  const $capBlack = document.getElementById('capBlack');  // "Hitam tertangkap"
  const $capWhite = document.getElementById('capWhite');  // "Putih tertangkap"

  let selected = null;
  let lastMove = null;
  let vsAI = false;

  // stamp koordinat ke cell (a–h, 8–1)
  (function stampCoordinates(){
    const cells = boardEl.querySelectorAll('.sq');
    for (let i = 0; i < cells.length; i++) {
      const f = i % 8, r = (i/8)|0;
      cells[i].setAttribute('data-file', filesStr[f]);
      cells[i].setAttribute('data-rank', String(8 - r));
    }
  })();

  // ==================== CAPTURE TRAYS ====================
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

  // ==================== RENDER & STATUS ====================
  function legalTargetsFrom(a){ return G.moves({square:a}).map(m=>m.to); }
  function clearCheckHighlight(){ if (!ui || !ui.cells) return; for (const c of ui.cells) c.classList.remove('check'); }
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
    const h=G.history(); let out='';
    for (let i=0;i<h.length;i+=2) out+=`${(i/2)+1}. ${h[i]??''} ${h[i+1]??''}\n`;
    if ($hist) $hist.textContent = out || '_';
  }

  // ==================== CAPTURE DETECTOR ====================
  function detectCapture(prevBoard, nextBoard, fromAlg, toAlg){
    const fromIdx = idx(fromAlg), toIdx = idx(toAlg);
    const mover   = prevBoard[fromIdx];
    const prevTo = prevBoard[toIdx], nowTo = nextBoard[toIdx];
    if (prevTo && nowTo && prevTo.color !== nowTo.color) return prevTo;        // normal
    if (mover && mover.piece === 'P' && prevTo == null) {                      // en-passant
      const fromFile = fromIdx % 8, toFile = toIdx % 8;
      if (fromFile !== toFile) {
        const capSq = toIdx + (mover.color === 'w' ? 8 : -8);
        return prevBoard[capSq] || null;
      }
    }
    return null;
  }

  // ==================== AI: EVALUATION ====================
  // nilai material + PST (middlegame-ish)
  const VAL = { P:100, N:320, B:330, R:500, Q:900, K:0 };
  const PST = {
    // 0=a8 .. 63=h1 ; untuk hitam dipakai mirror vertikal
    P: [
       0,  0,  0,  0,  0,  0,  0,  0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
       5,  5, 10, 27, 27, 10,  5,  5,
       2,  2,  5, 25, 25,  5,  2,  2,
       0,  0,  0, 20, 20,  0,  0,  0,
       5, -5,-10,  0,  0,-10, -5,  5,
       0,  0,  0,  0,  0,  0,  0,  0
    ],
    N: [
     -50,-40,-30,-30,-30,-30,-40,-50,
     -40,-20,  0,  5,  5,  0,-20,-40,
     -30,  5, 10, 15, 15, 10,  5,-30,
     -30,  0, 15, 20, 20, 15,  0,-30,
     -30,  5, 15, 20, 20, 15,  5,-30,
     -30,  0, 10, 15, 15, 10,  0,-30,
     -40,-20,  0,  0,  0,  0,-20,-40,
     -50,-40,-30,-30,-30,-30,-40,-50
    ],
    B: [
     -20,-10,-10,-10,-10,-10,-10,-20,
     -10,  5,  0,  0,  0,  0,  5,-10,
     -10, 10, 10, 10, 10, 10, 10,-10,
     -10,  0, 10, 10, 10, 10,  0,-10,
     -10,  5,  5, 10, 10,  5,  5,-10,
     -10,  0,  5, 10, 10,  5,  0,-10,
     -10,  0,  0,  0,  0,  0,  0,-10,
     -20,-10,-10,-10,-10,-10,-10,-20
    ],
    R: [
       0,  0,  5, 10, 10,  5,  0,  0,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
       5, 10, 10, 10, 10, 10, 10,  5,
       0,  0,  0,  0,  0,  0,  0,  0
    ],
    Q: [
     -20,-10,-10, -5, -5,-10,-10,-20,
     -10,  0,  0,  0,  0,  0,  0,-10,
     -10,  0,  5,  5,  5,  5,  0,-10,
      -5,  0,  5,  5,  5,  5,  0, -5,
       0,  0,  5,  5,  5,  5,  0, -5,
     -10,  5,  5,  5,  5,  5,  0,-10,
     -10,  0,  0,  0,  0,  0,  0,-10,
     -20,-10,-10, -5, -5,-10,-10,-20
    ],
    K: [
     -30,-40,-40,-50,-50,-40,-40,-30,
     -30,-40,-40,-50,-50,-40,-40,-30,
     -30,-40,-40,-50,-50,-40,-40,-30,
     -30,-40,-40,-50,-50,-40,-40,-30,
     -20,-30,-30,-40,-40,-30,-30,-20,
     -10,-20,-20,-20,-20,-20,-20,-10,
      20, 20,  0,  0,  0,  0, 20, 20,
      20, 30, 10,  0,  0, 10, 30, 20
    ]
  };
  function mirror(i){ return (7 - ((i/8)|0))*8 + (i%8); } // untuk PST hitam
  function evaluate(){
    const B = G.board();
    let score = 0;
    for (let i=0;i<64;i++){
      const p = B[i]; if(!p) continue;
      const sign = (p.color==='w') ? 1 : -1;
      const base = VAL[p.piece];
      const pst  = PST[p.piece][ p.color==='w' ? i : mirror(i) ];
      score += sign * (base + pst);
    }
    // dari sudut pandang side to move (negamax style):
    return (G.turn()==='w') ? score : -score;
  }

  // ==================== AI: MOVE ORDERING ====================
  function scoreMove(m){
    // MVV-LVA sederhana: nilai korban - nilai pelaku
    const B = G.board();
    const toPiece = B[idx(m.to)];
    const fromPiece = B[idx(m.from)];
    let s = 0;
    if (toPiece) s += 10*VAL[toPiece.piece] - VAL[fromPiece.piece];
    // prioritas promosi / check (kasar)
    if (m.promotion) s += 800;
    return s;
  }

  // ==================== AI: SEARCH ====================
  let nodes = 0;
  function qsearch(alpha, beta, endTime){
    // only captures to reduce horizon
    nodes++;
    const stand = evaluate();
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;

    const moves = G.moves();
    // filter: hanya capture
    const caps = [];
    for (const m of moves) {
      if (performance.now() > endTime) break;
      const target = G.board()[idx(m.to)];
      if (target) caps.push(m);
    }
    caps.sort((a,b)=>scoreMove(b)-scoreMove(a));

    for (const m of caps){
      if (performance.now() > endTime) break;
      if (!G.move(m)) continue;
      const score = -qsearch(-beta, -alpha, endTime);
      G.undo();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function negamax(depth, alpha, beta, endTime){
    if (performance.now() > endTime) return evaluate();
    if (depth === 0) {
      return AI_PROFILE.useQuiescence ? qsearch(alpha, beta, endTime) : evaluate();
    }
    nodes++;
    let best = -1e9;
    let legalFound = false;

    let moves = G.moves();
    moves.sort((a,b)=>scoreMove(b)-scoreMove(a));

    for (const m of moves){
      if (performance.now() > endTime) break;
      if (!G.move(m)) continue; // illegal after all? (engine already filters, but safe)
      legalFound = true;
      const score = -negamax(depth-1, -beta, -alpha, endTime);
      G.undo();
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break; // beta cut
    }
    if (!legalFound) {
      // tidak ada langkah legal → checkmate (-M) atau stalemate (0)
      const status = G.gameStatus();
      if (status === 'checkmate') return -999999 + (AI_PROFILE.maxDepth-depth); // prefer matting quicker
      return 0;
    }
    return best;
  }

  function bestMoveWithTime(timeMs, maxDepth){
    const endTime = performance.now() + timeMs;
    let best = null;
    nodes = 0;

    // root move ordering awal
    let rootMoves = G.moves();
    rootMoves.sort((a,b)=>scoreMove(b)-scoreMove(a));

    let bestScore = -1e9;

    for (let depth=1; depth<=maxDepth; depth++){
      if (performance.now() > endTime) break;
      let localBest = null;
      let localBestScore = -1e9;

      for (const m of rootMoves){
        if (performance.now() > endTime) break;
        if (!G.move(m)) continue;
        const sc = -negamax(depth-1, -1e9, 1e9, endTime);
        G.undo();

        if (sc > localBestScore) { localBestScore = sc; localBest = m; }
      }
      if (localBest) { best = localBest; bestScore = localBestScore; }

      // re-order root by last iteration PV
      if (best){
        rootMoves.sort((a,b)=>{
          if (a.from===best.from && a.to===best.to) return -1;
          if (b.from===best.from && b.to===best.to) return 1;
          return scoreMove(b)-scoreMove(a);
        });
      }
    }
    // fallback kalau kehabisan waktu
    return best || rootMoves[0] || null;
  }

  // ==================== GAME FLOW ====================
  function tryMove(from,to){
    const prev=JSON.parse(JSON.stringify(G.board()));
    const moved = G.move({from,to}) || G.move({from,to,promotion:'Q'});
    if(!moved) return false;

    // tray korban
    const cap = detectCapture(prev, G.board(), from, to);
    if (cap) { (cap.color==='b'?capturedBlack:capturedWhite).push(cap); renderCaptures(); }

    lastMove={from,to};
    selected=null;
    render([]);

    const status=G.gameStatus();
    if(status==='checkmate'){
      const winner=(G.turn()==='w')?'Hitam':'Putih';
      window.__azbrySetResult?.({ text:`${winner} Menang!`, subText:'Skakmat ⚔️' });
      return true;
    }else if(status==='stalemate'){
      window.__azbrySetResult?.({ text:'Seri 🤝', subText:'Stalemate — tidak ada langkah sah' });
      return true;
    }

    // giliran AI
    if (vsAI){
      setTimeout(()=> {
        const m = bestMoveWithTime(AI_PROFILE.timeMs, AI_PROFILE.maxDepth);
        if (!m) return;
        const prev2=JSON.parse(JSON.stringify(G.board()));
        G.move(m);
        const cap2=detectCapture(prev2, G.board(), m.from, m.to);
        if (cap2) { (cap2.color==='b'?capturedBlack:capturedWhite).push(cap2); renderCaptures(); }
        lastMove={from:m.from,to:m.to};
        render([]);

        const st2=G.gameStatus();
        if(st2==='checkmate'){
          const winner=(G.turn()==='w')?'Hitam':'Putih';
          window.__azbrySetResult?.({ text:`${winner} Menang!`, subText:'Skakmat ⚔️' });
        }else if(st2==='stalemate'){
          window.__azbrySetResult?.({ text:'Seri 🤝', subText:'Stalemate — tidak ada langkah sah' });
        }
      }, 10);
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

  // ==================== TOOLBAR ====================
  document.getElementById('btnReset')?.addEventListener('click',()=>{
    G.reset(); lastMove=null; selected=null;
    capturedBlack.length=0; capturedWhite.length=0;
    renderCaptures(); render([]);
  });
  document.getElementById('btnUndo')?.addEventListener('click',()=>{
    if(G.undo()){ lastMove=null; render([]); }
  });
  document.getElementById('btnRedo')?.addEventListener('click',()=>{
    if(G.redo()){ lastMove=null; render([]); }
  });
  document.getElementById('btnFlip')?.addEventListener('click',()=>{
    ui.toggleFlip(); render(selected?legalTargetsFrom(selected):[]);
  });
  document.getElementById('modeHuman')?.addEventListener('click',()=>{
    vsAI=false; G.reset(); lastMove=null; selected=null;
    capturedBlack.length=0; capturedWhite.length=0;
    renderCaptures(); render([]);
  });
  document.getElementById('modeAI')?.addEventListener('click',()=>{
    vsAI=true;  G.reset(); lastMove=null; selected=null;
    capturedBlack.length=0; capturedWhite.length=0;
    renderCaptures(); render([]);
  });

  // ==================== START ====================
  render([]); renderCaptures();
})();
