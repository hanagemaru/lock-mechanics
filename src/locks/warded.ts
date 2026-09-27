import { Mechanism, type EvalResult, type Host, type Visibility, W } from '../core/mechanism';
import { C, type G, text, rr, seg, clamp, vgrad } from '../core/draw';
import { sfx } from '../core/sfx';
import { drawOpenStamp, drawGridBg, drawDivider, drawCover } from './housing';

/** [col, row, fromDeg, toDeg, group?] — angles measured clockwise from "bit pointing down" */
export type Ward = [number, number, number, number, number?];

export interface WardedCfg {
  cols: number;
  rows: number;
  wards: Ward[];
  /** columns whose outermost cell must reach the bolt */
  bolt: number[];
  /** how far the key turns (deg) */
  sweep?: number;
}

const L = {
  caseTop: 14,
  caseBot: 104,
  panelY: 196,
  pr: 44,
  rb: 6,
  cell: 8,
  shaftY: 382,
  bitTop: 396,
  cellH: 30,
};

const GROUP_COLORS = ['#b7791f', '#9f7aea', '#38b2ac'];

export class WardedLock extends Mechanism {
  cells: boolean[][]; // [col][row]
  sp: number;
  xs: number[];
  hit: [number, number] | null = null;
  falling: { c: number; r: number; t: number }[] = [];
  missingBolt: number[] = [];
  sweep: number;
  lastTheta = 0;
  pr: number;
  cell: number;

  constructor(
    host: Host,
    vis: Visibility,
    public cfg: WardedCfg,
  ) {
    super(host, vis);
    this.sp = Math.min(76, 340 / cfg.cols);
    const x0 = W / 2 - (this.sp * (cfg.cols - 1)) / 2;
    this.xs = Array.from({ length: cfg.cols }, (_, i) => x0 + i * this.sp);
    this.pr = Math.min(L.pr, this.sp / 2 - 1);
    this.cell = Math.min(10, (this.pr - L.rb - 2) / cfg.rows);
    this.cells = this.blank();
    this.sweep = cfg.sweep ?? 180;
    this.turnDur = 1.6;
  }

  blank() {
    return Array.from({ length: this.cfg.cols }, () => Array.from({ length: this.cfg.rows }, () => true));
  }
  isPristine() {
    return this.cells.every((c) => c.every(Boolean));
  }
  newBlank() {
    this.cells = this.blank();
    this.hit = null;
    this.feedback = false;
  }

  /** first angle (deg) at which a present cell meets a ward, or null */
  collision(): { ang: number; c: number; r: number } | null {
    let best: { ang: number; c: number; r: number } | null = null;
    for (const [c, r, a0, a1] of this.cfg.wards) {
      if (!this.cells[c]?.[r]) continue;
      if (a1 < 0 || a0 > this.sweep) continue;
      const ang = Math.max(0, a0);
      if (!best || ang < best.ang) best = { ang, c, r };
    }
    return best;
  }

  evaluate(): EvalResult {
    const col = this.collision();
    this.hit = col ? [col.c, col.r] : null;
    if (col) {
      return {
        ok: false,
        stopAt: Math.max(0.03, (col.ang - 8) / this.sweep),
        msg: `${col.c + 1}列目の刃が障害物（ワード）に当たって止まった`,
      };
    }
    this.missingBolt = this.cfg.bolt.filter((c) => !this.cells[c][this.cfg.rows - 1]);
    if (this.missingBolt.length) {
      return { ok: false, stopAt: 1, msg: '最後まで回るけれど、ボルトに刃先が届かない' };
    }
    return { ok: true };
  }

  protected onTurnStep(prev: number, cur: number) {
    const th = cur * this.sweep;
    if (Math.floor(th / 30) !== Math.floor(prev * this.sweep / 30)) sfx.tick(0.4, 0.05);
  }

  // ------------------------------------------------------------------ editing
  cellRect(c: number, r: number) {
    const w = this.sp - 4;
    return { x: this.xs[c] - w / 2, y: L.bitTop + r * L.cellH, w, h: L.cellH - 2 };
  }

  pointerDown(x: number, y: number) {
    if (!this.editable) return;
    for (let c = 0; c < this.cfg.cols; c++)
      for (let r = 0; r < this.cfg.rows; r++) {
        const b = this.cellRect(c, r);
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h + 2) {
          if (!this.cells[c][r]) {
            sfx.error();
            return;
          }
          this.cells[c][r] = false;
          sfx.grind(0.12);
          this.dropDisconnected();
          this.hit = null;
          this.host.changed();
          return;
        }
      }
  }

  /** cells no longer connected to the shaft (row 0) fall off */
  dropDisconnected() {
    const { cols, rows } = this.cfg;
    const seen = this.cells.map((col) => col.map(() => false));
    const q: [number, number][] = [];
    for (let c = 0; c < cols; c++)
      if (this.cells[c][0]) {
        seen[c][0] = true;
        q.push([c, 0]);
      }
    while (q.length) {
      const [c, r] = q.pop()!;
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        if (!this.cells[nc][nr] || seen[nc][nr]) continue;
        seen[nc][nr] = true;
        q.push([nc, nr]);
      }
    }
    let dropped = 0;
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++)
        if (this.cells[c][r] && !seen[c][r]) {
          this.cells[c][r] = false;
          this.falling.push({ c, r, t: 0 });
          dropped++;
        }
    if (dropped) {
      this.host.say(`つながりを失った部分（${dropped}マス）が欠け落ちた！`, 'warn');
      sfx.clack();
    }
  }

  update(dt: number) {
    super.update(dt);
    this.falling.forEach((f) => (f.t += dt));
    this.falling = this.falling.filter((f) => f.t < 1);
  }

  // ------------------------------------------------------------------ drawing
  theta() {
    return this.turn * this.sweep;
  }

  draw(g: G) {
    drawGridBg(g, W, 660);
    this.drawCase(g);
    this.drawPanels(g);
    this.drawEditor(g);
    if (this.phase === 'open') drawOpenStamp(g, W / 2, 196, this.openT);
  }

  drawCase(g: G) {
    const x0 = 24;
    const x1 = W - 24;
    g.fillStyle = vgrad(g, L.caseTop, L.caseBot, [
      [0, '#5a4630'],
      [1, '#3b2d1d'],
    ]);
    rr(g, x0, L.caseTop, x1 - x0, L.caseBot - L.caseTop, 10);
    g.fill();
    g.strokeStyle = '#7a6040';
    g.stroke();
    // bolt
    const th = this.theta();
    const ok = this.phase === 'turning' || this.phase === 'open';
    const travel = ok ? seg(th, this.sweep * 0.7, this.sweep) * 70 : 0;
    const by = (L.caseTop + L.caseBot) / 2;
    g.fillStyle = vgrad(g, by - 14, by + 14, [
      [0, C.steelLight],
      [1, C.steelDark],
    ]);
    rr(g, x1 - 150 - travel, by - 13, 190, 26, 4);
    g.fill();
    // talon notch
    g.fillStyle = '#3b2d1d';
    g.fillRect(x1 - 120 - travel, by + 7, 18, 7);
    // strike plate
    g.fillStyle = '#2a2016';
    g.fillRect(x1 + 2, by - 18, 18, 36);
    text(g, 'ボルト', x1 - 70 - travel, by, { size: 11, color: '#1d2530', weight: '800' });
    text(g, 'ウォード錠（箱錠）', x0 + 12, L.caseTop + 14, { size: 10, color: '#d6bb90', align: 'left' });
  }

  drawPanels(g: G) {
    const th = this.theta();
    const inserted = this.insert;
    const showHl = this.feedback && this.vis !== 'hidden';
    const { rows } = this.cfg;
    this.xs.forEach((cx, c) => {
      const cy = L.panelY;
      const R = this.pr;
      g.save();
      g.fillStyle = '#1a222c';
      g.beginPath();
      g.arc(cx, cy, R + 4, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#2f3b48';
      g.lineWidth = 1;
      g.stroke();
      // row rings
      g.strokeStyle = 'rgba(142,160,181,0.12)';
      for (let r = 0; r <= rows; r++) {
        g.beginPath();
        g.arc(cx, cy, L.rb + r * this.cell, 0, Math.PI * 2);
        g.stroke();
      }
      // sweep hint
      g.strokeStyle = 'rgba(255,204,51,0.14)';
      g.setLineDash([2, 3]);
      g.beginPath();
      g.arc(cx, cy, L.rb + rows * this.cell + 3, Math.PI / 2, Math.PI / 2 + (this.sweep * Math.PI) / 180);
      g.stroke();
      g.setLineDash([]);
      // wards
      for (const [wc, wr, a0, a1, grp] of this.cfg.wards) {
        if (wc !== c) continue;
        const r0 = L.rb + wr * this.cell;
        const inPath = !(a1 < 0 || a0 > this.sweep);
        g.strokeStyle = GROUP_COLORS[grp ?? 0];
        g.globalAlpha = inPath ? 1 : 0.45;
        g.lineWidth = this.cell - 1;
        g.beginPath();
        g.arc(cx, cy, r0 + this.cell / 2, Math.PI / 2 + (a0 * Math.PI) / 180, Math.PI / 2 + (a1 * Math.PI) / 180);
        g.stroke();
        g.globalAlpha = 1;
      }
      // bolt talon marker
      if (this.cfg.bolt.includes(c)) {
        const rr0 = L.rb + (rows - 1) * this.cell;
        g.fillStyle = 'rgba(184,195,207,0.25)';
        g.strokeStyle = C.steel;
        g.lineWidth = 1;
        g.beginPath();
        g.rect(cx - 5, cy - rr0 - this.cell - 6, 10, 8);
        g.fill();
        g.stroke();
      }
      // barrel (key shaft section)
      const colVisible = this.phase === 'edit' ? 0.28 : clamp((inserted - 0.34 - c * 0.08) / 0.12, 0, 1);
      g.fillStyle = '#0c1117';
      g.beginPath();
      g.arc(cx, cy, L.rb, 0, Math.PI * 2);
      g.fill();
      if (colVisible > 0) {
        g.save();
        g.globalAlpha = colVisible;
        g.translate(cx, cy);
        g.rotate((th * Math.PI) / 180);
        g.fillStyle = C.keyNickel;
        g.beginPath();
        g.arc(0, 0, L.rb - 1, 0, Math.PI * 2);
        g.fill();
        for (let r = 0; r < rows; r++) {
          if (!this.cells[c][r]) continue;
          const isHit = showHl && this.hit && this.hit[0] === c && this.hit[1] === r;
          g.fillStyle = isHit ? C.bad : r === rows - 1 && this.cfg.bolt.includes(c) ? C.keyNickelLight : C.keyNickel;
          g.fillRect(-4.5, L.rb + r * this.cell - 0.5, 9, this.cell + 0.5);
        }
        g.restore();
      }
      g.restore();
      text(g, `${c + 1}`, cx, cy + R + 14, { size: 11, color: C.sub });
    });
    text(g, '正面から見た各列の断面（鍵の刃は下向きから時計回りに回る）', W / 2, L.panelY - this.pr - 22, { size: 10, color: C.sub });
    if (this.vis === 'hidden') drawCover(g, 10, L.panelY - this.pr - 10, W - 20, this.pr * 2 + 20, '内部は見えない');
    if (showHl && this.missingBolt.length && !this.hit) {
      this.missingBolt.forEach((c) => {
        g.strokeStyle = C.bad;
        g.lineWidth = 2;
        g.strokeRect(this.xs[c] - 8, L.panelY - L.rb - this.cfg.rows * this.cell - 10, 16, 14);
      });
    }
  }

  drawEditor(g: G) {
    const ed = this.phase === 'edit';
    drawDivider(g, 300, W, ed ? '鍵の加工台（マスをタップで削る）' : '');
    const { rows, cols } = this.cfg;
    const alpha = ed ? 1 : 0.25;
    g.save();
    g.globalAlpha = alpha;
    // shaft & bow
    const left = this.xs[0] - this.sp / 2 - 30;
    const right = this.xs[cols - 1] + this.sp / 2 + 12;
    g.fillStyle = vgrad(g, L.shaftY - 10, L.shaftY + 10, [
      [0, C.keyNickelLight],
      [1, C.keyNickelDark],
    ]);
    rr(g, left, L.shaftY - 9, right - left, 18, 9);
    g.fill();
    g.beginPath();
    g.arc(left - 6, L.shaftY, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = C.bg;
    g.beginPath();
    g.arc(left - 10, L.shaftY, 9, 0, Math.PI * 2);
    g.fill();
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        const b = this.cellRect(c, r);
        const isHit = this.feedback && this.hit && this.hit[0] === c && this.hit[1] === r;
        if (this.cells[c][r]) {
          g.fillStyle = isHit ? C.bad : vgrad(g, b.y, b.y + b.h, [
            [0, C.keyNickelLight],
            [1, C.keyNickel],
          ]);
          g.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
        } else {
          g.strokeStyle = 'rgba(142,160,181,0.3)';
          g.setLineDash([3, 3]);
          g.strokeRect(b.x, b.y, b.w, b.h);
          g.setLineDash([]);
        }
      }
    // grid lines on the bit
    g.strokeStyle = 'rgba(80,90,105,0.35)';
    g.lineWidth = 1;
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        if (!this.cells[c][r]) continue;
        const b = this.cellRect(c, r);
        g.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
      }
    // bolt contact markers
    this.cfg.bolt.forEach((c) => {
      const b = this.cellRect(c, rows - 1);
      text(g, 'ボルト', b.x + b.w / 2, b.y + b.h + 14, { size: 10, color: C.brassLight, weight: '700' });
      g.strokeStyle = C.brassLight;
      g.setLineDash([2, 2]);
      g.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      g.setLineDash([]);
    });
    for (let c = 0; c < cols; c++) text(g, `${c + 1}`, this.xs[c], L.shaftY - 20, { size: 10, color: C.sub });
    // falling bits
    this.falling.forEach((f) => {
      const b = this.cellRect(f.c, f.r);
      g.save();
      g.globalAlpha = (1 - f.t) * alpha;
      g.translate(b.x + b.w / 2, b.y + b.h / 2 + f.t * f.t * 160);
      g.rotate(f.t * 2);
      g.fillStyle = C.keyNickel;
      g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      g.restore();
    });
    g.restore();
    text(g, '行1＝軸に近い側', 16, L.bitTop + 8, { size: 9, color: C.sub, align: 'left' });
  }
}
