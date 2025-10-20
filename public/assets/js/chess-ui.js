/* Azbry Chess — UI (render, interaksi papan & panel) + TRUE perspective
 * Butuh: createChessEngine() dari chess-engine.js
 */
(function(global){
  "use strict";

  function el(id){ return document.getElementById(id); }

  function createChessUI(opts){
    const {
      boardId='board',
      turnLabelId='turnLabel',
      moveHistoryId='moveHistory',
      btnResetId='btnReset',
      btnUndoId='btnUndo',
      btnRedoId='btnRedo'
    } = opts || {};

    const BOARD = el(boardId);
    const TURN  = el(turnLabelId);
    const LOG   = el(moveHistoryId);

    const engine = global.createChessEngine();
    let sel=null, legal=[], onAIMove=null, vsAI=false;

    // ======== TRUE PERSPECTIVE (NO CSS ROTATE) ========
    // 'w' = white bottom (default), 'b' = black bottom
    let perspective = localStorage.getItem('az_chess_persp') || 'w';
    function setPerspective(side){
      perspective = (side==='b') ? 'b' : 'w';
      localStorage.setItem('az_chess_persp', perspective);
      drawBoard();
    }
    function rowsOrder(){ return (perspective==='w') ? [...Array(8).keys()] : [...Array(8).keys()].reverse(); }
    function colsOrder(){ return (perspective==='w') ? [...Array(8).keys()] : [...Array(8).keys()].reverse(); }
    function labelFile(idx){ const files='abcdefgh'; return (perspective==='w') ? files[idx] : files[7-idx]; }
    function labelRank(idx){ const ranks=[8,7,6,5,4,3,2,1]; return (perspective==='w') ? ranks[idx] : ranks[7-idx]; }

    function fmtTurn(){
      const isWhite = (engine.getTurn()==='w');
      return `${isWhite?'⚪':'⚫'} ${isWhite?'Putih':'Hitam'}`;
    }

    function drawBoard(){
      const B = engine.getBoard();
      BOARD.innerHTML = '';
      const rIdx = rowsOrder(), cIdx = colsOrder();
      for(let i=0;i<8;i++){
        for(let j=0;j<8;j++){
          const r = rIdx[i], c = cIdx[j];
          const d = document.createElement('div');
          d.className = 'square ' + (((r+c)%2)?'dark':'light');
          d.dataset.r = r; d.dataset.c = c;
          const p = B[r][c];
          if(p!=='.') d.textContent = engine.ICON[p] || '';

          // coordinates (render di sisi bawah/kanan papan sesuai perspektif)
          if(i===7){ const f=document.createElement('span'); f.className='coord file'; f.textContent=labelFile(j); d.appendChild(f); }
          if(j===0){ const k=document.createElement('span'); k.className='coord rank'; k.textContent=labelRank(i); d.appendChild(k); }

          d.addEventListener('click', onSquareClick);
          BOARD.appendChild(d);
        }
      }
      updateTurnBar();
    }

    function clearMarks(){
      [...BOARD.children].forEach(e=>{
        e.classList.remove('sel','move');
        const d=e.querySelector('.dot'); if(d) d.remove();
      });
    }
    function markSelected(){
      clearMarks();
      if(!sel) return;
      // cari index visual dari koordinat real
      const rIdx = rowsOrder(), cIdx = colsOrder();
      const vi = rIdx.indexOf(sel.r), vj = cIdx.indexOf(sel.c);
      const idx = vi*8 + vj;
      BOARD.children[idx]?.classList.add('sel');

      for(const m of legal){
        const ti = rIdx.indexOf(m.to.r), tj = cIdx.indexOf(m.to.c);
        const el = BOARD.children[ti*8 + tj];
        if(!el) continue;
        el.classList.add('move');
        const dot=document.createElement('div'); dot.className='dot'; el.appendChild(dot);
      }
    }

    function updateTurnBar(){
      TURN.textContent = fmtTurn();
      const sb = document.getElementById('statusBar');
      if(sb){
        if(engine.isCheck(engine.getTurn())){ sb.style.display='block'; sb.textContent='CHECK!'; }
        else { sb.style.display='none'; }
      }
    }

    function updateLog(){
      const lines = engine.historySAN();
      LOG.textContent = lines.length ? lines.join('\n') : '_';
      LOG.scrollTop = LOG.scrollHeight;
    }

    function onSquareClick(e){
      if(vsAI && engine.getTurn()==='b') return; // tunggu AI gerak
      const r = +e.currentTarget.dataset.r;
      const c = +e.currentTarget.dataset.c;
      const B = engine.getBoard();
      const p = B[r][c];

      if(!sel){
        if(p!=='.' && ((engine.getTurn()==='w' && /[PNBRQK]/.test(p)) || (engine.getTurn()==='b' && /[pnbrqk]/.test(p)))){
          sel={r,c};
          legal=engine.legalMovesAt(r,c);
          markSelected();
        }
        return;
      }
      if(sel.r===r && sel.c===c){ sel=null; legal=[]; clearMarks(); return; }

      const mv = legal.find(m => m.to.r===r && m.to.c===c);
      if(mv){
        const promo = promoIfNeeded(sel,{r,c});
        engine.makeMove(sel,{r,c},promo);
        sel=null; legal=[]; clearMarks();
        drawBoard(); updateLog();

        const st=engine.statusInfo();
        if(st.end){ showResult(st); }
        else if(vsAI && engine.getTurn()==='b' && typeof onAIMove==='function'){ onAIMove(); }
        return;
      }

      if(p!=='.' && ((engine.getTurn()==='w' && /[PNBRQK]/.test(p)) || (engine.getTurn()==='b' && /[pnbrqk]/.test(p)))){
        sel={r,c}; legal=engine.legalMovesAt(r,c); markSelected();
      }else{ sel=null; legal=[]; clearMarks(); }
    }

    function promoIfNeeded(from,to){
      const p=engine.getBoard()[from.r][from.c];
      if(p==='P' && to.r===0) return 'Q';
      if(p==='p' && to.r===7) return 'q';
      return null;
    }

    function showResult(st){
      const box=el('resultModal'), title=el('resultTitle'), desc=el('resultDesc');
      if(!box||!title||!desc) return;
      if(st.type==='checkmate'){
        title.textContent='Checkmate';
        const w=(st.winner==='w')?'Putih':'Hitam';
        desc.textContent=`${w} menang. Tekan "Mulai Ulang" untuk main lagi.`;
      }else if(st.type==='stalemate'){
        title.textContent='Stalemate'; desc.textContent='Seri. Tekan "Mulai Ulang" untuk main lagi.';
      }else{ title.textContent='Hasil'; desc.textContent='Permainan selesai.'; }
      box.style.display='grid';
    }

    function reset(){ engine.reset(); sel=null; legal=[]; clearMarks(); drawBoard(); updateLog(); }
    function undo(){ const m=engine.undo(); if(!m) return; sel=null; legal=[]; clearMarks(); drawBoard(); updateLog(); }
    function redo(){ const m=engine.redo(); if(!m) return; sel=null; legal=[]; clearMarks(); drawBoard(); updateLog(); }

    // boot
    drawBoard(); updateLog();

    // Public API
    return {
      engine,
      drawBoard, updateTurnBar, updateLog,
      reset, undo, redo,
      setVsAI(flag){ vsAI=!!flag; },
      setAICallback(fn){ onAIMove = (typeof fn==='function') ? fn : null; },
      setPerspective,   // ← panggil dari main/injeksi tombol flip
      commitAIMove(move){
        if(!move) return false;
        engine.makeMove(move.from, move.to, move.promo||null);
        drawBoard(); updateLog();
        const st=engine.statusInfo();
        if(st.end) showResult(st);
        return true;
      }
    };
  }

  global.createChessUI = createChessUI;

})(window);
