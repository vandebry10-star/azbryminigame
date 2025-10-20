// =====================================================
// Azbry Chess UI — render papan, interaksi, mode AI
// =====================================================
import { ChessEngine } from './chess-engine.js';

let engine;
let aiMode = false;          // false = vs Human, true = vs Azbry-MD (AI = hitam)
let selected = null;         // {x,y} kotak terpilih
let moveLog = [];            // simpan riwayat langkah untuk ditampilkan
let redoLog = [];

let boardEl, historyEl;

const PIECE_GLYPH = {
  'K': '♔','Q': '♕','R': '♖','B': '♗','N': '♘','P': '♙',
  'k': '♚','q': '♛','r': '♜','b': '♝','n': '♞','p': '♟'
};

export function initUI() {
  boardEl   = document.getElementById('board');
  historyEl = document.getElementById('moveHistory');

  if (!boardEl) return console.error('board element not found');

  // build 8×8 squares
  boardEl.innerHTML = '';
  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      const sq = document.createElement('div');
      sq.className = 'square ' + ((rank + file) % 2 ? 'black' : 'white');
      sq.dataset.x = file;    // file 0..7 (a..h)
      sq.dataset.y = rank;    // rank 0..7 (bottom=0)
      sq.addEventListener('click', onSquareClick);
      boardEl.appendChild(sq);
    }
  }

  newGame();
}

export function newGame() {
  engine = new ChessEngine();
  moveLog = [];
  redoLog = [];
  selected = null;
  renderBoard();
  renderHistory();
}

export function setModeAI(flag) {
  aiMode = !!flag;
  // reset permainan saat ganti mode biar bersih
  newGame();
}

// ===== Board interactions =====
function onSquareClick(e) {
  const sq = e.currentTarget;
  const x = parseInt(sq.dataset.x, 10);
  const y = parseInt(sq.dataset.y, 10);

  // giliran yang bisa jalan (kalau vs AI: pemain adalah putih)
  const turnIsWhite = engine.turn === 'white';
  const piece = engine.get(x, y);

  // Klik ke-1: pilih piece yang boleh jalan
  if (!selected) {
    if (!piece) return; // kotak kosong

    // jika vs AI: hanya boleh pilih bidak putih saat turn putih
    if (aiMode && !turnIsWhite) return;
    if ((turnIsWhite && piece !== piece.toUpperCase()) ||
        (!turnIsWhite && piece !== piece.toLowerCase())) return;

    selected = { x, y };
    highlightMovesFrom(x, y);
    return;
  }

  // Klik ke-2: coba pindah ke target
  const from = { ...selected };
  const to   = { x, y };
  clearHighlights();

  if (tryUserMove(from, to)) {
    // jika vs AI, giliran AI (hitam) jalan sesudah pemain
    if (aiMode && engine.turn === 'black') {
      setTimeout(aiStep, 180);
    }
  }

  selected = null;
  renderBoard();
  renderHistory();
}

// ===== Movement helpers =====
function tryUserMove(from, to) {
  // validasi legal kasar via engine.getAllMoves
  const legal = engine.getAllMoves(engine.turn);
  const ok = legal.some(m => m.fromX === from.x && m.fromY === from.y && m.toX === to.x && m.toY === to.y);
  if (!ok) return false;

  engine.move(from.x, from.y, to.x, to.y);
  pushLog(from, to);
  redoLog.length = 0; // reset redo saat langkah baru
  return true;
}

function aiStep() {
  const moves = engine.getAllMoves('black');
  if (!moves.length) return; // no move → (belum implement checkmate hard)

  // AI sederhana: pilih acak (stabil & ringan)
  const mv = moves[Math.floor(Math.random() * moves.length)];
  engine.move(mv.fromX, mv.fromY, mv.toX, mv.toY);
  pushLog({x:mv.fromX,y:mv.fromY}, {x:mv.toX,y:mv.toY}, true);

  renderBoard();
  renderHistory();
}

function pushLog(from, to, isAI = false) {
  moveLog.push({
    from: coordAlg(from.x, from.y),
    to:   coordAlg(to.x, to.y),
    by:   isAI ? 'AI' : 'You'
  });
}

function coordAlg(x, y) {
  return String.fromCharCode(97 + x) + (y + 1);
}

// ===== Highlight legal moves =====
function highlightMovesFrom(x, y) {
  clearHighlights();
  const sqSel = querySq(x, y);
  if (sqSel) sqSel.classList.add('highlight');

  const legal = engine.getAllMoves(engine.turn)
    .filter(m => m.fromX === x && m.fromY === y);

  legal.forEach(m => {
    const t = querySq(m.toX, m.toY);
    if (t) t.classList.add('move-option');
  });
}

function clearHighlights() {
  boardEl.querySelectorAll('.highlight,.move-option').forEach(el => {
    el.classList.remove('highlight', 'move-option');
  });
}

function querySq(x, y) {
  return boardEl.querySelector(`.square[data-x="${x}"][data-y="${y}"]`);
}

// ===== Render =====
function renderBoard() {
  // bersihkan isi
  boardEl.querySelectorAll('.square').forEach(sq => { sq.innerHTML = ''; });

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const piece = engine.get(x, y);
      if (!piece) continue;
      const el = document.createElement('span');
      el.className = 'piece';
      el.textContent = PIECE_GLYPH[piece] || '•';
      querySq(x, y).appendChild(el);
    }
  }
}

function renderHistory() {
  if (!historyEl) return;
  if (!moveLog.length) { historyEl.textContent = '—'; return; }

  let out = '';
  for (let i = 0; i < moveLog.length; i += 2) {
    const left  = moveLog[i]     ? `${i/2+1}. ${moveLog[i].from}→${moveLog[i].to}` : '';
    const right = moveLog[i + 1] ? `   ${moveLog[i+1].from}→${moveLog[i+1].to}` : '';
    out += left + right + '\n';
  }
  historyEl.textContent = out.trim();
}

// ===== Public helpers for main.js =====
export function undoOne() {
  if (!moveLog.length) return;
  const last = moveLog.pop();
  redoLog.push(last);
  engine.undo();
  renderBoard(); renderHistory();
}

export function redoOne() {
  if (!redoLog.length) return;
  const step = redoLog.pop();
  // parse algebra -> x,y
  const f = { x: step.from.charCodeAt(0) - 97, y: parseInt(step.from[1], 10) - 1 };
  const t = { x: step.to.charCodeAt(0) - 97, y: parseInt(step.to[1], 10) - 1 };
  engine.move(f.x, f.y, t.x, t.y);
  moveLog.push(step);
  renderBoard(); renderHistory();
}
