// assets/js/chess-ui.js — ChessUI v2.1 (robust)
// Build grid 8x8 (class .sq), render dari array board() atau FEN,
// support flip, legal move dots, highlight last move, dan mark king in-check.
// Kompatibel dengan CSS kamu (.sq, .light/.dark, .dot, .src, .last, .check).

;(function (global) {
  'use strict';

  const FILES = ['a','b','c','d','e','f','g','h'];
  const PIECE_CHAR = {
    k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟',
    K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙'
  };

  function idxToAlg(i){
    // i: 0..63 -> "a1".. "h8" (match toIdx di main.js)
    const r = 8 - Math.floor(i / 8);   // 8..1
    const f = i % 8;                   // 0..7
    return FILES[f] + r;
  }

  function ChessUI(boardEl, onSquareClick) {
    if (!boardEl) throw new Error('ChessUI: boardEl is required');
    this.board = boardEl;
    this.onSquareClick = typeof onSquareClick === 'function' ? onSquareClick : function(){};
    this.flipped = false;
    this.squares = [];
    this._lastKind  = null;   // 'array' | 'fen'
    this._lastBoard = null;   // array 64
    this._lastFEN   = null;
    this._opts      = {};
    this._buildGrid();
  }

  // ================= Grid =================
  ChessUI.prototype._buildGrid = function () {
    const b = this.board;
    b.innerHTML = '';
    b.classList.add('board');
    this.squares.length = 0;

    // r (rank) dari 8..1 (atas -> bawah), f (file) 0..7 (a..h)
    for (let r = 8; r >= 1; r--) {
      for (let f = 0; f < 8; f++) {
        const sqAlg = FILES[f] + r;
        const d = document.createElement('div');
        d.className = 'sq ' + ((r + f) % 2 === 0 ? 'light' : 'dark');
        d.dataset.square = sqAlg;
        d.dataset.file   = FILES[f];   // buat label CSS (a–h)
        d.dataset.rank   = r;          // buat label CSS (1–8)
        d.addEventListener('click', () => this.onSquareClick(this._map(sqAlg)));
        this.squares.push(d);
        b.appendChild(d);
      }
    }
  };

  // ================= Flip =================
  ChessUI.prototype._map = function (sq) {
    if (!this.flipped) return sq;
    const f = 7 - FILES.indexOf(sq[0]);
    const r = 9 - parseInt(sq[1],10);
    return FILES[f] + r;
  };

  ChessUI.prototype.toggleFlip = function () {
    this.flipped = !this.flipped;
    this.board.classList.toggle('flipped', this.flipped);
    // re-render terakhir biar posisi bidak & marks konsisten
    if (this._lastKind === 'array' && this._lastBoard) {
      this.render(this._lastBoard, this._opts);
    } else if (this._lastKind === 'fen' && this._lastFEN) {
      this.renderFEN(this._lastFEN, this._opts);
    }
  };

  // =============== Utilities ===============
  ChessUI.prototype._clearPiecesAndMarks = function () {
    // buang bidak & titik
    this.board.querySelectorAll('.piece, .dot').forEach(n => n.remove());
    // bersihkan kelas highlight
    this.squares.forEach(n => n.classList.remove('sel','src','last','check','in-check'));
  };

  // =============== Render: dari array 64 ===============
  // boardArray[i] = null | { color:'w'|'b', piece:'P'|'N'|'B'|'R'|'Q'|'K' }
  ChessUI.prototype.render = function (boardArray, opts = {}) {
    this._lastKind  = 'array';
    this._lastBoard = boardArray;
    this._opts      = opts || {};
    this._clearPiecesAndMarks();

    // Pieces
    for (let i = 0; i < 64; i++) {
      const cell = boardArray[i];
      if (!cell) continue;
      const sq = idxToAlg(i);
      const target = this.board.querySelector(`[data-square="${this._map(sq)}"]`);
      if (!target) continue;
      const el = document.createElement('div');
      el.className = 'piece ' + (cell.color === 'w' ? 'white' : 'black');
      const key = (cell.color === 'w' ? cell.piece.toUpperCase() : cell.piece.toLowerCase());
      el.textContent = PIECE_CHAR[key] || '?';
      target.appendChild(el);
    }

    // Selected
    if (opts.selected) {
      const c = this.board.querySelector(`[data-square="${this._map(opts.selected)}"]`);
      if (c) c.classList.add('sel');
    }

    // Legal dots
    if (Array.isArray(opts.legal)) {
      for (const to of opts.legal) {
        const c = this.board.querySelector(`[data-square="${this._map(to)}"]`);
        if (!c) continue;
        const dot = document.createElement('div');
        dot.className = 'dot enter';
        c.appendChild(dot);
        requestAnimationFrame(()=> dot.classList.remove('enter'));
      }
    }

    // Last move (from -> .src, to -> .last)
    if (opts.lastMove && opts.lastMove.from && opts.lastMove.to) {
      const s = this.board.querySelector(`[data-square="${this._map(opts.lastMove.from)}"]`);
      const d = this.board.querySelector(`[data-square="${this._map(opts.lastMove.to)}"]`);
      if (s) s.classList.add('src');
      if (d) d.classList.add('last');
    }

    // In-check: tandai kotak raja
    if (opts.inCheck) {
      const need = opts.inCheck === 'w' ? 'K' : 'k';
      for (let i = 0; i < 64; i++) {
        const c = boardArray[i];
        if (!c) continue;
        const key = (c.color === 'w' ? c.piece.toUpperCase() : c.piece.toLowerCase());
        if (key === need) {
          const sq = idxToAlg(i);
          const cellEl = this.board.querySelector(`[data-square="${this._map(sq)}"]`);
          if (cellEl) cellEl.classList.add('check');
          break;
        }
      }
    }
  };

  // =============== Render: dari FEN ===============
  ChessUI.prototype.renderFEN = function (fen, opts = {}) {
    this._lastKind = 'fen';
    this._lastFEN  = fen;
    this._opts     = opts || {};
    this._clearPiecesAndMarks();

    // FEN pieces
    const pos  = (fen || '').split(' ')[0] || '';
    const rows = pos.split('/');
    for (let r = 0; r < 8; r++) {
      let file = 0;
      const row = rows[r] || '';
      for (const ch of row) {
        if (/\d/.test(ch)) { file += parseInt(ch, 10); continue; }
        const sq = FILES[file] + (8 - r); // algebraic normal
        const target = this.board.querySelector(`[data-square="${this._map(sq)}"]`);
        if (target) {
          const el = document.createElement('div');
          const isWhite = (ch === ch.toUpperCase());
          el.className = 'piece ' + (isWhite ? 'white' : 'black');
          el.textContent = PIECE_CHAR[ch] || '?';
          target.appendChild(el);
        }
        file++;
      }
    }

    // Selected
    if (opts.selected) {
      const c = this.board.querySelector(`[data-square="${this._map(opts.selected)}"]`);
      if (c) c.classList.add('sel');
    }

    // Legal dots
    if (Array.isArray(opts.legal)) {
      for (const to of opts.legal) {
        const c = this.board.querySelector(`[data-square="${this._map(to)}"]`);
        if (!c) continue;
        const dot = document.createElement('div');
        dot.className = 'dot enter';
        c.appendChild(dot);
        requestAnimationFrame(()=> dot.classList.remove('enter'));
      }
    }

    // Last move
    if (opts.lastMove && opts.lastMove.from && opts.lastMove.to) {
      const s = this.board.querySelector(`[data-square="${this._map(opts.lastMove.from)}"]`);
      const d = this.board.querySelector(`[data-square="${this._map(opts.lastMove.to)}"]`);
      if (s) s.classList.add('src');
      if (d) d.classList.add('last');
    }

    // In-check: cari K/k di FEN
    if (opts.inCheck) {
      const need = opts.inCheck === 'w' ? 'K' : 'k';
      for (let rr = 0; rr < 8; rr++) {
        let ff = 0;
        const row = rows[rr] || '';
        for (const ch of row) {
          if (/\d/.test(ch)) { ff += parseInt(ch,10); continue; }
          if (ch === need) {
            const sq = FILES[ff] + (8 - rr);
            const cellEl = this.board.querySelector(`[data-square="${this._map(sq)}"]`);
            if (cellEl) cellEl.classList.add('check');
          }
          ff++;
        }
      }
    }
  };

  // Expose
  global.ChessUI = ChessUI;
})(window);
