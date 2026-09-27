// Synthesized sound effects (no audio assets needed).

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;

function ctx(): AudioContext | null {
  if (muted) return null;
  if (!ac) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.55;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

function noise(a: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number) {
  const a = ctx();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function burst(dur: number, freq: number, q: number, vol: number, delay = 0, type: BiquadFilterType = 'bandpass') {
  const a = ctx();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const s = a.createBufferSource();
  s.buffer = noise(a);
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

export const sfx = {
  setMuted(m: boolean) {
    muted = m;
  },
  get muted() {
    return muted;
  },
  unlock() {
    ctx();
  },
  tap() {
    tone(900, 0.05, 'triangle', 0.08);
  },
  /** Metallic tick of a pin / wafer / lever moving. pitch ~ 0..1 */
  tick(pitch = 0.5, vol = 0.18) {
    burst(0.035, 2500 + pitch * 3500, 8, vol);
    tone(1800 + pitch * 1600, 0.03, 'square', vol * 0.25);
  },
  /** File / grinder removing material */
  grind(len = 0.12) {
    burst(len, 3200, 1.2, 0.2);
    burst(len * 0.8, 6200, 2, 0.1, 0.02);
  },
  drill() {
    tone(180, 0.18, 'sawtooth', 0.05, 0, 260);
    burst(0.18, 4200, 1.5, 0.15);
  },
  slide() {
    burst(0.25, 1800, 0.8, 0.07, 0, 'lowpass');
  },
  thunk() {
    tone(120, 0.12, 'sine', 0.35, 0, 70);
    burst(0.06, 900, 2, 0.2);
  },
  clack() {
    burst(0.05, 2200, 3, 0.35);
    tone(220, 0.1, 'triangle', 0.25, 0, 110);
  },
  open() {
    burst(0.05, 2600, 3, 0.35);
    tone(160, 0.14, 'triangle', 0.3, 0, 90);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.45, 'sine', 0.12, 0.12 + i * 0.07));
  },
  star(i: number) {
    tone(880 * Math.pow(1.26, i), 0.25, 'sine', 0.12);
  },
  error() {
    tone(200, 0.15, 'square', 0.06);
    tone(150, 0.2, 'square', 0.06, 0.1);
  },
  magnet() {
    tone(320, 0.12, 'sine', 0.12, 0, 480);
  },
};
