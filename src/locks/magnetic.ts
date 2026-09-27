import { type EvalResult, type Host, type Visibility, W } from '../core/mechanism';
import { C, type G, text, easeInOut, seg } from '../core/draw';
import { sfx } from '../core/sfx';
import { PinLock, PIN, type PinCfg } from './pin';
import { drawDivider } from './housing';

export type Pole = 'N' | 'S' | null;

export interface MagCfg extends PinCfg {
  /** required magnet per position: 'N', 'S' or null (no magnet allowed) */
  mags: Pole[];
}

const ROT_Y = 360;
const MAG_Y = PIN.editTop + PIN.bladeH - 11;

/**
 * Pin tumbler + magnetic sidebar. Each position also has a small magnetic
 * rotor; the key's embedded magnet turns it. Only when every rotor's gate
 * faces up (and every pin is at the shear line) can the plug turn.
 */
export class MagneticLock extends PinLock {
  mags: Pole[];
  rotStatus: ('ok' | 'bad')[] = [];

  constructor(
    host: Host,
    vis: Visibility,
    public mcfg: MagCfg,
  ) {
    super(host, vis, { ...mcfg, maxDepth: mcfg.maxDepth ?? 4 });
    this.mags = mcfg.mags.map(() => null);
  }

  isPristine() {
    return super.isPristine() && this.mags.every((m) => m === null);
  }
  newBlank() {
    super.newBlank();
    this.mags = this.mags.map(() => null);
    this.rotStatus = [];
  }

  evaluate(): EvalResult {
    const pin = super.evaluate();
    this.rotStatus = this.mcfg.mags.map((m, i) => (this.mags[i] === m ? 'ok' : 'bad'));
    const badRot = this.rotStatus.filter((s) => s === 'bad').length;
    if (pin.ok && !badRot) return { ok: true };
    const parts: string[] = [];
    const badPins = this.status.filter((s) => s !== 'ok').length;
    if (badPins) parts.push(`ピン${badPins}本`);
    if (badRot) parts.push(`磁気ローター${badRot}個`);
    return { ok: false, stopAt: 0.05, msg: `${parts.join('と')}が揃っていない` };
  }

  /** rotor angle (rad): 0 = rest (N left). Gate position depends on rotor type. */
  rotorAngle(i: number) {
    const k = this.insert <= 0 ? 0 : easeInOut(seg(this.insert, 0.55 + i * 0.05, 0.8 + i * 0.03));
    const m = this.mags[i];
    // N below pulls S down → N up: N was at left (−x); rotate +90° (cw) puts N at top
    const target = m === 'N' ? Math.PI / 2 : m === 'S' ? -Math.PI / 2 : 0;
    return target * k;
  }

  gateOffset(i: number) {
    const need = this.mcfg.mags[i];
    // gate location on rotor in rest frame: N end = left (π), S end = right (0), none = top (−π/2)
    return need === 'N' ? Math.PI : need === 'S' ? 0 : -Math.PI / 2;
  }

  pointerDown(x: number, y: number) {
    if (!this.editable) return;
    const i = this.xs.findIndex((xx) => Math.abs(xx - x) < 14);
    if (i >= 0 && Math.abs(y - MAG_Y) < 12) {
      const cur = this.mags[i];
      this.mags[i] = cur === null ? 'N' : cur === 'N' ? 'S' : null;
      this.rotStatus = [];
      sfx.magnet();
      this.host.changed();
      return;
    }
    super.pointerDown(x, y);
  }

  draw(g: G) {
    super.draw(g);
    this.drawRotors(g);
    if (this.phase === 'edit') this.drawKeyMagnets(g, 0, PIN.editTop);
  }

  protected drawEditor(g: G) {
    const ed = this.phase === 'edit';
    drawDivider(g, 428, W, ed ? '鍵の加工台（山を削る＋磁石をタップで N→S→なし）' : '');
    if (ed) this.key.drawKey(g, 0, PIN.editTop, { editing: true, showCode: true });
  }

  drawKeyMagnets(g: G, ox: number, topY: number) {
    const y = topY + PIN.bladeH - 11;
    this.xs.forEach((x, i) => {
      const m = this.mags[i];
      g.beginPath();
      g.arc(x + ox, y, 7.5, 0, Math.PI * 2);
      if (m) {
        g.fillStyle = m === 'N' ? C.magN : C.magS;
        g.fill();
        text(g, m, x + ox, y + 0.5, { size: 9, color: '#fff', weight: '900' });
      } else {
        g.strokeStyle = 'rgba(60,70,85,0.6)';
        g.setLineDash([2, 2]);
        g.stroke();
        g.setLineDash([]);
      }
      const st = this.rotStatus[i];
      if (st === 'bad' && this.phase === 'edit') text(g, '✕', x + ox + 12, y - 6, { size: 10, color: C.bad, weight: '800' });
    });
  }

  drawRotors(g: G) {
    const success = this.phase === 'turning' || this.phase === 'open';
    const showHl = this.feedback && this.vis !== 'hidden';
    // sidebar
    g.fillStyle = C.shellDark;
    g.fillRect(PIN.face, ROT_Y - 30, W - 28 - PIN.face, 58);
    const drop = success ? seg(this.turn, 0, 0.3) * 6 : 0;
    g.fillStyle = success ? C.ok : C.brass;
    g.globalAlpha = 0.9;
    g.fillRect(PIN.face + 4, ROT_Y - 26 + drop, W - 36 - PIN.face, 5);
    g.globalAlpha = 1;
    text(g, '磁気ローター：黄線＝切り欠き（真上を向けばOK）', PIN.face + 2, ROT_Y + 38, { size: 9, color: C.shear, align: 'left' });
    this.xs.forEach((x, i) => {
      const a = this.rotorAngle(i);
      const r = 14;
      g.save();
      g.translate(x, ROT_Y);
      g.rotate(a);
      // N half (left) / S half (right) in rest frame
      g.fillStyle = C.magN;
      g.beginPath();
      g.arc(0, 0, r, Math.PI / 2, (Math.PI * 3) / 2);
      g.fill();
      g.fillStyle = C.magS;
      g.beginPath();
      g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
      g.fill();
      // gate notch
      const go = this.gateOffset(i);
      g.fillStyle = C.shellDark;
      g.beginPath();
      g.arc(Math.cos(go) * r, Math.sin(go) * r, 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = C.shear;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(Math.cos(go) * (r - 5), Math.sin(go) * (r - 5));
      g.lineTo(Math.cos(go) * (r + 5), Math.sin(go) * (r + 5));
      g.stroke();
      g.restore();
      g.save();
      g.translate(x, ROT_Y);
      g.rotate(a);
      text(g, 'N', -6.5, 0.5, { size: 9, color: '#fff', weight: '900' });
      text(g, 'S', 6.5, 0.5, { size: 9, color: '#fff', weight: '900' });
      g.restore();
      if (showHl && this.rotStatus[i] === 'bad') {
        g.strokeStyle = C.bad;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, ROT_Y, r + 4, 0, Math.PI * 2);
        g.stroke();
      }
    });
    if (this.vis === 'hidden') {
      g.fillStyle = '#323d4a';
      g.fillRect(PIN.face, ROT_Y - 30, W - 28 - PIN.face, 58);
    }
  }
}
