import { Mechanism, type EvalResult, type Host, type Visibility, W } from '../core/mechanism';
import { C, type G, text, clamp, vgrad } from '../core/draw';
import { sfx } from '../core/sfx';
import { drawChamberShell, drawChamberPlug, type PinStatus } from './pinview';
import { drawOpenStamp, drawGridBg, drawDivider, drawCover, drawGauge } from './housing';

export interface TubularCfg {
  code: number[];
}

/**
 * Tubular (radial) pin tumbler. Pins sit on a circle; the key is a tube whose
 * end face has notches. Top: the ring of chambers "unrolled" into a cutaway.
 * Bottom: the key's end face, notch depth edited by dragging toward the centre.
 */
const L = {
  chTop: 30,
  shear: 124,
  plugBot: 208,
  faceTop: 180,
  step: 6,
  maxD: 6,
  cx: 200,
  cy: 462,
  rOut: 104,
  rIn: 62,
  notchStep: 5,
};

export class TubularLock extends Mechanism {
  cuts: number[];
  n: number;
  xs: number[];
  keyLens: number[];
  status: PinStatus[] = [];
  drag: { i: number; base: number; val: number; r0: number; moved: boolean } | null = null;
  flash: { i: number; t: number } | null = null;

  constructor(
    host: Host,
    vis: Visibility,
    public cfg: TubularCfg,
  ) {
    super(host, vis);
    this.n = cfg.code.length;
    const sp = Math.min(44, 330 / this.n);
    const x0 = W / 2 - (sp * (this.n - 1)) / 2;
    this.xs = cfg.code.map((_, i) => x0 + i * sp);
    this.cuts = cfg.code.map(() => 0);
    this.keyLens = cfg.code.map((c) => L.faceTop + c * L.step - L.shear);
    this.turnDur = 1.2;
  }

  isPristine() {
    return this.cuts.every((c) => c === 0);
  }
  newBlank() {
    this.cuts = this.cuts.map(() => 0);
    this.feedback = false;
    this.status = [];
  }

  angleOf(i: number) {
    // index notch at 12 o'clock; pin 1 starts just clockwise of it
    return -Math.PI / 2 + ((i + 0.5) / this.n) * Math.PI * 2;
  }

  cutOf(i: number) {
    return this.drag && this.drag.i === i ? this.drag.val : this.cuts[i];
  }

  tip(i: number) {
    const rest = L.plugBot - 6;
    if (this.insert <= 0) return rest;
    // key pushes in: face travels from below
    const travel = clamp(this.insert, 0, 1);
    const face = L.faceTop + (1 - travel) * 70;
    return Math.min(rest, face + this.cuts[i] * L.step);
  }

  evaluate(): EvalResult {
    this.status = this.cfg.code.map((c, i) => (this.cuts[i] === c ? 'ok' : this.cuts[i] < c ? 'high' : 'low'));
    const bad = this.status.filter((s) => s !== 'ok').length;
    if (!bad) return { ok: true };
    return { ok: false, stopAt: 0.05, msg: `${bad}本のピンがシアラインをまたいでいる` };
  }

  protected onInsertStep(prev: number, cur: number) {
    if (Math.floor(prev * 6) !== Math.floor(cur * 6)) sfx.tick(0.5, 0.06);
  }

  pointerDown(x: number, y: number) {
    if (!this.editable) return;
    const dx = x - L.cx;
    const dy = y - L.cy;
    const r = Math.hypot(dx, dy);
    if (r < L.rIn - 30 || r > L.rOut + 40) return;
    let a = Math.atan2(dy, dx) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    const i = Math.floor((a / (Math.PI * 2)) * this.n) % this.n;
    this.drag = { i, base: this.cuts[i], val: this.cuts[i], r0: r, moved: false };
    sfx.tap();
  }
  pointerMove(x: number, y: number) {
    const d = this.drag;
    if (!d) return;
    const r = Math.hypot(x - L.cx, y - L.cy);
    if (Math.abs(r - d.r0) > 5) d.moved = true;
    // dragging toward the center = deeper notch (notches are cut axially; we show depth radially)
    const v = clamp(d.base + Math.round((d.r0 - r) / 10), d.base, L.maxD);
    if (v !== d.val) {
      d.val = v;
      sfx.tick(0.8, 0.05);
    }
  }
  pointerUp() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const v = d.moved ? d.val : Math.min(L.maxD, d.base + 1);
    if (v > d.base) {
      this.cuts[d.i] = v;
      this.flash = { i: d.i, t: 1 };
      sfx.grind(0.1 + (v - d.base) * 0.04);
      if (this.status.length) this.status[d.i] = undefined as unknown as PinStatus;
      this.host.changed();
    } else if (!d.moved) sfx.error();
  }

  update(dt: number) {
    super.update(dt);
    if (this.flash) this.flash.t = Math.max(0, this.flash.t - dt * 2.5);
  }

  draw(g: G) {
    drawGridBg(g, W, 660);
    const showHl = this.feedback && this.vis !== 'hidden';
    const x0 = this.xs[0] - 30;
    const x1 = this.xs[this.n - 1] + 30;
    // housing (unrolled)
    g.fillStyle = C.shell;
    g.fillRect(x0, L.chTop - 8, x1 - x0, L.shear - L.chTop + 8);
    this.xs.forEach((x, i) =>
      drawChamberShell(g, {
        x,
        top: L.chTop,
        shear: L.shear,
        tip: this.tip(i),
        keyLen: this.keyLens[i],
        driverLen: 22,
        width: 16,
        status: showHl ? this.status[i] : null,
        hl: showHl && this.status[i] !== 'ok',
      }),
    );
    // plug: slides sideways as it rotates (unrolled view)
    const shift = this.turn * 26;
    g.save();
    g.beginPath();
    g.rect(x0, L.shear, x1 - x0, L.plugBot - L.shear);
    g.clip();
    g.fillStyle = C.plug;
    g.fillRect(x0, L.shear, x1 - x0, L.plugBot - L.shear);
    g.translate(shift, 0);
    this.xs.forEach((x, i) =>
      drawChamberPlug(
        g,
        { x, top: L.chTop, shear: L.shear, tip: this.tip(i), keyLen: this.keyLens[i], driverLen: 22, width: 16, hl: showHl && this.status[i] === 'low' },
        L.plugBot + 8,
      ),
    );
    // key tube end (unrolled) pushing from below
    if (this.insert > 0) {
      const face = L.faceTop + (1 - this.insert) * 70;
      g.fillStyle = vgrad(g, face, L.plugBot, [
        [0, C.keyNickelLight],
        [1, C.keyNickelDark],
      ]);
      g.beginPath();
      g.moveTo(x0, L.plugBot + 10);
      g.lineTo(x0, face);
      this.xs.forEach((x, i) => {
        const d = this.cuts[i] * L.step;
        g.lineTo(x - 9, face);
        g.lineTo(x - 6, face + d);
        g.lineTo(x + 6, face + d);
        g.lineTo(x + 9, face);
      });
      g.lineTo(x1, face);
      g.lineTo(x1, L.plugBot + 10);
      g.closePath();
      g.fill();
    }
    g.restore();
    this.xs.forEach((x, i) => text(g, `${i + 1}`, x, L.plugBot + 14, { size: 11, color: C.sub }));
    const success = this.phase === 'turning' || this.phase === 'open';
    g.save();
    g.strokeStyle = success ? C.ok : C.shear;
    g.setLineDash(success ? [] : [6, 4]);
    g.lineWidth = success ? 2.5 : 1.5;
    g.beginPath();
    g.moveTo(x0 - 4, L.shear);
    g.lineTo(x1 + 4, L.shear);
    g.stroke();
    g.restore();
    text(g, '円周上のピンを1列に展開した断面', W / 2, 12, { size: 10, color: C.sub });

    if (this.phase === 'edit' && this.vis === 'full') {
      const rest = L.plugBot - 6;
      drawGauge(g, x0 + 2, x1 - 4, Array.from({ length: L.maxD + 1 }, (_, k) => rest - (L.faceTop + k * L.step - L.shear)));
    }
    if (this.vis === 'window') {
      drawCover(g, x0, L.chTop - 8, x1 - x0, L.shear - 14 - (L.chTop - 8));
      drawCover(g, x0, L.shear + 14, x1 - x0, L.plugBot - L.shear - 14);
    } else if (this.vis === 'hidden') {
      drawCover(g, x0, L.chTop - 8, x1 - x0, L.plugBot - L.chTop + 8, '内部は見えない');
    }

    this.drawFace(g);
    if (this.phase === 'open') drawOpenStamp(g, W / 2, 130, this.openT);
  }

  drawFace(g: G) {
    const ed = this.phase === 'edit';
    drawDivider(g, 244, W, ed ? '鍵の先端（切り欠きをタップ／中心へドラッグ）' : '');
    const rot = this.turn * (Math.PI / 4);
    g.save();
    g.translate(L.cx, L.cy);
    g.rotate(rot);
    g.globalAlpha = ed ? 1 : 0.35;
    // tube
    g.fillStyle = vgrad(g, -L.rOut, L.rOut, [
      [0, C.keyNickelLight],
      [1, C.keyNickelDark],
    ]);
    g.beginPath();
    g.arc(0, 0, L.rOut, 0, Math.PI * 2);
    g.arc(0, 0, L.rIn, 0, Math.PI * 2, true);
    g.fill('evenodd');
    // index nub
    g.fillStyle = C.keyNickelLight;
    g.fillRect(-7, -L.rOut - 10, 14, 12);
    // notches
    for (let i = 0; i < this.n; i++) {
      const a = this.angleOf(i);
      const c = this.cutOf(i);
      const depth = c * L.notchStep;
      const w = 0.19;
      g.fillStyle = C.bg;
      g.beginPath();
      g.arc(0, 0, L.rOut + 1, a - w, a + w);
      g.arc(0, 0, L.rOut - 6 - depth, a + w * 0.8, a - w * 0.8, true);
      g.closePath();
      if (c > 0) g.fill();
      g.strokeStyle = this.drag && this.drag.i === i ? C.shear : 'rgba(40,50,60,0.4)';
      g.lineWidth = 1;
      g.setLineDash(c > 0 ? [] : [2, 3]);
      g.stroke();
      g.setLineDash([]);
      const lr = L.rIn - 16;
      g.save();
      g.translate(Math.cos(a) * lr, Math.sin(a) * lr);
      g.rotate(-rot);
      text(g, `${i + 1}`, 0, 0, { size: 10, color: C.sub });
      g.restore();
      const vr = L.rOut + 22;
      g.save();
      g.translate(Math.cos(a) * vr, Math.sin(a) * vr);
      g.rotate(-rot);
      const st = ed ? this.status[i] : undefined;
      const col = st === 'ok' ? C.ok : st === 'high' ? C.warn : st === 'low' ? C.bad : this.drag && this.drag.i === i ? C.shear : C.text;
      text(g, st === 'high' ? `${c}▼` : st === 'low' ? `${c}✕` : String(c), 0, 0, { size: 13, color: col, weight: '800' });
      g.restore();
      if (this.flash && this.flash.i === i && this.flash.t > 0) {
        g.save();
        g.globalAlpha = this.flash.t;
        g.fillStyle = '#ffe9a8';
        g.beginPath();
        g.arc(Math.cos(a) * (L.rOut - 6 - depth), Math.sin(a) * (L.rOut - 6 - depth), 4 + (1 - this.flash.t) * 6, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
    g.restore();
    text(g, '▲ 位置合わせの突起', L.cx, L.cy - L.rOut - 40, { size: 10, color: C.sub });
  }
}
