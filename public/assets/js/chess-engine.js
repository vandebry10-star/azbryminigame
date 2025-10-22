/* ===========================================================
   AZBRY CHESS ENGINE — STABLE (0x88) • OFFLINE LOCAL
   =========================================================== */
(function (global) {
  function Chess(fen) {
    let board = new Array(128).fill(null);
    let turn  = 'w';
    let epSquare = -1;
    let castling = { K:false, Q:false, k:false, q:false };
    let halfMoves = 0, moveNumber = 1;

    let hist = [];       // {from,to,promotion,fen}
    let redoStack = [];

    const FILES = 'abcdefgh';
    const RANKS = '12345678';
    const WHITE='w', BLACK='b';
    const RANK_2 = 6, RANK_7 = 1;

    const OFFS = {
      n: [-18,-33,-31,-14, 18,33,31,14],
      b: [-17,-15, 17, 15],
      r: [-16,  1, 16, -1],
      q: [-17,-16,-15, -1, 1,15,16,17],
      k: [-17,-16,-15, -1, 1,15,16,17]
    };

    const SQUARES = {};
    for (let r=0;r<8;r++) for (let f=0;f<8;f++)
      SQUARES[FILES[f]+RANKS[r]] = (r<<4) | f;

    function algebraic(i){ const f=i&15, r=i>>4; return FILES[f]+RANKS[7-r]; }
    function swap(c){ return c==='w' ? 'b' : 'w'; }

    function clear(){
      board.fill(null); turn=WHITE; epSquare=-1;
      castling={K:false,Q:false,k:false,q:false};
      halfMoves=0; moveNumber=1; hist=[]; redoStack=[];
    }

    function put(piece, square){
      const sq=SQUARES[square]; if (sq==null) return false;
      board[sq]={ type:piece.type, color:piece.color }; return true;
    }
    function get(square){ const sq=SQUARES[square]; return sq==null?null:board[sq]; }

    function load(fenStr){
      clear();
      const [pos, t='w', castles='-', ep='-'] = fenStr.trim().split(/\s+/);
      const rows = pos.split('/'); let i=0;
      for (let r=0;r<8;r++){
        for (const ch of rows[r]){
          if (/\d/.test(ch)){ i+=+ch; continue; }
          const color = ch===ch.toUpperCase()?WHITE:BLACK;
          const type = ch.toLowerCase();
          const sq = algebraic(119 - i);
          put({type,color}, sq); i++;
        }
      }
      turn=t;
      if (castles && castles!=='-') for (const c of castles) castling[c]=true;
      epSquare = (ep && ep!=='-') ? SQUARES[ep] : -1;
      return true;
    }

    function reset(){ load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'); }

    function fen(){
      let out=''; for (let r=0;r<8;r++){
        let empty=0; for (let f=0;f<8;f++){
          const sq=(7-r)*16+f, p=board[sq];
          if (!p){ empty++; continue; }
          if (empty){ out+=empty; empty=0; }
          out += p.color==='w'? p.type.toUpperCase(): p.type;
        }
        if (empty) out+=empty; if (r<7) out+='/';
      }
      const ep = epSquare>=0 ? algebraic(epSquare) : '-';
      const castles=(castling.K?'K':'')+(castling.Q?'Q':'')+(castling.k?'k':'')+(castling.q?'q':'') || '-';
      return `${out} ${turn} ${castles} ${ep} ${halfMoves} ${moveNumber}`;
    }

    function moves(opts={}){
      const res=[]; const us=turn, them=swap(turn);
      function push(from,to,promo){ const m={from:algebraic(from),to:algebraic(to)}; if(promo)m.promotion=promo; if(opts.verbose)m.color=us; res.push(m); }
      for (let i=0;i<128;i++){
        if (i&0x88){ i+=7; continue; }
        const p=board[i]; if(!p||p.color!==us) continue;

        if (p.type==='p'){
          const dir=(us===WHITE)?-16:16; const rank=i>>4; const start=(us===WHITE)?RANK_2:RANK_7;
          const one=i+dir;
          if (!(one&0x88) && !board[one]){
            const toRank=one>>4;
            if ((us===WHITE&&toRank===0)||(us===BLACK&&toRank===7)){ for (const pr of ['q','r','b','n']) push(i,one,pr); }
            else push(i,one);
            const two=i+2*dir;
            if (rank===start && !board[two] && !(two&0x88)) push(i,two);
          }
          for (const off of [dir-1,dir+1]){
            const t=i+off; if (t&0x88) continue;
            if (board[t] && board[t].color===them){
              const toRank=t>>4;
              if ((us===WHITE&&toRank===0)||(us===BLACK&&toRank===7)){ for (const pr of ['q','r','b','n']) push(i,t,pr); }
              else push(i,t);
            }
          }
          continue;
        }

        for (const d of OFFS[p.type]){
          let t=i; while(true){
            t+=d; if (t&0x88) break;
            const q=board[t];
            if (!q) push(i,t); else { if (q.color===them) push(i,t); break; }
            if (p.type==='n'||p.type==='k') break;
          }
        }
      }
      return opts.square? res.filter(m=>m.from===opts.square) : res;
    }

    function makeMove(mv){
      const from=SQUARES[mv.from], to=SQUARES[mv.to]; const piece=board[from]; if(!piece) return false;
      let placed={ type:piece.type, color:piece.color };
      if (mv.promotion) placed={ type:mv.promotion, color:piece.color };
      const before=fen();
      board[to]=placed; board[from]=null;
      turn=swap(turn); redoStack.length=0;
      hist.push({ from:mv.from, to:mv.to, promotion:mv.promotion, fen:before });
      return true;
    }

    function move(input){
      const want={ from:input.from, to:input.to, promotion:input.promotion };
      const list=moves({square:want.from, verbose:true});
      const found=list.find(m=>m.to===want.to && (!want.promotion || m.promotion===want.promotion));
      if (!found) return null;
      return makeMove(found) ? found : null;
    }

    function undo(){
      const last=hist.pop(); if(!last) return null;
      const cur=fen(); load(last.fen); redoStack.push({...last, fen:cur}); return {from:last.from,to:last.to,promotion:last.promotion};
    }
    function redo(){ const mv=redoStack.pop(); if(!mv) return null; return makeMove(mv)?mv:null; }
    function historyAPI(opts={}){ return opts.verbose? hist.map(h=>({from:h.from,to:h.to,promotion:h.promotion})) : hist.map(h=>`${h.from}${h.to}`); }

    if (fen) load(fen); else reset();

    return {
      turn:()=>turn, fen, load, reset, get, put,
      moves, move, undo, redo, history:historyAPI,
      in_check:()=>false, in_checkmate:()=>false, in_stalemate:()=>false,
      in_draw:()=>false, game_over:()=>false,
    };
  }
  global.Chess = Chess;
})(typeof window!=='undefined'?window:globalThis);
