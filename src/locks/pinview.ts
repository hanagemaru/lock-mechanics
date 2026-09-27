import { C, type G, pinFill, spring, rr, easeInOut, seg, lerp } from '../core/draw';
import { type Rot, drawBore3D, drawPin3D } from '../core/turn3d';

/** Pose of a key traveling from the editor into the keyway, driven by insert∈[0,1]. */
export function keyPose(insert: number, tipX: number, faceX: number, editDY: number) {
  const outX = faceX - 8 - tipX;
  const a = easeInOut(seg(insert, 0, 0.2));
  const b = easeInOut(seg(insert, 0.2, 0.34));
  const c = seg(insert, 0.34, 1);
  const cEase = c < 1 ? 1 - Math.pow(1 - c, 1.6) : 1;
  let ox = lerp(0, outX, a);
  if (c > 0) ox = lerp(outX, 0, cEase);
  const dy = lerp(editDY, 0, b);
  return { ox, dy, inKeyway: b >= 1 };
}

export type PinStatus = 'ok' | 'high' | 'low';

export interface ChamberDraw {
  x: number;
  /** y of chamber ceiling */
  top: number;
  /** y of the shear line */
  shear: number;
  /** y of the key pin tip */
  tip: number;
  keyLen: number;
  driverLen: number;
  width: number;
  status?: PinStatus | null;
  /** extra master pin segment length */
  masterLen?: number;
  /** rotation projection factor for plug part */
  plugScale?: number;
  axis?: number;
  hl?: boolean;
}

/** Draws a spring / driver / key pin stack in a vertical chamber (shell part). */
export function drawChamberShell(g: G, c: ChamberDraw) {
  const w = c.width;
  const x0 = c.x - w / 2;
  // bore
  g.fillStyle = C.cavity;
  g.fillRect(x0 - 2, c.top, w + 4, c.shear - c.top);
  const keyTop = c.tip - c.keyLen;
  const drvBottom = keyTop - (c.masterLen ?? 0);
  const drvTop = drvBottom - c.driverLen;
  spring(g, c.x, c.top + 2, drvTop, w * 0.8, 7);
  // driver
  g.save();
  g.beginPath();
  g.rect(x0 - 3, c.top, w + 6, c.shear - c.top);
  g.clip();
  const drvKind = c.status && c.status === 'low' && c.hl ? 'red' : 'steel';
  g.fillStyle = pinFill(g, x0, w, drvKind);
  rr(g, x0, drvTop, w, c.driverLen, 3);
  g.fill();
  // key pin part above shear (overset)
  if (keyTop < c.shear) {
    g.fillStyle = pinFill(g, x0, w, c.status === 'high' && c.hl ? 'red' : 'brass');
    rr(g, x0, keyTop, w, c.shear - keyTop + 4, 3);
    g.fill();
  }
  if (c.masterLen) {
    g.fillStyle = pinFill(g, x0, w, 'green');
    g.fillRect(x0, drvBottom, w, c.masterLen);
  }
  g.restore();
}

/** Key pin + plug bore (drawn inside the plug transform). */
export function drawChamberPlug(g: G, c: ChamberDraw, plugBottom: number) {
  const w = c.width;
  const x0 = c.x - w / 2;
  g.fillStyle = C.cavity;
  g.fillRect(x0 - 2, c.shear, w + 4, plugBottom - c.shear - 8);
  const keyTop = c.tip - c.keyLen;
  g.save();
  g.beginPath();
  g.rect(x0 - 3, c.shear, w + 6, 400);
  g.clip();
  // driver part below shear (under-lifted)
  const drvBottom = keyTop - (c.masterLen ?? 0);
  if (drvBottom > c.shear) {
    g.fillStyle = pinFill(g, x0, w, c.hl ? 'red' : 'steel');
    rr(g, x0, c.shear - 6, w, drvBottom - c.shear + 6, 3);
    g.fill();
  }
  if (c.masterLen && keyTop > c.shear) {
    g.fillStyle = pinFill(g, x0, w, 'green');
    g.fillRect(x0, Math.max(c.shear, drvBottom), w, keyTop - Math.max(c.shear, drvBottom));
  }
  // key pin with pointed tip
  g.fillStyle = pinFill(g, x0, w, 'brass');
  g.beginPath();
  g.moveTo(x0, keyTop + 3);
  g.quadraticCurveTo(x0, keyTop, x0 + 3, keyTop);
  g.lineTo(x0 + w - 3, keyTop);
  g.quadraticCurveTo(x0 + w, keyTop, x0 + w, keyTop + 3);
  g.lineTo(x0 + w, c.tip - w * 0.45);
  g.lineTo(c.x + 1.5, c.tip);
  g.lineTo(c.x - 1.5, c.tip);
  g.lineTo(x0, c.tip - w * 0.45);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(60,40,0,0.5)';
  g.lineWidth = 0.8;
  g.stroke();
  g.restore();
}

/** pin bore in the plug section face, from the shear line down into the keyway */
export function drawPlugBore3D(g: G, r: Rot, c: ChamberDraw, keywayTop: number) {
  drawBore3D(g, r, c.x, c.width + 4, c.shear, keywayTop + 2);
}

/** key pin (and an under-lifted driver) projected with the plug rotation */
export function drawChamberPlug3D(g: G, r: Rot, c: ChamberDraw) {
  const w = c.width;
  const keyTop = c.tip - c.keyLen;
  if (keyTop > c.shear) drawPin3D(g, r, c.x, w, c.shear - 6, keyTop, c.hl ? 'red' : 'steel', false);
  drawPin3D(g, r, c.x, w, Math.max(keyTop, c.shear - 30), c.tip, 'brass', true);
}
