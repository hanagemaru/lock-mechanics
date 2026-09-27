import { C, rr, pinFill, spring } from '../core/draw';
import type { Kind } from '../stages';

/** Animated title illustration: a transparent padlock whose pins bob. */
export function drawTitleArt(cv: HTMLCanvasElement, t: number) {
  const g = cv.getContext('2d')!;
  const S = cv.width / 300;
  g.setTransform(S, 0, 0, S, 0, 0);
  g.clearRect(0, 0, 300, 300);
  // shackle
  const lift = Math.max(0, Math.sin(t * 0.9)) ** 8 * 14;
  g.lineCap = 'round';
  g.strokeStyle = '#aeb8c4';
  g.lineWidth = 18;
  g.beginPath();
  g.moveTo(95, 130 - lift);
  g.lineTo(95, 90 - lift);
  g.arc(150, 90 - lift, 55, Math.PI, 0);
  g.lineTo(205, 120 - lift);
  g.stroke();
  // body
  const bg = g.createLinearGradient(0, 120, 0, 270);
  bg.addColorStop(0, '#4c5a6b');
  bg.addColorStop(1, '#27313c');
  g.fillStyle = bg;
  rr(g, 50, 120, 200, 150, 22);
  g.fill();
  g.strokeStyle = C.shellEdge;
  g.lineWidth = 2;
  g.stroke();
  // plug
  g.fillStyle = C.plug;
  g.fillRect(62, 205, 176, 46);
  g.strokeStyle = C.shear;
  g.setLineDash([5, 4]);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(58, 205);
  g.lineTo(242, 205);
  g.stroke();
  g.setLineDash([]);
  const code = [2, 4, 1, 3, 2];
  for (let i = 0; i < 5; i++) {
    const x = 88 + i * 31;
    const ph = Math.sin(t * 2 + i * 0.9);
    const settle = Math.max(0, Math.sin(t * 0.9)) ** 8;
    const off = (1 - settle) * ph * 10;
    const kl = 20 + code[i] * 5;
    const keyTop = 205 + off;
    g.fillStyle = C.cavity;
    g.fillRect(x - 8, 136, 16, 112);
    spring(g, x, 138, keyTop - 22, 12, 5);
    g.fillStyle = pinFill(g, x - 7, 14, 'steel');
    rr(g, x - 7, keyTop - 22, 14, 22, 2);
    g.fill();
    g.fillStyle = pinFill(g, x - 7, 14, 'brass');
    rr(g, x - 7, keyTop, 14, kl, 2);
    g.fill();
  }
}

export function drawChapterIcon(cv: HTMLCanvasElement, kind: Kind, open: boolean) {
  const g = cv.getContext('2d')!;
  const S = cv.width / 52;
  g.setTransform(S, 0, 0, S, 0, 0);
  g.clearRect(0, 0, 52, 52);
  g.globalAlpha = open ? 1 : 0.4;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const brass = C.brass;
  const steel = C.steel;
  switch (kind) {
    case 'pin':
      for (let i = 0; i < 4; i++) {
        const x = 12 + i * 9.5;
        const kl = [10, 16, 8, 13][i];
        g.fillStyle = steel;
        g.fillRect(x - 3, 10, 6, 12);
        g.fillStyle = brass;
        g.fillRect(x - 3, 22, 6, kl);
      }
      g.strokeStyle = C.shear;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(6, 22);
      g.lineTo(46, 22);
      g.stroke();
      break;
    case 'wafer':
      for (let i = 0; i < 4; i++) {
        const x = 12 + i * 9.5;
        const o = [0, 4, -3, 2][i];
        g.fillStyle = brass;
        g.fillRect(x - 3, 12 + o, 6, 28);
        g.fillStyle = '#0f1720';
        g.fillRect(x - 1.5, 20 + o, 3, 12);
      }
      break;
    case 'warded':
      g.strokeStyle = C.ward;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(26, 26, 17, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(26, 26, 10, 0.4, Math.PI * 1.6);
      g.stroke();
      g.fillStyle = steel;
      g.fillRect(24, 26, 4, 18);
      g.fillRect(24, 38, 12, 5);
      break;
    case 'lever':
      for (let i = 0; i < 3; i++) {
        g.fillStyle = [brass, '#b7892f', '#8a6a24'][i];
        g.fillRect(8, 10 + i * 4, 36, 10);
      }
      g.fillStyle = '#0f1720';
      g.fillRect(28, 18, 10, 4);
      g.fillStyle = steel;
      g.beginPath();
      g.arc(20, 38, 6, 0, Math.PI * 2);
      g.fill();
      break;
    case 'tubular':
      g.strokeStyle = steel;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(26, 26, 16, 0, Math.PI * 2);
      g.stroke();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
        g.fillStyle = brass;
        g.beginPath();
        g.arc(26 + Math.cos(a) * 16, 26 + Math.sin(a) * 16, 3, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'dimple':
      g.fillStyle = steel;
      rr(g, 6, 18, 40, 16, 3);
      g.fill();
      g.fillStyle = '#3d4855';
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(12 + i * 7.5, i % 2 ? 23 : 29, 2.4, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'disc':
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = [steel, '#9aa6b2', '#7e8896'][i];
        g.lineWidth = 3;
        g.beginPath();
        g.arc(18 + i * 8, 26, 12, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = brass;
      g.fillRect(12, 11, 28, 4);
      break;
    case 'magnetic':
      g.fillStyle = C.magN;
      g.fillRect(10, 14, 14, 24);
      g.fillStyle = C.magS;
      g.fillRect(28, 14, 14, 24);
      g.fillStyle = '#fff';
      g.font = 'bold 10px system-ui';
      g.textAlign = 'center';
      g.fillText('N', 17, 30);
      g.fillText('S', 35, 30);
      break;
  }
}
