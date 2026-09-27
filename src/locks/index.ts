import type { Host, Mechanism } from '../core/mechanism';
import type { Stage } from '../stages';
import { PinLock } from './pin';
import { WaferLock } from './wafer';
import { WardedLock } from './warded';
import { LeverLock } from './lever';
import { TubularLock } from './tubular';
import { DimpleLock } from './dimple';
import { DiscLock } from './disc';
import { MagneticLock } from './magnetic';

export function createMechanism(stage: Stage, host: Host): Mechanism {
  const vis = stage.vis ?? 'full';
  switch (stage.kind) {
    case 'pin':
      return new PinLock(host, vis, stage.cfg);
    case 'wafer':
      return new WaferLock(host, vis, stage.cfg);
    case 'warded':
      return new WardedLock(host, vis, stage.cfg);
    case 'lever':
      return new LeverLock(host, vis, stage.cfg);
    case 'tubular':
      return new TubularLock(host, vis, stage.cfg);
    case 'dimple':
      return new DimpleLock(host, vis, stage.cfg);
    case 'disc':
      return new DiscLock(host, vis, stage.cfg);
    case 'magnetic':
      return new MagneticLock(host, vis, stage.cfg);
    default:
      throw new Error(`unknown lock kind ${stage.kind}`);
  }
}
