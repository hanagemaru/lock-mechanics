import { C, type G, rr, vgrad, text, easeOutBack, clamp, pinFill } from '../core/draw';

/** Padlock body outline + shackle. lift: 0..1 shackle pop. */
export function drawPadlock(g: G, x0: number, x1: number, y0: number, y1: number, lift: number) {
  const cx = (x0 + x1) / 2;
  const sw = Math.min(170, (x1 - x0) * 0.55);
  const sy = y0 - 8 - lift * 16;
  // shackle
  g.save();
  g.lineCap = 'round';
  const legL = cx - sw / 2;
  const legR = cx + sw / 2;
  const r = sw / 2;
  const top = sy - 58;
  g.strokeStyle = vgrad(g, top, y0, [
    [0, '#dfe6ee'],
    [1, '#7d8896'],
  ]);
  g.lineWidth = 16;
  g.beginPath();
  g.moveTo(legL, y0 + 10);
  g.lineTo(legL, top + r);
  g.arc(cx, top + r, r, Math.PI, 0);
  g.lineTo(legR, sy + 16);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, top + r, r - 3, Math.PI * 1.1, Math.PI * 1.6);
  g.stroke();
  g.restore();
  // body
  g.fillStyle = vgrad(g, y0, y1, [
    [0, '#4c5a6b'],
    [0.5, '#3a4756'],
    [1, '#2a3440'],
  ]);
  rr(g, x0 - 10, y0, x1 - x0 + 20, y1 - y0, 14);
  g.fill();
  g.strokeStyle = C.shellEdge;
  g.lineWidth = 1.5;
  g.stroke();
}

export function drawOpenStamp(g: G, cx: number, cy: number, t: number) {
  if (t <= 0) return;
  const s = easeOutBack(clamp(t * 1.6, 0, 1));
  g.save();
  g.translate(cx, cy);
  g.rotate(-0.12);
  g.scale(s, s);
  g.globalAlpha = clamp(t * 3, 0, 1);
  g.strokeStyle = C.ok;
  g.lineWidth = 4;
  rr(g, -78, -26, 156, 52, 10);
  g.fillStyle = 'rgba(10,30,18,0.85)';
  g.fill();
  g.stroke();
  text(g, 'OPEN', 0, 1, { size: 32, color: C.ok, weight: '900' });
  g.restore();
}

/** Opaque cover with a subtle hatch used for hidden internals. */
export function drawCover(g: G, x: number, y: number, w: number, h: number, label?: string) {
  g.save();
  g.fillStyle = '#323d4a';
  g.fillRect(x, y, w, h);
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  g.lineWidth = 1;
  g.beginPath();
  for (let i = -h; i < w; i += 8) {
    g.moveTo(x + i, y + h);
    g.lineTo(x + i + h, y);
  }
  g.stroke();
  g.restore();
  if (label) text(g, label, x + w / 2, y + h / 2, { size: 11, color: 'rgba(200,215,230,0.45)' });
}

export function drawGridBg(g: G, w: number, h: number) {
  g.fillStyle = C.bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = C.grid;
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x <= w; x += 20) {
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, h);
  }
  for (let y = 0; y <= h; y += 20) {
    g.moveTo(0, y + 0.5);
    g.lineTo(w, y + 0.5);
  }
  g.stroke();
}

export function drawDivider(g: G, y: number, w: number, label: string) {
  g.save();
  g.strokeStyle = 'rgba(142,160,181,0.25)';
  g.setLineDash([4, 4]);
  g.beginPath();
  g.moveTo(12, y);
  g.lineTo(w - 12, y);
  g.stroke();
  g.restore();
  g.fillStyle = C.bg;
  const tw = label.length * 11 + 16;
  g.fillRect(w / 2 - tw / 2, y - 8, tw, 16);
  text(g, label, w / 2, y, { size: 10, color: C.sub });
}

/** Faint measuring lines so that discrete depth levels can be counted. ys[0] = level 0. */
export function drawGauge(g: G, x0: number, x1: number, ys: number[], label = true) {
  g.save();
  g.strokeStyle = 'rgba(255,204,51,0.3)';
  g.lineWidth = 1;
  g.setLineDash([2, 3]);
  ys.forEach((y) => {
    g.beginPath();
    g.moveTo(x0, y + 0.5);
    g.lineTo(x1, y + 0.5);
    g.stroke();
  });
  g.restore();
  if (label && ys.length > 1) {
    const gap = Math.abs(ys[1] - ys[0]);
    ys.forEach((y, k) => {
      if (gap >= 9 || k === 0 || k === ys.length - 1) text(g, String(k), x1 + 7, y, { size: 8, color: 'rgba(255,204,51,0.7)' });
    });
  }
}

/** rest = no key; set = at the shear line; high = key pin/wafer sticks out; low = driver dips into the plug */
export type FrontState = 'rest' | 'set' | 'high' | 'low';

/**
 * End-on view of the cylinder, drawn in the top-right corner. Shows why the
 * plug can (or cannot) turn: the parts must all sit inside the plug circle.
 * kind 'pin' shows one pin stack, 'wafer' a wafer plate.
 */
export function drawFrontView(
  g: G,
  cx: number,
  cy: number,
  ang: number,
  o: { kind: 'pin' | 'wafer'; inKey: boolean; state: FrontState; success: boolean; label?: string },
) {
  const Rs = 28;
  const Rp = 17;
  const bad = o.state === 'high' || o.state === 'low';
  g.save();
  // backdrop
  g.fillStyle = 'rgba(8,12,18,0.85)';
  g.beginPath();
  g.arc(cx, cy, Rs + 5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(142,160,181,0.35)';
  g.lineWidth = 1;
  g.stroke();
  // shell
  g.fillStyle = vgrad(g, cy - Rs, cy + Rs, [
    [0, '#55657a'],
    [1, '#2d3845'],
  ]);
  g.beginPath();
  g.arc(cx, cy, Rs, 0, Math.PI * 2);
  g.fill();
  // shell bores / channels
  g.fillStyle = C.cavity;
  if (o.kind === 'pin') g.fillRect(cx - 4, cy - Rs + 3, 8, Rs - Rp - 2);
  else {
    g.fillRect(cx - 10, cy - Rp - 5, 20, 6);
    g.fillRect(cx - 10, cy + Rp - 1, 20, 6);
  }
  g.fillStyle = C.cavity;
  g.beginPath();
  g.arc(cx, cy, Rp + 0.8, 0, Math.PI * 2);
  g.fill();

  // --- plug (rotates) ---
  g.translate(cx, cy);
  g.rotate(ang);
  g.fillStyle = vgrad(g, -Rp, Rp, [
    [0, '#9aaabd'],
    [1, '#56667a'],
  ]);
  g.beginPath();
  g.arc(0, 0, Rp, 0, Math.PI * 2);
  g.fill();
  // keyway (vertical slot)
  g.fillStyle = C.cavity;
  g.fillRect(-2.6, -Rp * 0.42, 5.2, Rp * 1.18);
  if (o.inKey) {
    g.fillStyle = vgrad(g, -Rp * 0.4, Rp * 0.7, [
      [0, C.keyNickelLight],
      [1, C.keyNickelDark],
    ]);
    g.fillRect(-1.8, -Rp * 0.38, 3.6, Rp * 1.08);
  }
  const keyTop = -Rp * 0.38;
  // pin/wafer offset: rest = pushed down by the spring (no key), bad = sticks out
  const off = !o.inKey ? 4.5 : o.state === 'high' ? -4 : o.state === 'low' ? 4 : 0;
  if (o.kind === 'pin') {
    g.fillStyle = C.cavity;
    g.fillRect(-4, -Rp - 1, 8, Rp + keyTop + 1);
    const pinTop = -Rp + off;
    const pinBot = o.inKey ? keyTop : keyTop + 4;
    g.fillStyle = pinFill(g, -3.5, 7, o.state === 'high' ? 'red' : 'brass');
    g.fillRect(-3.5, Math.max(pinTop, -Rp), 7, pinBot - Math.max(pinTop, -Rp));
    if (!o.inKey) {
      // driver pushed down into the plug
      g.fillStyle = pinFill(g, -3.5, 7, 'steel');
      g.fillRect(-3.5, -Rp, 7, off);
    }
  } else {
    // wafer plate with a window the key passes through
    const wy = off;
    const Wd = Rp * 1.7;
    const top = -Rp + 1 + wy;
    const bot = Rp - 1 + wy;
    g.fillStyle = bad ? '#b45454' : C.brass;
    g.beginPath();
    g.rect(-Wd / 2, top, Wd, bot - top);
    g.rect(-3, top + 6 - wy + (o.inKey ? 0 : 0), 6, Rp * 1.1);
    g.fill('evenodd');
  }
  g.restore();

  // --- static parts over the plug (shell side) ---
  g.save();
  if (o.kind === 'pin') {
    // driver pin + spring in the shell bore
    const drvBot = cy - Rp + (o.state === 'high' ? -4 : 0);
    const drvTop = drvBot - 7;
    g.strokeStyle = C.spring;
    g.lineWidth = 1;
    g.beginPath();
    const sTop = cy - Rs + 4;
    for (let k = 0; k <= 6; k++) g.lineTo(cx + (k % 2 ? 3 : -3), sTop + ((drvTop - sTop) * k) / 6);
    g.stroke();
    g.fillStyle = pinFill(g, cx - 3.5, 7, 'steel');
    g.fillRect(cx - 3.5, drvTop, 7, drvBot - drvTop);
    if (o.state === 'high') {
      // key pin sticking out of the plug into the shell: this is what blocks it
      g.fillStyle = pinFill(g, cx - 3.5, 7, 'red');
      g.fillRect(cx - 3.5, cy - Rp - 4, 7, 4.5);
    } else if (o.state === 'low') {
      // driver pin dipping below the shear line into the plug
      g.fillStyle = pinFill(g, cx - 3.5, 7, 'red');
      g.fillRect(cx - 3.5, drvTop, 7, drvBot - drvTop + 4);
    }
  } else if (bad) {
    g.fillStyle = '#b45454';
    g.fillRect(cx - 10, cy + Rp - 1, 20, 3.5);
  }
  // shear circle
  g.strokeStyle = o.success ? C.ok : bad ? C.bad : 'rgba(255,204,51,0.8)';
  g.lineWidth = o.success ? 1.8 : 1.2;
  g.setLineDash(o.success ? [] : [3, 2]);
  g.beginPath();
  g.arc(cx, cy, Rp + 0.5, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  // turn arrow
  if (ang > 0.05) {
    g.strokeStyle = o.success ? C.ok : C.bad;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, Rs + 2, -Math.PI / 2, -Math.PI / 2 + ang);
    g.stroke();
    const ea = -Math.PI / 2 + ang;
    const ex = cx + Math.cos(ea) * (Rs + 2);
    const ey = cy + Math.sin(ea) * (Rs + 2);
    g.fillStyle = g.strokeStyle;
    g.beginPath();
    g.moveTo(ex + Math.cos(ea + Math.PI / 2) * 5, ey + Math.sin(ea + Math.PI / 2) * 5);
    g.lineTo(ex + Math.cos(ea) * 4, ey + Math.sin(ea) * 4);
    g.lineTo(ex - Math.cos(ea) * 4, ey - Math.sin(ea) * 4);
    g.closePath();
    g.fill();
  }
  g.restore();
  text(g, o.label ?? '正面から', cx, cy + Rs + 11, { size: 9, color: C.sub });
}
