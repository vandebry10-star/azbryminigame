// =====================================================
// Azbry Chess Main — wiring tombol & mode
// =====================================================
import { initUI, newGame, setModeAI, undoOne, redoOne } from './chess-ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initUI();

  // Mode
  const btnHuman = document.getElementById('modeHuman');
  const btnAI    = document.getElementById('modeAI');

  btnHuman?.addEventListener('click', () => {
    btnHuman.classList.add('active');
    btnAI?.classList.remove('active');
    setModeAI(false);
  });

  btnAI?.addEventListener('click', () => {
    btnAI.classList.add('active');
    btnHuman?.classList.remove('active');
    setModeAI(true);
  });

  // Kontrol
  document.getElementById('btnReset')?.addEventListener('click', newGame);
  document.getElementById('btnUndo') ?.addEventListener('click', undoOne);
  document.getElementById('btnRedo') ?.addEventListener('click', redoOne);
  document.getElementById('btnFlip') ?.addEventListener('click', () => {
    document.getElementById('board')?.classList.toggle('flip');
  });

  // Tampilan (board only / kembali)
  document.getElementById('btnBoardOnly')?.addEventListener('click', () => {
    document.body.classList.toggle('board-only');
  });

  document.getElementById('btnBack')?.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.href = 'index.html';
  });
});
