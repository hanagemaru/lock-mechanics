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
  {
    id: 'wafer',
    kind: 'wafer',
    name: 'ウェハータンブラー錠',
    en: 'Wafer Tumbler',
    where: '机の引き出し・ロッカー・自動車のドアなど',
    intro: [
      'ピンの代わりに、窓のあいた薄い板（ウェハー）がバネで押されて並んでいます。',
      '鍵がないとウェハーが内筒の外周からはみ出して、外側の溝に引っかかり回りません。',
      '鍵がウェハーの窓のふちを押して、すべての板が内筒の中にぴったり収まると回ります。',
    ],
    tips: [
      '窓のふちが深い位置にあるウェハーほど、鍵を深く削ります。',
      '自動車の鍵のように、上下両側に刻みのある「両面ウェハー」も登場します。',
      '青い刻みは鍵の下辺。下から押し上げられているウェハーに対応します。',
    ],
    stages: [
      S('wafer', '2-1', '引き出しの鍵', '窓のふちの位置を見て削ろう', 2, { wafers: [['t', 3], ['t', 1], ['t', 4], ['t', 2]], ghost: true }),
      S('wafer', '2-2', '5枚ウェハー', '全部の板を外周の内側へ', 1, { wafers: [['t', 2], ['t', 5], ['t', 0], ['t', 3], ['t', 1]] }),
      S('wafer', '2-3', '両面ウェハー', '下から押されるウェハーは鍵の下辺で押し下げる', 2, { wafers: [['t', 3], ['b', 2], ['t', 1], ['b', 4], ['t', 2]] }),
      S('wafer', '2-4', '自動車のキー', '上下あわせて6か所', 1, { wafers: [['b', 1], ['t', 4], ['b', 3], ['t', 2], ['b', 5], ['t', 3]] }, { maxBlanks: 2 }),
      S('wafer', '2-5', 'のぞき窓', '外周のあたりしか見えない', 4, { wafers: [['t', 2], ['b', 4], ['t', 5], ['b', 1], ['t', 3], ['b', 2]] }, { vis: 'window' }),
    ],
  },
  {
    id: 'warded',
    kind: 'warded',
    name: 'ウォード錠',
    en: 'Warded Lock',
    where: '古い扉・宝箱・アンティークの南京錠',
    intro: [
      '錠前の中に、鍵の回転をじゃまする固定の障害物（ワード）がリング状に並んでいます。',
      'ワードの位置に切り込みがある鍵だけが、ぶつからずに回ってボルトを動かせます。',
      'ピンのような可動部品はなく、鍵の「輪郭そのもの」が暗号になっています。',
    ],
    tips: [
      '上の丸い図は、鍵の刃の各列を正面から見た断面。茶色の弧がワードです。',
      '刃が回る範囲（黄色い点線）にあるワードだけが当たります。範囲外は無視してOK。',
      '軸とつながらなくなった部分は欠け落ちます。ボルトを押す刃先は残すこと。',
    ],
    stages: [
      S('warded', '3-1', '宝箱の鍵', 'ワードに当たる部分だけを削ろう', 1, { cols: 3, rows: 3, wards: [[0, 1, 40, 140], [2, 0, 60, 160], [1, 1, 220, 320]], bolt: [1] }),
      S('warded', '3-2', '古い扉', '範囲外のワードにまどわされないで', 1, {
        cols: 4,
        rows: 3,
        wards: [[0, 0, 30, 120], [1, 1, 20, 150], [3, 0, 100, 170], [2, 2, 200, 300], [3, 2, 190, 260]],
        bolt: [2],
      }),
      S('warded', '3-3', '迷路のような刃', '刃先まで「つながった道」を残す', 1, {
        cols: 5,
        rows: 4,
        wards: [[0, 2, 10, 90], [1, 0, 40, 170], [2, 1, 0, 60], [2, 2, 120, 200], [3, 0, 50, 140], [4, 2, 60, 100], [1, 3, 150, 175], [3, 2, 190, 350], [0, 0, 270, 350]],
        bolt: [3],
      }),
      S('warded', '3-4', 'スケルトンキー', '色ちがいの3つの錠を1本で開ける「合い鍵」を作れ', 1, {
        cols: 5,
        rows: 4,
        wards: [[1, 1, 20, 120, 0], [3, 2, 60, 140, 0], [0, 2, 0, 90, 1], [3, 0, 100, 170, 1], [4, 1, 30, 80, 1], [1, 2, 80, 160, 2], [3, 1, 140, 180, 2], [2, 3, 200, 300, 2]],
        bolt: [0, 4],
      }),
    ],
  },
  {
    id: 'lever',
    kind: 'lever',
    name: 'レバータンブラー錠',
    en: 'Lever Tumbler',
    where: '金庫・古い玄関扉・イギリスの箱錠',
    intro: [
      '重なった数枚のレバー（板）に窓があり、ボルトの突起（スタンプ）が窓の中に引っかかっています。',
      '鍵を回すと、刃の段がそれぞれのレバーを持ち上げます。',
      'すべてのレバーの通り道（ゲート）がスタンプの高さに揃ったときだけ、ボルトが動きます。',
    ],
    tips: [
      'レバーの下端（おなか）が鍵に近いほど、少し持ち上げるだけで足ります → 刃を短く。',
      '刃は先端から削って短くします。削った分は戻せません。',
      '持ち上げすぎても、足りなくても、スタンプは通れません。',
    ],
    stages: [
      S('lever', '4-1', '3レバー', 'おなかの高さを見比べよう', 2, { code: [2, 4, 1] }),
      S('lever', '4-2', '金庫の扉', '5枚のレバー', 1, { code: [3, 0, 5, 2, 4] }),
      S('lever', '4-3', '変則ゲート', 'ゲートの位置もレバーごとに違う', 2, { code: [1, 4, 2, 5], gates: [8, 16, 12, 20] }),
      S('lever', '4-4', 'のぞき窓', 'スタンプのまわりしか見えない', 4, { code: [4, 1, 3, 0, 5] }, { vis: 'window' }),
    ],
  },
];

export const allStages: Stage[] = chapters.flatMap((c) => c.stages);

export function chapterOf(stage: Stage): Chapter {
  return chapters.find((c) => c.stages.includes(stage))!;
}
