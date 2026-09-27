import { sfx } from './sfx';
import { clamp, type G } from './draw';

export type Phase = 'edit' | 'inserting' | 'inserted' | 'turning' | 'turnFail' | 'removing' | 'open';
export type Visibility = 'full' | 'window' | 'hidden';

export const W = 400;
export const H = 660;

export interface Host {
  /** called whenever buttons may need refreshing */
  changed(): void;
  /** hint / status line */
  say(msg: string, tone?: 'info' | 'ok' | 'bad' | 'warn'): void;
  opened(): void;
  failed(): void;
}

export interface EvalResult {
  ok: boolean;
  /** 0..1 fraction of the turn the key reaches before being blocked (fail only) */
  stopAt?: number;
  msg?: string;
}

/**
 * Base class for every lock mechanism. Handles the shared
 * edit → insert → turn → (open | fail → remove) state machine and timing.
 * Subclasses provide the model, drawing and key editing.
 */
export abstract class Mechanism {
  phase: Phase = 'edit';
  /** 0 = key in the editor, 1 = fully inserted */
  insert = 0;
  /** 0..1 fraction of the full turn */
  turn = 0;
  /** 0..1 open celebration progress */
  openT = 0;
  /** time inside current phase */
  pt = 0;
  /** show feedback from the last failed turn */
  feedback = false;
  time = 0;

  insertDur = 1.25;
  removeDur = 0.8;
  turnDur = 1.1;
  failDur = 0.9;
  openDur = 1.0;

  protected result: EvalResult = { ok: false };

  constructor(
    public host: Host,
    public vis: Visibility,
  ) {}

  abstract draw(g: G): void;
  abstract evaluate(): EvalResult;
  abstract newBlank(): void;
  /** true while the key has no modification (so "new blank" is pointless) */
  abstract isPristine(): boolean;

  /** optional coaching line for tutorial stages (called on state changes) */
  coach(): string | null {
    return null;
  }

  pointerDown(_x: number, _y: number): void {}
  pointerMove(_x: number, _y: number): void {}
  pointerUp(_x: number, _y: number): void {}

  /** called while inserting / removing with previous and new insert value */
  protected onInsertStep(_prev: number, _cur: number): void {}
  /** called once after a failed turn, before feedback is shown */
  protected onFailed(): void {}
  /** called while turning with previous and new turn value */
  protected onTurnStep(_prev: number, _cur: number): void {}

  get editable() {
    return this.phase === 'edit';
  }

  startInsert() {
    if (this.phase !== 'edit') return;
    this.phase = 'inserting';
    this.pt = 0;
    this.feedback = false;
    sfx.slide();
    this.host.changed();
  }

  startRemove() {
    if (this.phase !== 'inserted') return;
    this.phase = 'removing';
    this.pt = 0;
    this.feedback = false;
    sfx.slide();
    this.host.changed();
  }

  startTurn() {
    if (this.phase !== 'inserted') return;
    this.result = this.evaluate();
    this.phase = this.result.ok ? 'turning' : 'turnFail';
    this.pt = 0;
    this.host.changed();
  }

  /** insertion curve: subclasses may read `insert` directly */
  update(dt: number) {
    this.time += dt;
    this.pt += dt;
    switch (this.phase) {
      case 'inserting': {
        const prev = this.insert;
        this.insert = clamp(this.pt / this.insertDur, 0, 1);
        this.onInsertStep(prev, this.insert);
        if (this.insert >= 1) {
          this.phase = 'inserted';
          sfx.clack();
          this.host.changed();
        }
        break;
      }
      case 'removing': {
        const prev = this.insert;
        this.insert = 1 - clamp(this.pt / this.removeDur, 0, 1);
        this.onInsertStep(prev, this.insert);
        if (this.insert <= 0) {
          this.phase = 'edit';
          this.host.changed();
        }
        break;
      }
      case 'turning': {
        const prev = this.turn;
        this.turn = clamp(this.pt / this.turnDur, 0, 1);
        this.onTurnStep(prev, this.turn);
        if (this.turn >= 1) {
          this.phase = 'open';
          this.pt = 0;
          sfx.open();
          buzz([20, 40, 60]);
          this.host.changed();
        }
        break;
      }
      case 'turnFail': {
        const stop = this.result.stopAt ?? 0.06;
        const d = this.failDur;
        const a = d * 0.45;
        const hold = d * 0.2;
        const prev = this.turn;
        if (this.pt < a) this.turn = stop * easeOutQuad(this.pt / a);
        else if (this.pt < a + hold) {
          if (prev < stop) {
            this.turn = stop;
          }
          if (this.pt - dt < a) {
            sfx.thunk();
            buzz(30);
          }
        } else this.turn = stop * (1 - clamp((this.pt - a - hold) / (d - a - hold), 0, 1));
        this.onTurnStep(prev, this.turn);
        if (this.pt >= d) {
          this.turn = 0;
          this.phase = 'inserted';
          this.feedback = true;
          this.onFailed();
          this.host.failed();
          if (this.result.msg) this.host.say(this.result.msg, 'bad');
          this.host.changed();
        }
        break;
      }
      case 'open': {
        this.openT = clamp(this.pt / this.openDur, 0, 1);
        if (this.pt >= this.openDur + 0.5 && this.openT >= 1 && this.pt - dt < this.openDur + 0.5) {
          this.host.opened();
        }
        break;
      }
    }
  }
}

const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

function buzz(p: number | number[]) {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* not allowed */
  }
}
