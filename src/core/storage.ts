const KEY = 'lock-mechanics:v1';

export interface Save {
  stars: Record<string, number>;
  seenIntro: Record<string, boolean>;
  muted: boolean;
}

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Save>;
      return { stars: s.stars ?? {}, seenIntro: s.seenIntro ?? {}, muted: !!s.muted };
    }
  } catch {
    /* storage unavailable */
  }
  return { stars: {}, seenIntro: {}, muted: false };
}

export const save: Save = load();

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* ignore */
  }
}

export function recordStars(id: string, stars: number) {
  if ((save.stars[id] ?? 0) < stars) save.stars[id] = stars;
  persist();
}

export function resetAll() {
  save.stars = {};
  save.seenIntro = {};
  persist();
}
