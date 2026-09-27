import { Mechanism, type EvalResult, type Host, type Visibility, W } from '../core/mechanism';
import { C, type G, text, easeOutBack } from '../core/draw';
import { sfx } from '../core/sfx';
import { BladeKey } from './bladekey';
import { keyPose, drawChamberShell, drawChamberPlug, type PinStatus } from './pinview';
import { drawPadlock, drawFrontInset, drawOpenStamp, drawCover, drawGridBg, drawDivider, drawGauge } from './housing';

export interface PinCfg {
  /** correct cut depth for each chamber (0..maxDepth) */
  code: number[];
  maxDepth?: number;
  /** tutorial aid: while editing, show where the key pins would sit */
  ghost?: boolean;
}

export const PIN = {
  face: 44,
  bodyTop: 92,
  chamberTop: 104,
  shear: 212,
  plugBottom: 312,
  bodyBottom: 332,
  bladeTop: 246,
  bladeH: 56,
  step: 7,
  editTop: 452,
  driverLen: 30,
  pinW: 18,
};

export function pinXs(n: number) {
  const sp = n <= 4 ? 56 : n === 5 ? 50 : n === 6 ? 44 : 40;
  const first = PIN.face + 46;
  return { xs: Array.from({ length: n }, (_, i) => first + i * sp), sp };
}

export class PinLock extends Mechanism {
  key: BladeKey;
  xs: number[];
  sp: number;
  keyLens: number[];
  status: PinStatus[] = [];
  private lastTip: number[];
  private lastDir: number[];
  /** set by subclasses to shift the whole lock drawing */
  protected yOff = 0;

  constructor(
    host: Host,
    vis: Visibility,
    public cfg: PinCfg,
  ) {
    super(host, vis);
    const { xs, sp } = pinXs(cfg.code.length);
    this.xs = xs;
    this.sp = sp;
    const maxD = cfg.maxDepth ?? 6;
    this.key = new BladeKey(xs, null, maxD, PIN.step, PIN.face - 4, xs[xs.length - 1] + 34, PIN.bladeH);
    this.keyLens = cfg.code.map((c) => PIN.bladeTop + c * PIN.step - PIN.shear);
    this.lastTip = xs.map(() => 0);
    this.lastDir = xs.map(() => 0);
  }

  isPristine() {
    return this.key.pristine();
  }

  newBlank() {
    this.key.reset();
    this.feedback = false;
  }

  /** y of key pin tip for chamber i given the key pose */
  tipY(i: number, ox: number, inKeyway: boolean): number {
    const rest = PIN.plugBottom - 12;
    if (!inKeyway) return rest;
    const u = this.xs[i] - ox;
    if (u < this.key.bladeX0 || u > this.key.tipX) return rest;
    const d = Math.min(PIN.bladeH * 0.8, this.key.depthAt(u, 'top', false));
    return Math.min(rest, PIN.bladeTop + d);
  }

  pose() {
    return keyPose(this.insert, this.key.tipX, PIN.face, PIN.editTop - PIN.bladeTop);
  }

  evaluate(): EvalResult {
    this.status = this.cfg.code.map((c, i) => (this.key.top[i] === c ? 'ok' : this.key.top[i] < c ? 'high' : 'low'));
    const bad = this.status.filter((s) => s !== 'ok').length;
    if (bad === 0) return { ok: true };
    return {
      ok: false,
      stopAt: 0.05,
      msg:
        this.vis === 'hidden'
          ? '回らない…鍵に当たりの跡がついた'
          : `${bad}本のピンがシアラインをまたいでいて回らない`,
    };
  }

  protected onFailed() {
    const imp = this.vis === 'hidden';
    this.key.marksTop = this.status.map((s) => (imp ? (s === 'high' ? 'imp' : null) : s));
  }

  protected onInsertStep(_prev: number, _cur: number) {
    const p = this.pose();
    this.xs.forEach((_, i) => {
      const t = this.tipY(i, p.ox, p.inKeyway);
      const dir = Math.sign(t - this.lastTip[i]);
      if (dir !== 0) {
        if (this.lastDir[i] < 0 && dir > 0) sfx.tick(0.3 + i * 0.1, 0.1);
        this.lastDir[i] = dir;
      }
      this.lastTip[i] = t;
    });
  }

  coach(): string | null {
    if (!this.cfg.ghost) return null;
    if (this.phase === 'edit') {
      const okN = this.cfg.code.filter((c, i) => this.key.top[i] === c).length;
      if (this.key.top.some((c, i) => c > this.cfg.code[i])) return '削りすぎた所がある… 下の「新しいブランク」でやり直そう';
      if (okN === this.cfg.code.length) return '全部の点線枠がシアラインに揃った！「差し込む」を押そう';
      if (this.key.pristine()) return '① 鍵の山（ピンの真下）をタップすると1段削れる。上下ドラッグでまとめて削れる';
      return `② 点線枠（下ピン）の上端が黄色いシアラインに揃うまで削ろう（${okN}/${this.cfg.code.length}）`;
    }
    if (this.phase === 'inserted' && !this.feedback) return '③ 下ピンの境目がシアラインに揃っている。「回す」を押そう！';
    return null;
  }

  pointerDown(x: number, y: number) {
    if (!this.editable) return;
    this.key.down(x, y, 0, PIN.editTop, this.sp);
  }
  pointerMove(x: number, y: number) {
    this.key.move(x, y);
  }
  pointerUp() {
    if (this.key.up()) this.host.changed();
  }

  update(dt: number) {
    super.update(dt);
    this.key.update(dt);
  }

  get angle() {
    return (this.turn * Math.PI) / 2;
  }

  draw(g: G) {
    drawGridBg(g, W, 660);
    this.drawLock(g);
    this.drawEditor(g);
  }

  protected drawLock(g: G) {
    const p = this.pose();
    const lift = this.phase === 'open' ? easeOutBack(Math.min(1, this.openT * 1.4)) : 0;
    drawPadlock(g, PIN.face, W - 28, PIN.bodyTop, PIN.bodyBottom, lift);
    const x0 = PIN.face;
    const x1 = W - 28;
    // shell & plug background
    g.fillStyle = C.shell;
    g.fillRect(x0, PIN.chamberTop - 6, x1 - x0, PIN.shear - PIN.chamberTop + 6);
    const showHl = this.feedback && this.vis !== 'hidden';
    const tips = this.xs.map((_, i) => this.tipY(i, p.ox, p.inKeyway));
    const stat = (i: number) => (showHl ? this.status[i] : null);
    const inKey = this.insert > 0 && p.inKeyway;

    this.xs.forEach((x, i) =>
      drawChamberShell(g, {
        x,
        top: PIN.chamberTop,
        shear: PIN.shear,
        tip: tips[i],
        keyLen: this.keyLens[i],
        driverLen: PIN.driverLen,
        width: PIN.pinW,
        status: stat(i),
        hl: showHl && this.status[i] !== 'ok',
      }),
    );

    // plug with rotation projection
    const axis = (PIN.shear + PIN.plugBottom) / 2;
    const s = Math.max(0.03, Math.cos(this.angle));
    g.save();
    g.beginPath();
    g.rect(x0, PIN.shear, x1 - x0, PIN.plugBottom - PIN.shear);
    g.clip();
    g.fillStyle = C.plug;
    g.fillRect(x0, PIN.shear, x1 - x0, PIN.plugBottom - PIN.shear);
    // cylinder shading
    const sh = g.createLinearGradient(0, PIN.shear, 0, PIN.plugBottom);
    sh.addColorStop(0, 'rgba(255,255,255,0.18)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = sh;
    g.fillRect(x0, PIN.shear, x1 - x0, PIN.plugBottom - PIN.shear);
    g.translate(0, axis);
    g.scale(1, s);
    g.translate(0, -axis);
    // keyway
    g.fillStyle = C.cavity;
    g.fillRect(x0, PIN.bladeTop - 8, x1 - x0 - 14, PIN.bladeH + 10);
    this.xs.forEach((x, i) =>
      drawChamberPlug(
        g,
        {
          x,
          top: PIN.chamberTop,
          shear: PIN.shear,
          tip: tips[i],
          keyLen: this.keyLens[i],
          driverLen: PIN.driverLen,
          width: PIN.pinW,
          status: stat(i),
          hl: showHl && this.status[i] === 'low',
        },
        PIN.plugBottom,
      ),
    );
    if (inKey) this.key.drawKey(g, p.ox, PIN.bladeTop + p.dy, { editing: false, showCode: false });
    g.restore();

    // shear line
    const success = this.phase === 'turning' || this.phase === 'open';
    g.save();
    g.strokeStyle = success ? C.ok : C.shear;
    g.globalAlpha = success ? 1 : 0.8;
    g.lineWidth = success ? 2.5 : 1.5;
    g.setLineDash(success ? [] : [6, 4]);
    g.beginPath();
    g.moveTo(x0 - 6, PIN.shear);
    g.lineTo(x1 + 6, PIN.shear);
    g.stroke();
    g.restore();
    text(g, 'シアライン', x1 - 2, PIN.shear - 8, { size: 9, color: success ? C.ok : C.shear, align: 'right' });

    // highlight blocked chambers at shear line
    if (showHl) {
      this.xs.forEach((x, i) => {
        if (this.status[i] === 'ok') return;
        g.save();
        g.strokeStyle = C.bad;
        g.lineWidth = 2;
        g.shadowColor = C.bad;
        g.shadowBlur = 8;
        g.strokeRect(x - PIN.pinW / 2 - 4, PIN.shear - 6, PIN.pinW + 8, 12);
        g.restore();
      });
    }

    if (this.phase === 'edit' && this.cfg.ghost) this.drawGhost(g);
    if (this.phase === 'edit' && !this.cfg.ghost && this.vis === 'full') {
      const rest = PIN.plugBottom - 12;
      const ys = Array.from({ length: this.key.maxDepth + 1 }, (_, k) => rest - (PIN.bladeTop + k * PIN.step - PIN.shear));
      drawGauge(g, x0 + 4, x1 - 16, ys);
    }

    if (this.vis === 'window') {
      drawCover(g, x0, PIN.chamberTop - 6, x1 - x0, PIN.shear - 16 - (PIN.chamberTop - 6));
      drawCover(g, x0, PIN.shear + 16, x1 - x0, PIN.bladeTop - 10 - (PIN.shear + 16));
      text(g, 'のぞき窓', x0 + 30, PIN.shear + 24, { size: 9, color: C.sub });
    } else if (this.vis === 'hidden') {
      drawCover(g, x0, PIN.chamberTop - 6, x1 - x0, PIN.plugBottom - PIN.chamberTop + 6, '内部は見えない');
    }

    // plug face
    g.fillStyle = '#556476';
    g.fillRect(x0 - 8, PIN.shear - 2, 8, PIN.plugBottom - PIN.shear + 4);

    drawFrontInset(g, W - 46, 44, 20, this.angle + (this.phase === 'turnFail' ? 0 : 0));
    if (this.phase === 'open') drawOpenStamp(g, W / 2, 200, this.openT);
    if (!inKey) {
      // key traveling / in editor
      if (this.insert > 0) this.key.drawKey(g, p.ox, PIN.bladeTop + p.dy, { editing: false, showCode: false });
    }
  }

  /** translucent preview of key pin tops for the key as currently cut */
  protected drawGhost(g: G) {
    this.xs.forEach((x, i) => {
      const cut = this.key.drag && this.key.drag.i === i ? this.key.drag.val : this.key.top[i];
      const top = PIN.bladeTop + cut * PIN.step - this.keyLens[i];
      const ok = Math.abs(top - PIN.shear) < 0.5;
      g.save();
      g.globalAlpha = 0.9;
      g.strokeStyle = ok ? C.ok : 'rgba(243,207,122,0.9)';
      g.setLineDash(ok ? [] : [3, 2]);
      g.lineWidth = 2;
      g.strokeRect(x - PIN.pinW / 2 - 2, top, PIN.pinW + 4, this.keyLens[i]);
      g.restore();
      if (ok) text(g, '✓', x, top - 10, { size: 12, color: C.ok, weight: '800' });
    });
    text(g, '点線＝今の鍵を差したときの下ピン位置', PIN.face + 4, PIN.bodyBottom + 14, { size: 10, color: C.brassLight, align: 'left' });
  }

  protected drawEditor(g: G) {
    const ed = this.phase === 'edit';
    drawDivider(g, 372, W, ed ? '鍵の加工台' : '');
    if (ed) {
      // guides from chambers
      g.save();
      g.strokeStyle = 'rgba(255,204,51,0.12)';
      g.setLineDash([2, 5]);
      this.xs.forEach((x) => {
        g.beginPath();
        g.moveTo(x, PIN.bodyBottom + 4);
        g.lineTo(x, PIN.editTop - 40);
        g.stroke();
      });
      g.restore();
      this.key.drawKey(g, 0, PIN.editTop, { editing: true, showCode: true });
      text(g, 'キーコード（深さ）', 64, PIN.editTop + PIN.bladeH + 40, { size: 10, color: C.sub, align: 'left' });
    }
  }
}
