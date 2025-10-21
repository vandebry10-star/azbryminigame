// ---- helper status berbasis legal moves ----
function inCheck(color) {
  // kalau engine-mu punya isKingInCheck, pakai itu:
  if (typeof window.isKingInCheck === 'function') return window.isKingInCheck(color);
  // fallback ringan: minta engine yang ada
  const st = window.getGameStatus ? window.getGameStatus(color) : { check:false };
  return !!st.check;
}

function sideStatus(color){
  const moves = allLegalMoves(color);
  if (moves.length > 0) return { type: 'play' };            // masih ada langkah
  return inCheck(color) ? { type: 'mate' } : { type: 'stalemate' };
}

function handlePostMoveAndMaybeAI() {
  if (gameOver) return;

  const sideNext = (window.currentTurnColor === 'white') ? 'black' : 'white';

  // ⬇️ evaluasi akhir yang benar
  const st = sideStatus(sideNext);
  if (st.type === 'mate') {
    gameOver = true;
    const winner = (sideNext === 'white') ? 'Hitam' : 'Putih';
    showResultModal(`${winner} menang (Checkmate).`);
    return;
  }
  if (st.type === 'stalemate') {
    gameOver = true;
    showResultModal('Seri (Stalemate).');
    return;
  }

  // ganti giliran & panggil AI bila perlu
  window.currentTurnColor = sideNext;
  maybeAiTurn();
}

// === panggil ini setelah langkah manusia/AI sukses ===
function onHumanOrAiMoveCommitted(from, to, prev) {
  const note = alg(from,to);
  const next = clone(board());
  H.push({ prev, next, note });
  R.length = 0;
  renderLog();

  // toast check untuk lawan (opsional)
  const opp = (window.currentTurnColor === 'white') ? 'black' : 'white';
  if (inCheck(opp)) toast('Check!');

  handlePostMoveAndMaybeAI();
}
