import type { Host, Mechanism } from '../core/mechanism';
import type { Stage } from '../stages';
import { PinLock } from './pin';
import { WaferLock } from './wafer';

export function createMechanism(stage: Stage, host: Host): Mechanism {
  const vis = stage.vis ?? 'full';
  switch (stage.kind) {
    case 'pin':
      return new PinLock(host, vis, stage.cfg);
    case 'wafer':
      return new WaferLock(host, vis, stage.cfg);
    default:
      throw new Error(`unknown lock kind ${stage.kind}`);
  }
}
