// assets/js/chess-ui.js — ChessUI FINAL (delegation + fallback + pointer-safe)
// CUKUP ganti file ini saja. Tidak perlu utak-atik CSS lagi.

;(function (global) {
  'use strict';

  const FILES = ['a','b','c','d','e','f','g','h'];
  const PIECE_CHAR = {
    k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟',
    K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙'
  };

  function idxToAlg(i){
    const r = 8 - Math.floor(i / 8);
    const f = i % 8;
    return FILES[f] + r;
  }

  function ChessUI(boardEl, onSquareClick) {
    if (!boardEl) throw new Error('ChessUI: boardEl is required');
    this.board = boardEl;
    this.onSquareClick = typeof onSquareClick === 'function' ? onSquareClick : function(){};
    this.flipped = false;
    this.squares = [];
    this._lastKind  = null;
    this._lastBoard = null;
    this._lastFEN   = null;
    this._opts      = {};
    this._buildGrid();
    this._bindDelegatedClicks(); // <<— satu handler untuk semua klik (aman di HP)
  }

  // ================= Grid =================
  ChessUI.prototype._buildGrid = function () {
    const b = this.board;
    b.innerHTML = '';
    b.classList.add('board');
    this.squares.length = 0;

    for (let r = 8; r >= 1; r--) {
      for (let f = 0; f < 8; f++) {
        const sqAlg = FILES[f] + r;
        const d = document.createElement('div');
        d.className = 'sq ' + ((r + f) % 2 === 0 ? 'light' : 'dark');
        d.dataset.square = sqAlg;
        d.dataset.file   = FILES[f];
        d.dataset.rank   = r;
        // NOTE: tidak pasang listener di sini lagi (biar tidak bentrok di mobile)
        this.squares.push(d);
        b.appendChild(d);
      }
    }
  };

  // ================= Delegation + Fallback =================
  ChessUI.prototype._bindDelegatedClicks = function(){
    const handler = (ev) => {
      // 1) cari .sq terdekat dari target klik/tap
      const target = ev.target;
      let cell = target && target.closest ? target.closest('.sq') : null;

      if (!cell || !this.board.contains(cell)) {
        // 2) fallback: hitung kotak dari posisi tap
        const rect = this.board.getBoundingClientRect();
        const touch = ev.touches && ev.touches[0];
        const cx = touch ? touch.clientX : ev.clientX;
        const cy = touch ? touch.clientY : ev.clientY;
        if (typeof cx !== 'number' || typeof cy !== 'number') return;

        const x = Math.min(Math.max(cx - rect.left, 0), rect.width  - 0.01);
        const y = Math.min(Math.max(cy - rect.top,  0), rect.height - 0.01);
        const col = Math.floor((x / rect.width)  * 8); // 0..7
        const row = Math.floor((y / rect.height) * 8); // 0..7 dari atas
        const file = FILES[col];
        const rank = 8 - row;
        const sqAlg = file + rank;
        this.onSquareClick(this._map(sqAlg));
        return;
      }

      const sqAlg = cell.dataset.square;
      if (!sqAlg) return;
      this.onSquareClick(this._map(sqAlg));
    };

    // bersihin bind lama biar nggak dobel
    if (this._delegatedHandler) {
      this.board.removeEventListener('click', this._delegatedHandler);
      this.board.removeEventListener('touchstart', this._delegatedHandler);
    }
    this.board.addEventListener('click', handler, { passive: true });
    this.board.addEventListener('touchstart', handler, { passive: true });
    this._delegatedHandler = handler;
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
    if (this._lastKind === 'array' && this._lastBoard) {
      this.render(this._lastBoard, this._opts);
    } else if (this._lastKind === 'fen' && this._lastFEN) {
      this.renderFEN(this._lastFEN, this._opts);
    }
  };

  // =============== Utilities ===============
  ChessUI.prototype._clearPiecesAndMarks = function () {
    this.board.querySelectorAll('.piece, .dot').forEach(n => n.remove());
    this.squares.forEach(n => n.classList.remove('sel','src','last','check','in-check'));
  };

  function putPiece(target, char, isWhite){
    if (!target) return;
    // bersih2 dulu: cegah bidak dobel
    target.querySelectorAll('.piece').forEach(n => n.remove());
    const el = document.createElement('div');
    el.className = 'piece ' + (isWhite ? 'white' : 'black');
    el.textContent = char;
    // jangan blokir klik
    el.style.pointerEvents = 'none';
    el.style.zIndex = '2';
    target.appendChild(el);
  }

  function putDot(target){
    if (!target) return;
    const dot = document.createElement('div');
    dot.className = 'dot enter';
    dot.style.pointerEvents = 'none';
    target.appendChild(dot);
    requestAnimationFrame(()=> dot.classList.remove('enter'));
  }

  // =============== Render: dari array 64 ===============
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
      const key = (cell.color === 'w' ? cell.piece.toUpperCase() : cell.piece.toLowerCase());
      putPiece(target, PIECE_CHAR[key] || '?', cell.color === 'w');
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
        putDot(c);
      }
    }

    // Last move
    if (opts.lastMove && opts.lastMove.from && opts.lastMove.to) {
      const s = this.board.querySelector(`[data-square="${this._map(opts.lastMove.from)}"]`);
      const d = this.board.querySelector(`[data-square="${this._map(opts.lastMove.to)}"]`);
      if (s) s.classList.add('src');
      if (d) d.classList.add('last');
    }

    // In-check
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

    const pos  = (fen || '').split(' ')[0] || '';
    const rows = pos.split('/');
    for (let r = 0; r < 8; r++) {
      let file = 0;
      const row = rows[r] || '';
      for (const ch of row) {
        if (/\d/.test(ch)) { file += parseInt(ch, 10); continue; }
        const sq = FILES[file] + (8 - r);
        const target = this.board.querySelector(`[data-square="${this._map(sq)}"]`);
        putPiece(target, PIECE_CHAR[ch] || '?', ch === ch.toUpperCase());
        file++;
      }
    }

    if (opts.selected) {
      const c = this.board.querySelector(`[data-square="${this._map(opts.selected)}"]`);
      if (c) c.classList.add('sel');
    }

    if (Array.isArray(opts.legal)) {
      for (const to of opts.legal) {
        const c = this.board.querySelector(`[data-square="${this._map(to)}"]`);
        if (!c) continue;
        putDot(c);
      }
    }

    if (opts.lastMove && opts.lastMove.from && opts.lastMove.to) {
      const s = this.board.querySelector(`[data-square="${this._map(opts.lastMove.from)}"]`);
      const d = this.board.querySelector(`[data-square="${this._map(opts.lastMove.to)}"]`);
      if (s) s.classList.add('src');
      if (d) d.classList.add('last');
    }

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

  global.ChessUI = ChessUI;
})(window);
