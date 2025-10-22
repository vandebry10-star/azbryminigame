// ChessUI v2 — self-contained (tanpa helper lain)
// Build grid 8x8, render dari array board() atau FEN, label a–h & 1–8, flip, highlight & move dots.

;(function (global) {
  const FILES = ['a','b','c','d','e','f','g','h'];
  const PIECE_CHAR = {
    k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟',
    K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙'
  };

  function ChessUI(boardEl, onSquareClick) {
    if (!boardEl) throw new Error('boardEl is required');
    this.board = boardEl;
    this.onSquareClick = onSquareClick || function(){};
    this.flipped = false;
    this.squares = [];
    this._lastKind = null;   // 'array' | 'fen'
    this._lastBoard = null;  // array 64
    this._lastFEN = null;
    this._opts = {};
    this._buildGrid();
  }

  // === Build 8x8 grid ====================================================
  ChessUI.prototype._buildGrid = function () {
    const b = this.board;
    b.innerHTML = '';
    b.classList.add('board');
    this.squares.length = 0;

    // r: 8..1 (atas ke bawah), f: 0..7 (a..h)
    for (let r = 8; r >= 1; r--) {
      for (let f = 0; f < 8; f++) {
        const sqAlg = FILES[f] + r;
        const d = document.createElement('div');
        d.className = 'sq ' + ((r + f) % 2 === 0 ? 'light' : 'dark');
        d.dataset.square = sqAlg;
        d.dataset.file = FILES[f];    // ← huruf (a–h)
        d.dataset.rank = r;           // ← angka (1–8)
        d.addEventListener('click', () => this.onSquareClick(this._map(sqAlg)));
        b.appendChild(d);
        this.squares.push(d);
      }
    }
  };

  // Map algebraic jika board di-flip
  ChessUI.prototype._map = function (sq) {
    if (!this.flipped) return sq;
    const f = 7 - FILES.indexOf(sq[0]);
    const r = 9 - parseInt(sq[1],10);
    return FILES[f] + r;
  };

  ChessUI.prototype.toggleFlip = function () {
    this.flipped = !this.flipped;
    this.board.classList.toggle('flipped', this.flipped);
    // re-render terakhir
    if (this._lastKind === 'array' && this._lastBoard) {
      this.render(this._lastBoard, this._opts);
    } else if (this._lastKind === 'fen' && this._lastFEN) {
      this.renderFEN(this._lastFEN, this._opts);
    }
  };

  // === Utilities ==========================================================
  ChessUI.prototype._clearPiecesAndDots = function () {
    this.board.querySelectorAll('.piece, .dot').forEach(n => n.remove());
    this.squares.forEach(n => n.classList.remove('sel','src','last','check'));
  };

  function idxToAlg(i){
    // i: 0..63 dengan mapping: (8 - rank) * 8 + fileIndex  (match main.js -> toIdx)
    const r = 8 - Math.floor(i / 8);     // 8..1
    const f = i % 8;                     // 0..7
    return FILES[f] + r;                 // "a1".."h8"
  }

  // === Public: render dari array 64 (game.board()) =======================
  // boardArray[i] bisa null atau object { color:'w'|'b', piece:'P'|'N'|... }
  ChessUI.prototype.render = function (boardArray, opts = {}) {
    this._lastKind = 'array';
    this._lastBoard = boardArray;
    this._opts = opts || {};
    this._clearPiecesAndDots();

    // Render pieces
    for (let i = 0; i < 64; i++) {
      const cell = boardArray[i];
      if (!cell) continue;
      const sq = idxToAlg(i);                             // "e4"
      const target = this.board.querySelector(`[data-square="${this._map(sq)}"]`);
      if (!target) continue;
      const el = document.createElement('div');
      el.className = 'piece ' + (cell.color === 'w' ? 'white' : 'black');
      // tentukan char
      const key = (cell.color === 'w' ? cell.piece.toUpperCase() : cell.piece.toLowerCase());
      el.textContent = PIECE_CHAR[key] || '?';
      target.appendChild(el);
    }

    // Marks: selected
    if (opts.selected) {
      const c = this.board.querySelector(`[data-square="${this._map(opts.selected)}"]`);
      c && c.classList.add('sel');
    }

    // Marks: legal → DOT biru
    if (opts.legal && Array.isArray(opts.legal)) {
      for (const to of opts.legal) {
        const c = this.board.querySelector(`[data-square="${this._map(to)}"]`);
        if (c) {
          const dot = document.createElement('div');
          dot.className = 'dot enter';
          c.appendChild(dot);
          requestAnimationFrame(()=> dot.classList.remove('enter'));
        }
      }
    }

    // Marks: last move (match CSS kamu: from = .src, to = .last)
    if (opts.lastMove && opts.lastMove.from && opts.lastMove.to) {
      const s = this.board.querySelector(`[data-square="${this._map(opts.lastMove.from)}"]`);
      const d = this.board.querySelector(`[data-square="${this._map(opts.lastMove.to)}"]`);
      s && s.classList.add('src');
      d && d.classList.add('last');
    }

    // In-check (opsional): kasih ring di king yang diserang
    if (opts.inCheck) {
      const need = opts.inCheck === 'w' ? 'K' : 'k';
      // scan dari array untuk cari posisi king
      for (let i = 0; i < 64; i++) {
        const c = boardArray[i];
        if (!c) continue;
        const key = (c.color === 'w' ? c.piece.toUpperCase() : c.piece.toLowerCase());
        if (key === need) {
          const sq = idxToAlg(i);
          const cellEl = this.board.querySelector(`[data-square="${this._map(sq)}"]`);
          cellEl && cellEl.classList.add('check');
          break;
        }
      }
    }
  };

  // === Public: render dari FEN (opsional/bonus) ==========================
  ChessUI.prototype.renderFEN = function (fen, opts = {}) {
    this._lastKind = 'fen';
    this._lastFEN = fen;
    this._opts = opts || {};
    this._clearPiecesAndDots();

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

    if (opts.selected) {
      const c = this.board.querySelector(`[data-square="${this._map(opts.selected)}"]`);
      c && c.classList.add('sel');
    }
    if (opts.legal && Array.isArray(opts.legal)) {
      for (const to of opts.legal) {
        const c = this.board.querySelector(`[data-square="${this._map(to)}"]`);
        if (c) {
          const dot = document.createElement('div');
          dot.className = 'dot enter';
          c.appendChild(dot);
          requestAnimationFrame(()=> dot.classList.remove('enter'));
        }
      }
    }
    if (opts.lastMove) {
      const s = this.board.querySelector(`[data-square="${this._map(opts.lastMove.from)}"]`);
      const d = this.board.querySelector(`[data-square="${this._map(opts.lastMove.to)}"]`);
      s && s.classList.add('src');
      d && d.classList.add('last');
    }
    if (opts.inCheck) {
      const need = opts.inCheck === 'w' ? 'K' : 'k';
      // scan FEN untuk king
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
