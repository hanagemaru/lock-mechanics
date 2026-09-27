// Pseudo-3D helpers for drawing a cylinder plug that turns about a horizontal
// axis in the side cutaway view. Content is described in "plug frame"
// coordinates (y as drawn at rest, z = depth toward the viewer) and projected
// orthographically after rotating by `ang` about the axis line y = axis.
//
//   Y = axis + (y - axis)·cos(ang) + z·sin(ang)
//
// so things above the axis tilt toward the viewer and reveal their top faces.

import { C, type G, clamp, pinFill, easeInOut } from './draw';
import { sfx } from './sfx';

export interface Rot {
  axis: number;
  ang: number;
  c: number;
  s: number;
}

export function rot(axis: number, ang: number): Rot {
  // keep a sliver of height so edge-on layers still rasterise into a solid band
  return { axis, ang, c: Math.max(0.035, Math.cos(ang)), s: Math.sin(ang) };
}

export const projY = (r: Rot, y: number, z = 0) => r.axis + (y - r.axis) * r.c + z * r.s;

/** run `fn` with a transform so plug-frame drawing at depth z is projected */
export function layer(g: G, r: Rot, z: number, fn: () => void) {
  g.save();
  g.translate(0, r.axis + z * r.s);
  g.scale(1, r.c);
  g.translate(0, -r.axis);
  fn();
  g.restore();
}

/**
 * Extrude a flat shape between depths z0 (back) and z1 (front): side layers
 * are filled with `side`, then `front` draws the front face. Gives thin parts
 * (key blades, wafers) a visible edge as they tilt.
 */
export function extrude(g: G, r: Rot, z0: number, z1: number, path: () => void, side: string | CanvasGradient, front: () => void) {
  const span = Math.abs((z1 - z0) * r.s);
  if (span >= 0.5) {
    const n = Math.ceil(span / 0.5);
    for (let k = 0; k < n; k++) {
      const z = z0 + ((z1 - z0) * k) / n;
      layer(g, r, z, () => {
        path();
        g.fillStyle = side;
        g.fill();
      });
    }
  }
  layer(g, r, z1, front);
}

/** turn easing: slow take-up, smooth swing, tiny overshoot and settle */
export function turnEase(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const k = 0.86;
  if (t < k) return 1.035 * easeInOut(t / k);
  return 1.035 - 0.035 * easeInOut((t - k) / (1 - k));
}

/** light factor 0..1 for a surface whose plug-frame normal is (ny, nz) */
export function lit(r: Rot, ny: number, nz: number) {
  const Y = ny * r.c + nz * r.s;
  const Z = -ny * r.s + nz * r.c;
  // light from upper front
  return clamp(-0.55 * Y + 0.83 * Z, 0, 1);
}

/**
 * Plug body: a cylinder between y = top..bot. The sectioned face (the cutaway
 * plane) tilts away with the turn while the rounded outer surface, with
 * machining lines that roll past, comes into view.
 */
export function drawPlugBody(g: G, r: Rot, x0: number, x1: number, top: number, bot: number) {
  const R = (bot - top) / 2;
  // rounded surface
  g.fillStyle = C.plug;
  g.fillRect(x0, top, x1 - x0, bot - top);
  const sh = g.createLinearGradient(0, top, 0, bot);
  sh.addColorStop(0, 'rgba(255,255,255,0.28)');
  sh.addColorStop(0.35, 'rgba(255,255,255,0.05)');
  sh.addColorStop(0.75, 'rgba(0,0,0,0.25)');
  sh.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = sh;
  g.fillRect(x0, top, x1 - x0, bot - top);
  if (r.ang > 0.001) {
    // machining lines parallel to the axis rolling around the surface
    const N = 18;
    g.save();
    g.lineWidth = 1;
    for (let k = 0; k < N; k++) {
      const psi = (k / N) * Math.PI * 2 + r.ang;
      const z = Math.sin(psi);
      if (z <= 0.05) continue;
      const y = r.axis - R * Math.cos(psi);
      g.strokeStyle = k % 3 === 0 ? `rgba(20,28,37,${0.45 * z})` : `rgba(230,238,246,${0.16 * z})`;
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      g.stroke();
    }
    g.restore();
  }
  // section face
  const fy0 = projY(r, top);
  const fy1 = projY(r, bot);
  g.fillStyle = C.plug;
  g.fillRect(x0, fy0, x1 - x0, fy1 - fy0);
  const face = g.createLinearGradient(0, fy0, 0, fy1);
  face.addColorStop(0, 'rgba(255,255,255,0.16)');
  face.addColorStop(0.5, 'rgba(255,255,255,0)');
  face.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = face;
  g.fillRect(x0, fy0, x1 - x0, fy1 - fy0);
  const dark = 1 - lit(r, 0, 1) / lit(rot(r.axis, 0), 0, 1);
  if (dark > 0.01) {
    g.fillStyle = `rgba(8,12,18,${0.6 * dark})`;
    g.fillRect(x0, fy0, x1 - x0, fy1 - fy0);
  }
  if (r.ang > 0.001) {
    // crisp edges where the section face meets the rounded surface
    g.fillStyle = 'rgba(220,232,245,0.55)';
    g.fillRect(x0, fy0 - 0.5, x1 - x0, 1.2);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(x0, fy1 - 0.6, x1 - x0, 1.2);
  }
}

/**
 * A round pin (key pin) standing in the section plane from yTop down to a
 * pointed tip at yTip, projected as a cylinder: the flat top end shows as an
 * ellipse once the plug tilts.
 */
export function drawPin3D(
  g: G,
  r: Rot,
  x: number,
  w: number,
  yTop: number,
  yTip: number,
  kind: 'brass' | 'steel' | 'red' | 'green',
  pointed = true,
) {
  const a = w / 2;
  const e = a * Math.abs(r.s);
  const x0 = x - a;
  const Yt = projY(r, yTop);
  const shoulder = pointed ? yTip - w * 0.45 : yTip;
  const Ys = projY(r, shoulder);
  const Yb = projY(r, yTip);
  g.fillStyle = pinFill(g, x0, w, kind);
  g.beginPath();
  g.moveTo(x0, Yt);
  g.lineTo(x0, Ys);
  if (pointed) {
    g.lineTo(x - 1.5, Yb);
    g.lineTo(x + 1.5, Yb);
  } else if (e > 0.4) {
    g.ellipse(x, Ys, a, e, 0, Math.PI, 0, true);
  }
  g.lineTo(x + a, Ys);
  g.lineTo(x + a, Yt);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(60,40,0,0.45)';
  g.lineWidth = 0.8;
  g.stroke();
  if (pointed && e > 0.4) {
    // rounded underside of the shoulder where the cone starts
    g.beginPath();
    g.ellipse(x, Ys, a, e, 0, 0, Math.PI);
    g.fill();
  }
  if (e > 0.4) {
    // flat end face
    const pal = kind === 'brass' ? ['#fbe3a4', '#c79332'] : kind === 'steel' ? ['#f4f7fa', '#8f9baa'] : kind === 'red' ? ['#fecaca', '#b91c1c'] : ['#bbf7d0', '#15803d'];
    const gr = g.createLinearGradient(x0, Yt - e, x + a, Yt + e);
    gr.addColorStop(0, pal[0]);
    gr.addColorStop(1, pal[1]);
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(x, Yt, a, e, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(40,30,0,0.35)';
    g.stroke();
  }
}

/** a round bore (hole) in the section face, seen at an angle */
export function drawBore3D(g: G, r: Rot, x: number, w: number, y0: number, y1: number) {
  const a = w / 2;
  const e = a * Math.abs(r.s);
  const Y0 = projY(r, y0);
  const Y1 = projY(r, y1);
  g.fillStyle = C.cavity;
  g.beginPath();
  g.moveTo(x - a, Y0);
  g.lineTo(x - a, Y1);
  g.ellipse(x, Y1, a, e, 0, Math.PI, 0, true);
  g.lineTo(x + a, Y0);
  g.ellipse(x, Y0, a, e, 0, 0, Math.PI, true);
  g.closePath();
  g.fill();
}

/** layered depth for extruded key blades etc. */
export const KEY_T = 9;

/** cylinder turn sounds: take-up click at the start, cam clack at the stop */
export function turnSounds(prev: number, cur: number) {
  if (prev <= 0 && cur > 0) sfx.tick(0.35, 0.12);
  if (prev < 0.86 && cur >= 0.86) sfx.clack();
}
