import { save } from './save';
import { THEMES } from './themes';

const DEFAULT_TEXT = `
ant bat cat dog elf fox gem hat ink jar key log map net owl pen rug sun tap urn vet web yak zip
arc bow cup dot eel fig gap hen ice jam kit lid mud nut oak pie rib sky toy van wax yam zen
bark blot book cake code dash dust echo fern foam gale glow hail idea jazz kite lamp leaf mist
moon nest note oval page pear quiz rain rope sand star tide vine wind yarn zone bolt claw dawn
farm gold harp iron jump knot lava maze nail opal pond quip rust seed tent unit vase wolf yolk
angle brush cloud crane daisy ember flame grape heart ivory jelly koala lemon magic night ocean
paper quilt river stone tiger umbra vivid water xenon yacht zebra amber blank charm drift eager
frost giant haste ideal joust knack lunar mango noble olive pixel quest raven shade trail unity
vigor wheat
anchor bridge candle dragon engine forest garden hammer island jungle kettle ladder marker
napkin orange pencil quiver rabbit shadow thread velvet window yellow zigzag basket castle
desert empire folder gentle harbor invent jacket
balance blanket captain diamond eclipse fantasy gallery harvest imagine journey kingdom lantern
mystery network orchard pattern quarter rainbow shelter thunder uniform volcano warrior
backpack campfire dinosaur elephant flagpole graphite homework inkwell juniper keyboard
language mountain notebook obstacle painting question rooftop sunshine treasure umbrella
vehicle waterfall
adventure blueprint chocolate dangerous exercise fireworks geography happiness invisible
jellyfish knowledge lightning mysterious
`;

export function parseWords(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const w = raw.trim().toLowerCase();
    if (/^[a-z]{2,14}$/.test(w)) seen.add(w);
  }
  return [...seen];
}

export const DEFAULT_WORDS = parseWords(DEFAULT_TEXT.split(/\s+/).join('\n'));

export function currentWordSet(): { name: string; words: string[] } {
  const custom = save.getWords();
  if (custom) return custom;
  const th = THEMES[save.getTheme()];
  if (th) { const words = parseWords(th.words.join('\n')); if (words.length >= 20) return { name: th.name + ' words', words }; }
  return save.getWords() ?? { name: 'built-in words', words: DEFAULT_WORDS };
}

/** Picks words by length, avoiding shared first letters and repeats among live enemies. */
export class WordBank {
  private byLen = new Map<number, string[]>();
  private lens: number[] = [];
  constructor(words: string[]) {
    for (const w of words) {
      if (!this.byLen.has(w.length)) this.byLen.set(w.length, []);
      this.byLen.get(w.length)!.push(w);
    }
    this.lens = [...this.byLen.keys()].sort((a, b) => a - b);
  }

  pick(lo: number, hi: number, usedFirst: Set<string>, usedWords: Set<string>): string {
    // Try the wanted range first, then widen it, then finally allow shared first letters.
    for (let widen = 0; widen <= 8; widen++) {
      for (const strict of [true, false]) {
        const cands: string[] = [];
        for (const len of this.lens) {
          if (len < lo - widen || len > hi + widen) continue;
          for (const w of this.byLen.get(len)!) {
            if (usedWords.has(w)) continue;
            if (strict && usedFirst.has(w[0])) continue;
            cands.push(w);
          }
        }
        if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
      }
    }
    return 'ink';
  }
}
