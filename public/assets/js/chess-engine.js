// =====================================================
//  Azbry Chess Engine — legal move + check/checkmate
//  (tanpa castling & en-passant dulu, biar stabil)
//  API kompatibel dengan UI kamu sekarang.
// =====================================================

export class ChessEngine {
  constructor() { this.reset(); }

  reset() {
    // Notasi: baris 0 = rank 1 (bawah), baris 7 = rank 8 (atas)
    this.board = [
      ["r","n","b","q","k","b","n","r"], // y=7 (rank 8) — hitam
      ["p","p","p","p","p","p","p","p"], // y=6
      ["","","","","","","",""],         // y=5
      ["","","","","","","",""],         // y=4
      ["","","","","","","",""],         // y=3
      ["","","","","","","",""],         // y=2
      ["P","P","P","P","P","P","P","P"], // y=1
      ["R","N","B","Q","K","B","N","R"]  // y=0 (rank 1) — putih
    ];
    this.turn = "white";
    this.history = [];  // {board, turn}
    this.future  = [];
  }

  // ===== Util dasar =====
  inBounds(x,y){ return x>=0 && x<8 && y>=0 && y<8; }
  get(x,y){ return this.board[y][x]; }
  set(x,y,v){ this.board[y][x] = v; }
  cloneBoard(){ return this.board.map(r=>r.slice()); }
  isWhite(p){ return p && p === p.toUpperCase(); }
  isBlack(p){ return p && p === p.toLowerCase(); }
  colorOf(p){ return !p ? null : (this.isWhite(p) ? 'white' : 'black'); }
  opp(color){ return color === 'white' ? 'black' : 'white'; }

  // ===== API publik dipakai UI =====
  move(fromX,fromY,toX,toY){
    const legal = this.getAllMoves(this.turn).some(m=>m.fromX===fromX && m.fromY===fromY && m.toX===toX && m.toY===toY);
    if(!legal) return false;

    const piece = this.get(fromX,fromY);
    const target = this.get(toX,toY);

    this.history.push({ board:this.cloneBoard(), turn:this.turn });
    this.future.length = 0;

    // promosi sederhana: pion putih ke y=7, pion hitam ke y=0 -> jadi Queen
    const low = piece.toLowerCase();
    const isPawn = (low === 'p');
    const willPromote = isPawn && ((piece==='P' && toY===7) || (piece==='p' && toY===0));

    this.set(toX,toY, willPromote ? (this.isWhite(piece) ? 'Q':'q') : piece);
    this.set(fromX,fromY,"");

    this.turn = this.opp(this.turn);
    return { piece, target };
  }

  undo(){
    if(!this.history.length) return false;
    const prev = this.history.pop();
    this.future.push({ board:this.cloneBoard(), turn:this.turn });
    this.board = prev.board;
    this.turn = prev.turn;
    return true;
  }

  redo(){
    if(!this.future.length) return false;
    const next = this.future.pop();
    this.history.push({ board:this.cloneBoard(), turn:this.turn });
    this.board = next.board;
    this.turn = next.turn;
    return true;
  }

  // Dipakai UI untuk highlight & AI
  getAllMoves(color){
    // Pseudo → filter yang bikin raja sendiri diserang
    const pseudo = this._genAllPseudo(color);
    const legal = [];
    for(const m of pseudo){
      if(this._isLegalMove(color, m)) legal.push(m);
    }
    return legal;
  }

  // AI sederhana (tetap acak legal biar ringan)
  aiMove(){
    const moves = this.getAllMoves('black');
    if(!moves.length) return false;
    const m = moves[Math.floor(Math.random()*moves.length)];
    return this.move(m.fromX, m.fromY, m.toX, m.toY);
  }

  // ===== Check / Mate =====
  isCheck(color=this.turn){
    const k = this._kingPos(color);
    if(!k) return false;
    return this._squareAttackedBy(k.x, k.y, this.opp(color));
  }

  isCheckmate(color=this.turn){
    if(!this.isCheck(color)) return false;
    return this.getAllMoves(color).length === 0;
  }

  isStalemate(color=this.turn){
    if(this.isCheck(color)) return false;
    return this.getAllMoves(color).length === 0;
  }

  // ===== Internal: generate pseudo moves =====
  _genAllPseudo(color){
    const out = [];
    for(let y=0;y<8;y++){
      for(let x=0;x<8;x++){
        const p = this.get(x,y);
        if(!p) continue;
        const pc = this.colorOf(p);
        if(pc !== color) continue;
        this._genPiecePseudo(p, x, y, out);
      }
    }
    return out;
  }

  _genPiecePseudo(p, x, y, out){
    const low = p.toLowerCase();
    if(low==='p') return this._genPawn(p, x, y, out);
    if(low==='n') return this._genKnight(p, x, y, out);
    if(low==='b') return this._genBishop(p, x, y, out);
    if(low==='r') return this._genRook(p, x, y, out);
    if(low==='q') { this._genBishop(p,x,y,out); this._genRook(p,x,y,out); return; }
    if(low==='k') return this._genKing(p, x, y, out);
  }

  _pushMove(out, fromX,fromY,toX,toY){
    out.push({ fromX, fromY, toX, toY });
  }

  _genPawn(p,x,y,out){
    const white = this.isWhite(p);
    const dir = white ? 1 : -1;          // putih naik ke y besar (0 -> 7)
    const oneY = y + dir;

    // maju 1
    if(this.inBounds(x,oneY) && !this.get(x,oneY)){
      this._pushMove(out,x,y,x,oneY);
      // maju 2 dari rank awal
      const startRank = white ? 1 : 6;
      const twoY = y + dir*2;
      if(y===startRank && this.inBounds(x,twoY) && !this.get(x,twoY)){
        this._pushMove(out,x,y,x,twoY);
      }
    }
    // makan kiri/kanan
    for(const dx of [-1,1]){
      const nx = x + dx, ny = y + dir;
      if(!this.inBounds(nx,ny)) continue;
      const t = this.get(nx,ny);
      if(t && this.colorOf(t)!==this.colorOf(p)){
        this._pushMove(out,x,y,nx,ny);
      }
    }
    // (en-passant belum diaktifkan pada versi ini)
  }

  _genKnight(p,x,y,out){
    const deltas = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
    for(const [dx,dy] of deltas){
      const nx=x+dx, ny=y+dy;
      if(!this.inBounds(nx,ny)) continue;
      const t=this.get(nx,ny);
      if(!t || this.colorOf(t)!==this.colorOf(p)){
        this._pushMove(out,x,y,nx,ny);
      }
    }
  }

  _slideDir(p,x,y,dx,dy,out){
    let nx=x+dx, ny=y+dy;
    while(this.inBounds(nx,ny)){
      const t=this.get(nx,ny);
      if(!t){
        this._pushMove(out,x,y,nx,ny);
      } else {
        if(this.colorOf(t)!==this.colorOf(p)) this._pushMove(out,x,y,nx,ny);
        break;
      }
      nx+=dx; ny+=dy;
    }
  }

  _genBishop(p,x,y,out){
    this._slideDir(p,x,y, 1, 1,out);
    this._slideDir(p,x,y, 1,-1,out);
    this._slideDir(p,x,y,-1, 1,out);
    this._slideDir(p,x,y,-1,-1,out);
  }

  _genRook(p,x,y,out){
    this._slideDir(p,x,y, 1, 0,out);
    this._slideDir(p,x,y,-1, 0,out);
    this._slideDir(p,x,y, 0, 1,out);
    this._slideDir(p,x,y, 0,-1,out);
  }

  _genKing(p,x,y,out){
    for(let dx=-1; dx<=1; dx++){
      for(let dy=-1; dy<=1; dy++){
        if(dx===0 && dy===0) continue;
        const nx=x+dx, ny=y+dy;
        if(!this.inBounds(nx,ny)) continue;
        const t=this.get(nx,ny);
        if(!t || this.colorOf(t)!==this.colorOf(p)){
          this._pushMove(out,x,y,nx,ny);
        }
      }
    }
    // (castling belum diaktifkan pada versi ini)
  }

  // ===== Filter legal (raja sendiri tidak boleh terserang) =====
  _isLegalMove(color, m){
    const snap = this.cloneBoard();
    const piece = this.get(m.fromX,m.fromY);
    const target = this.get(m.toX,m.toY);

    // lakukan sementara
    this.set(m.toX,m.toY,piece);
    this.set(m.fromX,m.fromY,"");

    const ok = !this._kingInCheckAfter(color);

    // kembalikan
    this.board = snap;
    return ok;
  }

  _kingInCheckAfter(color){
    const k = this._kingPos(color);
    if(!k) return true;
    return this._squareAttackedBy(k.x, k.y, this.opp(color));
  }

  _kingPos(color){
    for(let y=0;y<8;y++){
      for(let x=0;x<8;x++){
        const p=this.get(x,y);
        if(!p) continue;
        if((color==='white' && p==='K') || (color==='black' && p==='k')){
          return {x,y};
        }
      }
    }
    return null;
  }

  _squareAttackedBy(x,y,attackerColor){
    // generate semua pseudo attackerColor, lihat apakah ada yg mendarat di (x,y)
    for(let j=0;j<8;j++){
      for(let i=0;i<8;i++){
        const p=this.get(i,j);
        if(!p || this.colorOf(p)!==attackerColor) continue;
        const pseudo=[];
        this._genPiecePseudo(p,i,j,pseudo);

        // Pion: serangan berbeda dgn gerak maju
        if(p.toLowerCase()==='p'){
          const white = this.isWhite(p);
          const dir = white ? 1 : -1;
          for(const dx of [-1,1]){
            const nx=i+dx, ny=j+dir;
            if(nx===x && ny===y) { // asal dalam papan & target beda warna di atas tidak perlu dicek di sini
              if(this.inBounds(nx,ny)) return true;
            }
          }
          // hilangkan gerak maju pion dari pseudo (karena bukan serangan)
          // (biar aman, kita cek manual dengan conditional di atas)
        }

        for(const m of pseudo){
          if(m.toX===x && m.toY===y){
            // valid khusus pion: hanya diagonal yg dianggap serang
            if(p.toLowerCase()!=='p') return true;
            // kalau pion, diagonal yang menghasilkan target adalah serangan → sudah dicek di atas
          }
        }
      }
    }
    return false;
  }
}
// expose ke global agar bisa dipakai tanpa module import
if (typeof window !== "undefined") window.ChessEngine = ChessEngine;
