/* Azbry Chess Engine – full rules, compact */
(function (global) {
  const EMPTY=null, WHITE='w', BLACK='b';
  const P='P',N='N',B='B',R='R',Q='Q',K='K';
  const startFEN="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";

  const file=i=>i%8, rank=i=>Math.floor(i/8), inB=i=>i>=0&&i<64;
  const alg=i=>"abcdefgh"[file(i)]+(8-rank(i));
  const idx=a=>(8-+a[1])*8+"abcdefgh".indexOf(a[0]);
  const clone=x=>JSON.parse(JSON.stringify(x));

  class Chess{
    constructor(f=startFEN){this.load(f)}
    load(f){
      const [pp,side,cast,ep]=f.split(' ');
      this.b=new Array(64).fill(null);
      let i=0; for(const ch of pp.replaceAll('/','')){
        if(/\d/.test(ch)) i+=+ch; else this.b[i++]={color:ch===ch.toUpperCase()?WHITE:BLACK,piece:ch.toUpperCase()};
      }
      this.side=side==='w'?WHITE:BLACK;
      this.cast={wK:cast.includes('K'),wQ:cast.includes('Q'),bK:cast.includes('k'),bQ:cast.includes('q')};
      this.ep=ep==='-'?null:idx(ep);
      this.h=0; this.hist=[]; this.redo=[];
    }
    reset(){this.load(startFEN)}
    board(){return this.b} turn(){return this.side}
    get(i){return this.b[i]} set(i,v){this.b[i]=v}
    enemy(){return this.side===WHITE?BLACK:WHITE}
    _king(c){for(let i=0;i<64;i++){const p=this.get(i);if(p&&p.piece===K&&p.color===c)return i}return-1}
    _att(i){
      const p=this.get(i); if(!p) return [];
      const c=p.color,t=p.piece,res=[]; const push=(d,ray=false)=>{let s=i+d; while(inB(s)&&Math.abs(file(s)-file(s-d))<=1){res.push(s); if(this.get(s))break; if(!ray)break; s+=d;}}
      if(t===P){const dir=c===WHITE?-8:8;[-1,1].forEach(df=>{const s=i+dir+df;if(inB(s)&&Math.abs(file(s)-file(i))===1)res.push(s)})}
      if(t===N){[15,17,-15,-17,10,-10,6,-6].forEach(d=>{const s=i+d;if(!inB(s))return;if(Math.max(Math.abs(file(s)-file(i)),Math.abs(rank(s)-rank(i)))<=2)res.push(s)})}
      if(t===B||t===Q){[9,7,-9,-7].forEach(d=>push(d,true))} if(t===R||t===Q){[8,-8,1,-1].forEach(d=>push(d,true))}
      if(t===K){[-1,1,-8,8,-9,-7,9,7].forEach(d=>{const s=i+d;if(inB(s)&&Math.abs(file(s)-file(i))<=1&&Math.abs(rank(s)-rank(i))<=1)res.push(s)})}
      return res;
    }
    _attacked(i,by){for(let s=0;s<64;s++){const p=this.get(s);if(p&&p.color===by){if(this._att(s).includes(i))return true}}return false}
    inCheck(c=this.side){return this._attacked(this._king(c),c===WHITE?BLACK:WHITE)}
    _push(list,from,to,flags={}){const p=this.get(from);list.push({from,to,piece:p,capture:this.get(to)||null,promotion:flags.promotion||null,castle:flags.castle||null,enPassant:!!flags.enPassant})}
    _gen(c){
      const m=[]; for(let i=0;i<64;i++){const p=this.get(i); if(!p||p.color!==c)continue;
        const f=file(i),r=rank(i);
        if(p.piece===P){
          const dir=c===WHITE?-8:8, one=i+dir, start=c===WHITE?6:1, last=c===WHITE?0:7;
          if(inB(one)&&!this.get(one)){ if(rank(one)===last)this._push(m,i,one,{promotion:Q}); else this._push(m,i,one); const two=i+dir*2; if(r===start && !this.get(two)) this._push(m,i,two,{double:true}); }
          for(const df of[-1,1]){const t=i+dir+df; if(inB(t)&&Math.abs(file(t)-f)===1){const q=this.get(t); if(q&&q.color!==c){ if(rank(t)===last)this._push(m,i,t,{promotion:Q}); else this._push(m,i,t); }}}
          if(this.ep!==null){const ep=this.ep; if(Math.abs(file(ep)-f)===1 && rank(ep)===r+(c===WHITE?-1:1)) this._push(m,i,ep,{enPassant:true})}
        } else if(p.piece===N){
          [15,17,-15,-17,10,-10,6,-6].forEach(d=>{const t=i+d;if(!inB(t))return;if(Math.max(Math.abs(file(t)-f),Math.abs(rank(t)-r))>2)return;const q=this.get(t);if(!q||q.color!==c)this._push(m,i,t)})
        } else if(p.piece===B||p.piece===R||p.piece===Q){
          const dirs=[]; if(p.piece!==R)dirs.push(9,7,-9,-7); if(p.piece!==B)dirs.push(8,-8,1,-1);
          for(const d of dirs){let t=i+d; while(inB(t)&&Math.abs(file(t)-file(t-d))<=1){const q=this.get(t); if(!q)this._push(m,i,t); else{if(q.color!==c)this._push(m,i,t); break} t+=d;}}
        } else if(p.piece===K){
          [-1,1,-8,8,-9,-7,9,7].forEach(d=>{const t=i+d;if(inB(t)&&Math.abs(file(t)-f)<=1&&Math.abs(rank(t)-r)<=1){const q=this.get(t);if(!q||q.color!==c)this._push(m,i,t)}})
          if(c===WHITE){
            if(this.cast.wK&&!this.get(61)&&!this.get(62)&&!this._attacked(60,BLACK)&&!this._attacked(61,BLACK)&&!this._attacked(62,BLACK)) this._push(m,60,62,{castle:'K'});
            if(this.cast.wQ&&!this.get(57)&&!this.get(58)&&!this.get(59)&&!this._attacked(60,BLACK)&&!this._attacked(59,BLACK)&&!this._attacked(58,BLACK)) this._push(m,60,58,{castle:'Q'});
          } else {
            if(this.cast.bK&&!this.get(5)&&!this.get(6)&&!this._attacked(4,WHITE)&&!this._attacked(5,WHITE)&&!this._attacked(6,WHITE)) this._push(m,4,6,{castle:'k'});
            if(this.cast.bQ&&!this.get(1)&&!this.get(2)&&!this.get(3)&&!this._attacked(4,WHITE)&&!this._attacked(3,WHITE)&&!this._attacked(2,WHITE)) this._push(m,4,2,{castle:'q'});
          }
        }
      } return m;
    }
    _make(m){
      const st={move:clone(m),cast:clone(this.cast),ep:this.ep,half:this.h};
      const {from,to,piece,enPassant,castle,promotion}=m;
      let cap=this.get(to);
      if(enPassant){const dir=piece.color===WHITE?1:-1;const capSq=to+8*dir;cap=this.get(capSq);this.set(capSq,EMPTY)}
      this.set(from,EMPTY); this.set(to,{color:piece.color,piece:promotion||piece.piece});
      if(cast==='K'){this.set(63,EMPTY);this.set(61,{color:WHITE,piece:R})}
      if(cast==='Q'){this.set(56,EMPTY);this.set(59,{color:WHITE,piece:R})}
      if(cast==='k'){this.set(7,EMPTY); this.set(5,{color:BLACK,piece:R})}
      if(cast==='q'){this.set(0,EMPTY); this.set(3,{color:BLACK,piece:R})}
      if(piece.piece===K){if(piece.color===WHITE){this.cast.wK=false;this.cast.wQ=false}else{this.cast.bK=false;this.cast.bQ=false}}
      if(piece.piece===R){if(from===63)this.cast.wK=false;if(from===56)this.cast.wQ=false;if(from===7)this.cast.bK=false;if(from===0)this.cast.bQ=false}
      if(cap&&cap.piece===R){if(to===63)this.cast.wK=false;if(to===56)this.cast.wQ=false;if(to===7)this.cast.bK=false;if(to===0)this.cast.bQ=false}
      this.ep=null; if(piece.piece===P&&Math.abs(from-to)===16)this.ep=(from+to)/2;
      this.h=(piece.piece===P||cap)?0:this.h+1; st.cap=cap||null; return st;
    }
    _unmake(st){
      const {move,cast,ep,half,cap}=st; const {from,to,piece,enPassant,castle}=move;
      if(cast==='K'){this.set(63,{color:WHITE,piece:R});this.set(61,EMPTY)}
      if(cast==='Q'){this.set(56,{color:WHITE,piece:R});this.set(59,EMPTY)}
      if(cast==='k'){this.set(7,{color:BLACK,piece:R}); this.set(5,EMPTY)}
      if(cast==='q'){this.set(0,{color:BLACK,piece:R}); this.set(3,EMPTY)}
      this.set(from,{color:piece.color,piece:piece.piece}); this.set(to,EMPTY);
      if(enPassant){const dir=piece.color===WHITE?1:-1;this.set(to+8*dir,cap)} else if(cap){this.set(to,cap)}
      this.cast=cast; this.ep=ep; this.h=half;
    }
    _legal(){const ps=this._gen(this.side),L=[];for(const m of ps){const st=this._make(m);const bad=this.inCheck(this.side);this._unmake(st);if(!bad)L.push(m)}return L}
    moves(o={}){ if(o.square){const ix=typeof o.square==='number'?o.square:idx(o.square);return this._legal().filter(m=>m.from===ix).map(m=>({from:alg(m.from),to:alg(m.to),promotion:m.promotion||null})) }
      return this._legal().map(m=>({from:alg(m.from),to:alg(m.to),promotion:m.promotion||null}))}
    move(m){const f=typeof m.from==='number'?m.from:idx(m.from),t=typeof m.to==='number'?m.to:idx(m.to);const ok=this._legal().find(x=>x.from===f&&x.to===t&&((x.promotion||null)===(m.promotion||x.promotion||null)));if(!ok)return null;const st=this._make(ok);const note=`${alg(ok.from)} → ${alg(ok.to)}`+(ok.promotion?`=${ok.promotion}`:'');this.hist.push({...ok,notation:note,snap:st});this.redo.length=0;this.side=this.side===WHITE?BLACK:WHITE;return note}
    undo(){const m=this.hist.pop();if(!m)return null;this._unmake(m.snap);this.side=this.side===WHITE?BLACK:WHITE;this.redo.push(m);return m.notation}
    redo(){const m=this.redo.pop();if(!m)return null;const st=this._make(m);this.hist.push({...m,snap:st});this.side=this.side===WHITE?BLACK:WHITE;return m.notation}
    history(){return this.hist.map(m=>m.notation)}
    gameStatus(){const L=this._legal();const chk=this.inCheck(this.side);if(L.length===0)return chk?'checkmate':'stalemate';return chk?'check':'ok'}
  }

  class ChessUI{
    constructor(el, onClick){this.el=el;this.cb=onClick||(()=>{});this.flip=false;this.sq=[];this._build()}
    _build(){this.el.innerHTML='';this.sq=new Array(64);for(let i=0;i<64;i++){const d=document.createElement('div');d.className=`sq ${(i+Math.floor(i/8))%2?'dark':'light'}`;d.dataset.i=i;d.addEventListener('click',()=>this.cb(this._alg(i)));this.el.appendChild(d);this.sq[i]=d}}
    _alg(i){return "abcdefgh"[i%8]+(8-Math.floor(i/8))}
    _idx(a){return (8-+a[1])*8+"abcdefgh".indexOf(a[0])}
    toggleFlip(){this.flip=!this.flip}
    render(board,{lastMove=null,legal=[]}={}){const L=new Set(legal.map(a=>typeof a==='string'?this._idx(a):a));const lf=lastMove? (typeof lastMove.from==='string'?this._idx(lastMove.from):lastMove.from):null;const lt=lastMove? (typeof lastMove.to==='string'?this._idx(lastMove.to):lastMove.to):null;for(let i=0;i<64;i++){const idx=this.flip?(63-i):i;const cell=this.sq[i];const p=board[idx];cell.innerHTML='';cell.classList.remove('src','last');if(p){const sp=document.createElement('span');sp.className=`piece ${p.color==='w'?'white':'black'}`;sp.textContent=(p.color==='w'?{P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'}:{P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'})[p.piece];cell.appendChild(sp)}if(lf===idx)cell.classList.add('src');if(lt===idx)cell.classList.add('last');if(L.has(idx)){const dot=document.createElement('div');dot.className='dot';cell.appendChild(dot)}}}
  }

  global.Chess=Chess; global.ChessUI=ChessUI;
})(window);
