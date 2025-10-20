/* Azbry Chess — UI (render, interaksi papan & panel)
 * Butuh: createChessEngine() dari chess-engine.js
 * Menyediakan: createChessUI({ mountIds })
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
      btnRedoId='btnRedo',
      btnBoardOnlyId='btnBoardOnly'
    } = opts || {};

    const BOARD = el(boardId);
    const TURN  = el(turnLabelId);
    const LOG   = el(moveHistoryId);

    const engine = global.createChessEngine(); // start position
    let sel = null;           // {r,c} selected
    let legal = [];           // legal moves from selected
    let onAIMove = null;      // callback untuk main.js
    let vsAI = false;         // state mode

    function fmtTurn(){
      const isWhite = (engine.getTurn()==='w');
      return `${isWhite?'⚪':'⚫'} ${isWhite?'Putih':'Hitam'}`;
    }

    function drawBoard(){
      const B = engine.getBoard();
      BOARD.innerHTML = '';
      for(let r=0;r<8;r++){
        for(let c=0;c<8;c++){
          const d = document.createElement('div');
          d.className = 'square ' + ((r+c)%2 ? 'dark':'light');
          d.dataset.r = r; d.dataset.c = c;
          const p = B[r][c];
          if(p!=='.') d.textContent = engine.ICON[p] || '';
          // coords
          if(r===7){ const f=document.createElement('span'); f.className='coord file'; f.textContent='abcdefgh'[c]; d.appendChild(f); }
          if(c===0){ const k=document.createElement('span'); k.className='coord rank'; k.textContent=8-r; d.appendChild(k); }
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
      const idx = sel.r*8 + sel.c;
      BOARD.children[idx]?.classList.add('sel');
      for(const m of legal){
        const el = BOARD.children[m.to.r*8 + m.to.c];
        if(!el) continue;
        el.classList.add('move');
        const dot = document.createElement('div');
        dot.className = 'dot'; el.appendChild(dot);
      }
    }

    function updateTurnBar(){
      TURN.textContent = fmtTurn();
      // show CHECK small banner
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
      if(vsAI && engine.getTurn()==='b') return; // tunggu AI
      const r = +e.currentTarget.dataset.r;
      const c = +e.currentTarget.dataset.c;
      const B = engine.getBoard();
      const p = B[r][c];

      if(!sel){
        if(p!=='.' && ( (engine.getTurn()==='w' && /[PNBRQK]/.test(p)) || (engine.getTurn()==='b' && /[pnbrqk]/.test(p)) )){
          sel = {r,c};
          legal = engine.legalMovesAt(r,c);
          markSelected();
        }
        return;
      }
      if(sel.r===r && sel.c===c){ sel=null; legal=[]; clearMarks(); return; }

      const mv = legal.find(m => m.to.r===r && m.to.c===c);
      if(mv){
        const promo = promoIfNeeded(sel, {r,c});
        engine.makeMove(sel, {r,c}, promo);
        sel=null; legal=[]; clearMarks();
        drawBoard(); updateLog();

        // status check + AI
        const st = engine.statusInfo();
        if(st.end){
          showResult(st);
        }else{
          if(vsAI && engine.getTurn()==='b' && typeof onAIMove==='function'){
            onAIMove(); // main.js will trigger AI after short delay
          }
        }
        return;
      }

      // reselect if clicked own piece
      if(p!=='.' && ( (engine.getTurn()==='w' && /[PNBRQK]/.test(p)) || (engine.getTurn()==='b' && /[pnbrqk]/.test(p)) )){
        sel={r,c};
        legal = engine.legalMovesAt(r,c);
        markSelected();
      }else{
        sel=null; legal=[]; clearMarks();
      }
    }

    function promoIfNeeded(from, to){
      const B = engine.getBoard();
      const p = B[from.r][from.c];
      if(p==='P' && to.r===0) return 'Q';
      if(p==='p' && to.r===7) return 'q';
      return null;
    }

    function showResult(st){
      const box = document.getElementById('resultModal');
      const title = document.getElementById('resultTitle');
      const desc  = document.getElementById('resultDesc');
      if(!box || !title || !desc) return;
      if(st.type==='checkmate'){
        title.textContent = 'Checkmate';
        const w = (st.winner==='w') ? 'Putih' : 'Hitam';
        desc.textContent = `${w} menang. Tekan "Mulai Ulang" untuk main lagi.`;
      }else if(st.type==='stalemate'){
        title.textContent = 'Stalemate';
        desc.textContent  = 'Seri. Tekan "Mulai Ulang" untuk main lagi.';
      }else{
        title.textContent = 'Hasil';
        desc.textContent  = 'Permainan selesai.';
      }
      box.style.display='grid';
    }

    // public controls
    function reset(){
      engine.reset();
      sel=null; legal=[]; clearMarks();
      drawBoard(); updateLog();
    }
    function undo(){
      const m = engine.undo(); if(!m) return;
      sel=null; legal=[]; clearMarks();
      drawBoard(); updateLog();
    }
    function redo(){
      const m = engine.redo(); if(!m) return;
      sel=null; legal=[]; clearMarks();
      drawBoard(); updateLog();
    }

    function setVsAI(flag){
      vsAI = !!flag;
    }

    // Hook default buttons if exist
    const btnReset = document.getElementById(btnResetId);
    const btnUndo  = document.getElementById(btnUndoId);
    const btnRedo  = document.getElementById(btnRedoId);
    if(btnReset) btnReset.onclick = ()=> reset();
    if(btnUndo)  btnUndo.onclick  = ()=> undo();
    if(btnRedo)  btnRedo.onclick  = ()=> redo();

    // First render
    drawBoard(); updateLog();

    // Expose a tiny API for main.js
    return {
      engine,
      drawBoard,
      updateTurnBar,
      updateLog,
      reset, undo, redo,
      setVsAI,
      // helper for AI: commit move object returned by engine.think()
      commitAIMove(move){
        if(!move) return false;
        engine.makeMove(move.from, move.to, move.promo||null);
        drawBoard(); updateLog();
        const st = engine.statusInfo();
        if(st.end) showResult(st);
        return true;
      }
    };
  }

  global.createChessUI = createChessUI;

})(window);
