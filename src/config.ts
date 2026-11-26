// Tunable constants for the prototype.
export const W = 1280;
export const H = 720;
export const CX = 640;
export const CY = 370;

export const WAVES = 5;
// 5 pages x ~36s plus three short boss fights is roughly a 5 minute run. Override for testing: ?wave=15
const q = new URLSearchParams(location.search);
export const WAVE_SECONDS = Number(q.get('wave')) || 36;
export const GOD = q.has('god');

// Difficulty slider: target typing speed in WPM, and ink multiplier.
export const WPM_LEVELS = [40, 55, 70, 85];
export const WPM_NAMES = ['easy', 'normal', 'hard', 'expert'];
export const INK_MULT = [1, 1.25, 1.5, 2];

// Per-wave tuning (index 0 = wave 1). Pages are short, so pressure starts high and ramps fast.
export const WORD_LEN: [number, number][] = [[3, 5], [3, 6], [4, 6], [4, 7], [5, 8]];
export const CROSS_SECONDS = [10.5, 9.5, 9, 8.5, 8];
export const LOAD = [0.85, 0.95, 1.0, 1.08, 1.15];
export const MAX_ALIVE = [6, 8, 10, 11, 13];
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
