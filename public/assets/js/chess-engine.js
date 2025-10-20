/* Azbry Chess Engine — aturan catur lengkap + AI */
(function () {
  const W = "w", B = "b";
  const START =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const a2i = (a) => [8 - parseInt(a[1]), a.charCodeAt(0) - 97];
  const i2a = (r, c) => String.fromCharCode(97 + c) + (8 - r);
  const inBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

  function parseFEN(fen) {
    const [bStr, t, cast, ep, half, full] = fen.split(" ");
    const rows = bStr.split("/");
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 8; r++) {
      let c = 0;
      for (const ch of rows[r]) {
        if (/\d/.test(ch)) c += +ch;
        else {
          const color = ch === ch.toLowerCase() ? B : W;
          b[r][c++] = { t: ch.toLowerCase(), c: color };
        }
      }
    }
    return { b, t, cast, ep: ep === "-" ? null : ep, h: +half, f: +full };
  }

  function toFEN(s) {
    let rows = [];
    for (let r = 0; r < 8; r++) {
      let run = 0, row = "";
      for (let c = 0; c < 8; c++) {
        const p = s.b[r][c];
        if (!p) run++;
        else {
          if (run) row += run, (run = 0);
          row += p.c === W ? p.t.toUpperCase() : p.t;
        }
      }
      if (run) row += run;
      rows.push(row);
    }
    return rows.join("/") + " " + s.t + " " + s.cast + " " + (s.ep || "-") + " " + s.h + " " + s.f;
  }

  function findKing(b, color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (b[r][c] && b[r][c].c === color && b[r][c].t === "k")
          return [r, c];
    return null;
  }

  function inCheck(s, color) {
    const enemy = color === W ? B : W;
    const king = findKing(s.b, color);
    if (!king) return true;
    const target = i2a(king[0], king[1]);
    const temp = clone(s);
    temp.t = enemy;
    return _genPseudo(temp).some((m) => m.to === target);
  }

  function _genPseudo(s) {
    const M = [];
    const { b, t } = s;
    const enemy = t === W ? B : W;
    const dir = t === W ? -1 : 1;
    const add = (from, to, opts = {}) => M.push({ from, to, ...opts });

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const P = b[r][c];
        if (!P || P.c !== t) continue;
        const from = i2a(r, c);

        if (P.t === "p") {
          const r1 = r + dir;
          if (inBoard(r1, c) && !b[r1][c]) add(from, i2a(r1, c));
          const start = P.c === W ? 6 : 1;
          const r2 = r + dir * 2;
          if (r === start && !b[r1][c] && !b[r2][c]) add(from, i2a(r2, c));
          for (const dc of [-1, 1]) {
            const cc = c + dc;
            if (!inBoard(r1, cc)) continue;
            const tgt = b[r1][cc];
            if (tgt && tgt.c === enemy) add(from, i2a(r1, cc), { cap: true });
          }
        }

        const slide = (dirs) => {
          for (const [dr, dc] of dirs) {
            let r2 = r + dr, c2 = c + dc;
            while (inBoard(r2, c2)) {
              const tgt = b[r2][c2];
              if (!tgt) add(from, i2a(r2, c2));
              else {
                if (tgt.c === enemy) add(from, i2a(r2, c2), { cap: true });
                break;
              }
              r2 += dr;
              c2 += dc;
            }
          }
        };

        if (P.t === "n") {
          const d = [
            [1, 2], [2, 1], [-1, 2], [-2, 1],
            [1, -2], [2, -1], [-1, -2], [-2, -1],
          ];
          for (const [dr, dc] of d) {
            const r2 = r + dr, c2 = c + dc;
            if (!inBoard(r2, c2)) continue;
            const tgt = b[r2][c2];
            if (!tgt || tgt.c === enemy)
              add(from, i2a(r2, c2), { cap: !!tgt });
          }
        }
        if (P.t === "b") slide([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
        if (P.t === "r") slide([[1, 0], [-1, 0], [0, 1], [0, -1]]);
        if (P.t === "q")
          slide([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]);
        if (P.t === "k") {
          for (const dr of [-1, 0, 1]) {
            for (const dc of [-1, 0, 1]) {
              if (!dr && !dc) continue;
              const r2 = r + dr, c2 = c + dc;
              if (!inBoard(r2, c2)) continue;
              const tgt = b[r2][c2];
              if (!tgt || tgt.c === enemy)
                add(from, i2a(r2, c2), { cap: !!tgt });
            }
          }
        }
      }
    }
    return M;
  }

  function genLegal(s) {
    return _genPseudo(s).filter((m) => !inCheck(makeMove(s, m), s.t));
  }

  function makeMove(s, m) {
    const ns = clone(s);
    const [fr, fc] = a2i(m.from);
    const [tr, tc] = a2i(m.to);
    const P = ns.b[fr][fc];
    ns.b[fr][fc] = null;
    ns.b[tr][tc] = { t: m.promo || P.t, c: P.c };
    ns.t = s.t === W ? B : W;
    return ns;
  }

  const val = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  const score = (b) => {
    let s = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (p) s += (p.c === W ? 1 : -1) * val[p.t];
      }
    return s;
  };

  function minimax(s, d, a, b) {
    const L = genLegal(s);
    if (!L.length) {
      if (inCheck(s, s.t)) return [s.t === W ? +Infinity : -Infinity, null];
      return [0, null];
    }
    if (d === 0) return [score(s.b), null];
    if (s.t === W) {
      let best = [-Infinity, null];
      for (const m of L) {
        const [sc] = minimax(makeMove(s, m), d - 1, a, b);
        if (sc > best[0]) best = [sc, m];
        a = Math.max(a, sc);
        if (b <= a) break;
      }
      return best;
    } else {
      let best = [Infinity, null];
      for (const m of L) {
        const [sc] = minimax(makeMove(s, m), d - 1, a, b);
        if (sc < best[0]) best = [sc, m];
        b = Math.min(b, sc);
        if (b <= a) break;
      }
      return best;
    }
  }

  window.AzChess = class {
    constructor(fen = START) {
      this.s = parseFEN(fen);
      this.undoStack = [];
      this.redoStack = [];
      this.hist = [];
    }

    legal() { return genLegal(this.s); }
    move(m) {
      const legal = this.legal().find((x) => x.from === m.from && x.to === m.to);
      if (!legal) return false;
      this.undoStack.push(this.s);
      this.s = makeMove(this.s, legal);
      this.redoStack = [];
      this.hist.push(legal);
      return true;
    }
    undo() {
      if (!this.undoStack.length) return false;
      this.redoStack.push(this.s);
      this.s = this.undoStack.pop();
      this.hist.pop();
      return true;
    }
    redo() {
      if (!this.redoStack.length) return false;
      this.undoStack.push(this.s);
      this.s = this.redoStack.pop();
      return true;
    }
    bestMove(d = 2) {
      const [, m] = minimax(this.s, d, -Infinity, +Infinity);
      return m;
    }
    turn() { return this.s.t; }
    fen() { return toFEN(this.s); }
    inCheck(color = this.s.t) { return inCheck(this.s, color); }
    isGameOver() {
      const L = genLegal(this.s);
      if (L.length) return null;
      return this.inCheck(this.s.t) ? "checkmate" : "stalemate";
    }
  };
})();
