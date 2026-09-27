import { Mechanism, type EvalResult, type Host, type Visibility, W } from '../core/mechanism';
import { C, type G, text, rr, seg, clamp, vgrad, hgrad, arrow } from '../core/draw';
import { sfx } from '../core/sfx';
import { drawOpenStamp, drawGridBg, drawDivider, drawCover } from './housing';

export interface LeverCfg {
  /** correct cut depth for each lever step */
  code: number[];
  /** optional per-lever gate offset (px, default 12) */
  gates?: number[];
}

const L = {
  boltY: 44,
  stumpY: 176,
  keyY: 282,
  sMax: 44,
  step: 5,
  maxD: 5,
  gate: 12,
  shaftY: 388,
  bitTop: 398,
  scale: 2.2,
};

type St = 'ok' | 'high' | 'low';

export class LeverLock extends Mechanism {
  cuts: number[];
  sp: number;
  xs: number[];
  bellies: number[];
  gates: number[];
  status: St[] = [];
  drag: { i: number; y0: number; base: number; val: number; moved: boolean } | null = null;
  flash: { i: number; t: number } | null = null;

  constructor(
    host: Host,
    vis: Visibility,
    public cfg: LeverCfg,
  ) {
    super(host, vis);
    const n = cfg.code.length;
    this.sp = Math.min(84, 360 / n);
    const x0 = W / 2 - (this.sp * (n - 1)) / 2;
    this.xs = cfg.code.map((_, i) => x0 + i * this.sp);
    this.cuts = cfg.code.map(() => 0);
    this.gates = cfg.gates ?? cfg.code.map(() => L.gate);
    this.bellies = cfg.code.map((c, i) => L.sMax - c * L.step - this.gates[i]);
    this.turnDur = 2.0;
    this.failDur = 1.8;
  }

  isPristine() {
    return this.cuts.every((c) => c === 0);
  }
  newBlank() {
    this.cuts = this.cuts.map(() => 0);
    this.status = [];
    this.feedback = false;
  }

  stepLen(i: number, preview = true) {
    const c = preview && this.drag && this.drag.i === i ? this.drag.val : this.cuts[i];
    return L.sMax - c * L.step;
  }

  evaluate(): EvalResult {
    this.status = this.cfg.code.map((c, i) => (this.cuts[i] === c ? 'ok' : this.cuts[i] < c ? 'high' : 'low'));
    const bad = this.status.filter((s) => s !== 'ok').length;
    if (!bad) return { ok: true };
    return { ok: false, stopAt: 168 / 360, msg: `${bad}枚のレバーのゲートがスタンプの高さに合っていない` };
  }

  theta() {
    return this.turn * 360;
  }

  /** lever lift for lever i at key angle θ (deg, 0 = bit pointing down) */
  lift(i: number, th: number) {
    const s = this.stepLen(i, false);
    const reach = -Math.cos((th * Math.PI) / 180) * s; // + when pointing up
    return Math.max(0, reach - this.bellies[i]);
  }

  boltT() {
    const th = this.theta();
    if (this.phase === 'turning' || this.phase === 'open') return this.phase === 'open' ? 1 : seg(th, 160, 205);
    if (this.phase === 'turnFail') return seg(th, 160, 205) * 0.3;
    return 0;
  }

  protected onTurnStep(prev: number, cur: number) {
    const a = prev * 360;
    const b = cur * 360;
    if (a < 150 && b >= 150) sfx.tick(0.3, 0.12);
    if (a < 200 && b >= 200) sfx.clack();
  }

  pointerDown(x: number, y: number) {
    if (!this.editable) return;
    if (y < L.shaftY - 10 || y > L.bitTop + L.sMax * L.scale + 40) return;
    let best = -1;
    let bd = this.sp / 2;
    this.xs.forEach((xx, i) => {
      if (Math.abs(xx - x) < bd) {
        bd = Math.abs(xx - x);
        best = i;
      }
    });
    if (best < 0) return;
    this.drag = { i: best, y0: y, base: this.cuts[best], val: this.cuts[best], moved: false };
    sfx.tap();
  }
  pointerMove(_x: number, y: number) {
    const d = this.drag;
    if (!d) return;
    if (Math.abs(y - d.y0) > 5) d.moved = true;
    const v = clamp(d.base + Math.round((d.y0 - y) / 14), d.base, L.maxD);
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
      sfx.grind(0.1 + (v - d.base) * 0.05);
      if (this.status.length) this.status[d.i] = undefined as unknown as St;
      this.host.changed();
    } else if (!d.moved) sfx.error();
  }

  update(dt: number) {
    super.update(dt);
    if (this.flash) this.flash.t = Math.max(0, this.flash.t - dt * 2.5);
  }

  draw(g: G) {
    drawGridBg(g, W, 660);
    const th = this.theta();
    const bt = this.boltT();
    const showHl = this.feedback && this.vis !== 'hidden';
    const inKey = this.insert > 0.3;
    // bolt bar
    const bx = 20 + bt * 60;
    g.fillStyle = vgrad(g, L.boltY - 14, L.boltY + 14, [
      [0, C.steelLight],
      [1, C.steelDark],
    ]);
    rr(g, bx, L.boltY - 14, W - 60, 28, 5);
    g.fill();
    text(g, 'ボルト →', bx + 60, L.boltY, { size: 12, color: '#1d2530', weight: '800' });
    g.fillStyle = '#2a2016';
    g.fillRect(W - 22, L.boltY - 20, 22, 40);
    // stump post
    g.strokeStyle = 'rgba(184,195,207,0.35)';
    g.lineWidth = 2;
    g.setLineDash([3, 4]);
    g.beginPath();
    g.moveTo(bx + 30, L.boltY + 14);
    g.lineTo(bx + 30, L.stumpY - 40);
    g.stroke();
    g.setLineDash([]);
    text(g, 'スタンプ（ボルトの突起）は全レバーを貫通', W / 2 + 20, L.boltY + 30, { size: 10, color: C.sub });

    this.xs.forEach((cx, i) => {
      const lift = inKey ? this.lift(i, th) : 0;
      const pw = this.sp - 10;
      const x0 = cx - pw / 2;
      const belly = L.keyY - this.bellies[i] - lift;
      const top = L.stumpY - 56 - lift;
      const gate = this.gates[i];
      const bad = showHl && this.status[i] && this.status[i] !== 'ok';
      // lever plate
      g.save();
      g.fillStyle = hgrad(g, x0, x0 + pw, bad ? [[0, '#7f1d1d'], [0.5, '#f87171'], [1, '#7f1d1d']] : [[0, C.brassDark], [0.45, C.brassLight], [1, C.brass]]);
      g.beginPath();
      g.moveTo(x0, top);
      g.lineTo(x0 + pw, top);
      g.lineTo(x0 + pw, belly - 14);
      g.lineTo(cx + 12, belly);
      g.lineTo(cx - 12, belly);
      g.lineTo(x0, belly - 14);
      g.closePath();
      // window (rear pocket + gate channel + front pocket), in lever coords
      const wy = L.stumpY - lift; // stump rest center in lever coords
      const pr = 7;
      const rear = cx - pw / 2 + 9;
      const front = cx + pw / 2 - 9;
      g.rect(rear - pr, wy - pr - 2, pr * 2, gate + pr * 2 + 12);
      g.rect(rear - pr, wy + gate - pr, front - rear + pr * 2, pr * 2);
      g.rect(front - pr, wy + gate - pr - 10, pr * 2, pr * 2 + 10);
      g.fill('evenodd');
      g.strokeStyle = 'rgba(60,40,0,0.45)';
      g.lineWidth = 1;
      g.stroke();
      // lever spring
      g.strokeStyle = C.spring;
      g.beginPath();
      for (let k = 0; k <= 6; k++) g.lineTo(cx + (k % 2 ? 5 : -5), top - k * 3);
      g.stroke();
      g.restore();
      // stump
      const sx = rear + (front - rear) * bt;
      g.fillStyle = vgrad(g, L.stumpY - 6, L.stumpY + 6, [
        [0, C.steelLight],
        [1, C.steelDark],
      ]);
      g.beginPath();
      g.arc(sx, L.stumpY, 6, 0, Math.PI * 2);
      g.fill();
      if (bad) arrow(g, cx + pw / 2 - 2, L.stumpY + 22, this.status[i] === 'high' ? -1 : 1, C.bad, 6);

      // key barrel + bit
      g.fillStyle = '#0c1117';
      g.beginPath();
      g.arc(cx, L.keyY, 10, 0, Math.PI * 2);
      g.fill();
      if (inKey) {
        g.save();
        g.translate(cx, L.keyY);
        g.rotate((th * Math.PI) / 180);
        g.fillStyle = C.keyNickel;
        g.beginPath();
        g.arc(0, 0, 8, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = vgrad(g, 0, 40, [
          [0, C.keyNickelLight],
          [1, C.keyNickelDark],
        ]);
        g.fillRect(-5, 0, 10, this.stepLen(i, false));
        g.restore();
      }
      text(g, `${i + 1}`, cx, L.keyY + 58, { size: 11, color: C.sub });
    });
    // gate alignment guide line
    g.save();
    g.strokeStyle = this.phase === 'turning' || this.phase === 'open' ? C.ok : 'rgba(255,204,51,0.5)';
    g.setLineDash([5, 4]);
    g.beginPath();
    g.moveTo(8, L.stumpY);
    g.lineTo(W - 8, L.stumpY);
    g.stroke();
    g.restore();
    text(g, 'スタンプの通り道', 10, L.stumpY - 12, { size: 9, color: C.shear, align: 'left' });

    if (this.vis === 'window') {
      drawCover(g, 6, L.stumpY - 90, W - 12, 72);
      drawCover(g, 6, L.stumpY + 26, W - 12, L.keyY - 18 - (L.stumpY + 26));
      text(g, 'のぞき窓', 14, L.stumpY + 36, { size: 9, color: C.sub, align: 'left' });
    }
    if (this.vis === 'hidden') drawCover(g, 6, L.stumpY - 90, W - 12, L.keyY - L.stumpY + 60, '内部は見えない');

    this.drawEditor(g);
    if (this.phase === 'open') drawOpenStamp(g, W / 2, 200, this.openT);
  }

  drawEditor(g: G) {
    const ed = this.phase === 'edit';
    drawDivider(g, 356, W, ed ? '鍵の加工台（刃先をタップ／上へドラッグで短く）' : '');
    g.save();
    g.globalAlpha = ed ? 1 : 0.25;
    const left = this.xs[0] - this.sp / 2 - 20;
    const right = this.xs[this.xs.length - 1] + this.sp / 2 + 10;
    g.fillStyle = vgrad(g, L.shaftY - 9, L.shaftY + 9, [
      [0, C.keyNickelLight],
      [1, C.keyNickelDark],
    ]);
    rr(g, left, L.shaftY - 9, right - left, 18, 9);
    g.fill();
    g.beginPath();
    g.arc(left - 8, L.shaftY, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = C.bg;
    g.beginPath();
    g.arc(left - 12, L.shaftY, 9, 0, Math.PI * 2);
    g.fill();
    // bit steps
    this.xs.forEach((cx, i) => {
      const w = this.sp - 2;
      const len = this.stepLen(i) * L.scale;
      const full = L.sMax * L.scale;
      g.fillStyle = vgrad(g, L.bitTop, L.bitTop + full, [
        [0, C.keyNickelLight],
        [1, C.keyNickel],
      ]);
      g.fillRect(cx - w / 2, L.bitTop - 2, w, len + 2);
      g.strokeStyle = 'rgba(80,90,105,0.4)';
      g.strokeRect(cx - w / 2, L.bitTop - 2, w, len + 2);
      if (ed) {
        g.save();
        g.setLineDash([3, 3]);
        g.strokeStyle = 'rgba(200,210,225,0.3)';
        g.strokeRect(cx - w / 2, L.bitTop - 2, w, full + 2);
        g.restore();
      }
      const c = this.drag && this.drag.i === i ? this.drag.val : this.cuts[i];
      text(g, String(c), cx, L.bitTop + full + 22, { size: 13, color: this.drag && this.drag.i === i ? C.shear : C.sub, weight: '800' });
      const st = this.feedback || ed ? this.status[i] : undefined;
      if (ed && st) {
        const col = st === 'ok' ? C.ok : st === 'high' ? C.warn : C.bad;
        text(g, st === 'ok' ? '✓' : st === 'high' ? '▲' : '✕', cx, L.bitTop + len + 12, { size: 12, color: col, weight: '800' });
      }
      if (this.flash && this.flash.i === i && this.flash.t > 0) {
        g.save();
        g.globalAlpha = this.flash.t;
        g.fillStyle = '#ffe9a8';
        g.fillRect(cx - w / 2, L.bitTop + len - 3, w, 3);
        g.restore();
      }
    });
    g.restore();
    if (ed) text(g, 'キーコード（削った段数）', W / 2, L.bitTop + L.sMax * L.scale + 44, { size: 10, color: C.sub });
  }
}
