// assets/js/main.js — Controller + Renderer (final + menu & result overlay)
// Cocok dengan engine "Chess" (API mirip chess.js) dan UI "ChessUI(boardEl, onSquareCb)".

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // Root UI
  let boardEl      = $('board');
  const modeHuman  = $('modeHuman');
  const modeAI     = $('modeAI');
  const btnReset   = $('btnReset');
  const btnUndo    = $('btnUndo');
  const btnRedo    = $('btnRedo');
  const btnFlip    = $('btnFlip');
  const btnOnly    = $('btnBoardOnly');
  const btnBack    = $('btnBack');
  const moveLog    = $('moveHistory');

  // Overlays (opsional, kalau ada di HTML)
  const startMenu     = $('startMenu');
  const btnStartHuman = $('btnStartHuman');
  const btnStartAI    = $('btnStartAI');

  const resultPopup = $('resultPopup');
  const resultText  = $('resultText');
  const btnRestart  = $('btnRestart');

  // Board fallback jika belum ada (biar gak blank)
  if (!boardEl) {
    boardEl = document.createElement('div');
    boardEl.id = 'board';
    boardEl.className = 'board';
    document.body.appendChild(boardEl);
  }

  // Game state
  const game = new Chess();                 // engine
  const ui   = new ChessUI(boardEl, onSquare);
  let mode   = 'human';                     // 'human' | 'ai'
  let selected = null;
  let lastMove = null;

  // Mode picker (di halaman)
  if (modeHuman) modeHuman.addEventListener('click', () => setMode('human'));
  if (modeAI)    modeAI.addEventListener('click',    () => setMode('ai'));

  // Controls
  if (btnReset)  btnReset.addEventListener('click',  () => hardReset());
  if (btnUndo)   btnUndo.addEventListener('click',   () => { game.undo(); selected=null; lastMove=null; sync(); });
  if (btnRedo)   btnRedo.addEventListener('click',   () => { game.redo(); selected=null; lastMove=null; sync(); });
  if (btnFlip)   btnFlip.addEventListener('click',   () => { if (ui.toggleFlip) ui.toggleFlip(); sync(); });

  // Board Only
  if (btnOnly) {
    btnOnly.addEventListener('click', () => {
      document.body.classList.add('board-only');
      if (btnOnly) btnOnly.style.display = 'none';
      if (btnBack) btnBack.style.display = 'inline-block';
    });
  }
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      document.body.classList.remove('board-only');
      if (btnBack) btnBack.style.display = 'none';
      if (btnOnly) btnOnly.style.display = 'inline-block';
    });
  }

  // Start menu (opsional)
  if (btnStartHuman) btnStartHuman.addEventListener('click', () => startGame('human'));
  if (btnStartAI)    btnStartAI.addEventListener('click',    () => startGame('ai'));

  // Result popup (opsional)
  if (btnRestart) btnRestart.addEventListener('click', () => {
    hideResult();
    if (startMenu) startMenu.classList.add('show');
    hardReset();
  });

  function startGame(m) {
    setMode(m);
    if (startMenu) startMenu.classList.remove('show');
  }

  function setMode(m) {
    mode = m;
    if (modeHuman) modeHuman.classList.toggle('active', m==='human');
    if (modeAI)    modeAI.classList.toggle('active',   m==='ai');
    selected = null;
    lastMove = null;
    sync();
    // Kalau AI dan ganti giliran jadi AI (misal flip), langsung jalanin
    maybeAIMove();
  }

  function hardReset() {
    game.reset();
    selected = null;
    lastMove = null;
    sync();
    if (mode === 'ai') maybeAIMove();
  }

  // ====== INPUT: Klik kotak papan ======
  function onSquare(squareAlg) {
    // Mode AI: manusia = putih; AI = hitam
    if (mode === 'ai' && game.turn && game.turn() === 'b') return;

    const legalFromSel = selected ? legalTargets(selected) : [];

    // klik tujuan legal dari selected
    if (selected && legalFromSel.includes(squareAlg)) {
      const promo = needsPromotion(selected, squareAlg) ? askPromotionOrDefault() : null;
      const note = tryMove({ from: selected, to: squareAlg, promotion: promo });
      if (note) {
        lastMove = { from: selected, to: squareAlg, san: note.san || '' };
        selected = null;
        sync();
        // Jika AI: jalankan langkah AI setelah render
        maybeAIMove();
      }
      return;
    }

    // pilih atau batal pilih
    if (squareHasColorPiece(squareAlg, game.turn ? game.turn() : 'w')) {
      selected = squareAlg;
    } else {
      selected = null;
    }
    sync();
  }

  // ====== ENGINE HELPERS ======
  function tryMove(m) {
    // Support dua gaya API: san string atau objek verbose
    try {
      return game.move ? game.move(m) : null;
    } catch (e) {
      // fallback san "e2e4" style kalau engine pakai notasi pendek
      try {
        const san = (m.from || '') + (m.to || '') + (m.promotion ? m.promotion.toLowerCase() : '');
        return game.move(san);
      } catch {
        return null;
      }
    }
  }

  function legalTargets(from) {
    // coba verbose
    try {
      const list = game.moves ? game.moves({ square: from, verbose: true }) : [];
      if (Array.isArray(list) && list.length && list[0].to) {
        return list.map(x => x.to);
      }
    } catch {}
    // fallback non-verbose (SAN) — engine mungkin nggak support
    try {
      const list = game.moves ? game.moves({ square: from }) : [];
      if (Array.isArray(list)) {
        // sulit mapping SAN->to; kosongin aja
        return [];
      }
    } catch {}
    return [];
  }

  function needsPromotion(from, to) {
    // kalau pion mencapai rank terakhir
    try {
      const piece = game.get ? game.get(from) : null;
      if (!piece || piece.type !== 'p') return false;
      const rank = parseInt(to[1], 10);
      if (piece.color === 'w' && rank === 8) return true;
      if (piece.color === 'b' && rank === 1) return true;
      return false;
    } catch { return false; }
  }

  function askPromotionOrDefault() {
    // sementara default Queen, nanti bisa dihubungkan dengan modal pilihan UI
    return 'Q';
  }

  function squareHasColorPiece(sq, color) {
    try {
      const p = game.get ? game.get(sq) : null;
      return !!(p && p.color === color);
    } catch { return false; }
  }

  // ====== AI (Azbry-MD) ======
  function maybeAIMove() {
    if (mode !== 'ai') return;
    if (game.game_over && game.game_over()) return;
    if (game.turn && game.turn() === 'b') {
      // sedikit delay biar kelihatan "berpikir"
      setTimeout(() => {
        const move = chooseAIMove(game, 2); // depth 2 cukup cepat
        if (move) {
          tryMove(move);
          lastMove = { from: move.from, to: move.to, san: move.san || '' };
          sync();
        } else {
          // fallback random legal
          const mv = randomLegal(game);
          if (mv) {
            tryMove(mv);
            lastMove = { from: mv.from, to: mv.to, san: mv.san || '' };
            sync();
          }
        }
      }, 200);
    }
  }

  function chooseAIMove(chess, depth = 2) {
    // minimax sederhana (material only)
    const maximizingColor = 'b';
    let best = null, bestScore = -Infinity;

    const moves = safeMoves(chess, { verbose: true });
    for (const m of moves) {
      chess.move(m);
      const score = -negamax(chess, depth - 1, -Infinity, Infinity, flipColor(maximizingColor));
      chess.undo();
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }

  function negamax(chess, depth, alpha, beta, colorToMax) {
    if (depth === 0 || (chess.game_over && chess.game_over())) {
      return evaluate(chess, colorToMax);
    }
    let value = -Infinity;
    const moves = safeMoves(chess, { verbose: true });
    for (const m of moves) {
      chess.move(m);
      const score = -negamax(chess, depth - 1, -beta, -alpha, flipColor(colorToMax));
      chess.undo();
      value = Math.max(value, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return value;
  }

  function evaluate(chess, povColor) {
    // material simple
    const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    let score = 0;
    try {
      const board = chess.board ? chess.board() : []; // chess.js style
      for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
          const p = board[r][c];
          if (!p) continue;
          const v = pieceValues[p.type] || 0;
          score += (p.color === povColor) ? v : -v;
        }
      }
    } catch {
      // FEN parse fallback
      try {
        const fen = chess.fen ? chess.fen() : '';
        const part = fen.split(' ')[0] || '';
        for (const ch of part) {
          const t = ch.toLowerCase();
          const isUpper = ch !== t;
          if ('prnbqk'.includes(t)) {
            const v = pieceValues[t] || 0;
            score += isUpper ? v : -v;
          }
        }
      } catch {}
    }
    return score / 1000; // scale kecil
  }

  function flipColor(c) { return c === 'w' ? 'b' : 'w'; }

  function safeMoves(chess, opts) {
    try {
      return chess.moves ? chess.moves(opts) : [];
    } catch { return []; }
  }

  function randomLegal(chess) {
    const list = safeMoves(chess, { verbose: true });
    if (list.length) return list[Math.floor(Math.random()*list.length)];
    // fallback non-verbose impossible to apply safely
    return null;
  }

  // ====== RENDER & STATUS ======
  function sync() {
    // Build opsi render untuk UI (kalau ChessUI mendukung)
    let opts = {};
    if (selected) {
      opts.legal = legalTargets(selected);
      opts.selected = selected;
    }
    if (lastMove) opts.lastMove = lastMove;

    // highlight check (opsional)
    let inCheck = false;
    try { inCheck = game.in_check && game.in_check(); } catch {}
    opts.inCheck = !!inCheck;

    // Render papan & bidak
    try {
      if (ui.render) ui.render(game, opts);
      // Optional hooks
      if (ui.setHints && opts.legal) ui.setHints(opts.legal, lastMove);
      if (ui.highlightCheck && inCheck) {
        const kingSq = findKingSquare(game, game.turn ? game.turn() : 'w');
        if (kingSq) ui.highlightCheck(kingSq);
      }
    } catch (e) {
      console.warn('UI render warn:', e);
    }

    // Riwayat langkah
    updateMoveLog();

    // Periksa akhir game
    checkEndGame();
  }

  function updateMoveLog() {
    if (!moveLog) return;
    let hist = [];
    try { hist = game.history ? game.history({ verbose: true }) : []; } catch {}
    if (!hist || !hist.length) {
      moveLog.textContent = '—';
      return;
    }
    // Format 1. e4 e5 2. Nf3 ...
    let out = '';
    let moveNum = 1;
    for (let i = 0; i < hist.length; i += 2) {
      const w = hist[i];
      const b = hist[i+1];
      out += `${moveNum}. ${w ? (w.san || toAlgPair(w)) : ''} ${b ? (b.san || toAlgPair(b)) : ''}\n`;
      moveNum++;
    }
    moveLog.textContent = out.trim();
  }

  function toAlgPair(m) {
    if (!m) return '';
    if (m.from && m.to) return `${m.from}-${m.to}`;
    return m.san || '';
  }

  function checkEndGame() {
    let over = false, msg = '';
    try {
      if (game.in_checkmate && game.in_checkmate()) {
        over = true;
        const winner = (game.turn && game.turn() === 'w') ? 'Hitam' : 'Putih';
        // kalau mode AI: b = AI
        if (mode === 'ai') {
          if (winner === 'Hitam') {
            msg = `Azbry-MD menang!\n“Terima kasih sudah menjadi sparring.”`;
          } else {
            msg = `Kamu menang!\n“Untung aja aku lagi ngantuk.” — Azbry-MD`;
          }
        } else {
          msg = `${winner} menang (Checkmate)`;
        }
      } else if (game.in_stalemate && game.in_stalemate()) {
        over = true; msg = 'Seri (Stalemate)';
      } else if (game.in_draw && game.in_draw()) {
        over = true; msg = 'Seri';
      } else if (game.in_threefold_repetition && game.in_threefold_repetition()) {
        over = true; msg = 'Seri (Tiga kali pengulangan)';
      } else if (game.insufficient_material && game.insufficient_material()) {
        over = true; msg = 'Seri (Material tidak cukup)';
      }
    } catch {}

    if (over) {
      showResult(msg || 'Game Selesai');
    } else {
      hideResult();
    }
  }

  function showResult(text) {
    if (resultPopup && resultText) {
      resultText.textContent = text;
      resultPopup.classList.add('show');
    }
  }
  function hideResult() {
    if (resultPopup) resultPopup.classList.remove('show');
  }

  function findKingSquare(chess, color) {
    try {
      const board = chess.board ? chess.board() : null;
      if (board) {
        const files = ['a','b','c','d','e','f','g','h'];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.type === 'k' && p.color === color) {
              return files[c] + (8 - r);
            }
          }
        }
      }
    } catch {}
    return null;
  }

  // ===== INIT =====
  hardReset(); // render awal
});
