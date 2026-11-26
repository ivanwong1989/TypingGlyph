// Tunable constants for the prototype.
const q = new URLSearchParams(location.search);

// Mobile mode: phones and touch devices get a portrait layout with an on-screen keyboard.
// Override with ?mobile=1 or ?mobile=0.
function detectMobile(): boolean {
  const f = q.get('mobile');
  if (f !== null) return f !== '0';
  try {
    return matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900;
  } catch { return false; }
}
export const MOBILE = detectMobile();

// On phones the logical height follows the real visible area, so the game fills the screen edge to edge.
function phoneHeight(): number {
  const el = document.getElementById('game');
  const vw = el?.clientWidth || window.innerWidth || 390;
  const vh = el?.clientHeight || window.innerHeight || 844;
  return Math.round(Math.min(1120, Math.max(860, 480 * (vh / vw))));
}
export const W = MOBILE ? 480 : 1280;
export const H = MOBILE ? phoneHeight() : 720;
export const CX = W / 2;
export const KB_H = MOBILE ? 274 : 0; // bottom strip reserved for spell buttons + keyboard
export const PLAY_B = H - KB_H;       // bottom edge of the playfield
export const CY = MOBILE ? Math.round(196 + (PLAY_B - 196) * 0.52) : 370;

// Layout numbers that differ between desktop and phone.
export const LY = MOBILE ? {
  topFont: 26, topY: 96, ruleY: 118, ruleW: 300,
  chipFont: 16, chipSubFont: 13, chipH: 52,
  comboX: W - 58, comboFont: 34, comboY: 26, comboSubY: 52, scoreY: 72,
  meterX: CX - 110, meterY: 136, meterW: 220,
  bossHpY: 158, hintY: 178, bossBodyY: 262, bossWordY: 346, bossHint: 14,
  labelMin: 196, labelPad: 60, bannerY: 330, bannerFont: 44, subY: 376, subFont: 18,
  upgX: 10, upgY: 190, inset: 70, introScale: 1.7,
  slotSpacing: 66, slotSize: 50, slotY: PLAY_B + 34, slotLabelDy: 34,
} : {
  topFont: 30, topY: 27, ruleY: 50, ruleW: 380,
  chipFont: 20, chipSubFont: 16, chipH: 62,
  comboX: W - 28, comboFont: 44, comboY: 30, comboSubY: 66, scoreY: 90,
  meterX: W - 228, meterY: 112, meterW: 200,
  bossHpY: 76, hintY: 98, bossBodyY: 182, bossWordY: 296, bossHint: 16,
  labelMin: 112, labelPad: 130, bannerY: 250, bannerFont: 60, subY: 300, subFont: 22,
  upgX: 28, upgY: 110, inset: 170, introScale: 2.4,
  slotSpacing: 62, slotSize: 46, slotY: 656, slotLabelDy: 30,
};

export const WAVES = 5;
// 5 pages x ~36s plus three short boss fights is roughly a 5 minute run. Override for testing: ?wave=15
export const WAVE_SECONDS = Number(q.get('wave')) || 36;
export const GOD = q.has('god');

// Difficulty slider: target typing speed in WPM, and ink multiplier.
// Phones get an easier tier: people type roughly half as fast on a touch keyboard.
export const WPM_LEVELS = MOBILE ? [20, 28, 36, 45] : [40, 55, 70, 85];
export const WPM_NAMES = ['easy', 'normal', 'hard', 'expert'];
export const INK_MULT = [1, 1.25, 1.5, 2];

// Per-wave tuning (index 0 = wave 1). Pages are short, so pressure starts high and ramps fast.
export const WORD_LEN: [number, number][] = MOBILE ? [[3, 4], [3, 5], [3, 5], [3, 6], [4, 6]] : [[3, 5], [3, 6], [4, 6], [4, 7], [5, 8]];
export const CROSS_SECONDS = [10.5, 9.5, 9, 8.5, 8];
export const SPEED_SCALE = MOBILE ? 0.72 : 1; // the portrait playfield is narrower, so enemies travel slower in px/s
export const LOAD = [0.85, 0.95, 1.0, 1.08, 1.15];
export const MAX_ALIVE = MOBILE ? [4, 5, 6, 7, 8] : [6, 8, 10, 11, 13];
export const WAVE_KINDS: string[][] = [
  ['drifter', 'dasher'],
  ['drifter', 'dasher', 'splitter'],
  ['drifter', 'dasher', 'shielded', 'scrambler'],
  ['drifter', 'dasher', 'splitter', 'scrambler', 'inker'],
  ['drifter', 'dasher', 'splitter', 'shielded', 'scrambler', 'inker', 'marker'],
];
export const WAVE_INTRO = [
  'Drifters and dashers. Type the fast ones first.',
  'Splitters break into smaller words.',
  'Shielded targets need two words. Scramblers shuffle letters.',
  'Inkers blur the words around them.',
  'Markers heal. Kill them first.',
];

export const BASE_HP = 5;
export const MAX_CHARGES = 3;
export const FINALE_NEEDED = 25;
