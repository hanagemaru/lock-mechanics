import { Mechanism, type EvalResult, type Host, type Visibility, W } from '../core/mechanism';
import { C, type G, text, rr, vgrad, clamp, easeInOut } from '../core/draw';
import { sfx } from '../core/sfx';
import { drawChamberShell, drawChamberPlug, type PinStatus } from './pinview';
import { drawOpenStamp, drawGridBg, drawDivider, drawCover, drawGauge } from './housing';

export interface DimpleCfg {
  cols: number;
  /** [row (0 = A, 1 = B), col, depth] */
  pins: [number, number, number][];
}

const ROWS = [
  { top: 30, shear: 92, bot: 146, face: 126 },
  { top: 176, shear: 238, bot: 292, face: 272 },
];
const L = { step: 5, maxD: 4, keyTop: 392, rowY: [414, 452], keyH: 84 };

export class DimpleLock extends Mechanism {
  holes: number[][]; // [row][col]
  xs: number[];
  sp: number;
  keyLens: number[];
  status: PinStatus[] = [];
  flash: { r: number; c: number; t: number } | null = null;
  tipX: number;

  constructor(
    host: Host,
    vis: Visibility,
    public cfg: DimpleCfg,
  ) {
    super(host, vis);
    this.sp = Math.min(48, 300 / cfg.cols);
    this.xs = Array.from({ length: cfg.cols }, (_, j) => 78 + j * this.sp);
    this.holes = [0, 1].map(() => Array.from({ length: cfg.cols }, () => 0));
    this.keyLens = cfg.pins.map(([r, , d]) => ROWS[r].face + d * L.step - ROWS[r].shear);
    this.tipX = this.xs[cfg.cols - 1] + 30;
  }

  isPristine() {
    return this.holes.every((row) => row.every((d) => d === 0));
  }
  newBlank() {
    this.holes = [0, 1].map(() => Array.from({ length: this.cfg.cols }, () => 0));
    this.feedback = false;
    this.status = [];
  }

  keyOx() {
    const t = easeInOut(clamp(this.insert, 0, 1));
    return (t - 1) * (this.tipX - 20);
  }

  /** depth (px) of material under world x in given row, for key offset ox */
  surfDepth(row: number, x: number, ox: number) {
    const u = x - ox;
    if (u > this.tipX) return null;
    let d = 0;
    this.xs.forEach((cx, j) => {
      const h = this.holes[row][j];
      if (!h) return;
      const r = 5 + h * 2.5;
      const dx = Math.abs(u - cx);
      if (dx < r) d = Math.max(d, h * L.step * Math.sqrt(1 - (dx / r) ** 2));
    });
    const tip = this.tipX - 14;
    if (u > tip) d = Math.max(d, (u - tip) * 1.2);
    return d;
  }

  tip(k: number) {
    const [r, c] = this.cfg.pins[k];
    const R = ROWS[r];
    const rest = R.bot - 4;
    if (this.insert <= 0) return rest;
    const d = this.surfDepth(r, this.xs[c], this.keyOx());
    if (d === null) return rest;
    return Math.min(rest, R.face + d);
  }

  evaluate(): EvalResult {
    this.status = this.cfg.pins.map(([r, c, d]) => {
      const h = this.holes[r][c];
      return h === d ? 'ok' : h < d ? 'high' : 'low';
    });
    const bad = this.status.filter((s) => s !== 'ok').length;
    if (!bad) return { ok: true };
    return { ok: false, stopAt: 0.05, msg: `${bad}本のピンが揃っていない` };
  }

  protected onInsertStep(prev: number, cur: number) {
    if (Math.floor(prev * 10) !== Math.floor(cur * 10)) sfx.tick(0.6, 0.05);
  }

  holeAt(x: number, y: number) {
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < this.cfg.cols; c++) {
        if (Math.hypot(x - this.xs[c], y - L.rowY[r]) < Math.min(18, this.sp / 2)) return { r, c };
      }
    return null;
  }

  pointerDown(x: number, y: number) {
    if (!this.editable) return;
    const h = this.holeAt(x, y);
    if (!h) return;
    if (this.holes[h.r][h.c] >= L.maxD) {
      sfx.error();
      return;
    }
    this.holes[h.r][h.c]++;
    this.flash = { ...h, t: 1 };
    sfx.drill();
    this.status = [];
    this.host.changed();
  }

  update(dt: number) {
    super.update(dt);
    if (this.flash) this.flash.t = Math.max(0, this.flash.t - dt * 2);
  }

  draw(g: G) {
    drawGridBg(g, W, 660);
    const showHl = this.feedback && this.vis !== 'hidden';
    const ox = this.keyOx();
    const x0 = 36;
    const x1 = W - 36;
    const s = Math.max(0.03, Math.cos((this.turn * Math.PI) / 2));
    ROWS.forEach((R, r) => {
      g.fillStyle = C.shell;
      g.fillRect(x0, R.top - 6, x1 - x0, R.shear - R.top + 6);
      this.cfg.pins.forEach(([pr, pc], k) => {
        if (pr !== r) return;
        drawChamberShell(g, {
          x: this.xs[pc],
          top: R.top,
          shear: R.shear,
          tip: this.tip(k),
          keyLen: this.keyLens[k],
          driverLen: 18,
          width: 14,
          status: showHl ? this.status[k] : null,
          hl: showHl && this.status[k] !== 'ok',
        });
      });
      g.save();
      g.beginPath();
      g.rect(x0, R.shear, x1 - x0, R.bot - R.shear);
      g.clip();
      g.fillStyle = C.plug;
      g.fillRect(x0, R.shear, x1 - x0, R.bot - R.shear);
      const axis = (R.shear + R.bot) / 2;
      g.translate(0, axis);
      g.scale(1, s);
      g.translate(0, -axis);
      g.fillStyle = C.cavity;
      g.fillRect(x0, R.face - 4, x1 - x0 - 10, R.bot - R.face);
      this.cfg.pins.forEach(([pr, pc], k) => {
        if (pr !== r) return;
        drawChamberPlug(
          g,
          { x: this.xs[pc], top: R.top, shear: R.shear, tip: this.tip(k), keyLen: this.keyLens[k], driverLen: 18, width: 14, hl: showHl && this.status[k] === 'low' },
          R.bot + 6,
        );
      });
      if (this.insert > 0) {
        // key edge-on with dimples along this row
        g.fillStyle = vgrad(g, R.face, R.bot, [
          [0, C.keyNickelLight],
          [1, C.keyNickelDark],
        ]);
        g.beginPath();
        g.moveTo(x0 - 40 + ox, R.bot);
        g.lineTo(x0 - 40 + ox, R.face);
        for (let u = x0 - 40; u <= this.tipX; u += 1) {
          const d = this.surfDepth(r, u + ox, ox) ?? 0;
          g.lineTo(u + ox, R.face + Math.min(d, R.bot - R.face - 4));
        }
        g.lineTo(this.tipX + ox, R.bot);
        g.closePath();
        g.fill();
      }
      g.restore();
      const success = this.phase === 'turning' || this.phase === 'open';
      g.save();
      g.strokeStyle = success ? C.ok : C.shear;
      g.setLineDash(success ? [] : [6, 4]);
      g.lineWidth = success ? 2.5 : 1.5;
      g.beginPath();
      g.moveTo(x0 - 4, R.shear);
      g.lineTo(x1 + 4, R.shear);
      g.stroke();
      g.restore();
      text(g, r === 0 ? 'A列（上側のピン）' : 'B列（奥側のピン）', x0, R.top - 16, { size: 10, color: r === 0 ? C.brassLight : '#7dd3fc', align: 'left' });
      if (this.phase === 'edit' && this.vis === 'full') {
        drawGauge(g, x0 + 2, x1 - 4, Array.from({ length: L.maxD + 1 }, (_, k) => R.bot - 4 - (R.face + k * L.step - R.shear)));
      }
      if (this.vis === 'window') {
        drawCover(g, x0, R.top - 6, x1 - x0, R.shear - 12 - (R.top - 6));
        drawCover(g, x0, R.shear + 12, x1 - x0, R.face - 6 - (R.shear + 12));
      } else if (this.vis === 'hidden') drawCover(g, x0, R.top - 6, x1 - x0, R.bot - R.top + 6, '内部は見えない');
    });
    // column guides
    this.xs.forEach((x, j) => text(g, `${j + 1}`, x, ROWS[1].bot + 12, { size: 10, color: C.sub }));

    this.drawEditor(g);
    if (this.phase === 'open') drawOpenStamp(g, W / 2, 170, this.openT);
  }

  drawEditor(g: G) {
    const ed = this.phase === 'edit';
    drawDivider(g, 336, W, ed ? '鍵の面（くぼみの位置をタップで掘る）' : '');
    g.save();
    g.globalAlpha = ed ? 1 : 0.3;
    const left = 30;
    const right = this.tipX + 10;
    // bow
    g.fillStyle = vgrad(g, L.keyTop - 20, L.keyTop + L.keyH + 20, [
      [0, C.keyNickelLight],
      [1, C.keyNickelDark],
    ]);
    rr(g, -40, L.keyTop - 18, left + 50, L.keyH + 36, 18);
    g.fill();
    // blade (top view)
    g.fillStyle = vgrad(g, L.keyTop, L.keyTop + L.keyH, [
      [0, C.keyNickelLight],
      [0.5, C.keyNickel],
      [1, C.keyNickelDark],
    ]);
    g.beginPath();
    g.moveTo(left, L.keyTop);
    g.lineTo(right - 16, L.keyTop);
    g.lineTo(right, L.keyTop + 16);
    g.lineTo(right, L.keyTop + L.keyH - 16);
    g.lineTo(right - 16, L.keyTop + L.keyH);
    g.lineTo(left, L.keyTop + L.keyH);
    g.closePath();
    g.fill();
    g.strokeStyle = C.keyNickelDark;
    g.stroke();
    for (let r = 0; r < 2; r++) {
      text(g, r === 0 ? 'A' : 'B', left + 12, L.rowY[r], { size: 11, color: r === 0 ? C.brassDark : '#1e5a8a', weight: '800' });
      for (let c = 0; c < this.cfg.cols; c++) {
        const x = this.xs[c];
        const y = L.rowY[r];
        const h = this.holes[r][c];
        if (h === 0) {
          g.strokeStyle = 'rgba(60,70,85,0.35)';
          g.setLineDash([2, 2]);
          g.beginPath();
          g.arc(x, y, 6, 0, Math.PI * 2);
          g.stroke();
          g.setLineDash([]);
        } else {
          const rad = 5 + h * 2.5;
          const gr = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 1, x, y, rad);
          gr.addColorStop(0, '#2a323d');
          gr.addColorStop(0.7, '#5d6874');
          gr.addColorStop(1, '#dfe5ec');
          g.fillStyle = gr;
          g.beginPath();
          g.arc(x, y, rad, 0, Math.PI * 2);
          g.fill();
          text(g, String(h), x, y + 0.5, { size: 10, color: '#fff', weight: '800' });
        }
        if (this.flash && this.flash.r === r && this.flash.c === c && this.flash.t > 0) {
          g.save();
          g.globalAlpha = this.flash.t;
          g.strokeStyle = '#ffe9a8';
          g.lineWidth = 2;
          g.beginPath();
          g.arc(x, y, 8 + (1 - this.flash.t) * 12, 0, Math.PI * 2);
          g.stroke();
          g.restore();
        }
      }
    }
    // feedback marks
    if (ed && this.status.length) {
      this.cfg.pins.forEach(([r, c], k) => {
        const st = this.status[k];
        const col = st === 'ok' ? C.ok : st === 'high' ? C.warn : C.bad;
        text(g, st === 'ok' ? '✓' : st === 'high' ? '▼' : '✕', this.xs[c] + 12, L.rowY[r] - 12, { size: 11, color: col, weight: '800' });
      });
    }
    g.restore();
    this.xs.forEach((x, j) => text(g, `${j + 1}`, x, L.keyTop + L.keyH + 16, { size: 10, color: C.sub }));
    if (ed) text(g, '数字＝くぼみの深さ（タップするたび1段深く）', W / 2, L.keyTop + L.keyH + 40, { size: 10, color: C.sub });
  }
}
