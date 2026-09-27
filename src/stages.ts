import type { Visibility } from './core/mechanism';

export type Kind = 'pin' | 'wafer' | 'warded' | 'lever' | 'tubular' | 'dimple' | 'disc' | 'magnetic';

export interface Stage {
  id: string;
  kind: Kind;
  title: string;
  /** one-line objective shown when the stage starts */
  brief: string;
  /** trial count for 3 stars */
  par: number;
  /** failing more than this many tries ends the attempt */
  maxTries?: number;
  /** number of blanks available (default: unlimited) */
  maxBlanks?: number;
  vis?: Visibility;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cfg: any;
}

export interface Chapter {
  id: string;
  kind: Kind;
  name: string;
  en: string;
  where: string;
  intro: string[];
  tips: string[];
  stages: Stage[];
}

const S = (kind: Kind, id: string, title: string, brief: string, par: number, cfg: unknown, extra: Partial<Stage> = {}): Stage => ({
  id,
  kind,
  title,
  brief,
  par,
  cfg,
  ...extra,
});

export const chapters: Chapter[] = [
  {
    id: 'pin',
    kind: 'pin',
    name: 'ピンタンブラー錠',
    en: 'Pin Tumbler',
    where: '玄関・南京錠など、いちばん身近なシリンダー錠',
    intro: [
      '外筒（シェル）と内筒（プラグ）をまたいで、上下2段のピンが入っています。',
      '鍵がないと上ピン（銀）が境目＝シアラインをまたいでいて、内筒は回りません。',
      '鍵の山の高さで下ピン（金）を押し上げ、すべてのピンの境目をシアラインに揃えると回ります。',
    ],
    tips: [
      '下ピンが長いほど、鍵は深く削る必要があります。',
      '削った金属は戻せません。削りすぎたら新しいブランクキーからやり直し。',
      '鍵の山をタップで1段、上下ドラッグでまとめて削れます。',
    ],
    stages: [
      S('pin', '1-1', 'はじめての鍵', 'ピンの長さを見て、3か所を削ろう', 2, { code: [2, 4, 1], ghost: true }),
      S('pin', '1-2', '4本ピン', '長いピンほど深く削る', 2, { code: [3, 1, 5, 2], ghost: true }),
      S('pin', '1-3', '5本ピン', '差す前によく観察しよう', 1, { code: [4, 2, 6, 1, 3] }),
      S('pin', '1-4', 'のぞき窓', '内部はシアライン付近しか見えない。差して確かめよう', 4, { code: [2, 5, 3, 0, 4] }, { vis: 'window' }),
      S('pin', '1-5', '6本ピン', 'ブランクは2本まで', 1, { code: [5, 1, 4, 6, 2, 3] }, { maxBlanks: 2 }),
      S(
        'pin',
        '1-6',
        'インプレッション',
        '中は見えない。回して付いた「当たり跡」の所だけ削っていこう',
        6,
        { code: [3, 1, 4, 2, 5] },
        { vis: 'hidden', maxBlanks: 3 },
      ),
    ],
  },
];

export const allStages: Stage[] = chapters.flatMap((c) => c.stages);

export function chapterOf(stage: Stage): Chapter {
  return chapters.find((c) => c.stages.includes(stage))!;
}
