/* Glue: hubungkan UI <-> Engine, tombol, history, flip */

(function(){
  const elBoard   = document.getElementById('board');
  const elReset   = document.getElementById('btnReset');
  const elUndo    = document.getElementById('btnUndo');
  const elRedo    = document.getElementById('btnRedo');
  const elFlip    = document.getElementById('btnFlip');
  const elHist    = document.getElementById('moveHistory');
  const btnModeH  = document.getElementById('modeHuman');
  const btnModeAI = document.getElementById('modeAI');

  // engine wajib sudah ada
  const engine = new ChessEngine();
  const ui = new ChessUI(elBoard, onSquareClick);

  // state klik
  let selected = null;
  let legalCache = [];

  // mode
  let mode = 'human'; // 'human' | 'ai'

  // ----- init -----
  refreshAll();

  // ----- handlers tombol -----
  elReset?.addEventListener('click', ()=>{
    engine.reset();
    selected = null; legalCache = [];
    refreshAll(true);
  });

  elUndo?.addEventListener('click', ()=>{
    if(engine.undo) {
      engine.undo();
      selected = null; legalCache = [];
      refreshAll();
    }
  });

  elRedo?.addEventListener('click', ()=>{
    if(engine.redo) {
      engine.redo();
      selected = null; legalCache = [];
      refreshAll();
    }
  });

  elFlip?.addEventListener('click', ()=>{
    ui.setFlip(!ui.flipped);
  });

  btnModeH?.addEventListener('click', () => { mode='human'; btnModeH.classList.add('active'); btnModeAI?.classList.remove('active'); });
  btnModeAI?.addEventListener('click', () => { mode='ai';    btnModeAI.classList.add('active'); btnModeH?.classList.remove('active'); });

  // ----- klik papan -----
  function onSquareClick(idx){
    // kalau ada legal list dan idx ada di dalam -> eksekusi move
    if(selected!=null && legalCache.includes(idx)){
      const res = engine.move(selected, idx);
      selected=null; legalCache=[];
      refreshAll();

      // langkah AI (sederhana): langsung minta engine pilih
      if(mode==='ai' && engine.bestMove){
        const ai = engine.bestMove(); // {from,to}
        if(ai){
          engine.move(ai.from, ai.to, {ai:true});
          refreshAll();
        }
      }
      return;
    }

    // pilih kotak sebagai sumber
    // cek apakah bidak milik side yang jalan
    const bd = engine.board();
    const piece = bd[idx];
    if(!piece) { selected=null; legalCache=[]; ui.clearMarks(); return; }
    const turn = engine.turn && engine.turn() || 'w';
    const isWhite = piece && piece[0]==='w';
    if((turn==='w' && !isWhite) || (turn==='b' && isWhite)) return;

    selected = idx;
    ui.clearMarks();
    ui.markSource(idx);

    // dapatkan langkah legal
    legalCache = (engine.legalMovesFrom ? engine.legalMovesFrom(idx) : []) || [];
    ui.markMoves(legalCache);
  }

  // ----- render ulang -----
  function refreshAll(resetHistory=false){
    ui.render(engine.board());

    ui.clearMarks();
    const last = (engine.lastMove && engine.lastMove()) || null;
    if(last) ui.markLast(last.from, last.to);

    // status akhir
    if(engine.isCheckmate && engine.isCheckmate()){
      pushHistory("Checkmate! " + (engine.turn()==='w' ? "Hitam menang" : "Putih menang"));
      return;
    }
    if(engine.isStalemate && engine.isStalemate()){
      pushHistory("Seri (Stalemate)");
      return;
    }

    if(resetHistory) { elHist && (elHist.textContent = "—"); }
  }

  // ----- sejarah langkah -----
  function pushHistory(text){
    if(!elHist) return;
    if(elHist.textContent === "—") elHist.textContent = "";
    elHist.textContent += (elHist.textContent ? "\n" : "") + text;
  }

  // Expose kecil untuk debug di console
  window.__az = {engine, ui};
})();
