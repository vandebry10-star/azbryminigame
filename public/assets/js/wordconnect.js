/* =====================================================
   Azbry Word Connect (Fix Promax)
   Reset tiap refresh, cuma simpen Best.
   ===================================================== */

const LEVELS = [
  { letters: 'BATIK', words: ['BATIK','BAKTI','IKAT','TIBA','KITA','TIKA','BAKI'] },
  { letters: 'SAKIT', words: ['SAKIT','SIKAT','TAKSI','AKSI','KATA','TIKA','SITA'] },
  { letters: 'PASIR', words: ['PASIR','SIRAP','PRIA','RAPI','SARI','ASRI','IRIS'] },
  { letters: 'MELATI', words: ['MELATI','TELAI','ELIT','TALI','LIMA','TEMA','MATA'] },
  { letters: 'IKLAN', words: ['IKLAN','KAIN','NAIK','KALI','KIAN','LAIN','IKAL'] },
  { letters: 'RUMAH', words: ['RUMAH','HARUM','ARUM','HUMA','HARI','MAHU'] },
  { letters: 'KAPUR', words: ['KAPUR','PAKU','RUPA','PURA','KURA','ARPU','AKU'] },
  { letters: 'SEPEDA', words: ['SEPEDA','SAPA','SEPA','PELA','LEPAS','PELAS'] },
  { letters: 'GARIS', words: ['GARIS','SARI','RASI','ASRI','IRIS','RIGA'] },
  { letters: 'SENJA', words: ['SENJA','JASA','SENA','NESA','JAN','ESA','ANE'] },
  { letters: 'KOPIAH', words: ['KOPIAH','KOPI','PAKAI','PAI','PAK','OHA'] },
  { letters: 'GARAMU', words: ['GARAM','AGAR','RAGA','AMAR','ARUM','RAMA'] },
  { letters: 'KAMBING', words: ['KAMBING','BINGKA','BINA','KAMI','AMIN','GAMI'] },
  { letters: 'CABAIK', words: ['CABAI','BAIK','BACA','AKIB','ABAI','KACA','BIA'] },
  { letters: 'ROTANG', words: ['ROTAN','TANG','RANG','RONTGA','RONA','TARO'] },
  { letters: 'SAYUR', words: ['SAYUR','RASA','SURA','AYU','RAYA','SURAU'] },
  { letters: 'NASIRO', words: ['NASI','SION','SARI','RONA','ORANG','ARIS','RISA'] },
  { letters: 'LAPANG', words: ['LAPANG','PALANG','LAGAN','LAGA','PALA','LANG'] },
  { letters: 'TANJUR', words: ['TANJUR','TARUN','JUTA','JARUT','TARU','JURAT'] },
  { letters: 'RAMBUT', words: ['RAMBUT','TARUM','BURAM','TARU','RATU','TUBA'] },
];

// ==========================
//  STATE
// ==========================
const state = {
  level: 1,
  score: 0,
  best: Number(localStorage.getItem('azbry-wc-best') || 0),
  currentWord: '',
  foundWords: new Set(),
};

// tiap refresh mulai ulang
localStorage.removeItem('azbry-wc-level');
localStorage.removeItem('azbry-wc-score');

// cuma simpen best
const save = () => {
  localStorage.setItem('azbry-wc-best', state.best);
};

// ==========================
//  GAME CORE
// ==========================
function loadLevel(num) {
  const level = LEVELS[num - 1];
  if (!level) {
    alert("🎉 Kamu sudah menamatkan semua level!");
    return;
  }
  state.currentLevel = level;
  state.foundWords.clear();
  state.currentWord = '';

  renderBoard(level);
  updateUI();
  log(`Level ${num} dimulai. Huruf: ${level.letters.split('').join(' • ')}`);
}

function renderBoard(level) {
  const board = document.getElementById('board');
  if (!board) return;
  board.innerHTML = '';

  const letters = level.letters.split('');
  letters.forEach(letter => {
    const el = document.createElement('button');
    el.className = 'letter';
    el.textContent = letter;
    el.onclick = () => addLetter(letter);
    board.appendChild(el);
  });
}

function addLetter(l) {
  state.currentWord += l;
  document.getElementById('currentWord').textContent = state.currentWord;
}

function submitWord() {
  const word = state.currentWord.toUpperCase();
  if (state.currentLevel.words.includes(word) && !state.foundWords.has(word)) {
    state.foundWords.add(word);
    state.score += 10;
    log(`✅ Benar: ${word}`);
  } else {
    log(`❌ Salah: ${word}`);
  }
  state.currentWord = '';
  document.getElementById('currentWord').textContent = '';

  // cek level complete
  if (state.foundWords.size === state.currentLevel.words.length) {
    state.level++;
    log(`🎯 Level ${state.level - 1} selesai!`);
    save();
    setTimeout(() => loadLevel(state.level), 1000);
  }
  updateUI();
}

function shuffleLetters() {
  const arr = state.currentLevel.letters.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  state.currentLevel.letters = arr.join('');
  renderBoard(state.currentLevel);
}

function updateUI() {
  document.getElementById('score').textContent = state.score;
  document.getElementById('best').textContent = state.best;
  document.getElementById('level').textContent = state.level;
  if (state.score > state.best) {
    state.best = state.score;
    save();
  }
}

function log(txt) {
  const logBox = document.getElementById('log');
  if (logBox) logBox.innerHTML = `[${new Date().toLocaleTimeString()}] ${txt}<br>` + logBox.innerHTML;
}

// ==========================
//  INIT
// ==========================
document.addEventListener('DOMContentLoaded', () => {
  loadLevel(state.level);
  document.getElementById('shuffleBtn').onclick = shuffleLetters;
  document.getElementById('submitBtn').onclick = submitWord;
});
