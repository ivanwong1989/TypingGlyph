// localStorage persistence: ink, difficulty, ship, unlocks, settings, word list, bests.
function get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function set(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* ignore */ } }

const UNLOCK_ALL = new URLSearchParams(location.search).has('unlockall'); // testing shortcut

export interface Settings { dys: boolean; speed: number; reduce: boolean; cb: boolean; music: number; sfx: number }
export const DEFAULT_SETTINGS: Settings = { dys: false, speed: 1, reduce: false, cb: false, music: 0.8, sfx: 1 };
export interface Bests { wpm: number; acc: number; combo: number; longest: number; score: number }

export const SHIPS = ['quill', 'scribe', 'cartographer'] as const;
export type ShipId = typeof SHIPS[number];

export const save = {
  getInk: () => Number(get('tg.ink')) || 0,
  addInk: (n: number) => { set('tg.ink', String(save.getInk() + n)); },
  spendInk: (n: number) => { set('tg.ink', String(Math.max(0, save.getInk() - n))); },
  getDiff: () => { const n = Number(get('tg.diff')); return n >= 0 && n <= 3 ? n : 1; },
  setDiff: (n: number) => set('tg.diff', String(n)),
  getShip: (): ShipId => { const s = get('tg.ship') as ShipId; return s && SHIPS.includes(s) && (s === 'quill' || save.hasUnlock(s)) ? s : 'quill'; },
  setShip: (s: string) => set('tg.ship', s),
  getUnlocks: (): string[] => { try { return JSON.parse(get('tg.unlocks') || '[]'); } catch { return []; } },
  hasUnlock: (k: string) => UNLOCK_ALL || save.getUnlocks().includes(k),
  addUnlock: (k: string) => { const u = save.getUnlocks(); if (!u.includes(k)) { u.push(k); set('tg.unlocks', JSON.stringify(u)); } },
  getBossKills: () => Number(get('tg.bosskills')) || 0,
  addBossKills: (n: number) => set('tg.bosskills', String(save.getBossKills() + n)),
  getWon: () => get('tg.won') === '1' || UNLOCK_ALL,
  setWon: () => set('tg.won', '1'),
  getMargin: () => get('tg.margin') === '1' && save.getWon(),
  setMargin: (b: boolean) => set('tg.margin', b ? '1' : '0'),
  getTheme: () => { const t = get('tg.theme') || 'default'; return t === 'default' || save.hasUnlock('theme_' + t) ? t : 'default'; },
  setTheme: (t: string) => set('tg.theme', t),
  getPage: () => { const t = get('tg.page') || 'plain'; return t === 'plain' || save.hasUnlock('page_' + t) ? t : 'plain'; },
  setPage: (t: string) => set('tg.page', t),
  getBest: (diff: number) => Number(get('tg.best.' + diff)) || 0,
  setBest: (diff: number, n: number) => set('tg.best.' + diff, String(n)),
  getBests: (): Bests => { try { return { wpm: 0, acc: 0, combo: 0, longest: 0, score: 0, ...JSON.parse(get('tg.bests') || '{}') }; } catch { return { wpm: 0, acc: 0, combo: 0, longest: 0, score: 0 }; } },
  setBests: (b: Bests) => set('tg.bests', JSON.stringify(b)),
  getSettings: (): Settings => { try { return { ...DEFAULT_SETTINGS, ...JSON.parse(get('tg.settings') || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; } },
  setSettings: (s: Settings) => set('tg.settings', JSON.stringify(s)),
  getWords: (): { name: string; words: string[] } | null => {
    const s = get('tg.words'); if (!s) return null;
    try { const o = JSON.parse(s); if (o && Array.isArray(o.words) && o.words.length) return o; } catch { /* ignore */ }
    return null;
  },
  setWords: (name: string, words: string[]) => set('tg.words', JSON.stringify({ name, words })),
  clearWords: () => { try { localStorage.removeItem('tg.words'); } catch { /* ignore */ } },

  /** Export / import everything as one JSON file. */
  exportAll: (): string => {
    const o: Record<string, string> = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.startsWith('tg.')) o[k] = localStorage.getItem(k)!; } } catch { /* ignore */ }
    return JSON.stringify(o, null, 1);
  },
  importAll: (text: string): boolean => {
    try { const o = JSON.parse(text); if (!o || typeof o !== 'object') return false; for (const k of Object.keys(o)) if (k.startsWith('tg.')) set(k, String(o[k])); return true; } catch { return false; }
  },
};
