// Upgrades are data: a name, a keyword to type, a description, and a stack limit.
// Game logic reads the stack counts (see game.ts) rather than each upgrade owning code.
export interface Upgrade {
  id: string;
  word: string;   // keyword typed to pick it
  title: string;
  desc: string;
  rare?: boolean;
  ship?: 'quill' | 'scribe' | 'cartographer'; // ship-class pool
  gate?: string;  // notebook unlock needed for it to appear
  max: number;
}

export const UPGRADES: Upgrade[] = [
  { id: 'chain', word: 'chain', title: 'Chain', desc: 'Each word also strikes the nearest other short word.', max: 3 },
  { id: 'splash', word: 'splash', title: 'Splash', desc: 'Kills small words around your target.', max: 3 },
  { id: 'forgive', word: 'forgive', title: 'Forgiveness', desc: 'First typo on each page is free.', max: 3 },
  { id: 'wide', word: 'wide', title: 'Wide margins', desc: 'Combo checkpoints come sooner.', max: 3 },
  { id: 'tempo', word: 'tempo', title: 'Tempo', desc: 'Spell charges arrive faster.', max: 3 },
  { id: 'plating', word: 'plating', title: 'Plating', desc: '+1 max health and heal 1.', max: 3 },
  { id: 'mend', word: 'mend', title: 'Mend', desc: 'Heal after every page.', max: 3 },
  { id: 'ward', word: 'ward', title: 'Ward', desc: 'Unlocks !ward: absorbs the next hits.', gate: 'ward', max: 3 },
  { id: 'finish', word: 'finish', title: 'Auto-finish', desc: 'The last letter of a word types itself.', max: 2 },
  { id: 'inkwell', word: 'inkwell', title: 'Inkwell', desc: 'Double score while the ink gauge is half full.', max: 1 },
  { id: 'compass', word: 'compass', title: 'Compass', desc: '!route costs no charge.', ship: 'cartographer', max: 1 },
  { id: 'gambit', word: 'gambit', title: 'Gambit', desc: 'Longer enemy words, but more score and ink.', max: 3 },
  { id: 'sharp', word: 'sharp', title: 'Sharp nib', desc: 'Words of 6+ letters score double.', ship: 'quill', max: 3 },
  { id: 'footnote', word: 'footnote', title: 'Footnote', desc: '!edit costs 1 charge instead of 2.', ship: 'scribe', max: 1 },
  { id: 'echo', word: 'echo', title: 'Echo', desc: 'RARE: every 4th word fires twice.', rare: true, gate: 'echo', max: 1 },
  { id: 'steady', word: 'steady', title: 'Steady hand', desc: 'RARE: typos never smudge the ship.', rare: true, max: 1 },
  { id: 'surge', word: 'surge', title: 'Surge', desc: 'RARE: spells are free at combo 20+.', rare: true, max: 1 },
];

/** Three cards with different first letters; one from the ship's pool; rares when allowed. */
export function drawCards(stacks: Record<string, number>, ship: 'quill' | 'scribe' | 'cartographer', unlocks: string[], allowRare: boolean, forceRare: boolean): Upgrade[] {
  const ok = (u: Upgrade) =>
    (!u.gate || unlocks.includes(u.gate)) && (stacks[u.id] || 0) < u.max && (!u.ship || u.ship === ship);
  const common = UPGRADES.filter((u) => ok(u) && !u.rare && !u.ship);
  const own = UPGRADES.filter((u) => ok(u) && u.ship === ship);
  const rares = UPGRADES.filter((u) => ok(u) && u.rare);
  const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

  for (let attempt = 0; attempt < 50; attempt++) {
    const picks: Upgrade[] = [];
    const take = (pool: Upgrade[]) => {
      for (const u of shuffle(pool)) if (!picks.includes(u) && !picks.some((p) => p.word[0] === u.word[0])) { picks.push(u); return true; }
      return false;
    };
    if (allowRare && rares.length && (forceRare || Math.random() < 0.45)) take(rares);
    if (own.length) take(own);
    while (picks.length < 3 && take(common)) { /* fill */ }
    if (picks.length === 3) return shuffle(picks);
  }
  return shuffle([...common, ...own]).slice(0, 3);
}
