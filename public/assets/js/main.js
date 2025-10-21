/* AZBRY CHESS – MAIN (FINAL PATCH)
   - AI vs Azbry-MD (AI = hitam), evaluasi sederhana (material + prefer capture)
   - Undo/Redo & riwayat: sudah ok, tetap dipakai
   - Board Only: sembunyikan panel (toggle)
   - Hasil akhir (Checkmate/Stalemate): modal “Menang/Kalah” + lock papan
*/
(() => {
  window.currentTurnColor = 'white';
  let mode = 'human';         // 'human' | 'ai'
  const aiColor = 'black';     // AI main hitam
  let gameOver = false;

  const H = [];   // history: { prev, next, note }
  const R = [];   // redo   : { prev, next, note }
  const logEl = document.getElementById('moveHistory');

  const board  = () => window.boardState;
  const clone  = b => b.map(r=>r.map(p=>p?{...p}:null));
  const file   = i => String.fromCharCode(97+i);
  const rank   = j => 8-j;
  const alg    = ([fx,fy],[tx,ty]) => `${file(fx)}${rank(fy)} → ${file(tx)}${rank(ty)}`;

  // ---------- UI bits ----------
  function renderLog(){
    if(!logEl) return;
    if(!H.length){ logEl.textContent = '—'; return; }
    logEl.textContent = H.map((h,i)=>`${i+1}. ${h.note}`).join('\n');
  }
  function toast(msg){
    let w=document.getElementById('resultModal');
    if(!w){
      w=document.createElement('div'); w.id='resultModal';
      w.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:20px;background:#202225;color:#e6ffe6;padding:10px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.4);z-index:10000';
      document.body.appendChild(w);
    }
    w.textContent=msg; w.style.display='block';
    setTimeout(()=>{ if(!gameOver) w.style.display='none'; },1200);
  }
  function showResultModal(winnerText){
    let m=document.getElementById('az-result');
    if(!m){
      m=document.createElement('div'); m.id='az-result';
      m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:10010';
      m.innerHTML = `
        <div style="background:#101214;color:#e8ffe8;padding:18px 20px;border-radius:16px;box-shadow:0 16px 60px rgba(0,0,0,.6);min-width:260px;text-align:center">
          <h3 style="margin:0 0 8px;font-size:18px">Game Selesai</h3>
          <p id="az-result-msg" style="opacity:.92;margin:0 0 12px"></p>
          <button id="az-result-ok" class="btn accent" style="padding:.6rem 1rem;border-radius:10px;background:#9BE27A;color:#111;border:0">Main Lagi</button>
        </div>`;
      document.body.appendChild(m);
      document.getElementById('az-result-ok').addEventListener('click', ()=>{
        m.remove(); // close
        // Reset game
        window.initBoard(); window.currentTurnColor='white';
        H.length=0; R.length=0; gameOver=false;
        window.UIChess?.rebuild(); renderLog();
        document.getElementById('resultModal')?.style && (document.getElementById('resultModal').style.display='none');
      });
    }
    document.getElementById('az-result-msg').textContent = winnerText;
    m.style.display='flex';
  }

  // ---------- engine adapters ----------
  function applyMove(from,to){
    if(gameOver) return false;
    const prev = clone(board());
    const ok = window.makeMove(from,to, window.currentTurnColor);
    if(ok){
      onHumanOrAiMoveCommitted(from,to, prev);
      return true;
    }
    return false;
  }
  // dipanggil UIChess ketika langkah manusia sukses (prev = snapshot sebelum jalan)
  window.onMoveApplied = (from,to, prev) => {
    onHumanOrAiMoveCommitted(from,to, prev);
  };

  function onHumanOrAiMoveCommitted(from,to, prev){
    const note = alg(from,to);
    const next = clone(board());
    H.push({ prev, next, note });
    R.length = 0;
    renderLog();

    // cek status utk sisi berikutnya
    const sideNext = (window.currentTurnColor==='white')?'black':'white';
    const st = window.getGameStatus(sideNext);
    if(st.mate){
      gameOver = true;
      const winner = (sideNext==='white') ? 'Hitam' : 'Putih';
      showResultModal(`${winner} menang (Checkmate).`);
    }else if(st.stalemate){
      gameOver = true;
      showResultModal('Seri (Stalemate).');
    }else if(st.check){
      toast('Check!');
    }

    // switch turn
    window.currentTurnColor = sideNext;

    // giliran AI?
    if(!gameOver) maybeAiTurn();
  }

  function allLegalMoves(color){
    const moves = [];
    for(let y=0;y<8;y++){
      for(let x=0;x<8;x++){
        const p = board()[y][x];
        if(!p || p.color!==color) continue;
        const list = window.getLegalMoves(x,y) || [];
        for(const [tx,ty] of list){ moves.push({from:[x,y], to:[tx,ty], piece:p}); }
      }
    }
    return moves;
  }

  // evaluasi sederhana
  const val = { 'P':100, 'N':320, 'B':330, 'R':500, 'Q':900, 'K':20000 };
  const scoreBoard = (b, color) => {
    let s=0;
    for(let y=0;y<8;y++) for(let x=0;x<8;x++){
      const p=b[y][x]; if(!p) continue;
      const sign = (p.color===color)?1:-1;
      s += sign * val[p.type.toUpperCase()];
    }
    return s;
  };

  function pickAiMove(color){
    // 1 ply lookahead + prefer capture
    const legal = allLegalMoves(color);
    if(!legal.length) return null;
    let best=null, bestScore=-1e9;

    for(const mv of legal){
      const before = clone(board());
      // coba
      const ok = window.makeMove(mv.from, mv.to, color);
      if(!ok){ window.boardState = before; continue; }
      const s = scoreBoard(board(), color) + (before[mv.to[1]][mv.to[0]] ? 50 : 0); // bonus capture
      if(s>bestScore){ bestScore=s; best=mv; }
      // revert
      window.boardState = before;
    }
    return best;
  }

  function maybeAiTurn(){
    if(mode!=='ai') return;
    if(gameOver) return;
    if(window.currentTurnColor !== aiColor) return;

    // kasih jeda biar natural
    setTimeout(()=>{
      const mv = pickAiMove(aiColor);
      if(!mv){ // tidak ada langkah
        const st = window.getGameStatus(aiColor);
        gameOver = true;
        if(st.mate) showResultModal('Putih menang (Checkmate).');
        else showResultModal('Seri.');
        return;
      }
      applyMove(mv.from, mv.to);
    }, 260);
  }

  // ---------- tombol ----------
  document.getElementById('btnReset')?.addEventListener('click', ()=>{
    window.initBoard(); window.currentTurnColor='white';
    H.length=0; R.length=0; gameOver=false;
    window.UIChess?.rebuild(); renderLog();
  });

  document.getElementById('btnUndo')?.addEventListener('click', ()=>{
    if(!H.length || gameOver && !document.getElementById('az-result')) return;
    const last = H.pop();
    R.push({ prev: clone(board()), next: clone(board()), note:last.note });
    window.boardState = clone(last.prev);
    window.currentTurnColor = (window.currentTurnColor==='white')?'black':'white';
    gameOver=false;
    window.UIChess?.render(); renderLog();
  });

  document.getElementById('btnRedo')?.addEventListener('click', ()=>{
    if(!R.length) return;
    const step = R.pop();
    H.push({ prev: clone(board()), next: clone(step.next), note: step.note });
    window.boardState = clone(step.next);
    window.currentTurnColor = (window.currentTurnColor==='white')?'black':'white';
    window.UIChess?.render(); renderLog();
    maybeAiTurn();
  });

  document.getElementById('btnFlip')?.addEventListener('click', ()=>{
    document.getElementById('board')?.classList.toggle('flip');
  });

  document.getElementById('modeHuman')?.addEventListener('click', ()=>{
    mode='human';
    document.getElementById('modeHuman')?.classList.add('active');
    document.getElementById('modeAI')?.classList.remove('active');
  });
  document.getElementById('modeAI')?.addEventListener('click', ()=>{
    mode='ai';
    document.getElementById('modeAI')?.classList.add('active');
    document.getElementById('modeHuman')?.classList.remove('active');
    maybeAiTurn();
  });

  // Board Only => sembunyikan .panel
  document.getElementById('btnBoardOnly')?.addEventListener('click', ()=>{
    document.querySelector('.panel')?.classList.toggle('hidden');
  });
  document.getElementById('btnBack')?.addEventListener('click', ()=>{
    window.initBoard(); window.currentTurnColor='white';
    H.length=0; R.length=0; gameOver=false;
    window.UIChess?.rebuild(); renderLog();
  });

  // ---------- init ----------
  if(!window.boardState?.length) window.initBoard?.();
  window.UIChess?.rebuild();
  renderLog();
})();
