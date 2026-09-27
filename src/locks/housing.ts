import { C, type G, rr, vgrad, text, easeOutBack, clamp } from '../core/draw';

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

/** Small front view of the keyhole/plug in a corner showing the rotation. */
export function drawFrontInset(g: G, cx: number, cy: number, r: number, angle: number, label = '正面') {
  g.save();
  g.fillStyle = 'rgba(10,15,22,0.7)';
  g.beginPath();
  g.arc(cx, cy, r + 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = C.shell;
  g.beginPath();
  g.arc(cx, cy, r + 3, 0, Math.PI * 2);
  g.fill();
  g.translate(cx, cy);
  g.rotate(angle);
  g.fillStyle = C.plug;
  g.beginPath();
  g.arc(0, 0, r - 2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = C.plugEdge;
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = C.cavity;
  // keyway squiggle
  g.beginPath();
  g.moveTo(-2, -r * 0.7);
  g.lineTo(2, -r * 0.7);
  g.lineTo(2, -r * 0.1);
  g.lineTo(4, r * 0.1);
  g.lineTo(2, r * 0.3);
  g.lineTo(3, r * 0.55);
  g.lineTo(-3, r * 0.55);
  g.lineTo(-2, r * 0.3);
  g.lineTo(-4, r * 0.1);
  g.lineTo(-2, -r * 0.1);
  g.closePath();
  g.fill();
  g.restore();
  text(g, label, cx, cy + r + 14, { size: 9, color: C.sub });
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
