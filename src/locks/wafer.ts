import { Mechanism, type EvalResult, type Host, type Visibility, W } from '../core/mechanism';
import { C, type G, text, rr, hgrad } from '../core/draw';
import { sfx } from '../core/sfx';
import { BladeKey } from './bladekey';
import { keyPose } from './pinview';
import { drawFrontInset, drawOpenStamp, drawCover, drawGridBg, drawDivider } from './housing';

export interface WaferCfg {
  /** per wafer: [side, depth] side 't' = spring pushes down, key's top edge lifts it; 'b' = pushed up, bottom edge lowers it */
  wafers: ['t' | 'b', number][];
  ghost?: boolean;
}

const L = {
  face: 40,
  x1: 360,
  houseTop: 112,
  plugTop: 176,
  plugBot: 281,
  houseBot: 345,
  bladeTop: 196,
  bladeH: 50,
  step: 5,
  maxD: 5,
  editTop: 470,
  waferW: 16,
  chan: 32,
  drop: 24,
};

type St = 'ok' | 'high' | 'low';

export class WaferLock extends Mechanism {
  key: BladeKey;
  xs: number[];
  sp: number;
  topIdx: number[] = [];
  botIdx: number[] = [];
  status: St[] = [];
  private lastY: number[];

  constructor(
    host: Host,
    vis: Visibility,
    public cfg: WaferCfg,
  ) {
    super(host, vis);
    const n = cfg.wafers.length;
    this.sp = n <= 4 ? 56 : n === 5 ? 48 : n === 6 ? 42 : 38;
    this.xs = cfg.wafers.map((_, i) => L.face + 50 + i * this.sp);
    cfg.wafers.forEach((w, i) => (w[0] === 't' ? this.topIdx : this.botIdx).push(i));
    const xsT = this.topIdx.map((i) => this.xs[i]);
    const xsB = this.botIdx.length ? this.botIdx.map((i) => this.xs[i]) : null;
    this.key = new BladeKey(xsT, xsB, L.maxD, L.step, L.face - 4, this.xs[n - 1] + 34, L.bladeH);
    this.lastY = this.xs.map(() => 0);
  }

  isPristine() {
    return this.key.pristine();
  }
  newBlank() {
    this.key.reset();
    this.feedback = false;
  }

  pose() {
    return keyPose(this.insert, this.key.tipX, L.face, L.editTop - L.bladeTop);
  }

  cutOf(i: number) {
    const [side] = this.cfg.wafers[i];
    return side === 't' ? this.key.top[this.topIdx.indexOf(i)] : this.key.bottom![this.botIdx.indexOf(i)];
  }

  /** wafer top y given key pose */
  waferTop(i: number, ox: number, inKeyway: boolean): number {
    const [side, c] = this.cfg.wafers[i];
    const P = L.plugBot - L.plugTop;
    const rest = side === 't' ? L.plugTop + L.drop : L.plugTop - L.drop;
    if (!inKeyway) return rest;
    const u = this.xs[i] - ox;
    if (u < this.key.bladeX0 || u > this.key.tipX) return rest;
    if (side === 't') {
      const w = L.bladeTop + c * L.step - L.plugTop; // window top offset
      const surf = L.bladeTop + Math.min(L.bladeH * 0.8, this.key.depthAt(u, 'top', false));
      return Math.min(rest, surf - w);
    } else {
      const v = L.plugBot - (L.bladeTop + L.bladeH - c * L.step);
      const tipD = u > this.key.tipX - 16 ? (u - (this.key.tipX - 16)) * 1.35 : 0;
      const surf = L.bladeTop + L.bladeH - Math.max(tipD, this.key.depthAt(u, 'bottom', false));
      const bottom = surf + v;
      return Math.max(rest, bottom - P);
    }
  }

  evaluate(): EvalResult {
    this.status = this.cfg.wafers.map(([side, c], i) => {
      const k = this.cutOf(i);
      if (k === c) return 'ok';
      // for 't' wafers: too shallow → wafer too high. for 'b' wafers: too shallow → wafer too low
      return side === 't' ? (k < c ? 'high' : 'low') : k < c ? 'low' : 'high';
    });
    const bad = this.status.filter((s) => s !== 'ok').length;
    if (!bad) return { ok: true };
    return { ok: false, stopAt: 0.05, msg: `${bad}枚のウェハーが内筒からはみ出していて回らない` };
  }

  protected onFailed() {
    const imp = this.vis === 'hidden';
    const markOf = (i: number) => {
      const s = this.status[i];
      const [side] = this.cfg.wafers[i];
      const shallow = side === 't' ? s === 'high' : s === 'low';
      if (imp) return shallow ? ('imp' as const) : null;
      return s === 'ok' ? ('ok' as const) : shallow ? ('high' as const) : ('low' as const);
    };
    this.key.marksTop = this.topIdx.map(markOf);
    this.key.marksBottom = this.botIdx.map(markOf);
  }

  protected onInsertStep() {
    const p = this.pose();
    this.xs.forEach((_, i) => {
      const y = this.waferTop(i, p.ox, p.inKeyway);
      if (Math.abs(y - this.lastY[i]) > 3) {
        sfx.tick(0.2 + i * 0.08, 0.07);
        this.lastY[i] = y;
      }
    });
  }

  coach(): string | null {
    if (!this.cfg.ghost || this.phase !== 'edit') return null;
    const okN = this.cfg.wafers.filter(([, c], i) => this.cutOf(i) === c).length;
    if (okN === this.cfg.wafers.length) return 'すべてのウェハーが内筒の中に収まった！「差し込む」を押そう';
    return `点線枠（ウェハー）が上下の黄色い線の内側にぴったり収まるまで削ろう（${okN}/${this.cfg.wafers.length}）`;
  }

  pointerDown(x: number, y: number) {
    if (!this.editable) return;
    this.key.down(x, y, 0, L.editTop, this.sp);
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

  draw(g: G) {
    drawGridBg(g, W, 660);
    const p = this.pose();
    const x0 = L.face;
    const x1 = L.x1;
    const ang = (this.turn * Math.PI) / 2;
    const inKey = this.insert > 0 && p.inKeyway;
    // housing
    g.fillStyle = C.shell;
    rr(g, x0 - 12, L.houseTop - 20, x1 - x0 + 24, L.houseBot - L.houseTop + 40, 12);
    g.fill();
    g.strokeStyle = C.shellEdge;
    g.stroke();
    // broaching channels
    this.xs.forEach((x) => {
      g.fillStyle = C.cavity;
      g.fillRect(x - L.waferW / 2 - 3, L.plugTop - L.chan, L.waferW + 6, L.chan);
      g.fillRect(x - L.waferW / 2 - 3, L.plugBot, L.waferW + 6, L.chan);
    });
    text(g, '溝（ブローチ）', x1 - 4, L.plugTop - L.chan - 8, { size: 9, color: C.sub, align: 'right' });

    const axis = (L.plugTop + L.plugBot) / 2;
    const s = Math.max(0.03, Math.cos(ang));
    const showHl = this.feedback && this.vis !== 'hidden';
    const P = L.plugBot - L.plugTop;

    // plug
    g.save();
    g.fillStyle = C.plug;
    g.fillRect(x0, L.plugTop, x1 - x0, P);
    const sh = g.createLinearGradient(0, L.plugTop, 0, L.plugBot);
    sh.addColorStop(0, 'rgba(255,255,255,0.18)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = sh;
    g.fillRect(x0, L.plugTop, x1 - x0, P);
    g.translate(0, axis);
    g.scale(1, s);
    g.translate(0, -axis);
    g.fillStyle = C.cavity;
    g.fillRect(x0, L.bladeTop - 6, x1 - x0 - 12, L.bladeH + 12);
    this.xs.forEach((x) => {
      g.fillRect(x - L.waferW / 2 - 2, L.plugTop, L.waferW + 4, P);
    });
    if (inKey) this.key.drawKey(g, p.ox, L.bladeTop + p.dy, { editing: false, showCode: false });
    // wafers
    this.xs.forEach((x, i) => {
      const [side, c] = this.cfg.wafers[i];
      const top = this.waferTop(i, p.ox, p.inKeyway);
      const wx = x - L.waferW / 2;
      const bad = showHl && this.status[i] !== 'ok';
      // window
      let wt: number;
      let wb: number;
      if (side === 't') {
        wt = L.bladeTop + c * L.step - L.plugTop;
        wb = Math.min(P - 6, wt + L.bladeH + 8);
      } else {
        const v = L.plugBot - (L.bladeTop + L.bladeH - c * L.step);
        wb = P - v;
        wt = Math.max(6, wb - L.bladeH - 8);
      }
      g.fillStyle = hgrad(g, wx, wx + L.waferW, bad ? [[0, '#7f1d1d'], [0.4, '#fca5a5'], [1, '#991b1b']] : [[0, C.brassDark], [0.35, C.brassLight], [1, C.brassDark]]);
      g.beginPath();
      g.rect(wx, top, L.waferW, P);
      g.rect(wx + 3, top + wt, L.waferW - 6, wb - wt);
      g.fill('evenodd');
      // contact edge accent
      g.fillStyle = side === 't' ? '#fff3c4' : '#bfe6ff';
      g.fillRect(wx + 3, side === 't' ? top + wt : top + wb - 2, L.waferW - 6, 2);
      // spring indicator
      g.strokeStyle = C.spring;
      g.lineWidth = 1.2;
      const sy = side === 't' ? top + 6 : top + P - 6;
      g.beginPath();
      g.moveTo(wx + L.waferW + 1, sy);
      for (let k = 0; k < 4; k++) g.lineTo(wx + L.waferW + (k % 2 ? 1 : 5), sy + (side === 't' ? 3 : -3) * (k + 1));
      g.stroke();
    });
    g.restore();

    // plug boundaries (shear lines)
    const success = this.phase === 'turning' || this.phase === 'open';
    g.save();
    g.strokeStyle = success ? C.ok : C.shear;
    g.lineWidth = success ? 2.5 : 1.5;
    g.setLineDash(success ? [] : [6, 4]);
    g.beginPath();
    g.moveTo(x0 - 6, L.plugTop);
    g.lineTo(x1 + 6, L.plugTop);
    g.moveTo(x0 - 6, L.plugBot);
    g.lineTo(x1 + 6, L.plugBot);
    g.stroke();
    g.restore();
    text(g, '内筒の外周', x0 + 2, L.plugBot + L.chan + 10, { size: 9, color: success ? C.ok : C.shear, align: 'left' });

    if (showHl) {
      this.xs.forEach((x, i) => {
        if (this.status[i] === 'ok') return;
        const top = this.waferTop(i, p.ox, p.inKeyway);
        const y = top < L.plugTop ? L.plugTop : L.plugBot;
        g.save();
        g.strokeStyle = C.bad;
        g.shadowColor = C.bad;
        g.shadowBlur = 8;
        g.lineWidth = 2;
        g.strokeRect(x - L.waferW / 2 - 4, y - 6, L.waferW + 8, 12);
        g.restore();
      });
    }

    if (this.phase === 'edit' && this.cfg.ghost) {
      this.xs.forEach((x, i) => {
        const [side, c] = this.cfg.wafers[i];
        const k = this.previewCut(i);
        const off = (k - c) * L.step * (side === 't' ? 1 : -1);
        const top = L.plugTop + off;
        const ok = k === c;
        g.save();
        g.strokeStyle = ok ? C.ok : 'rgba(243,207,122,0.9)';
        g.setLineDash(ok ? [] : [3, 2]);
        g.lineWidth = 2;
        g.strokeRect(x - L.waferW / 2 - 2, top, L.waferW + 4, P);
        g.restore();
      });
      text(g, '点線＝今の鍵を差したときのウェハー位置', x0, L.houseBot + 34, { size: 10, color: C.brassLight, align: 'left' });
    }

    if (this.vis === 'window') {
      drawCover(g, x0 - 12, L.houseTop - 20, x1 - x0 + 24, L.plugTop - 14 - (L.houseTop - 20));
      drawCover(g, x0 - 12, L.plugTop + 14, x1 - x0 + 24, L.plugBot - 14 - (L.plugTop + 14));
      drawCover(g, x0 - 12, L.plugBot + 14, x1 - x0 + 24, L.houseBot + 20 - (L.plugBot + 14));
    } else if (this.vis === 'hidden') {
      drawCover(g, x0 - 12, L.houseTop - 20, x1 - x0 + 24, L.houseBot - L.houseTop + 40, '内部は見えない');
    }

    // cam at the back
    const camX = x1 + 14;
    g.save();
    g.fillStyle = C.steel;
    const camLen = 46 * Math.cos(ang);
    g.fillRect(camX - 5, axis, 10, camLen + 4);
    g.fillRect(camX - 5, axis - 4, 10, 8);
    g.restore();

    drawFrontInset(g, W - 46, 40, 20, ang);
    if (this.phase === 'open') drawOpenStamp(g, W / 2, 228, this.openT);
    if (!inKey && this.insert > 0) this.key.drawKey(g, p.ox, L.bladeTop + p.dy, { editing: false, showCode: false });

    // editor
    const ed = this.phase === 'edit';
    drawDivider(g, 400, W, ed ? '鍵の加工台' : '');
    if (ed) {
      g.save();
      g.setLineDash([2, 5]);
      this.xs.forEach((x, i) => {
        g.strokeStyle = this.cfg.wafers[i][0] === 't' ? 'rgba(255,204,51,0.14)' : 'rgba(125,211,252,0.2)';
        g.beginPath();
        g.moveTo(x, L.houseBot + 22);
        g.lineTo(x, L.editTop - 40);
        g.stroke();
      });
      g.restore();
      this.key.drawKey(g, 0, L.editTop, { editing: true, showCode: true });
      if (this.botIdx.length) {
        text(g, '上の刻み＝上辺 ／ 青い数字＝下辺', W / 2, L.editTop + L.bladeH + 64, { size: 10, color: C.sub });
      }
    }
  }

  previewCut(i: number) {
    const [side] = this.cfg.wafers[i];
    const d = this.key.drag;
    if (side === 't') {
      const j = this.topIdx.indexOf(i);
      return d && d.edge === 'top' && d.i === j ? d.val : this.key.top[j];
    }
    const j = this.botIdx.indexOf(i);
    return d && d.edge === 'bottom' && d.i === j ? d.val : this.key.bottom![j];
  }
}
