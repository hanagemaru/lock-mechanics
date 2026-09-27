import { describe, it, expect } from 'vitest';
import { chapters, allStages, type Stage } from '../src/stages';
import { createMechanism } from '../src/locks';
import type { Host, Mechanism } from '../src/core/mechanism';
import type { WardedLock } from '../src/locks/warded';
import type { PinLock } from '../src/locks/pin';
import type { WaferLock } from '../src/locks/wafer';
import type { LeverLock } from '../src/locks/lever';
import type { TubularLock } from '../src/locks/tubular';
import type { DimpleLock } from '../src/locks/dimple';
import type { DiscLock } from '../src/locks/disc';
import type { MagneticLock } from '../src/locks/magnetic';

const host: Host = { changed() {}, say() {}, opened() {}, failed() {} };

/** Applies the intended solution directly to the key model. */
function solve(st: Stage, m: Mechanism) {
  const c = st.cfg;
  switch (st.kind) {
    case 'pin':
      (m as PinLock).key.top = [...c.code];
      break;
    case 'magnetic':
      (m as MagneticLock).key.top = [...c.code];
      (m as MagneticLock).mags = [...c.mags];
      break;
    case 'wafer': {
      const w = m as WaferLock;
      w.topIdx.forEach((i, j) => (w.key.top[j] = c.wafers[i][1]));
      w.botIdx.forEach((i, j) => (w.key.bottom![j] = c.wafers[i][1]));
      break;
    }
    case 'warded': {
      const w = m as WardedLock;
      for (const [col, row, a0, a1] of c.wards) if (!(a1 < 0 || a0 > w.sweep)) w.cells[col][row] = false;
      w.dropDisconnected();
      break;
    }
    case 'lever':
      (m as LeverLock).cuts = [...c.code];
      break;
    case 'tubular':
      (m as TubularLock).cuts = [...c.code];
      break;
    case 'dimple': {
      const d = m as DimpleLock;
      for (const [r, col, depth] of c.pins) d.holes[r][col] = depth;
      break;
    }
    case 'disc':
      (m as DiscLock).cuts = [...c.code];
      break;
  }
}

describe('stages', () => {
  it('have unique ids', () => {
    const ids = allStages.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every chapter has stages', () => {
    for (const ch of chapters) expect(ch.stages.length).toBeGreaterThan(2);
  });

  for (const st of allStages) {
    it(`${st.id} blank key does not open`, () => {
      const m = createMechanism(st, host);
      expect(m.evaluate().ok).toBe(false);
    });
    it(`${st.id} is solvable`, () => {
      const m = createMechanism(st, host);
      solve(st, m);
      const r = m.evaluate();
      expect(r.msg ?? '').toBe('');
      expect(r.ok).toBe(true);
    });
  }
});

describe('warded connectivity', () => {
  it('cells cut off from the shaft fall away', () => {
    const st = allStages.find((s) => s.kind === 'warded')!;
    const m = createMechanism(st, host) as WardedLock;
    for (let c = 0; c < m.cfg.cols; c++) m.cells[c][0] = false;
    m.dropDisconnected();
    expect(m.cells.every((col) => col.every((x) => !x))).toBe(true);
  });
});
