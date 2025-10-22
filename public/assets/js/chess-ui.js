// ChessUI v2 — self-contained (tanpa butuh helper lain)
// Tugas: bangun grid 8x8, render bidak dari FEN, label a–h & 1–8, flip, highlight.

;(function (global) {
  const FILES = ['a','b','c','d','e','f','g','h'];
  const PIECE_CHAR = { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟', K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙' };

  function ChessUI(boardEl, onSquareClick) {
    if (!boardEl) throw new Error('boardEl is required');
    this.board = boardEl;
    this.onSquareClick = onSquareClick || function(){};
    this.flipped = false;
    this.squares = [];
    this._buildGrid();
  }

  ChessUI.prototype._buildGrid = function () {
    const b = this.board;
    b.innerHTML = '';
    b.classList.add('board');
    // grid 64 kotak
    for (let r = 8; r >= 1; r--) {
      for (let f = 0; f < 8; f++) {
        const sq = FILES[f] + r;
        const d = document.createElement('div');
        d.className = 'square ' + ((r + f) % 2 === 0 ? 'light' : 'dark');
        d.dataset.square = sq;
        d.addEventListener('click', () => this.onSquareClick(this._map(sq)));
        b.appendChild(d);
        this.squares.push(d);
      }
    }
    // label file a–h (bawah)
    const files = document.createElement('div');
    files.className = 'files';
    for (let i = 0; i < 8; i++) {
      const span = document.createElement('span');
      span.textContent = FILES[i];
      files.appendChild(span);
    }
    b.appendChild(files);
    // label rank 1–8 (kanan)
    const ranks = document.createElement('div');
    ranks.className = 'ranks';
    for (let i = 8; i >= 1; i--) {
      const span = document.createElement('span');
      span.textContent = i;
      ranks.appendChild(span);
    }
    b.appendChild(ranks);
  };

  ChessUI.prototype._map = function (sq) {
    // mapping jika board di-flip
    if (!this.flipped) return sq;
    const f = 7 - FILES.indexOf(sq[0]);
    const r = 9 - parseInt(sq[1],10);
    return FILES[f] + r;
  };

  ChessUI.prototype.toggleFlip = function () {
    this.flipped = !this.flipped;
    this.board.classList.toggle('flipped', this.flipped);
    // re-render ulang supaya label tetap benar
    if (this._lastFEN) this.renderFEN(this._lastFEN, this._opts || {});
  };

  // opts: { selected, legal: [to], lastMove: {from,to}, inCheck: 'w'|'b', marks: {src,dst} }
  ChessUI.prototype.renderFEN = function (fen, opts={}) {
    this._lastFEN = fen;
    this._opts = opts;

    // bersih
    this.board.querySelectorAll('.piece').forEach(n => n.remove());
    this.squares.forEach(n => {
      n.classList.remove('sel','legal','src','dst','check');
    });

    // render pieces
    const pos = fen.split(' ')[0];
    const rows = pos.split('/');
    for (let r = 0; r < 8; r++) {
      let file = 0;
      for (const ch of rows[r]) {
        if (/\d/.test(ch)) { file += parseInt(ch,10); continue; }
        const sq = FILES[file] + (8 - r);
        const target = this.board.querySelector(`[data-square="${this._map(sq)}"]`);
        if (target) {
          const el = document.createElement('div');
          el.className = 'piece ' + (ch === ch.toUpperCase() ? 'white' : 'black');
          el.textContent = PIECE_CHAR[ch] || '?';
          target.appendChild(el);
        }
        file++;
      }
    }

    // marks
    if (opts.selected) {
      const c = this.board.querySelector(`[data-square="${this._map(opts.selected)}"]`);
      c && c.classList.add('sel');
    }
    if (opts.legal && Array.isArray(opts.legal)) {
      opts.legal.forEach(to => {
        const c = this.board.querySelector(`[data-square="${this._map(to)}"]`);
        c && c.classList.add('legal');
      });
    }
    if (opts.lastMove) {
      const s = this.board.querySelector(`[data-square="${this._map(opts.lastMove.from)}"]`);
      const d = this.board.querySelector(`[data-square="${this._map(opts.lastMove.to)}"]`);
      s && s.classList.add('src');
      d && d.classList.add('dst');
    }
    if (opts.inCheck) {
      // cari K/k sesuai warna lalu kasih ring merah di kotaknya
      const color = opts.inCheck; // 'w'|'b'
      const need = color === 'w' ? 'K' : 'k';
      // scan FEN
      for (let rr = 0; rr < 8; rr++) {
        let ff = 0;
        for (const ch of rows[rr]) {
          if (/\d/.test(ch)) { ff += parseInt(ch,10); continue; }
          if (ch === need) {
            const sq = FILES[ff] + (8 - rr);
            const c = this.board.querySelector(`[data-square="${this._map(sq)}"]`);
            c && c.classList.add('check');
          }
          ff++;
        }
      }
    }
  };

  global.ChessUI = ChessUI;
})(window);
