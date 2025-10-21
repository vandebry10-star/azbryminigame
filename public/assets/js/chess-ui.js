/* =====================================================
   Azbry Chess Board — Final Fix
   ===================================================== */

/* Wrapper utama papan */
.board {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  aspect-ratio: 1;
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 0 22px rgba(184,255,154,.1), inset 0 0 10px rgba(0,0,0,.6);
}

/* Kotak catur */
.square {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(22px, 5vw, 52px);
  font-weight: 400;
  transition: background 0.25s ease, transform 0.1s ease;
  user-select: none;
  position: relative;
}

/* Warna papan — kontras tapi lembut */
.square.light {
  background: #b4e39d; /* hijau lembut */
}
.square.dark {
  background: #1a1e1c; /* hitam kehijauan */
}

/* Bidak */
.piece {
  z-index: 2;
  cursor: pointer;
  transition: transform 0.12s ease;
}
.piece.white {
  color: #fff;
  text-shadow: 0 0 6px rgba(255,255,255,.6), 0 0 14px rgba(184,255,154,.2);
}
.piece.black {
  color: #0a0c0a;
  text-shadow: 0 0 4px rgba(0,0,0,.5), 0 0 12px rgba(0,0,0,.8);
}

/* Efek klik / seret */
.piece:active {
  transform: scale(0.9);
}

/* Highlight langkah terakhir */
.square.highlight {
  box-shadow: inset 0 0 16px 4px rgba(184,255,154,.5);
  z-index: 1;
}

/* Outline raja saat skak */
.square.check {
  box-shadow: inset 0 0 8px 3px rgba(255,70,70,.9), 0 0 12px rgba(255,70,70,.6);
}

/* Label papan (a–h, 1–8) */
.square::after {
  position: absolute;
  font-size: 12px;
  opacity: 0.45;
  font-weight: 700;
  pointer-events: none;
  color: #a9b6a3;
}
.square[data-square^="a"]::after { content: attr(data-square); top: 4px; left: 6px; }

/* Supaya cuma pojok bawah dan kiri yang tampil label */
.square[data-square="a1"]::after,
.square[data-square="b1"]::after,
.square[data-square="c1"]::after,
.square[data-square="d1"]::after,
.square[data-square="e1"]::after,
.square[data-square="f1"]::after,
.square[data-square="g1"]::after,
.square[data-square="h1"]::after,
.square[data-square^="a"]::after {
  content: attr(data-square);
}

/* Mode flip (rotasi 180°) */
.board.flipped {
  transform: rotate(180deg);
}
.board.flipped .square {
  transform: rotate(180deg);
}

/* Efek hover elegan */
.square:hover {
  background: rgba(184,255,154,.25);
}

/* Highlight langkah legal */
.square.legal::before {
  content: "";
  position: absolute;
  width: 26%;
  height: 26%;
  border-radius: 50%;
  background: rgba(184,255,154,.4);
  z-index: 1;
}

/* Bidak dipromosikan (Queen dll) animasi */
@keyframes promote-glow {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(184,255,154,.6)); }
  50% { filter: drop-shadow(0 0 18px rgba(184,255,154,.9)); }
}
.piece.promoted {
  animation: promote-glow 1.3s ease-in-out infinite;
}

/* Skor / status */
.move-log {
  font-size: 14px;
  background: rgba(255,255,255,.03);
  border-radius: 16px;
  padding: 10px;
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #c4d3be;
  border: 1px solid rgba(255,255,255,.05);
}

/* Responsif */
@media (max-width: 600px) {
  .square {
    font-size: 32px;
  }
                                                 }
