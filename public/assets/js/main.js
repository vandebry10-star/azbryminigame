/* Azbry Chess Main (final) */
(() => {
  const $ = sel => document.querySelector(sel);
  const boardEl   = $("#board");
  const btnReset  = $("#btnReset");
  const btnUndo   = $("#btnUndo");
  const btnRedo   = $("#btnRedo");
  const btnFlip   = $("#btnFlip");
  const modeHuman = $("#modeHuman");
  const modeAI    = $("#modeAI");
  const logEl     = $("#moveHistory");

  const eng = new AZ_Engine();
  const ui  = new AZ_UI(boardEl, onSquare);
  let mode = "human";           // "human" | "ai"
  let srcIdx = null;            // asal klik
  let redoStack = [];

  function sync(){
    const legal = srcIdx!=null ? eng.legalMoves().filter(m=>m.from===srcIdx) : [];
    ui.render(eng.squares, eng.lastMove, legal, srcIdx);
    logEl.textContent = movesSAN().join("  ") || "–";
  }
  function movesSAN(){
    // stack -> simple “e2-e4”
    return eng.stack.map(m=>{
      const a = idx2algebra(m.from), b=idx2algebra(m.to);
      return `${a} → ${b}`;
    });
  }
  function idx2algebra(i){
    const file = "abcdefgh"[i%8];
    const rank = 8 - Math.floor(i/8);
    return file+rank;
  }

  function onSquare(idx){
    // kalau lagi nunggu AI, jangan ganggu
    if(mode==="ai" && eng.getTurn()==='b') return;

    // pilih / gerak
    if(srcIdx==null){
      const p = eng.at(idx);
      if(p==='.' ) return;
      // hanya boleh pilih piece warna turn
      if(eng.getTurn()==='w' && !/[A-Z]/.test(p)) return;
      if(eng.getTurn()==='b' && !/[a-z]/.test(p)) return;
      srcIdx = idx;
    }else{
      const legal = eng.legalMoves().filter(m=>m.from===srcIdx && m.to===idx);
      if(legal.length){
        redoStack.length=0;
        eng.makeMove(srcIdx, idx);
        srcIdx=null;
        afterMove();
      }else{
        // ganti sumber
        const p = eng.at(idx);
        if(p!=='.'){
          if(eng.getTurn()==='w' && /[A-Z]/.test(p)) { srcIdx=idx; }
          else if(eng.getTurn()==='b' && /[a-z]/.test(p)) { srcIdx=idx; }
          else srcIdx=null;
        }else srcIdx=null;
      }
    }
    sync();
  }

  function afterMove(){
    const res = eng.result();
    if(res){
      toast(res);
      sync(); return;
    }
    if(mode==="ai" && eng.getTurn()==='b'){
      setTimeout(()=>{
        const mv = eng.aiMove(2);  // depth ringan
        if(mv){ eng.makeMove(mv.from,mv.to); }
        const r2=eng.result(); if(r2) toast(r2);
        sync();
      }, 220);
    }
  }

  function toast(msg){
    // tampilkan hasil ke riwayat paling akhir
    const arr = movesSAN();
    arr.push(`[${msg}]`);
    logEl.textContent = arr.join("  ");
  }

  // buttons
  btnReset.addEventListener("click", ()=>{
    eng.loadFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    srcIdx=null; redoStack.length=0; sync();
  });
  btnUndo.addEventListener("click", ()=>{
    if(!eng.stack.length) return;
    redoStack.push(eng.stack[eng.stack.length-1]);
    eng.undo(); srcIdx=null; sync();
  });
  btnRedo.addEventListener("click", ()=>{
    const last = redoStack.pop(); if(!last) return;
    eng.makeMove(last.from,last.to); srcIdx=null; sync();
  });
  btnFlip.addEventListener("click", ()=>{ ui.flip(); sync(); });

  modeHuman.addEventListener("click", ()=>{
    mode="human";
    modeHuman.classList.add("active");
    modeAI.classList.remove("active");
    srcIdx=null; sync();
  });
  modeAI.addEventListener("click", ()=>{
    mode="ai";
    modeAI.classList.add("active");
    modeHuman.classList.remove("active");
    srcIdx=null; sync();
    // kalau AI kebagian jalan dulu (hitam), biar manusia putih
    if(eng.getTurn()==='b'){
      const mv = eng.aiMove(2);
      if(mv){ eng.makeMove(mv.from,mv.to); }
      sync();
    }
  });

  // init
  sync();
})();
