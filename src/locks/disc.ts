import { Mechanism, type EvalResult, type Host, type Visibility, W } from '../core/mechanism';
import { C, type G, text, rr, seg, clamp, vgrad, easeInOut } from '../core/draw';
import { sfx } from '../core/sfx';
import { drawOpenStamp, drawGridBg, drawDivider, drawCover } from './housing';

export interface DiscCfg {
  /** cut (0..5) per disc; gate sits code*STEP degrees counter-clockwise of the sidebar */
  code: number[];
  /** decoy shallow notches: [disc, cut] */
  falseGates?: [number, number][];
}

const STEP = 18;
const MAXC = 5;
const L = { sideY: 118, discY: 176, dialY: 420, codeY: 478 };

export class DiscLock extends Mechanism {
  cuts: number[];
  n: number;
  xs: number[];
  r: number;
  status: ('ok' | 'bad')[] = [];

  constructor(
    host: Host,
    vis: Visibility,
    public cfg: DiscCfg,
  ) {
    super(host, vis);
    this.n = cfg.code.length;
    const sp = Math.min(76, 360 / this.n);
    const x0 = W / 2 - (sp * (this.n - 1)) / 2;
    this.xs = cfg.code.map((_, i) => x0 + i * sp);
    this.r = Math.min(32, sp / 2 - 3);
    this.cuts = cfg.code.map(() => 0);
    this.turnDur = 2.2;
    this.failDur = 1.6;
  }

  isPristine() {
    return this.cuts.every((c) => c === 0);
  }
  newBlank() {
    this.cuts = this.cuts.map(() => 0);
    this.status = [];
    this.feedback = false;
  }

  evaluate(): EvalResult {
    this.status = this.cfg.code.map((c, i) => (this.cuts[i] === c ? 'ok' : 'bad'));
    const bad = this.status.filter((s) => s === 'bad').length;
    if (!bad) return { ok: true };
    const onFalse = this.cfg.falseGates?.some(([d, c]) => this.cuts[d] === c) ?? false;
    return {
      ok: false,
      stopAt: 0.5,
      msg: onFalse ? `サイドバーが途中で止まった…浅い「偽ゲート」に入ったディスクがある` : `${bad}枚のディスクのゲートが上に揃っていない`,
    };
  }

  /** disc rotation (deg) at current turn progress */
  discRot(i: number) {
    const t = this.turn;
    const spin = easeInOut(seg(t, 0, 0.42)) * this.cuts[i] * STEP;
    const body = this.phase === 'turning' || this.phase === 'open' ? easeInOut(seg(t, 0.62, 1)) * 90 : 0;
    return spin + body;
  }

  sidebarDrop() {
    const t = this.turn;
    if (this.phase === 'turning' || this.phase === 'open') return seg(t, 0.44, 0.58);
    if (this.phase === 'turnFail') return seg(t, 0.44, 0.5) * 0.3;
    return 0;
  }

  protected onTurnStep(prev: number, cur: number) {
    if (prev < 0.44 && cur >= 0.44) sfx.tick(0.5, 0.15);
    if (prev < 0.58 && cur >= 0.58) sfx.clack();
  }

  pointerDown(x: number, y: number) {
    if (!this.editable) return;
    if (Math.abs(y - L.dialY) > 40) return;
    const i = this.xs.findIndex((xx) => Math.abs(xx - x) < this.r + 4);
    if (i < 0) return;
    if (this.cuts[i] >= MAXC) {
      sfx.error();
      return;
    }
    this.cuts[i]++;
    this.status = [];
    sfx.grind(0.1);
    this.host.changed();
  }

  draw(g: G) {
    drawGridBg(g, W, 660);
    const showHl = this.feedback && this.vis !== 'hidden';
    const drop = this.sidebarDrop();
    const inKey = this.insert > 0.3;
    // housing
    const hx0 = this.xs[0] - this.r - 18;
    const hx1 = this.xs[this.n - 1] + this.r + 18;
    g.fillStyle = vgrad(g, 40, 250, [
      [0, '#44505e'],
      [1, '#2b3440'],
    ]);
    rr(g, hx0, 56, hx1 - hx0, 190, 16);
    g.fill();
    g.strokeStyle = C.shellEdge;
    g.stroke();
    text(g, 'ディスク・ディテイナー錠', hx0 + 10, 70, { size: 10, color: C.sub, align: 'left' });
    // sidebar channel in housing
    g.fillStyle = C.cavity;
    g.fillRect(hx0 + 8, L.sideY - 14, hx1 - hx0 - 16, 14);

    this.xs.forEach((cx, i) => {
      const rot = inKey ? this.discRot(i) : 0;
      const gate = -this.cfg.code[i] * STEP; // rest gate angle (deg from top, cw+)
      const cy = L.discY;
      const R = this.r;
      if (this.vis === 'full') {
        g.save();
        for (let k = 0; k <= MAXC; k++) {
          const a = ((-k * STEP) * Math.PI) / 180 - Math.PI / 2;
          g.strokeStyle = k === 0 ? 'rgba(255,204,51,0.8)' : 'rgba(255,204,51,0.3)';
          g.lineWidth = k === 0 ? 2 : 1;
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * (R + 2), cy + Math.sin(a) * (R + 2));
          g.lineTo(cx + Math.cos(a) * (R + 7), cy + Math.sin(a) * (R + 7));
          g.stroke();
        }
        g.restore();
      }
      g.save();
      g.translate(cx, cy);
      g.rotate(((rot + gate) * Math.PI) / 180);
      // disc body with gate notch at top (in rotated frame)
      const bad = showHl && this.status[i] === 'bad';
      g.fillStyle = bad ? '#b45454' : C.steel;
      g.beginPath();
      const gw = 0.24;
      g.arc(0, 0, R, -Math.PI / 2 + gw, -Math.PI / 2 - gw + Math.PI * 2);
      g.lineTo(Math.cos(-Math.PI / 2 - gw) * (R - 9), Math.sin(-Math.PI / 2 - gw) * (R - 9));
      g.lineTo(Math.cos(-Math.PI / 2 + gw) * (R - 9), Math.sin(-Math.PI / 2 + gw) * (R - 9));
      g.closePath();
      g.fill();
      g.strokeStyle = C.steelDark;
      g.lineWidth = 1;
      g.stroke();
      g.restore();
      // false gates
      this.cfg.falseGates?.forEach(([d, c]) => {
        if (d !== i) return;
        const a = ((rot - c * STEP) * Math.PI) / 180 - Math.PI / 2;
        g.fillStyle = '#26303b';
        g.beginPath();
        g.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 5, 0, Math.PI * 2);
        g.fill();
      });
      // centre hole with key section
      g.save();
      g.translate(cx, cy);
      g.fillStyle = C.cavity;
      g.beginPath();
      g.arc(0, 0, R * 0.42, 0, Math.PI * 2);
      g.fill();
      if (inKey) {
        const keyRot = this.phase === 'turning' || this.phase === 'turnFail' || this.phase === 'open' ? rot : this.cuts[i] * 0;
        g.rotate((keyRot * Math.PI) / 180);
        g.fillStyle = C.keyNickel;
        g.beginPath();
        g.arc(0, 0, R * 0.38, Math.PI, 0);
        g.closePath();
        g.fill();
      }
      g.restore();
      text(g, `${i + 1}`, cx, cy + R + 14, { size: 11, color: C.sub });
    });
    // sidebar
    const sy = L.sideY - 12 + drop * 12;
    const ok = this.phase === 'turning' || this.phase === 'open';
    g.save();
    if (ok && this.turn > 0.62) {
      // whole core rotates; show sidebar sliding away
      g.globalAlpha = 1 - seg(this.turn, 0.62, 0.8);
    }
    g.fillStyle = vgrad(g, sy, sy + 12, [
      [0, C.brassLight],
      [1, C.brassDark],
    ]);
    g.fillRect(hx0 + 10, sy, hx1 - hx0 - 20, 12);
    g.restore();
    text(g, 'サイドバー', hx1 - 14, L.sideY - 22, { size: 9, color: C.brassLight, align: 'right' });
    g.save();
    g.strokeStyle = ok ? C.ok : 'rgba(255,204,51,0.5)';
    g.setLineDash([3, 3]);
    this.xs.forEach((cx) => {
      g.beginPath();
      g.moveTo(cx, L.sideY + 2);
      g.lineTo(cx, L.discY - this.r - 2);
      g.stroke();
    });
    g.restore();
    if (this.vis === 'hidden') drawCover(g, hx0, 80, hx1 - hx0, 150, '内部は見えない');

    this.drawEditor(g);
    if (this.phase === 'open') drawOpenStamp(g, W / 2, 170, this.openT);
  }

  drawEditor(g: G) {
    const ed = this.phase === 'edit';
    drawDivider(g, 300, W, ed ? '鍵の加工台（各段をタップで斜めに削る）' : '');
    g.save();
    g.globalAlpha = ed ? 1 : 0.3;
    // key body side view (half-moon rod) under the dials
    const kx0 = this.xs[0] - this.r - 30;
    const kx1 = this.xs[this.n - 1] + this.r + 6;
    g.fillStyle = vgrad(g, 340, 364, [
      [0, C.keyNickelLight],
      [1, C.keyNickelDark],
    ]);
    rr(g, kx0, 344, kx1 - kx0, 18, 6);
    g.fill();
    g.beginPath();
    g.arc(kx0 - 6, 353, 20, 0, Math.PI * 2);
    g.fill();
    text(g, '鍵を先端から見た各段の断面 ↓', W / 2, 380, { size: 10, color: C.sub });
    this.xs.forEach((cx, i) => {
      const R = this.r * 0.9;
      g.fillStyle = '#18212b';
      g.beginPath();
      g.arc(cx, L.dialY, R, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#2f3b48';
      g.stroke();
      // angle ticks
      for (let k = 0; k <= MAXC; k++) {
        const a = ((k * STEP) * Math.PI) / 180 - Math.PI / 2;
        g.strokeStyle = k === this.cuts[i] ? C.shear : 'rgba(142,160,181,0.3)';
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * (R - 2), L.dialY + Math.sin(a) * (R - 2));
        g.lineTo(cx + Math.cos(a) * (R - 7), L.dialY + Math.sin(a) * (R - 7));
        g.stroke();
      }
      // key half-moon section with angled cut face
      g.save();
      g.translate(cx, L.dialY);
      g.fillStyle = C.keyNickel;
      g.beginPath();
      g.arc(0, 0, R * 0.62, 0, Math.PI);
      g.closePath();
      g.fill();
      // cut face indicator: a line showing the cut angle
      const ca = ((this.cuts[i] * STEP) * Math.PI) / 180;
      g.rotate(ca);
      g.strokeStyle = C.shear;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -R * 0.62);
      g.stroke();
      g.restore();
      const st = this.status[i];
      const col = st === 'ok' ? C.ok : st === 'bad' ? C.bad : C.text;
      text(g, `${this.cuts[i]}`, cx, L.codeY, { size: 14, color: col, weight: '800' });
      text(g, `${this.cuts[i] * STEP}°`, cx, L.codeY + 16, { size: 9, color: C.sub });
    });
    g.restore();
    if (ed) text(g, '数字＝ディスクを回す量（1段＝18°）', W / 2, L.codeY + 40, { size: 10, color: C.sub });
    void clamp;
  }
}
