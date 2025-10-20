/* Azbry Chess — glue UI + Engine + UX kecil */
(function(){
  "use strict";

  // ===== inject status & result modal jika belum ada =====
  function ensureStatusAndModal(){
    if(!document.getElementById('statusBar')){
      const sb=document.createElement('div'); sb.id='statusBar'; document.body.appendChild(sb);
    }
    if(!document.getElementById('resultModal')){
      const wrap=document.createElement('div'); wrap.id='resultModal'; wrap.innerHTML =
        '<div class="card">' +
          '<div id="resultTitle">Hasil</div>' +
          '<div id="resultDesc">—</div>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
            '<button id="btnRestart" class="btn accent">Mulai Ulang</button>' +
            '<button id="btnCloseModal" class="btn">Tutup</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(wrap);
      document.getElementById('btnCloseModal').onclick=()=>wrap.style.display='none';
      document.getElementById('btnRestart').onclick=()=>{ wrap.style.display='none'; ui.reset(); };
    }
  }
  ensureStatusAndModal();

  // ===== init UI =====
  const ui = createChessUI({
    boardId:'board',
    turnLabelId:'turnLabel',
    moveHistoryId:'moveHistory',
    btnResetId:'btnReset',
    btnUndoId:'btnUndo',
    btnRedoId:'btnRedo'
  });

  // ===== mode picker =====
  const btnHuman = document.getElementById('modeHuman');
  const btnAI    = document.getElementById('modeAI');
  let vsAI = JSON.parse(localStorage.getItem('az_chess_vsAI') ?? 'false');

  function saveMode(){ localStorage.setItem('az_chess_vsAI', JSON.stringify(vsAI)); }
  function applyMode(){
    ui.setVsAI(vsAI);
    btnHuman?.classList.toggle('active', !vsAI);
    btnAI?.classList.toggle('active', vsAI);
  }
  btnHuman?.addEventListener('click', ()=>{ vsAI=false; saveMode(); applyMode(); ui.reset(); });
  btnAI?.addEventListener('click',    ()=>{ vsAI=true;  saveMode(); applyMode(); ui.reset(); });
  applyMode();

  // ===== AI scheduling (Hitam) =====
  function scheduleAI(){
    if(!vsAI) return;
    if(ui.engine.getTurn() !== 'b') return;
    setTimeout(()=>{
      const best = ui.engine.think(2,'b'); // minimax depth-2
      ui.commitAIMove(best);
    }, 250);
  }

  // hook ke updateTurnBar supaya AI otomatis jalan
  const _origUpdate = ui.updateTurnBar;
  ui.updateTurnBar = function(){
    _origUpdate();
    scheduleAI();
  };

  // ===== Board Only / Back =====
  document.getElementById('btnBoardOnly')?.addEventListener('click', ()=>{
    document.body.classList.toggle('board-only');
  });
  document.getElementById('btnBack')?.addEventListener('click', ()=>{
    document.body.classList.remove('board-only');
  });

})();
