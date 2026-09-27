import { C, type G, text, arrow, clamp } from '../core/draw';
import { sfx } from '../core/sfx';

/**
 * A flat key blade whose top (and optionally bottom) edge is cut with V-shaped
 * notches at fixed positions. Material can only be removed: deeper cuts are
 * possible, going back needs a fresh blank.
 */
export interface EdgeSpec {
  /** x of each cut position (key-local == world when fully inserted) */
  xs: number[];
  /** index into cuts per x */
}

export type Mark = 'ok' | 'high' | 'low' | 'imp' | null;

export class BladeKey {
  top: number[];
  bottom: number[] | null;
  /** preview depth while dragging (top edge) */
  drag: { edge: 'top' | 'bottom'; i: number; y0: number; base: number; val: number; moved: boolean } | null = null;
  marksTop: Mark[];
  marksBottom: Mark[];
  grinds = 0;
  lastCutFlash: { edge: 'top' | 'bottom'; i: number; t: number } | null = null;

  constructor(
    public xsTop: number[],
    public xsBottom: number[] | null,
    public maxDepth: number,
    public step: number,
    public bladeX0: number,
    public tipX: number,
    public bladeH: number,
  ) {
    this.top = xsTop.map(() => 0);
    this.bottom = xsBottom ? xsBottom.map(() => 0) : null;
    this.marksTop = xsTop.map(() => null);
    this.marksBottom = xsBottom ? xsBottom.map(() => null) : [];
  }

  reset() {
    this.top = this.xsTop.map(() => 0);
    this.bottom = this.xsBottom ? this.xsBottom.map(() => 0) : null;
    this.clearMarks();
  }

  clearMarks() {
    this.marksTop = this.xsTop.map(() => null);
    this.marksBottom = this.xsBottom ? this.xsBottom.map(() => null) : [];
  }

  pristine() {
    return this.top.every((d) => d === 0) && (!this.bottom || this.bottom.every((d) => d === 0));
  }

  /** material removed (px, downward from edge) at key-local u for the given edge */
  depthAt(u: number, edge: 'top' | 'bottom', usePreview = true): number {
    const xs = edge === 'top' ? this.xsTop : this.xsBottom!;
    const cuts = edge === 'top' ? this.top : this.bottom!;
    let d = 0;
    const flat = 3;
    const slope = 1.1;
    for (let i = 0; i < xs.length; i++) {
      let c = cuts[i];
      if (usePreview && this.drag && this.drag.edge === edge && this.drag.i === i) c = this.drag.val;
      const v = c * this.step - Math.max(0, Math.abs(u - xs[i]) - flat) * slope;
      if (v > d) d = v;
    }
    // tip chamfer
    const tipStart = this.tipX - 16;
    if (u > tipStart) d = Math.max(d, (u - tipStart) * 1.35);
    return d;
  }

  /** path of the key outline at offset (ox, oy) where oy is the blade-top y */
  path(g: G, ox: number, topY: number, usePreview = true) {
    const h = this.bladeH;
    g.beginPath();
    g.moveTo(this.bladeX0 + ox, topY);
    for (let u = this.bladeX0; u <= this.tipX; u += 1) {
      g.lineTo(u + ox, topY + Math.min(h * 0.8, this.depthAt(u, 'top', usePreview)));
    }
    const tipMid = topY + h * 0.55;
    g.lineTo(this.tipX + ox, tipMid);
    if (this.bottom) {
      for (let u = this.tipX; u >= this.bladeX0; u -= 1) {
        const tipD = u > this.tipX - 16 ? (u - (this.tipX - 16)) * 1.35 : 0;
        g.lineTo(u + ox, topY + h - Math.max(tipD, Math.min(h * 0.45, this.depthAt(u, 'bottom', usePreview))));
      }
    } else {
      g.lineTo(this.tipX - 20 + ox, topY + h);
      g.lineTo(this.bladeX0 + ox, topY + h);
    }
    g.closePath();
  }

  drawKey(g: G, ox: number, topY: number, opts: { editing: boolean; showCode: boolean; alpha?: number } = { editing: false, showCode: false }) {
    const h = this.bladeH;
    g.save();
    if (opts.alpha !== undefined) g.globalAlpha = opts.alpha;
    // bow
    const bx = this.bladeX0 + ox;
    const by = topY + h / 2;
    g.fillStyle = this.metal(g, topY - 30, topY + h + 30);
    g.beginPath();
    g.moveTo(bx + 2, topY - 6);
    g.lineTo(bx - 14, topY - 6);
    g.arc(bx - 52, by, 44, -0.35, Math.PI * 2 - 0.35 + 0.0001, false);
    g.lineTo(bx - 14, topY + h + 6);
    g.lineTo(bx + 2, topY + h + 6);
    g.closePath();
    g.fill();
    g.strokeStyle = C.keyNickelDark;
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = C.bg;
    g.beginPath();
    g.arc(bx - 66, by, 11, 0, Math.PI * 2);
    g.fill();

    // blade
    this.path(g, ox, topY);
    g.fillStyle = this.metal(g, topY, topY + h);
    g.fill();
    g.strokeStyle = C.keyNickelDark;
    g.lineWidth = 1;
    g.stroke();
    // groove (keyway milling)
    g.save();
    this.path(g, ox, topY);
    g.clip();
    g.fillStyle = 'rgba(80,90,105,0.35)';
    g.fillRect(bx, topY + h * 0.58, this.tipX - this.bladeX0, 5);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(bx, topY + h * 0.58 + 5, this.tipX - this.bladeX0, 1.5);
    g.restore();

    // ghost of original blank edge while editing
    if (opts.editing) {
      g.save();
      g.setLineDash([3, 3]);
      g.strokeStyle = 'rgba(200,210,225,0.35)';
      g.beginPath();
      g.moveTo(this.bladeX0 + ox, topY);
      g.lineTo(this.tipX - 16 + ox, topY);
      if (this.bottom) {
        g.moveTo(this.bladeX0 + ox, topY + h);
        g.lineTo(this.tipX - 16 + ox, topY + h);
      }
      g.stroke();
      g.restore();
    }

    // marks & flash
    const drawMarks = (edge: 'top' | 'bottom') => {
      const xs = edge === 'top' ? this.xsTop : this.xsBottom!;
      const cuts = edge === 'top' ? this.top : this.bottom!;
      const marks = edge === 'top' ? this.marksTop : this.marksBottom;
      xs.forEach((x, i) => {
        const d = cuts[i] * this.step;
        const ey = edge === 'top' ? topY + d : topY + h - d;
        const m = marks[i];
        if (m === 'imp') {
          g.save();
          g.strokeStyle = 'rgba(20,20,25,0.85)';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x + ox - 4, ey + (edge === 'top' ? 1.5 : -1.5));
          g.lineTo(x + ox + 4, ey + (edge === 'top' ? 1.5 : -1.5));
          g.stroke();
          g.restore();
        } else if (m && opts.editing) {
          const col = m === 'ok' ? C.ok : m === 'high' ? C.warn : C.bad;
          const my = edge === 'top' ? topY - 26 : topY + h + 26;
          g.save();
          g.fillStyle = col;
          g.globalAlpha *= 0.9;
          if (m === 'ok') text(g, '✓', x + ox, my, { size: 14, color: col, weight: '800' });
          else if (m === 'high') arrow(g, x + ox, my, edge === 'top' ? 1 : -1, col, 6);
          else text(g, '✕', x + ox, my, { size: 14, color: col, weight: '800' });
          g.restore();
        }
      });
    };
    drawMarks('top');
    if (this.bottom) drawMarks('bottom');

    if (this.lastCutFlash && this.lastCutFlash.t > 0) {
      const f = this.lastCutFlash;
      const xs = f.edge === 'top' ? this.xsTop : this.xsBottom!;
      const cuts = f.edge === 'top' ? this.top : this.bottom!;
      const x = xs[f.i] + ox;
      const ey = f.edge === 'top' ? topY + cuts[f.i] * this.step : topY + h - cuts[f.i] * this.step;
      g.save();
      g.globalAlpha = f.t;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI - (f.edge === 'top' ? Math.PI : 0);
        const r = 6 + (1 - f.t) * 18;
        g.fillStyle = k % 2 ? '#ffd27a' : '#fff4d0';
        g.fillRect(x + Math.cos(a) * r, ey + Math.sin(a) * r, 2, 2);
      }
      g.restore();
    }

    if (opts.showCode) {
      this.xsTop.forEach((x, i) => {
        const v = this.drag && this.drag.edge === 'top' && this.drag.i === i ? this.drag.val : this.top[i];
        text(g, String(v), x + ox, topY + h + (this.bottom ? 44 : 16), { size: 12, color: C.sub, weight: '700' });
      });
      if (this.bottom && this.xsBottom) {
        this.xsBottom.forEach((x, i) => {
          const v = this.drag && this.drag.edge === 'bottom' && this.drag.i === i ? this.drag.val : this.bottom![i];
          text(g, String(v), x + ox, topY + h + 44, { size: 12, color: '#7dd3fc', weight: '700' });
        });
      }
    }

    // drag bubble
    if (this.drag && opts.editing) {
      const d = this.drag;
      const xs = d.edge === 'top' ? this.xsTop : this.xsBottom!;
      const x = xs[d.i] + ox;
      const ey = d.edge === 'top' ? topY + d.val * this.step : topY + h - d.val * this.step;
      g.save();
      g.strokeStyle = C.shear;
      g.setLineDash([2, 2]);
      g.beginPath();
      g.moveTo(x - 16, ey);
      g.lineTo(x + 16, ey);
      g.stroke();
      g.restore();
      const by2 = d.edge === 'top' ? topY - 34 : topY + h + 34;
      g.fillStyle = 'rgba(15,23,32,0.9)';
      g.strokeStyle = C.shear;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, by2, 13, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      text(g, String(d.val), x, by2 + 0.5, { size: 14, color: C.shear, weight: '800' });
    }
    g.restore();
  }

  metal(g: G, y0: number, y1: number) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, C.keyNickelLight);
    gr.addColorStop(0.45, C.keyNickel);
    gr.addColorStop(1, C.keyNickelDark);
    return gr;
  }

  update(dt: number) {
    if (this.lastCutFlash) this.lastCutFlash.t = Math.max(0, this.lastCutFlash.t - dt * 2.5);
  }

  /** editor hit test; returns true if a drag started */
  down(x: number, y: number, ox: number, topY: number, spacing: number): boolean {
    const h = this.bladeH;
    const tryEdge = (edge: 'top' | 'bottom', xs: number[], cuts: number[]) => {
      const ey = edge === 'top' ? topY : topY + h;
      const inBand = edge === 'top' ? y > ey - 44 && y < ey + h * (this.bottom ? 0.5 : 0.8) : y > ey - h * 0.5 && y < ey + 44;
      if (!inBand) return false;
      let best = -1;
      let bd = spacing * 0.55;
      xs.forEach((xx, i) => {
        const dd = Math.abs(xx + ox - x);
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      });
      if (best < 0) return false;
      this.drag = { edge, i: best, y0: y, base: cuts[best], val: cuts[best], moved: false };
      sfx.tap();
      return true;
    };
    if (this.bottom && this.xsBottom && y > topY + h / 2) {
      if (tryEdge('bottom', this.xsBottom, this.bottom)) return true;
    }
    return tryEdge('top', this.xsTop, this.top);
  }

  move(_x: number, y: number) {
    const d = this.drag;
    if (!d) return;
    const dy = (y - d.y0) * (d.edge === 'top' ? 1 : -1);
    if (Math.abs(y - d.y0) > 5) d.moved = true;
    const v = clamp(d.base + Math.round(dy / 13), d.base, this.maxDepth);
    if (v !== d.val) {
      d.val = v;
      sfx.tick(0.8, 0.05);
    }
  }

  /** commits the cut; returns true if material was removed */
  up(): boolean {
    const d = this.drag;
    if (!d) return false;
    this.drag = null;
    let v = d.val;
    if (!d.moved) v = Math.min(this.maxDepth, d.base + 1);
    if (v > d.base) {
      if (d.edge === 'top') {
        this.top[d.i] = v;
        if (this.marksTop[d.i] === 'imp' || this.marksTop[d.i]) this.marksTop[d.i] = null;
      } else {
        this.bottom![d.i] = v;
        this.marksBottom[d.i] = null;
      }
      this.grinds++;
      this.lastCutFlash = { edge: d.edge, i: d.i, t: 1 };
      sfx.grind(0.08 + (v - d.base) * 0.05);
      return true;
    }
    if (!d.moved && d.base >= this.maxDepth) sfx.error();
    return false;
  }
}
