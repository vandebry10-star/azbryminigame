// ================= CONFIG =====================
const MASK = [
  ".....XXX.....X..",
  ".....X..X....X..",
  "....XXX..XXXXX..",
  ".X..X....X..X...",
  ".....XXXXX.....X",
  "....X...X...X...",
  "..XXXXX.X.XXXXX.",
  "....X...X...X...",
  "X.....XXXXX.....",
  "...X..X....X..X.",
  "..XXXXX..XXX...."
];

const ACROSS_ANS = [
  {ans:"RUMAH", clue:"Tempat tinggal manusia"},
  {ans:"SEWA", clue:"Disewa sementara"},
  {ans:"ARENA", clue:"Tempat pertandingan"},
  {ans:"IKLAN", clue:"Promosi komersial"},
  {ans:"KOMPAS", clue:"Penunjuk arah di peta"},
  {ans:"ASAL", clue:"Berasal"},
  {ans:"UNDANG", clue:"Meminta hadir secara resmi"},
  {ans:"DATA", clue:"Kumpulan fakta"},
  {ans:"SEPEDA", clue:"Kendaraan beroda dua"},
  {ans:"POTONG", clue:"Memotong tipis"}
];
const DOWN_ANS = [
  {ans:"MATA", clue:"Bagian tubuh untuk melihat"},
  {ans:"PENA", clue:"Benda untuk menulis"},
  {ans:"SUARA", clue:"Bunyi; vokal"},
  {ans:"TANAM", clue:"Menanam bibit"},
  {ans:"INTI", clue:"Pusat; inti"},
  {ans:"ALAMI", clue:"Berasal dari alam"},
  {ans:"AKTIF", clue:"Banyak bergerak"},
  {ans:"HOBI", clue:"Kegemaran"},
  {ans:"RAMAH", clue:"Sikap bersahabat"},
  {ans:"LIRIK", clue:"Kata-kata pada lagu"}
];
// =============================================

const H = MASK.length, W = MASK[0].length;
const gridInfo = Array.from({length:H},(_,r)=>
  Array.from({length:W},(_,c)=>({block:MASK[r][c]==='X',char:'',num:0}))
);

// -------- find slots --------
function findAcross(){
  const s=[];
  for(let r=0;r<H;r++){
    let c=0;
    while(c<W){
      if(gridInfo[r][c].block){c++;continue;}
      const start=(c===0||gridInfo[r][c-1].block);
      if(start){
        let len=0,k=c;
        while(k<W&&!gridInfo[r][k].block){len++;k++;}
        s.push({r,c,len});
        c=k;
      }else c++;
    }
  }
  return s;
}
function findDown(){
  const s=[];
  for(let c=0;c<W;c++){
    let r=0;
    while(r<H){
      if(gridInfo[r][c].block){r++;continue;}
      const start=(r===0||gridInfo[r-1][c].block);
      if(start){
        let len=0,k=r;
        while(k<H&&!gridInfo[k][c].block){len++;k++;}
        s.push({r,c,len});
        r=k;
      }else r++;
    }
  }
  return s;
}

let A=findAcross(), D=findDown();
// === prune 10 slot masing2 ===
A=A.slice(0,10).map((x,i)=>({...x,no:i+1,type:'A'}));
D=D.slice(0,10).map((x,i)=>({...x,no:i+1,type:'D'}));
const used=new Set();
for(const s of [...A,...D]){
  if(s.type==='A')for(let k=0;k<s.len;k++)used.add(`${s.r},${s.c+k}`);
  else for(let k=0;k<s.len;k++)used.add(`${s.r+k},${s.c}`);
}
for(let r=0;r<H;r++)for(let c=0;c<W;c++){
  if(!used.has(`${r},${c}`))gridInfo[r][c].block=true;
}
const acrossSlots=A, downSlots=D;

// ---------- build board ----------
const $g=document.getElementById('grid');
$g.style.gridTemplateColumns=`repeat(${W},1fr)`;
for(let r=0;r<H;r++){
  for(let c=0;c<W;c++){
    const d=gridInfo[r][c];
    const el=document.createElement('div');
    el.className='cell'+(d.block?' block':'');
    el.dataset.r=r;el.dataset.c=c;
    $g.appendChild(el);
  }
}
for(const s of acrossSlots){
  const el=$g.children[s.r*W+s.c];
  const n=document.createElement('div');n.className='num';n.textContent=s.no;
  el.appendChild(n);
}
for(const s of downSlots){
  const el=$g.children[s.r*W+s.c];
  if(!el.querySelector('.num')){
    const n=document.createElement('div');n.className='num';n.textContent=s.no;
    el.appendChild(n);
  }
}

// render clue lists
const Aol=document.getElementById('across'), Dol=document.getElementById('down');
ACROSS_ANS.forEach(x=>{const li=document.createElement('li');li.textContent=x.clue;Aol.appendChild(li);});
DOWN_ANS.forEach(x=>{const li=document.createElement('li');li.textContent=x.clue;Dol.appendChild(li);});

// -------- interaksi --------
let dir='A';let cur={r:acrossSlots[0].r,c:acrossSlots[0].c};
const $dir=document.getElementById('dir'),$hid=document.getElementById('hid');
function setDir(d){dir=d;$dir.textContent=`Arah: ${d==='A'?'Mendatar':'Menurun'}`;}
setDir('A');
function cellAt(r,c){return $g.children[r*W+c];}
function isLetter(r,c){return !gridInfo[r][c].block;}
function focusCell(r,c){
  if(!isLetter(r,c))return;
  document.querySelectorAll('.cell.active').forEach(e=>e.classList.remove('active'));
  cellAt(r,c).classList.add('active');cur={r,c};$hid.focus();
}
focusCell(cur.r,cur.c);
function step(r,c,d){let rr=r,cc=c;do{rr+=(dir==='D'?d:0);cc+=(dir==='A'?d:0);}while(rr>=0&&rr<H&&cc>=0&&cc<W&&!isLetter(rr,cc));if(rr<0||rr>=H||cc<0||cc>=W)return null;return{r:rr,c:cc};}
function put(ch){if(!isLetter(cur.r,cur.c))return;cellAt(cur.r,cur.c).textContent=ch;const nx=step(cur.r,cur.c,1);if(nx)focusCell(nx.r,nx.c);}
function back(){if(!isLetter(cur.r,cur.c))return;if(!cellAt(cur.r,cur.c).textContent){const pv=step(cur.r,cur.c,-1);if(pv)focusCell(pv.r,pv.c);}cellAt(cur.r,cur.c).textContent='';}
document.addEventListener('keydown',e=>{if(e.key===' '){setDir(dir==='A'?'D':'A');e.preventDefault();return;}if(e.key==='Backspace'){back();e.preventDefault();return;}const k=e.key.toUpperCase();if(k>='A'&&k<='Z')put(k);});
$g.addEventListener('click',e=>{const t=e.target.closest('.cell');if(!t)return;const r=+t.dataset.r,c=+t.dataset.c;if(!isLetter(r,c))return;focusCell(r,c);});
$hid.addEventListener('input',e=>{const v=e.target.value.slice(-1).toUpperCase();if(v>='A'&&v<='Z')put(v);e.target.value='';});
$hid.addEventListener('keydown',e=>{if(e.key==='Backspace'){back();e.preventDefault();}});

// --- check & reset ---
function readAcross(s){let str='';for(let i=0;i<s.len;i++)str+=(cellAt(s.r,s.c+i).textContent||'');return str;}
function readDown(s){let str='';for(let i=0;i<s.len;i++)str+=(cellAt(s.r+i,s.c).textContent||'');return str;}
document.getElementById('btnCheck').onclick=()=>{
  let ok=true;
  for(let i=0;i<acrossSlots.length&&i<ACROSS_ANS.length;i++)
    if(readAcross(acrossSlots[i])!==ACROSS_ANS[i].ans){ok=false;break;}
  if(ok)for(let i=0;i<downSlots.length&&i<DOWN_ANS.length;i++)
    if(readDown(downSlots[i])!==DOWN_ANS[i].ans){ok=false;break;}
  alert(ok?'Mantap! Semua benar 🎉':'Masih ada yang salah 😅');
};
document.getElementById('btnReset').onclick=()=>{
  [...$g.children].forEach(el=>{
    if(!el.classList.contains('block')){
      const n=el.querySelector('.num');el.textContent='';if(n)el.appendChild(n);
    }
  });
  setDir('A');focusCell(acrossSlots[0].r,acrossSlots[0].c);
};
