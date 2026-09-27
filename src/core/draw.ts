// Shared drawing helpers & palette for the "transparent cutaway" look.

export const C = {
  bg: '#0f1720',
  grid: 'rgba(120,170,220,0.06)',
  shell: '#3a4756',
  shellEdge: '#5b6b7d',
  shellDark: '#26313d',
  plug: '#6f8196',
  plugEdge: '#9fb0c4',
  cavity: '#141c25',
  brass: '#d9a441',
  brassLight: '#f3cf7a',
  brassDark: '#8a5e14',
  steel: '#b8c3cf',
  steelLight: '#e8eef4',
  steelDark: '#6b7785',
  spring: '#8fa3b6',
  keyNickel: '#c9ced6',
  keyNickelLight: '#eef1f5',
  keyNickelDark: '#7e8794',
  shear: '#ffcc33',
  ok: '#4ade80',
  bad: '#f87171',
  warn: '#fb923c',
  info: '#60a5fa',
  text: '#e6edf5',
  sub: '#8ea0b5',
  magN: '#ef4444',
  magS: '#3b82f6',
  ward: '#a16207',
};

export type G = CanvasRenderingContext2D;

export function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}

export function vgrad(g: G, y0: number, y1: number, stops: [number, string][]) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

export function hgrad(g: G, x0: number, x1: number, stops: [number, string][]) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

/** metal cylinder-ish horizontal shading for vertical pins */
export function pinFill(g: G, x: number, w: number, kind: 'brass' | 'steel' | 'red' | 'blue' | 'green') {
  const pal =
    kind === 'brass'
      ? [C.brassDark, C.brassLight, C.brass, C.brassDark]
      : kind === 'steel'
        ? [C.steelDark, C.steelLight, C.steel, C.steelDark]
        : kind === 'red'
          ? ['#7f1d1d', '#fca5a5', '#ef4444', '#7f1d1d']
          : kind === 'blue'
            ? ['#1e3a8a', '#93c5fd', '#3b82f6', '#1e3a8a']
            : ['#14532d', '#86efac', '#22c55e', '#14532d'];
  return hgrad(g, x, x + w, [
    [0, pal[0]],
    [0.3, pal[1]],
    [0.6, pal[2]],
    [1, pal[3]],
  ]);
}

export function spring(g: G, x: number, y0: number, y1: number, w: number, coils = 7) {
  g.save();
  g.strokeStyle = C.spring;
  g.lineWidth = 1.6;
  g.beginPath();
  const h = y1 - y0;
  g.moveTo(x, y0);
  for (let i = 0; i <= coils * 2; i++) {
    const yy = y0 + (h * i) / (coils * 2);
    g.lineTo(x + (i % 2 === 0 ? -w / 2 : w / 2), yy);
  }
  g.lineTo(x, y1);
  g.stroke();
  g.restore();
}

export function text(
  g: G,
  s: string,
  x: number,
  y: number,
  opts: { size?: number; color?: string; align?: CanvasTextAlign; weight?: string; base?: CanvasTextBaseline } = {},
) {
  g.save();
  g.font = `${opts.weight ?? '600'} ${opts.size ?? 12}px system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif`;
  g.fillStyle = opts.color ?? C.text;
  g.textAlign = opts.align ?? 'center';
  g.textBaseline = opts.base ?? 'middle';
  g.fillText(s, x, y);
  g.restore();
}

export function arrow(g: G, x: number, y: number, dir: 1 | -1, color: string, size = 7) {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y + dir * size);
  g.lineTo(x - size, y - dir * size * 0.3);
  g.lineTo(x + size, y - dir * size * 0.3);
  g.closePath();
  g.fill();
  g.restore();
}

export function hatch(g: G, x: number, y: number, w: number, h: number, color: string, gap = 6) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = color;
  g.lineWidth = 1;
  g.beginPath();
  for (let i = -h; i < w; i += gap) {
    g.moveTo(x + i, y + h);
    g.lineTo(x + i + h, y);
  }
  g.stroke();
  g.restore();
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** 0→1 over segment [a,b] of t */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
