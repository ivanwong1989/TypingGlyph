// Which enemies can the player see and target? One rule, used for BOTH drawing the word
// and accepting key presses, so a word you can read is always a word you can type.
// On phones the playfield starts just below the HUD, so the top edge behaves like the sides.
export const PHONE_TOP = 150;

export interface Layout { W: number; H: number; mobile: boolean }

export function isVisible(x: number, y: number, l: Layout): boolean {
  const side = l.mobile ? 8 : -10;   // phones: the body must be inside the screen sides
  const top = l.mobile ? PHONE_TOP : -10; // phones: the HUD bottom edge is the top of the playfield
  return x > side && x < l.W - side && y > top && y < l.H + 10;
}

export interface Targetable { id: number; word: string; x: number; y: number; kind?: string }

export function targetViews(enemies: Targetable[], l: Layout, cx: number, cy: number) {
  return enemies
    .filter((e) => e.kind === 'boss' || isVisible(e.x, e.y, l))
    .map((e) => ({ id: e.id, word: e.word, distSq: (e.x - cx) ** 2 + (e.y - cy) ** 2 }));
}
