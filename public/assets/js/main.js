/* AZBRY CHESS – MAIN (FIX)
   - simpan history {prev,next,note}
   - undo/redo jalan
   - board only toggle
   - toast untuk check/checkmate
*/
(() => {
  window.currentTurnColor = 'white';
  let mode = 'human'; // 'ai' nanti

  const history = [];   // { prev, next, note }
  const redo   = [];
  const logEl  = document.getElementById('moveHistory');
  const board  = () => window.boardState;
  const clone  = b => b.map(r=>r.map(p=>p?{...p}:null));

  const file = i => String.fromCharCode(97+i);
  const rank = j => 8-j;
  const alg  = ([fx,fy],[tx,ty]) => `${file(fx)}${rank(fy)} → ${file(tx)}${rank(ty)}`;

  function renderLog(){
    if(!logEl){return;}
    if(!history.length){ logEl.textContent='—'; return; }
    logEl.textContent = history.map((h,i)=>`${i+1}. ${h.note}`).join('\n');
  }
  function toast(msg){
    let w=document.getElementById('resultModal');
    if(!w){ w=document.createElement('div'); w.id='resultModal';
      w.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:20px;background:#202225;color:#e6ffe6;padding:10px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.4);z-index:10000';
      document.body.appendChild(w);
    }
    w.textContent=msg; w.style.display='block';
    setTimeout(()=>w.style.display='none',1400);
  }

  // dipanggil UI setelah makeMove sukses; prev= snapshot sebelum langkah
  window.onMoveApplied = (from,to, prev) => {
    const note = alg(from,to);
    const next = clone(board());
    history.push({ prev, next, note });
    redo.length = 0;
    renderLog();

    const sideNext = (window.currentTurnColor==='white')?'black':'white';
    const st = window.getGameStatus(sideNext);
    if(st.mate){ toast(`${sideNext==='white'?'Putih':'Hitam'} MAT!`); }
    else if(st.check){ toast('Check!'); }

    window.currentTurnColor = sideNext;
  };

  // tombol
  document.getElementById('btnReset')?.addEventListener('click', ()=>{
    window.initBoard(); window.currentTurnColor='white';
    history.length=0; redo.length=0;
    window.UIChess?.rebuild(); renderLog();
  });

  document.getElementById('btnUndo')?.addEventListener('click', ()=>{
    if(!history.length) return;
    const last = history.pop();
    // simpan state sekarang ke redo
    redo.push({ prev: clone(board()), next: clone(board()), note:last.note });
    window.boardState = clone(last.prev);
    window.currentTurnColor = (window.currentTurnColor==='white')?'black':'white';
    window.UIChess?.render(); renderLog();
  });

  document.getElementById('btnRedo')?.addEventListener('click', ()=>{
    if(!redo.length) return;
    const step = redo.pop();
    // simpan state sekarang ke history
    history.push({ prev: clone(board()), next: clone(step.next), note: step.note });
    window.boardState = clone(step.next);
    window.currentTurnColor = (window.currentTurnColor==='white')?'black':'white';
    window.UIChess?.render(); renderLog();
  });

  document.getElementById('btnFlip')?.addEventListener('click', ()=>{
    document.getElementById('board')?.classList.toggle('flip');
  });

  // Mode tombol (AI belum diaktifkan)
  document.getElementById('modeHuman')?.addEventListener('click', ()=>{
    mode='human';
    document.getElementById('modeHuman')?.classList.add('active');
    document.getElementById('modeAI')?.classList.remove('active');
  });
  document.getElementById('modeAI')?.addEventListener('click', ()=>{
    mode='ai';
    document.getElementById('modeAI')?.classList.add('active');
    document.getElementById('modeHuman')?.classList.remove('active');
    // TODO: panggil bot setelah giliran manusia
  });

  // Board Only = sembunyikan panel kontrol (toggle)
  document.getElementById('btnBoardOnly')?.addEventListener('click', ()=>{
    document.querySelector('.panel')?.classList.toggle('hidden');
  });
  // Kembali = reset state ringan (biar tidak mati)
  document.getElementById('btnBack')?.addEventListener('click', ()=>{
    window.initBoard(); window.currentTurnColor='white';
    history.length=0; redo.length=0;
    window.UIChess?.rebuild(); renderLog();
  });

  // init
  if(!window.boardState?.length) window.initBoard?.();
  window.UIChess?.rebuild();
  renderLog();
})();
