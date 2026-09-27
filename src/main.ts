import './style.css';
import { chapters, type Chapter, type Stage } from './stages';
import { save, persist, recordStars } from './core/storage';
import { sfx } from './core/sfx';
import { W, H, type Mechanism, type Host } from './core/mechanism';
import { createMechanism } from './locks';
import { drawChapterIcon, drawTitleArt } from './ui/art';
import { learnNotes } from './ui/learn';

const app = document.getElementById('app')!;
sfx.setMuted(save.muted);
const UNLOCK_ALL = new URLSearchParams(location.search).has('unlock');

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...kids: (Node | string | null | undefined | false)[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'html') el.innerHTML = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

let cleanup: (() => void) | null = null;
function show(el: HTMLElement) {
  cleanup?.();
  cleanup = null;
  app.replaceChildren(el);
}

function starsHtml(n: number, max = 3) {
  let s = '';
  for (let i = 0; i < max; i++) s += i < n ? '<b>★</b>' : '★';
  return s;
}

function clearedCount(ch: Chapter) {
  return ch.stages.filter((s) => (save.stars[s.id] ?? 0) > 0).length;
}
function starCount(ch: Chapter) {
  return ch.stages.reduce((a, s) => a + (save.stars[s.id] ?? 0), 0);
}
function chapterUnlocked(i: number) {
  if (UNLOCK_ALL || i === 0) return true;
  const prev = chapters[i - 1];
  return clearedCount(prev) >= prev.stages.length - 1;
}
function stageUnlocked(ch: Chapter, i: number) {
  if (UNLOCK_ALL || i === 0) return true;
  return (save.stars[ch.stages[i - 1].id] ?? 0) > 0 || (save.stars[ch.stages[i].id] ?? 0) > 0;
}

function toast(msg: string) {
  const t = h('div', { class: 'toast' }, msg);
  app.append(t);
  setTimeout(() => t.remove(), 1600);
}

// ---------------------------------------------------------------- title
function titleScreen() {
  const cv = h('canvas', { width: 600, height: 600 }) as HTMLCanvasElement;
  let raf = 0;
  const t0 = performance.now();
  const loop = () => {
    drawTitleArt(cv, (performance.now() - t0) / 1000);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const total = chapters.reduce((a, c) => a + c.stages.length, 0);
  const cleared = chapters.reduce((a, c) => a + clearedCount(c), 0);
  const el = h(
    'div',
    { class: 'screen title-screen' },
    cv,
    h('div', { class: 'logo' }, 'LOCK MECHANICS'),
    h('div', { class: 'logo-sub' }, '鍵 の し く み パ ズ ル'),
    h(
      'p',
      { class: 'title-copy' },
      '透明な錠前の中をのぞき、仕組みを理解して、鍵そのものを削って作る。実在する8種類の錠前機構に挑戦しよう。',
    ),
    h(
      'button',
      {
        class: 'btn primary wide',
        onclick: () => {
          sfx.unlock();
          sfx.tap();
          chapterScreen();
        },
      },
      cleared > 0 ? `つづきから（${cleared}/${total}）` : 'はじめる',
    ),
    h(
      'button',
      {
        class: 'linkbtn',
        onclick: (e: Event) => {
          save.muted = !save.muted;
          sfx.setMuted(save.muted);
          persist();
          (e.currentTarget as HTMLElement).textContent = save.muted ? '🔇 サウンド OFF' : '🔊 サウンド ON';
        },
      },
      save.muted ? '🔇 サウンド OFF' : '🔊 サウンド ON',
    ),
  );
  show(el);
  cleanup = () => cancelAnimationFrame(raf);
}

// ---------------------------------------------------------------- chapters
function chapterScreen() {
  const list = h('div', { class: 'scroll' });
  chapters.forEach((ch, i) => {
    const open = chapterUnlocked(i);
    const icon = h('canvas', { width: 104, height: 104 }) as HTMLCanvasElement;
    drawChapterIcon(icon, ch.kind, open);
    const done = clearedCount(ch);
    list.append(
      h(
        'button',
        {
          class: 'chap',
          disabled: !open,
          onclick: () => {
            sfx.tap();
            stageScreen(ch);
          },
        },
        h('div', { class: 'num' }, icon),
        h(
          'div',
          { class: 'meta' },
          h('div', { class: 'en' }, `Chapter ${i + 1} · ${ch.en}`),
          h('div', { class: 'name' }, open ? ch.name : '？？？'),
          h('div', { class: 'where' }, open ? ch.where : '前の章をクリアすると解放'),
          h('div', { class: 'bar' }, h('i', { style: `width:${(done / ch.stages.length) * 100}%` })),
        ),
        h('div', { class: 'prog', html: `★ ${starCount(ch)}<br><span style="color:var(--sub)">${done}/${ch.stages.length}</span>` }),
      ),
    );
  });
  show(
    h(
      'div',
      { class: 'screen' },
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'iconbtn', onclick: () => titleScreen(), 'aria-label': '戻る' }, '‹'),
        h('h2', {}, '錠前をえらぶ', h('small', {}, '仕組みがちがえば、考え方もちがう')),
      ),
      list,
    ),
  );
}

// ---------------------------------------------------------------- stage list
function explainBlock(ch: Chapter) {
  return h(
    'div',
    { class: 'explain' },
    h('h3', {}, `しくみ：${ch.name}`),
    ...ch.intro.map((p) => h('p', {}, p)),
    h('ul', {}, ...ch.tips.map((t) => h('li', {}, t))),
  );
}

function stageScreen(ch: Chapter) {
  const grid = h('div', { class: 'stages' });
  ch.stages.forEach((st, i) => {
    const open = stageUnlocked(ch, i);
    const tags: string[] = [];
    if (st.vis === 'window') tags.push('のぞき窓');
    if (st.vis === 'hidden') tags.push('見えない');
    if (st.maxBlanks) tags.push(`ブランク${st.maxBlanks}`);
    if (st.maxTries) tags.push(`挑戦${st.maxTries}回`);
    grid.append(
      h(
        'button',
        {
          class: 'stagebtn',
          disabled: !open,
          onclick: () => {
            sfx.tap();
            playScreen(st);
          },
        },
        h('span', { class: 'sid' }, st.id),
        h('span', { class: 'st' }, st.title),
        h('span', {}, ...tags.map((t) => h('span', { class: 'tag' }, t))),
        h('span', { class: 'stars', html: starsHtml(save.stars[st.id] ?? 0) }),
      ),
    );
  });
  show(
    h(
      'div',
      { class: 'screen' },
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'iconbtn', onclick: () => chapterScreen(), 'aria-label': '戻る' }, '‹'),
        h('h2', {}, ch.name, h('small', {}, ch.en)),
      ),
      h('div', { class: 'scroll' }, explainBlock(ch), grid),
    ),
  );
}

// ---------------------------------------------------------------- play
function modal(content: HTMLElement, onClose?: () => void) {
  const bg = h('div', { class: 'modal-bg' }, content);
  bg.addEventListener('click', (e) => {
    if (e.target === bg && onClose) {
      bg.remove();
      onClose();
    }
  });
  app.append(bg);
  return bg;
}

function computeStars(st: Stage, tries: number, blanks: number) {
  if (tries <= st.par && blanks <= 1) return 3;
  if (tries <= st.par + 3) return 2;
  return 1;
}

function playScreen(st: Stage) {
  const ch = chapters.find((c) => c.stages.includes(st))!;
  const idx = ch.stages.indexOf(st);
  let tries = 0;
  let blanks = 1;
  let over = false;

  const hint = h('div', { class: 'hint' }, st.brief);
  const say = (msg: string, tone: 'info' | 'ok' | 'bad' | 'warn' = 'info') => {
    hint.textContent = msg;
    hint.className = `hint ${tone === 'info' ? '' : tone}`;
  };
  const cTries = h('div', { class: 'counter' });
  const cBlanks = h('div', { class: 'counter' });
  const renderCounters = () => {
    cTries.innerHTML = `試し挿し<b>${tries}${st.maxTries ? `/${st.maxTries}` : ''}</b>`;
    cBlanks.innerHTML = `ブランク<b>${st.maxBlanks ? `${st.maxBlanks - blanks}` : '∞'}</b>`;
    cBlanks.className = `counter ${st.maxBlanks && st.maxBlanks - blanks <= 0 ? 'warn' : ''}`;
    cBlanks.title = '残りの予備ブランク';
  };

  const bBlank = h('button', { class: 'btn' }) as HTMLButtonElement;
  const bInsert = h('button', { class: 'btn primary' }) as HTMLButtonElement;
  const bTurn = h('button', { class: 'btn go' }) as HTMLButtonElement;

  const host: Host = {
    changed: () => refresh(),
    say,
    opened: () => onOpened(),
    failed: () => {
      if (st.maxTries && tries >= st.maxTries) {
        over = true;
        setTimeout(() => outOfTries(), 500);
      }
    },
  };
  let mech: Mechanism = createMechanism(st, host);

  let lastCoach = '';
  function refresh() {
    renderCounters();
    const coach = mech.coach();
    if (coach && coach !== lastCoach) say(coach, coach.includes('！') ? 'ok' : coach.includes('削りすぎ') ? 'warn' : 'info');
    lastCoach = coach ?? '';
    const p = mech.phase;
    bBlank.innerHTML = `<span>新しい<br>ブランク</span>`;
    bBlank.disabled = p !== 'edit' || mech.isPristine() || (!!st.maxBlanks && blanks >= st.maxBlanks) || over;
    if (p === 'inserted' || p === 'removing' || p === 'turnFail' || p === 'turning' || p === 'open') {
      bInsert.innerHTML = '<span>抜く<small>加工台に戻す</small></span>';
      bInsert.disabled = p !== 'inserted' || over;
      bInsert.className = 'btn';
    } else {
      bInsert.innerHTML = '<span>差し込む<small>試し挿し</small></span>';
      bInsert.disabled = p !== 'edit' || over;
      bInsert.className = 'btn primary';
    }
    bTurn.innerHTML = '<span>回す<small>開くか？</small></span>';
    bTurn.disabled = p !== 'inserted' || over;
  }

  bBlank.onclick = () => {
    if (mech.phase !== 'edit') return;
    blanks++;
    mech.newBlank();
    sfx.clack();
    say('新しいブランクキーに交換した', 'info');
    refresh();
  };
  bInsert.onclick = () => {
    sfx.unlock();
    if (mech.phase === 'edit') {
      tries++;
      say('差し込み中…', 'info');
      mech.startInsert();
    } else if (mech.phase === 'inserted') {
      mech.startRemove();
      say('鍵を抜いた。加工台で修正しよう', 'info');
    }
  };
  bTurn.onclick = () => {
    if (mech.phase === 'inserted') {
      mech.startTurn();
      say('回してみる…', 'info');
    }
  };

  // canvas
  const cv = h('canvas') as HTMLCanvasElement;
  const g = cv.getContext('2d')!;
  const wrap = h('div', { class: 'stagewrap' }, cv);
  let scale = 1;
  let dpr = 1;
  const resize = () => {
    const r = wrap.getBoundingClientRect();
    scale = Math.min(r.width / W, r.height / H);
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.style.width = `${W * scale}px`;
    cv.style.height = `${H * scale}px`;
    cv.width = Math.round(W * scale * dpr);
    cv.height = Math.round(H * scale * dpr);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(wrap);

  const pt = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale] as const;
  };
  let pid: number | null = null;
  cv.addEventListener('pointerdown', (e) => {
    sfx.unlock();
    if (pid !== null || over) return;
    pid = e.pointerId;
    cv.setPointerCapture(e.pointerId);
    const [x, y] = pt(e);
    mech.pointerDown(x, y);
    refresh();
  });
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return;
    const [x, y] = pt(e);
    mech.pointerMove(x, y);
  });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  const up = (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    pid = null;
    const [x, y] = pt(e);
    mech.pointerUp(x, y);
    refresh();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);

  let raf = 0;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    mech.update(dt);
    g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    mech.draw(g);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  function restart() {
    tries = 0;
    blanks = 1;
    over = false;
    mech = createMechanism(st, host);
    say(st.brief);
    refresh();
  }

  function onOpened() {
    const stars = computeStars(st, tries, blanks);
    const first = !(save.stars[st.id] > 0);
    recordStars(st.id, stars);
    const next = ch.stages[idx + 1] ?? null;
    const chi = chapters.indexOf(ch);
    const nextCh = !next && chapters[chi + 1] && chapterUnlocked(chi + 1) ? chapters[chi + 1] : null;
    const note = learnNotes[st.id];
    const m = modal(
      h(
        'div',
        { class: 'modal' },
        h('h3', { style: 'text-align:center' }, '開錠！'),
        h('div', { class: 'bigstars', html: starsHtml(stars).replace(/<b>/g, () => `<b>`) }),
        h('div', { class: 'stats', html: `<span>試し挿し <b>${tries}</b> 回</span><span>ブランク <b>${blanks}</b> 本</span>` }),
        h('div', { class: 'stats', style: 'font-size:11px;margin-top:-4px' }, `★3条件：試し挿し${st.par}回以内・ブランク1本`),
        note ? h('div', { class: 'learn', html: note }) : null,
        h(
          'div',
          { class: 'row' },
          h(
            'button',
            {
              class: 'btn',
              onclick: () => {
                m.remove();
                restart();
              },
            },
            'もう一度',
          ),
          next
            ? h('button', { class: 'btn primary', onclick: () => playScreen(next) }, '次へ ›')
            : nextCh
              ? h('button', { class: 'btn primary', onclick: () => stageScreen(nextCh) }, '次の錠前へ ›')
              : h('button', { class: 'btn primary', onclick: () => stageScreen(ch) }, '一覧へ'),
        ),
      ),
    );
    m.querySelectorAll('.bigstars b').forEach((b, i) => {
      (b as HTMLElement).style.animationDelay = `${0.15 + i * 0.18}s`;
      setTimeout(() => sfx.star(i), 150 + i * 180);
    });
    if (first && !next && nextCh) setTimeout(() => toast(`「${nextCh.name}」が解放された！`), 900);
  }

  function outOfTries() {
    const m = modal(
      h(
        'div',
        { class: 'modal' },
        h('h3', {}, '挑戦回数の上限'),
        h('p', {}, `この錠前は ${st.maxTries} 回までしか試せない。考え直してもう一度挑戦しよう。`),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn', onclick: () => stageScreen(ch) }, '一覧へ'),
          h(
            'button',
            {
              class: 'btn primary',
              onclick: () => {
                m.remove();
                restart();
              },
            },
            'やり直す',
          ),
        ),
      ),
    );
  }

  function showHelp() {
    const m = modal(
      h(
        'div',
        { class: 'modal' },
        h('h3', {}, ch.name),
        h('p', { class: 'lead' }, ch.where),
        ...ch.intro.map((p) => h('p', {}, p)),
        h('div', { class: 'learn', html: ch.tips.map((t) => `・${t}`).join('<br>') }),
        h(
          'div',
          { class: 'row' },
          h(
            'button',
            {
              class: 'btn',
              onclick: () => {
                m.remove();
                restart();
              },
            },
            '最初から',
          ),
          h('button', { class: 'btn primary', onclick: () => m.remove() }, 'とじる'),
        ),
      ),
      () => {},
    );
  }

  const el = h(
    'div',
    { class: 'screen play' },
    h(
      'div',
      { class: 'topbar' },
      h('button', { class: 'iconbtn', onclick: () => stageScreen(ch), 'aria-label': '戻る' }, '‹'),
      h('h2', {}, `${st.id} ${st.title}`, h('small', {}, ch.name)),
      h('div', { class: 'counters' }, cTries, cBlanks),
      h('button', { class: 'iconbtn', onclick: showHelp, 'aria-label': 'しくみ' }, '?'),
    ),
    hint,
    wrap,
    h('div', { class: 'controls' }, bBlank, bInsert, bTurn),
  );
  show(el);
  resize();
  refresh();
  cleanup = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };

  if (idx === 0 && !save.seenIntro[ch.id]) {
    save.seenIntro[ch.id] = true;
    persist();
    showHelp();
  }
}

// debug entry: ?stage=1-3
const qs = new URLSearchParams(location.search).get('stage');
const direct = qs ? chapters.flatMap((c) => c.stages).find((s) => s.id === qs) : null;
if (direct) playScreen(direct);
else titleScreen();
