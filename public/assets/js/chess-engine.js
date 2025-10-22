/* =========================================================
   Azbry Chess Engine v3 — Full FIDE rules + undo/redo
   Index papan: 0..63 (0=a8 … 63=h1). Algebraic: a1..h8
   Public API:
     const G = new Chess();
     G.board(), G.turn(), G.moves({square?}),
     G.move({from,to,promotion:'Q'}), G.undo(), G.redo(),
     G.reset(), G.history(), G.gameStatus() -> 'ok'|'check'|'checkmate'|'stalemate'
   ========================================================= */
(function (global) {
  // ---- constants ----
  var EMPTY = null;
  var C_WHITE = 'w';
  var C_BLACK = 'b';
  var P = 'P', N = 'N', B = 'B', R = 'R', Q = 'Q', K = 'K';
  var START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";

  function file(i){ return i % 8; }
  function rank(i){ return (i/8)|0; }
  function inBoard(i){ return i>=0 && i<64; }
  function alg(i){ return "abcdefgh".charAt(file(i)) + (8 - rank(i)); }
  function idx(a){ return (8 - parseInt(a.charAt(1),10)) * 8 + "abcdefgh".indexOf(a.charAt(0)); }
  function enemy(c){ return c===C_WHITE ? C_BLACK : C_WHITE; }
  function deep(x){ return JSON.parse(JSON.stringify(x)); }

  // ===================== ENGINE =====================
  function Chess(fen){ this.load(fen || START_FEN); }

  Chess.prototype.load = function(fen){
    var parts = fen.split(' ');
    var pieces = parts[0], side = parts[1], cast = parts[2], ep = parts[3];

    this.B = new Array(64);
    for (var k=0;k<64;k++) this.B[k]=EMPTY;

    var i=0, raw = pieces.replace(/\//g,'');
    for (var j=0;j<raw.length;j++){
      var ch = raw.charAt(j);
      if (/\d/.test(ch)) { i += parseInt(ch,10); }
      else {
        this.B[i++] = { color: (ch===ch.toUpperCase()? C_WHITE : C_BLACK), piece: ch.toUpperCase() };
      }
    }

    this.side = (side==='w'? C_WHITE : C_BLACK);
    this.cast = {
      wK: cast.indexOf('K')>-1, wQ: cast.indexOf('Q')>-1,
      bK: cast.indexOf('k')>-1, bQ: cast.indexOf('q')>-1
    };
    this.ep = (ep==='-'? null : idx(ep));
    this.half = 0;
    this.hist = [];        // stack moves { ... , snap }
    this._redoStack = [];  // <— rename untuk hindari bentrok dengan method redo()
  };

  Chess.prototype.reset   = function(){ this.load(START_FEN); };
  Chess.prototype.board   = function(){ return this.B; };
  Chess.prototype.turn    = function(){ return this.side; };
  Chess.prototype.history = function(){ return this.hist.map(function(m){return m.note;}); };
  Chess.prototype.get     = function(i){ return this.B[i]; };
  Chess.prototype.set     = function(i,v){ this.B[i]=v; };

  Chess.prototype._kingIndex = function(c){
    for (var i=0;i<64;i++) {
      var p=this.get(i);
      if (p && p.piece===K && p.color===c) return i;
    }
    return -1;
  };

  // ---------- serangan dari satu petak ----------
  Chess.prototype._attacksFrom = function(i){
    var p=this.get(i); if(!p) return [];
    var c=p.color, t=p.piece, res=[];

    function ray(self,d){
      var s=i+d;
      while (inBoard(s) && Math.abs(file(s)-file(s-d))<=1){
        res.push(s);
        if (self.get(s)) break;
        s+=d;
      }
    }

    if (t===P){
      var dir = (c===C_WHITE? -8 : 8);
      var d1 = i+dir-1, d2 = i+dir+1;
      if (inBoard(d1) && Math.abs(file(d1)-file(i))===1) res.push(d1);
      if (inBoard(d2) && Math.abs(file(d2)-file(i))===1) res.push(d2);
    }

    if (t===N){
      var KN=[15,17,-15,-17,10,-10,6,-6];
      for(var k=0;k<KN.length;k++){
        var s=i+KN[k];
        if (!inBoard(s)) continue;
        var dx = Math.abs(file(s)-file(i));
        var dy = Math.abs(rank(s)-rank(i));
        if ((dx===1 && dy===2) || (dx===2 && dy===1)) res.push(s); // <— fix pola L
      }
    }

    if (t===B || t===Q){ ray(this, 9); ray(this, 7); ray(this,-9); ray(this,-7); }
    if (t===R || t===Q){ ray(this, 8); ray(this,-8); ray(this, 1); ray(this,-1); }

    if (t===K){
      var KK=[-1,1,-8,8,-9,-7,9,7];
      for (var u=0;u<KK.length;u++){
        var s2=i+KK[u];
        if (inBoard(s2) && Math.abs(file(s2)-file(i))<=1 && Math.abs(rank(s2)-rank(i))<=1) res.push(s2);
      }
    }
    return res;
  };

  Chess.prototype._attacked = function(sq, byColor){
    for (var i=0;i<64;i++){
      var p=this.get(i);
      if (p && p.color===byColor){
        var A=this._attacksFrom(i);
        for (var k=0;k<A.length;k++) if (A[k]===sq) return true;
      }
    }
    return false;
  };

  Chess.prototype.inCheck = function(c){
    c = c || this.side;
    return this._attacked(this._kingIndex(c), enemy(c));
  };

  // ---------- pseudo moves (belum filter self-check) ----------
  Chess.prototype._pseudo = function(c){
    var M=[], i, p, f, rnk;
    for (i=0;i<64;i++){
      p=this.get(i); if(!p || p.color!==c) continue;
      f=file(i); rnk=rank(i);

      if (p.piece===P){
        var dir=(c===C_WHITE? -8:8);
        var one=i+dir, two=i+dir*2;
        var start=(c===C_WHITE?6:1), last=(c===C_WHITE?0:7);

        if (inBoard(one) && !this.get(one)){
          if (rank(one)===last) this._push(M,i,one,{promotion:Q}); else this._push(M,i,one);
          if (rnk===start && !this.get(two)) this._push(M,i,two,{double:true});
        }
        var df, t;
        for (df=-1; df<=1; df+=2){
          t=i+dir+df;
          if (!inBoard(t) || Math.abs(file(t)-f)!==1) continue;
          var q=this.get(t);
          if (q && q.color!==c){
            if (rank(t)===last) this._push(M,i,t,{promotion:Q}); else this._push(M,i,t);
          }
        }
        if (this.ep!==null){
          var ep=this.ep;
          if (Math.abs(file(ep)-f)===1 && rank(ep)===rnk+(c===C_WHITE?-1:1))
            this._push(M,i,ep,{enPassant:true});
        }
        continue;
      }

      if (p.piece===N){
        var KN=[15,17,-15,-17,10,-10,6,-6];
        for (var kn=0;kn<KN.length;kn++){
          var t2=i+KN[kn];
          if (!inBoard(t2)) continue;
          var dx = Math.abs(file(t2)-f);
          var dy = Math.abs(rank(t2)-rnk);
          if (!((dx===1 && dy===2) || (dx===2 && dy===1))) continue; // <— fix pola L
          var q2=this.get(t2); if (!q2 || q2.color!==c) this._push(M,i,t2);
        }
        continue;
      }

      if (p.piece===B || p.piece===R || p.piece===Q){
        var dirs=[];
        if (p.piece!==R) { dirs.push(9,7,-9,-7); }
        if (p.piece!==B) { dirs.push(8,-8,1,-1); }
        for (var d=0; d<dirs.length; d++){
          var step=dirs[d], s=i+step;
          while (inBoard(s) && Math.abs(file(s)-file(s-step))<=1){
            var qq=this.get(s);
            if (!qq) this._push(M,i,s);
            else { if (qq.color!==c) this._push(M,i,s); break; }
            s+=step;
          }
        }
        continue;
      }

      if (p.piece===K){
        var KK=[-1,1,-8,8,-9,-7,9,7];
        for (var kk=0;kk<KK.length;kk++){
          var t3=i+KK[kk];
          if (!inBoard(t3)) continue;
          if (Math.abs(file(t3)-f)<=1 && Math.abs(rank(t3)-rnk)<=1){
            var q3=this.get(t3); if(!q3 || q3.color!==c) this._push(M,i,t3);
          }
        }
        // castling
        if (c===C_WHITE){
          // e1=60, h1=63, a1=56
          if (this.cast.wK && !this.get(61) && !this.get(62) &&
              !this._attacked(60,C_BLACK) && !this._attacked(61,C_BLACK) && !this._attacked(62,C_BLACK))
            this._push(M,60,62,{castle:'K'});
          if (this.cast.wQ && !this.get(57) && !this.get(58) && !this.get(59) &&
              !this._attacked(60,C_BLACK) && !this._attacked(59,C_BLACK) && !this._attacked(58,C_BLACK))
            this._push(M,60,58,{castle:'Q'});
        } else {
          // e8=4, h8=7, a8=0
          if (this.cast.bK && !this.get(5) && !this.get(6) &&
              !this._attacked(4,C_WHITE) && !this._attacked(5,C_WHITE) && !this._attacked(6,C_WHITE))
            this._push(M,4,6,{castle:'k'});
          if (this.cast.bQ && !this.get(1) && !this.get(2) && !this.get(3) &&
              !this._attacked(4,C_WHITE) && !this._attacked(3,C_WHITE) && !this._attacked(2,C_WHITE))
            this._push(M,4,2,{castle:'q'});
        }
      }
    }
    return M;
  };

  Chess.prototype._push = function(list, from, to, flags){
    flags = flags || {};
    var p=this.get(from);
    list.push({
      from:from, to:to,
      piece:{ color:p.color, piece:p.piece },
      capture:this.get(to)||null,
      enPassant: !!flags.enPassant,
      castle: flags.castle||null,
      promotion: flags.promotion||null
    });
  };

  // ---------- make / unmake ----------
  Chess.prototype._make = function(m){
    var snap = { move:deep(m), cast:deep(this.cast), ep:this.ep, half:this.half };
    var from=m.from, to=m.to, piece=m.piece, enPassant=m.enPassant, castle=m.castle, promotion=m.promotion;
    var cap=this.get(to);

    // en-passant: bidak yg dimakan ada di belakang "to"
    if (enPassant){
      var dir = (piece.color===C_WHITE? 1 : -1);
      var capSq = to + 8*dir;
      cap = this.get(capSq);
      this.set(capSq, EMPTY);
    }

    // pindahkan bidak (promotion jika ada)
    this.set(from, EMPTY);
    this.set(to, { color: piece.color, piece: (promotion || piece.piece) });

    // rokade: pindahkan rook
    if (castle==='K'){ this.set(63,EMPTY); this.set(61,{color:C_WHITE,piece:R}); }
    if (castle==='Q'){ this.set(56,EMPTY); this.set(59,{color:C_WHITE,piece:R}); }
    if (castle==='k'){ this.set(7, EMPTY); this.set(5, {color:C_BLACK,piece:R}); }
    if (castle==='q'){ this.set(0, EMPTY); this.set(3, {color:C_BLACK,piece:R}); }

    // hak rokade hilang kalau king/rook bergerak/terkena
    if (piece.piece===K){
      if (piece.color===C_WHITE){ this.cast.wK=false; this.cast.wQ=false; }
      else { this.cast.bK=false; this.cast.bQ=false; }
    }
    if (piece.piece===R){
      if (from===63) this.cast.wK=false;
      if (from===56) this.cast.wQ=false;
      if (from===7)  this.cast.bK=false;
      if (from===0)  this.cast.bQ=false;
    }
    if (cap && cap.piece===R){
      if (to===63) this.cast.wK=false;
      if (to===56) this.cast.wQ=false;
      if (to===7)  this.cast.bK=false;
      if (to===0)  this.cast.bQ=false;
    }

    // EP square jika bidak maju 2
    this.ep = null;
    if (piece.piece===P && Math.abs(from-to)===16) this.ep = (from+to)/2;

    // halfmove clock
    this.half = (piece.piece===P || cap) ? 0 : (this.half+1);

    snap.cap = cap || null;
    return snap;
  };

  Chess.prototype._unmake = function(snap){
    var move=snap.move, cast=snap.cast, ep=snap.ep, half=snap.half, cap=snap.cap;
    var from=move.from, to=move.to, piece=move.piece, enPassant=move.enPassant, castle=move.castle, promotion=move.promotion;

    // balikin rook kalau rokade
    if (castle==='K'){ this.set(63,{color:C_WHITE,piece:R}); this.set(61,EMPTY); }
    if (castle==='Q'){ this.set(56,{color:C_WHITE,piece:R}); this.set(59,EMPTY); }
    if (castle==='k'){ this.set(7, {color:C_BLACK,piece:R}); this.set(5, EMPTY); }
    if (castle==='q'){ this.set(0, {color:C_BLACK,piece:R}); this.set(3, EMPTY); }

    // balikin raja/bidak
    this.set(from, { color: piece.color, piece: piece.piece });
    this.set(to, EMPTY);

    // balikin yang dimakan
    if (enPassant){
      var dir = (piece.color===C_WHITE? 1 : -1);
      var capSq = to + 8*dir;
      this.set(capSq, cap);
    } else if (cap){
      this.set(to, cap);
    }

    this.cast = cast;
    this.ep   = ep;
    this.half = half;
  };

  // ---------- legal moves (filter self-check) ----------
  Chess.prototype._legal = function(){
    var pseudo=this._pseudo(this.side), L=[], k;
    for (k=0;k<pseudo.length;k++){
      var m=pseudo[k];
      var snap=this._make(m);
      var illegal=this.inCheck(this.side);
      this._unmake(snap);
      if (!illegal) L.push(m);
    }
    return L;
  };

  Chess.prototype.moves = function(opt){
    if (opt && opt.square!=null){
      var from = (typeof opt.square==='number') ? opt.square : idx(opt.square);
      var all = this._legal(), out=[], z;
      for (z=0;z<all.length;z++){
        if (all[z].from===from){
          out.push({ from:alg(all[z].from), to:alg(all[z].to), promotion: (all[z].promotion||null) });
        }
      }
      return out;
    }
    var legal=this._legal(), res=[], i;
    for (i=0;i<legal.length;i++){
      res.push({ from:alg(legal[i].from), to:alg(legal[i].to), promotion:(legal[i].promotion||null) });
    }
    return res;
  };

  Chess.prototype.move = function(m){
    var from = (typeof m.from==='number') ? m.from : idx(m.from);
    var to   = (typeof m.to  ==='number') ? m.to   : idx(m.to);
    var L=this._legal(), i, ok=null;

    for (i=0;i<L.length;i++){
      var x=L[i];
      var need = (m.promotion||x.promotion||null);
      var has  = (x.promotion||null);
      if (x.from===from && x.to===to && (has===need)) { ok=x; break; }
    }
    if (!ok) return null;

    var snap=this._make(ok);
    var note=alg(ok.from)+" → "+alg(ok.to)+(ok.promotion?("="+ok.promotion):"");
    this.hist.push({ from:ok.from,to:ok.to,piece:ok.piece,promotion:ok.promotion,snap:snap,note:note });
    this._redoStack.length=0;            // <— clear redo saat ada move baru
    this.side = enemy(this.side);
    return note;
  };

  Chess.prototype.undo = function(){
    var last=this.hist.pop();
    if (!last) return null;
    this._unmake(last.snap);
    this.side = enemy(this.side);
    this._redoStack.push(last);          // <— pakai _redoStack
    return last.note;
  };

  Chess.prototype.redo = function(){
    var next=this._redoStack.pop();      // <— pakai _redoStack
    if (!next) return null;
    var snap=this._make(next);
    this.hist.push({ from:next.from,to:next.to,piece:next.piece,promotion:next.promotion,snap:snap,note:next.note });
    this.side = enemy(this.side);
    return next.note;
  };

  Chess.prototype.gameStatus = function(){
    var legal=this._legal();
    var chk=this.inCheck(this.side);
    if (legal.length===0) return chk? 'checkmate':'stalemate';
    return chk? 'check' : 'ok';
  };

  // ===================== UI ringan (dipakai main.js) =====================
  function ChessUI(el, onClick){
    this.el=el; this.flip=false; this._cb=onClick||function(){};
    this._build();
  }
  ChessUI.prototype._build = function(){
    this.el.innerHTML='';
    this.cells = new Array(64);
    for (var i=0;i<64;i++){
      var d=document.createElement('div');
      d.className = 'sq ' + (((i + ((i/8)|0)) % 2) ? 'dark' : 'light');
      d.dataset.i = i;
      var self=this;
      d.addEventListener('click', (function(ii){ return function(){ self._cb(self._alg(ii)); };})(i));
      this.el.appendChild(d);
      this.cells[i]=d;
    }
  };
  ChessUI.prototype._alg = function(i){ return "abcdefgh".charAt(i%8) + (8 - ((i/8)|0)); };
  ChessUI.prototype._idx = function(a){ return (8 - parseInt(a.charAt(1),10))*8 + "abcdefgh".indexOf(a.charAt(0)); };
  ChessUI.prototype.toggleFlip = function(){ this.flip=!this.flip; };
  ChessUI.prototype.render = function(board, opts){
    opts = opts || {};
    var legal = opts.legal || [];
    var last  = opts.lastMove || null;

    var legalIdx = {};
    for (var k=0;k<legal.length;k++){
      var v = legal[k];
      var ii = (typeof v==='string') ? this._idx(v) : v;
      legalIdx[ii]=1;
    }
    var lf = last ? (typeof last.from==='string'? this._idx(last.from):last.from) : null;
    var lt = last ? (typeof last.to  ==='string'? this._idx(last.to)  :last.to)   : null;

    for (var i=0;i<64;i++){
      var mapped = this.flip ? (63 - i) : i;
      var cell = this.cells[i];
      var Pp = board[mapped];

      cell.innerHTML='';
      cell.classList.remove('src','last');

      if (Pp){
        var span=document.createElement('span');
        span.className='piece ' + (Pp.color===C_WHITE? 'white':'black');
        span.textContent = (Pp.color===C_WHITE
          ? {P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'}
          : {P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'})[Pp.piece];
        cell.appendChild(span);
      }
      if (lf===mapped) cell.classList.add('src');
      if (lt===mapped) cell.classList.add('last');
      if (legalIdx[mapped]){ var dot=document.createElement('div'); dot.className='dot'; cell.appendChild(dot); }
    }
  };

  // expose
  global.Chess = Chess;
  global.ChessUI = ChessUI;
})(window);
