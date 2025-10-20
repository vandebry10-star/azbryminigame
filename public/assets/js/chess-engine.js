// =====================================================
//  Azbry Chess Engine — aturan dasar & AI sederhana
// =====================================================

export class ChessEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = [
      ["r","n","b","q","k","b","n","r"],
      ["p","p","p","p","p","p","p","p"],
      ["","","","","","","",""],
      ["","","","","","","",""],
      ["","","","","","","",""],
      ["","","","","","","",""],
      ["P","P","P","P","P","P","P","P"],
      ["R","N","B","Q","K","B","N","R"]
    ];
    this.turn = "white";
    this.history = [];
    this.future = [];
  }

  inBounds(x, y){ return x>=0 && x<8 && y>=0 && y<8; }

  get(x, y){ return this.board[y][x]; }
  set(x, y, v){ this.board[y][x] = v; }

  cloneBoard(){ return this.board.map(r=>r.slice()); }

  move(fromX, fromY, toX, toY) {
    const piece = this.get(fromX, fromY);
    if(!piece) return false;
    const target = this.get(toX, toY);
    this.history.push({ board:this.cloneBoard(), turn:this.turn });
    this.set(toX, toY, piece);
    this.set(fromX, fromY, "");
    this.future = []; // reset redo
    this.turn = this.turn==="white" ? "black" : "white";
    return { piece, target };
  }

  undo(){
    if(this.history.length===0) return;
    const prev = this.history.pop();
    this.board = prev.board;
    this.turn = prev.turn;
  }

  redo(){
    if(this.future.length===0) return;
    const next = this.future.pop();
    this.board = next.board;
    this.turn = next.turn;
  }

  // ===============================
  //  AI sederhana (acak langkah legal)
  // ===============================
  aiMove(){
    const moves = this.getAllMoves("black");
    if(moves.length===0) return;
    const pick = moves[Math.floor(Math.random()*moves.length)];
    this.move(pick.fromX, pick.fromY, pick.toX, pick.toY);
  }

  // ===============================
  //  Dapatkan semua langkah (kasar)
  // ===============================
  getAllMoves(color){
    const moves=[];
    for(let y=0;y<8;y++){
      for(let x=0;x<8;x++){
        const p=this.get(x,y);
        if(!p) continue;
        if((color==="white" && p===p.toUpperCase()) || (color==="black" && p===p.toLowerCase())){
          const dirs=this.basicMoves(p,x,y);
          for(const [nx,ny] of dirs){
            if(this.inBounds(nx,ny)){
              const target=this.get(nx,ny);
              if(!target || this.isOpp(p,target)){
                moves.push({fromX:x,fromY:y,toX:nx,toY:ny});
              }
            }
          }
        }
      }
    }
    return moves;
  }

  isOpp(a,b){
    return (a===a.toUpperCase() && b===b.toLowerCase()) || (a===a.toLowerCase() && b===b.toUpperCase());
  }

  // Gerakan sederhana, belum penuh aturan
  basicMoves(piece, x, y){
    const res=[];
    const low=piece.toLowerCase();
    const dir=piece===piece.toUpperCase()?-1:1;

    switch(low){
      case "p":
        if(!this.get(x,y+dir)) res.push([x,y+dir]);
        break;
      case "r":
        for(let i=1;i<8;i++){
          if(!this.addDir(res,x,y,i,0)) break;
        }
        for(let i=1;i<8;i++){
          if(!this.addDir(res,x,y,-i,0)) break;
        }
        for(let i=1;i<8;i++){
          if(!this.addDir(res,x,y,0,i)) break;
        }
        for(let i=1;i<8;i++){
          if(!this.addDir(res,x,y,0,-i)) break;
        }
        break;
      case "n":
        [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].forEach(d=>res.push([x+d[0],y+d[1]]));
        break;
      case "b":
        for(let i=1;i<8;i++){
          if(!this.addDir(res,x,y,i,i)) break;
        }
        for(let i=1;i<8;i++){
          if(!this.addDir(res,x,y,-i,i)) break;
        }
        for(let i=1;i<8;i++){
          if(!this.addDir(res,x,y,i,-i)) break;
        }
        for(let i=1;i<8;i++){
          if(!this.addDir(res,x,y,-i,-i)) break;
        }
        break;
      case "q":
        res.push(...this.basicMoves("r",x,y));
        res.push(...this.basicMoves("b",x,y));
        break;
      case "k":
        for(let dx=-1;dx<=1;dx++){
          for(let dy=-1;dy<=1;dy++){
            if(dx||dy) res.push([x+dx,y+dy]);
          }
        }
        break;
    }
    return res.filter(([nx,ny])=>this.inBounds(nx,ny));
  }

  addDir(res,x,y,dx,dy){
    const nx=x+dx, ny=y+dy;
    if(!this.inBounds(nx,ny)) return false;
    const t=this.get(nx,ny);
    if(t){
      if(this.isOpp(this.get(x,y),t)) res.push([nx,ny]);
      return false;
    }
    res.push([nx,ny]);
    return true;
  }
}
