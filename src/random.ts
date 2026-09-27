import type { Kind, Stage } from './stages';
import type { Ward } from './locks/warded';

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** is the warded key that clears every ward still able to reach all bolt cells? */
export function wardedSolvable(cols: number, rows: number, wards: Ward[], bolt: number[], sweep = 180) {
  const cells = Array.from({ length: cols }, () => Array.from({ length: rows }, () => true));
  for (const [c, r, a0, a1] of wards) if (!(a1 < 0 || a0 > sweep)) cells[c][r] = false;
  const seen = cells.map((col) => col.map(() => false));
  const q: [number, number][] = [];
  for (let c = 0; c < cols; c++)
    if (cells[c][0]) {
      seen[c][0] = true;
      q.push([c, 0]);
    }
  while (q.length) {
    const [c, r] = q.pop()!;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || !cells[nc][nr] || seen[nc][nr]) continue;
      seen[nc][nr] = true;
      q.push([nc, nr]);
    }
  }
  return bolt.every((c) => seen[c][rows - 1]);
}

function randomWarded() {
  const cols = 5;
  const rows = 4;
  for (let tries = 0; tries < 500; tries++) {
    const wards: Ward[] = [];
    const used = new Set<string>();
    const n = ri(5, 7);
    while (wards.length < n) {
      const c = ri(0, cols - 1);
      const r = ri(0, rows - 1);
      if (used.has(`${c},${r}`)) continue;
      used.add(`${c},${r}`);
      const decoy = Math.random() < 0.2;
      const a0 = decoy ? ri(190, 250) : ri(0, 140);
      wards.push([c, r, a0, Math.min(decoy ? 350 : 200, a0 + ri(30, 100))]);
    }
    const bolt = [ri(0, cols - 1)];
    if (wards.some(([c, r, a0]) => bolt.includes(c) && r === rows - 1 && a0 <= 180)) continue;
    const cut = wards.filter(([, , a0]) => a0 <= 180).length;
    if (cut < 4) continue;
    if (wardedSolvable(cols, rows, wards, bolt)) return { cols, rows, wards, bolt };
  }
  return { cols: 3, rows: 3, wards: [[0, 1, 40, 140]] as Ward[], bolt: [1] };
}

/** random code with at least one non-zero cut, so a blank key never opens */
const code = (n: number, max: number) => {
  const c = Array.from({ length: n }, () => ri(0, max));
  if (!c.some((v) => v > 0)) c[ri(0, n - 1)] = ri(1, max);
  return c;
};

export function randomStage(kind: Kind): Stage {
  const base = { id: `free-${kind}`, kind, title: 'フリープレイ', par: 1 } as const;
  switch (kind) {
    case 'pin':
      return { ...base, brief: 'ランダムな5〜6本ピン', cfg: { code: code(ri(5, 6), 6) } };
    case 'wafer':
      return {
        ...base,
        brief: 'ランダムな両面ウェハー',
        cfg: { wafers: code(6, 5).map((v, i) => [i % 2 ? 'b' : 't', v]) },
      };
    case 'warded':
      return { ...base, brief: 'ランダムなワード配置', cfg: randomWarded() };
    case 'lever':
      return { ...base, brief: 'ランダムな5レバー', cfg: { code: code(5, 5) } };
    case 'tubular':
      return { ...base, brief: 'ランダムな7本ピン', cfg: { code: code(7, 6) } };
    case 'dimple': {
      const cols = 6;
      const pins: [number, number, number][] = [];
      for (let c = 0; c < cols; c++) {
        const which = pick([[0], [1], [0, 1]]);
        for (const r of which) pins.push([r, c, ri(0, 4)]);
      }
      if (pins.every((p) => p[2] === 0)) pins[0][2] = ri(1, 4);
      return { ...base, brief: 'ランダムな2列ディンプル', cfg: { cols, pins } };
    }
    case 'disc': {
      const cuts = code(6, 5);
      const falseGates: [number, number][] = [];
      for (let k = 0; k < 2; k++) {
        const d = ri(0, 5);
        let v = ri(0, 5);
        if (v === cuts[d]) v = (v + 2) % 6;
        falseGates.push([d, v]);
      }
      return { ...base, brief: 'ランダムな6枚ディスク', cfg: { code: cuts, falseGates } };
    }
    case 'magnetic':
      return {
        ...base,
        brief: 'ランダムな磁気＋ピン',
        cfg: { code: code(5, 4), mags: Array.from({ length: 5 }, () => pick(['N', 'S', null])) },
      };
  }
}
