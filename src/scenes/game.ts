import Phaser from 'phaser';
import {
  W, H, CX, CY, MOBILE, LY, PLAY_B, SPEED_SCALE, WAVE_SECONDS, GOD, WPM_LEVELS, INK_MULT, WORD_LEN, CROSS_SECONDS, LOAD,
  MAX_ALIVE, WAVE_KINDS, WAVE_INTRO, BASE_HP, MAX_CHARGES, FINALE_NEEDED,
} from '../config';
import { COL, CSS, FONT, FONT_C, P, SET, applySettings, drawBackdrop, ensureTextures, fillPts, regPoly, rotPts, strokePts, txt } from '../style';
import { TypingEngine, TypingEvent } from '../typing';
import { WordBank, currentWordSet } from '../words';
import { save, ShipId } from '../save';
import { audio, music } from '../sfx';
import { UPGRADES, Upgrade, drawCards } from '../upgrades';
import type { RunSummary } from './summary';
import { OnScreenKeyboard } from '../keyboard';

type Kind = 'drifter' | 'dasher' | 'splitter' | 'shielded' | 'child' | 'boss' | 'scrambler' | 'inker' | 'marker';
interface Plan { kind: Kind; word: string; x: number; y: number; cost: number }

interface Enemy {
  id: number; kind: Kind; word: string; disp: string; x: number; y: number; speed: number;
  hp: number; phase: number; ang: number; r: number; t1: number;
  label: Phaser.GameObjects.Text; ink: Phaser.GameObjects.Text;
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; col: number; line: boolean }
interface Shot { x1: number; y1: number; t: number }
interface Ring { x: number; y: number; t: number; dur: number; r: number; col: number; w: number }

interface BossDef { name: string; tuning: number; gimmick: 'blot' | 'pen' | 'page'; phases: [string, string][][] }
const same = (s: string): [string, string][] => s.split(' ').map((w) => [w, w] as [string, string]);
const BOSSES: BossDef[] = [
  {
    name: 'The Blot', tuning: 2, gimmick: 'blot',
    phases: [same('the ink spreads fast'), same('a drop becomes stain'), same('nothing stays clean')],
  },
  {
    name: 'The Red Pen', tuning: 4, gimmick: 'pen',
    phases: [
      [['teh', 'the'], ['wich', 'which'], ['recieve', 'receive']],
      [['seperate', 'separate'], ['definately', 'definitely'], ['occured', 'occurred']],
      [['untill', 'until'], ['adress', 'address'], ['becuase', 'because']],
    ],
  },
  {
    name: 'The Last Page', tuning: 5, gimmick: 'page',
    phases: [
      same('every story ends'), same('the margins close in'), same('then the paper tears'),
      same('all you wrote returns'), same('close the book'),
    ],
  },
];
type Stage = { t: 'wave'; w: number } | { t: 'boss'; b: number };
const STAGES: Stage[] = [
  { t: 'wave', w: 1 }, { t: 'wave', w: 2 }, { t: 'boss', b: 0 },
  { t: 'wave', w: 3 }, { t: 'wave', w: 4 }, { t: 'boss', b: 1 },
  { t: 'wave', w: 5 }, { t: 'boss', b: 2 },
];

const BOSS_HINT: Record<string, string> = {
  blot: MOBILE ? 'Its ink hides the word. Tap ERASE to reveal it.' : 'Its ink hides the word. Type !erase to reveal it.',
  pen: 'Type the CORRECT spelling, not the misspelled word shown.',
  page: 'The page folds, then tears open. Clear what spills out.',
};
const SPEED_FACTOR: Record<Kind, number> = { drifter: 1, dasher: 2.2, splitter: 0.9, shielded: 0.8, child: 1.15, boss: 0, scrambler: 0.85, inker: 0.75, marker: 0.7 };
const RADIUS: Record<Kind, number> = { drifter: 16, dasher: 14, splitter: 22, shielded: 24, child: 9, boss: 0, scrambler: 18, inker: 16, marker: 18 };
const MILESTONES = [10, 25, 50, 100, 150, 200];

export class GameScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private enemies: Enemy[] = [];
  private engine = new TypingEngine();
  private bank!: WordBank;
  private nextId = 1;
  private shipId: ShipId = 'quill';
  private margin = false;
  private queue: Plan[] = [];
  private routeSide: number | null = null;
  private routeT = 0;
  private routeAsk = false;
  private echoNext = false;
  private easeT = 0;
  private inset = 0;
  private previewTexts: Phaser.GameObjects.Text[] = [];
  private tHint!: Phaser.GameObjects.Text;
  private chip!: Phaser.GameObjects.Graphics;

  private mode: 'play' | 'clearing' | 'bossintro' | 'pick' | 'ending' = 'play';
  private paused = false;
  private stageIdx = -1;
  private stageT = 0;
  private clearT = 0;
  private introT = 0;
  private elapsed = 0;
  private spawnT = 1.2;
  private freeze = 0;
  private shake = 0;

  private hp = BASE_HP;
  private maxHp = BASE_HP;
  private combo = 0;
  private bestCombo = 0;
  private score = 0;
  private charges = 0;
  private chargeProg = 0;
  private finale = 0;
  private gauge = 0;
  private smudgeT = 0;
  private slowT = 0;
  private wardHits = 0;
  private typoFree = 0;
  private words = 0;
  private longest = '';
  private cleanWord = true;
  private typoFlash = 0;
  private bossesDown = 0;
  private perfects = 0;
  private stacks: Record<string, number> = {};
  private rerollLeft = 1;
  private alarmT = 0;
  private beatT = 0;
  private diff = 1;
  private shipAng = -Math.PI / 2;
  private pulse = 0;

  private boss: null | { def: BossDef; phase: number; idx: number; wordId: number | null; wait: number; mask: number; blotT: number; hit: number; done: number; total: number; splats: P[]; foldT: number; fold: number } = null;

  private shots: Shot[] = [];
  private rings: Ring[] = [];
  private parts: Particle[] = [];

  private tTopDim!: Phaser.GameObjects.Text;
  private tTopInk!: Phaser.GameObjects.Text;
  private tTopPct!: Phaser.GameObjects.Text;
  private tStage!: Phaser.GameObjects.Text;
  private tInk!: Phaser.GameObjects.Text;
  private tCombo!: Phaser.GameObjects.Text;
  private tComboSub!: Phaser.GameObjects.Text;
  private tScore!: Phaser.GameObjects.Text;
  private tToast!: Phaser.GameObjects.Text;
  private tBanner!: Phaser.GameObjects.Text;
  private tSub!: Phaser.GameObjects.Text;
  private tUpg!: Phaser.GameObjects.Text;
  private slotLabels: Phaser.GameObjects.Text[] = [];
  private slotKeys: Phaser.GameObjects.Text[] = [];
  private vig!: Phaser.GameObjects.Image;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private pauseObjs: Phaser.GameObjects.GameObject[] = [];
  private pickObjs: Phaser.GameObjects.GameObject[] = [];
  private pickInk: Phaser.GameObjects.Text[] = [];
  private cards: Upgrade[] = [];
  private pickBuf = '';
  private lastUpg = '';

  constructor() { super('Game'); }

  // ================================================================ setup
  create() {
    this.enemies = []; this.shots = []; this.rings = []; this.parts = []; this.boss = null;
    this.engine = new TypingEngine();
    this.nextId = 1; this.elapsed = 0; this.spawnT = 1.2; this.stageIdx = -1; this.stageT = 0;
    this.diff = save.getDiff();
    applySettings();
    this.margin = save.getMargin();
    this.queue = []; this.routeSide = null; this.routeT = 0; this.routeAsk = false; this.echoNext = false; this.easeT = 0; this.inset = 0;
    this.shipId = save.getShip();
    this.hp = this.maxHp = BASE_HP;
    this.combo = this.bestCombo = this.score = this.words = 0;
    this.charges = this.shipId === 'scribe' ? 1 : 0; this.chargeProg = 0; this.finale = 0;
    this.gauge = this.smudgeT = this.slowT = this.wardHits = this.typoFree = 0;
    this.longest = ''; this.cleanWord = true; this.typoFlash = 0; this.bossesDown = 0; this.perfects = 0;
    this.stacks = {}; this.rerollLeft = 1; this.freeze = 0; this.shake = 0; this.paused = false;
    this.mode = 'play'; this.pickBuf = ''; this.lastUpg = ''; this.alarmT = 0; this.beatT = 0;
    this.engine.spells = ['nova', 'slow', 'erase', 'finale'];
    if (this.shipId === 'scribe') this.engine.spells.push('edit');
    if (this.shipId === 'cartographer') this.engine.spells.push('route');
    if (save.hasUnlock('echo')) this.engine.spells.push('echo');
    this.bank = new WordBank(currentWordSet().words);

    drawBackdrop(this); ensureTextures(this);
    this.g = this.add.graphics().setDepth(5);
    this.hud = this.add.graphics().setDepth(20);
    this.vig = this.add.image(0, 0, 'dangerVig').setOrigin(0).setDepth(15).setAlpha(0);
    this.flashRect = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(30);

    this.tTopDim = txt(this, CX, LY.topY, '', LY.topFont, '#a9a89f', 0, 0.5, FONT_C).setDepth(19);
    this.tTopInk = txt(this, CX, LY.topY, '', LY.topFont, CSS.red, 0, 0.5, FONT_C).setDepth(19);
    this.tTopPct = txt(this, CX, LY.topY + 35, '', 12, CSS.grey, 0.5, 0.5, FONT_C).setDepth(19);
    this.chip = this.add.graphics().setDepth(31);
    this.tStage = txt(this, MOBILE ? 14 : 28, MOBILE ? 18 : 24, '', LY.chipFont, CSS.ink, 0, 0.5, FONT_C).setDepth(32);
    this.tInk = txt(this, MOBILE ? 14 : 28, MOBILE ? 38 : 50, '', LY.chipSubFont, CSS.red, 0, 0.5, FONT_C).setDepth(32);
    this.tHint = txt(this, CX, LY.hintY, '', LY.bossHint, CSS.red, 0.5, 0.5).setDepth(32).setWordWrapWidth(W - 30).setAlign('center');
    this.tCombo = txt(this, LY.comboX, LY.comboY, '', LY.comboFont, CSS.ink, 1, 0.5, FONT_C).setDepth(20);
    this.tComboSub = txt(this, LY.comboX, LY.comboSubY, '', MOBILE ? 13 : 16, CSS.mid, 1, 0.5, FONT_C).setDepth(20);
    this.tScore = txt(this, LY.comboX, LY.scoreY, '', MOBILE ? 12 : 15, CSS.grey, 1, 0.5, FONT_C).setDepth(20);
    this.tToast = txt(this, CX, CY + 110, '', MOBILE ? 17 : 22, CSS.red).setDepth(20).setAlpha(0).setWordWrapWidth(W - 30).setAlign('center');
    this.tBanner = txt(this, CX, LY.bannerY, '', LY.bannerFont, CSS.ink, 0.5, 0.5, FONT_C).setDepth(22).setAlpha(0);
    this.tSub = txt(this, CX, LY.subY, '', LY.subFont, CSS.mid).setDepth(22).setAlpha(0).setWordWrapWidth(W - 40).setAlign('center');
    this.tUpg = txt(this, LY.upgX, LY.upgY, '', MOBILE ? 12 : 14, CSS.grey, 0, 0, FONT_C).setDepth(20).setLineSpacing(4);

    const slots = this.slotDefs();
    this.slotLabels = slots.map((s, i) => txt(this, this.slotX(i, slots.length), LY.slotY + LY.slotLabelDy, MOBILE ? '' : '!' + s.word, 11, CSS.grey, 0.5, 0.5, FONT_C).setDepth(20));
    this.slotKeys = slots.map((s, i) => txt(this, this.slotX(i, slots.length), LY.slotY, MOBILE ? s.word : s.word[0].toUpperCase(), MOBILE ? 13 : 24, CSS.grey, 0.5, 0.5, FONT_C).setDepth(21));

    this.previewTexts = [0, 1, 2].map(() => txt(this, 0, 0, '', 12, CSS.grey, 0.5, 0.5).setDepth(9).setVisible(false));
    const kb = this.input.keyboard!;
    kb.addCapture('TAB,BACKSPACE,SPACE');
    kb.on('keydown', this.onKey, this);
    this.events.once('shutdown', () => { kb.off('keydown', this.onKey, this); music.stop(); });
    this.buildPause();
    if (MOBILE) this.buildTouch();
    audio.setMuted(audio.muted);
    audio.ensure();
    music.start(); music.set(0, 88);
    this.nextStage();
  }

  /** Phone controls: on-screen keyboard, tap-to-cast spell buttons, and a pause button. */
  private buildTouch() {
    new OnScreenKeyboard(this, (k) => this.onKey({ key: k } as KeyboardEvent));
    const slots = this.slotDefs();
    slots.forEach((sl, i) => {
      const z = this.add.zone(this.slotX(i, slots.length), LY.slotY, LY.slotSpacing, LY.slotSize + 14).setDepth(46).setInteractive();
      z.on('pointerdown', () => this.tapSpell(sl.word));
    });
    txt(this, W - 22, 22, 'II', 18, CSS.mid, 0.5, 0.5, FONT_C).setDepth(33);
    const pb = this.add.zone(W - 22, 22, 48, 48).setDepth(60).setInteractive();
    pb.on('pointerdown', () => { if (this.mode !== 'pick' && this.mode !== 'ending') this.setPaused(!this.paused); });
  }

  private tapSpell(name: string) {
    if (this.paused || this.mode !== 'play') return;
    audio.ensure();
    this.castSpell(name);
  }

  private slotDefs() {
    const list = [{ word: 'nova' }, { word: 'slow' }, { word: 'erase' }, { word: 'ward' }];
    if (save.hasUnlock('echo')) list.push({ word: 'echo' });
    if (this.shipId === 'scribe') list.push({ word: 'edit' });
    if (this.shipId === 'cartographer') list.push({ word: 'route' });
    list.push({ word: 'finale' });
    return list;
  }
  private slotX(i: number, n: number) { return CX + (i - (n - 1) / 2) * LY.slotSpacing; }

  // ================================================================ stages
  private stage(): Stage { return STAGES[Math.max(0, this.stageIdx)]; }
  private tuneW(): number { const s = this.stage(); return s.t === 'wave' ? s.w : BOSSES[s.b].tuning; }
  private upg(id: string) { return this.stacks[id] || 0; }

  private nextStage() {
    this.stageIdx++;
    if (this.stageIdx >= STAGES.length) { this.finish(true); return; }
    const s = STAGES[this.stageIdx];
    this.stageT = 0; this.typoFree = this.upg('forgive'); this.spawnT = 0.5; this.queue = []; this.inset = 0;
    this.mode = 'play';
    if (s.t === 'wave') {
      this.banner(`PAGE ${s.w}`, WAVE_INTRO[s.w - 1]);
    } else {
      const def = BOSSES[s.b];
      this.mode = 'bossintro'; this.introT = 2.4;
      this.boss = { def, phase: 0, idx: 0, wordId: null, wait: 0.4, mask: 0, blotT: 7, hit: 0, done: 0, total: def.phases.reduce((a, p) => a + p.length, 0), splats: [], foldT: this.margin ? 6 : 9, fold: 0 };
      this.banner(def.name.toUpperCase(), BOSS_HINT[def.gimmick]);
      audio.bossIntro(); this.shake = 10; this.flash(CSS.red, 0.2);
    }
    this.updateMusic();
  }

  private endStage() {
    const s = this.stage();
    if (this.upg('mend')) { this.hp = Math.min(this.maxHp, this.hp + this.upg('mend')); this.toast('Mended', CSS.red); }
    if (this.stageIdx >= STAGES.length - 1) { this.finish(true); return; }
    this.openPick(s.t === 'boss');
  }

  private updateMusic() {
    const s = this.stage(); let inten = 0; let bpm = 86;
    if (s.t === 'wave') { inten = [0, 1, 1, 2, 2][s.w - 1]; bpm = 86 + s.w * 4; } else { inten = 3; bpm = 112 + s.b * 6; }
    if (this.combo >= 20) inten = Math.min(3, inten + 1);
    if (this.mode === 'pick') inten = 0;
    music.set(inten, bpm);
  }

  // ================================================================ input
  private onKey(ev: KeyboardEvent) {
    if (this.mode === 'ending') return;
    if (this.routeAsk && !this.paused) {
      const sides: Record<string, number> = { n: 0, w: 1, e: 2, s: 3 }; const nm = ['north', 'west', 'east', 'south'];
      const kk = ev.key.toLowerCase();
      if (kk in sides) { this.routeSide = sides[kk]; this.routeT = 10; this.routeAsk = false; this.queue = []; this.toast('Enemies now arrive from the ' + nm[sides[kk]], CSS.red); audio.spell('edit'); }
      else if (ev.key === 'Escape' || ev.key === 'Backspace') { this.routeAsk = false; if (!this.upg('compass')) this.charges++; this.toast('Cancelled', CSS.mid); }
      return;
    }
    if (ev.key === 'Escape') { if (this.mode !== 'pick') this.setPaused(!this.paused); return; }
    if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
    if (this.paused) { if (ev.key.toLowerCase() === 'm') audio.setMuted(!audio.muted); return; }
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (this.mode === 'pick') { this.handlePick(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key); return; }
    if (this.mode === 'bossintro') return;
    const views = this.enemies
      .filter((e) => e.x > -10 && e.x < W + 10 && e.y > -10 && e.y < H + 10)
      .map((e) => ({ id: e.id, word: e.word, distSq: (e.x - CX) ** 2 + (e.y - CY) ** 2 }));
    for (const x of this.engine.key(k, views, this.time.now)) this.handle(x);
  }

  private handle(ev: TypingEvent) {
    switch (ev.t) {
      case 'lock': audio.lock(); this.cleanWord = true; break;
      case 'letter': {
        audio.key(this.combo);
        const fin = this.upg('finish'); const le = this.enemies.find((x) => x.id === ev.id);
        if (fin && le && le.kind !== 'boss' && this.engine.progress > 0 && le.word.length - this.engine.progress <= fin && le.word.length - this.engine.progress > 0) {
          this.engine.correctKeys += le.word.length - this.engine.progress; this.engine.release(); this.onComplete(le.id);
        }
        break;
      }
      case 'complete': audio.key(this.combo); this.onComplete(ev.id); break;
      case 'typo': this.onTypo(); break;
      case 'spellBuf': audio.select(); break;
      case 'spell': this.castSpell(ev.name); break;
      default: break;
    }
  }

  private chp() { return Math.max(4, 10 - 3 * this.upg('wide')); }

  private onTypo() {
    this.cleanWord = false;
    if (this.typoFree > 0) { this.typoFree--; this.toast('Forgiven', CSS.mid); audio.select(); return; }
    audio.typo();
    this.typoFlash = 0.3; this.shake = Math.max(this.shake, 4);
    const lk = this.enemies.find((x) => x.id === this.engine.lockedId);
    if (!(lk && lk.kind === 'boss')) { // boss typos cost ink, not combo
      const cp = this.chp();
      if (this.combo >= cp) this.pop(CX, CY - 70, 'combo -' + (this.combo - Math.floor(this.combo / cp) * cp), CSS.red, 18);
      this.combo = Math.floor(this.combo / cp) * cp;
      this.finale = Math.max(0, this.finale - 5);
    }
    if (!this.upg('steady')) {
      this.gauge += 18;
      if (this.gauge >= 100) { this.gauge = 0; this.smudgeT = 3; this.toast('SMUDGED: your next word needs a second pass', CSS.red); }
    }
  }

  private mult() { return Math.min(4, 1 + Math.floor(this.combo / 10)); }

  private onComplete(id: number) {
    const e = this.enemies.find((x) => x.id === id);
    if (!e) return;
    if (this.smudgeT > 0) {
      this.smudgeT = 0; this.engine.relock(e.id); this.setInk(e, 0); this.cleanWord = false;
      this.toast('Smudged. Type it again.', CSS.red); audio.typo(); return;
    }
    const perfect = this.cleanWord; this.cleanWord = true;
    this.words++;
    if (e.word.length > this.longest.length) this.longest = e.word;
    const before = this.combo;
    this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.finale = Math.min(FINALE_NEEDED, this.finale + (perfect ? 2 : 1));
    if (perfect) { this.perfects++; audio.perfect(); }

    // spell charges
    const every = Math.max(2, (this.shipId === 'scribe' ? 7 : 5) - this.upg('tempo'));
    if (++this.chargeProg >= every) {
      this.chargeProg = 0;
      if (this.charges < MAX_CHARGES) { this.charges++; audio.chargeUp(); this.pop(CX, CY - 90, 'spell charge', CSS.red, 16); }
    }

    // score
    let pts = e.word.length * 10 * this.mult();
    if (perfect) pts *= 1.5;
    if (this.upg('sharp') && e.word.length >= 6) pts *= 1 + this.upg('sharp');
    if (this.upg('gambit')) pts *= 1 + 0.5 * this.upg('gambit');
    if (this.upg('inkwell') && this.gauge >= 50) pts *= 2;
    pts = Math.round(pts); this.score += pts;
    this.pop(e.x, e.y - 40, '+' + pts, perfect ? CSS.red : CSS.ink, perfect ? 22 : 17);

    this.shipAng = Math.atan2(e.y - CY, e.x - CX);
    this.shots.push({ x1: e.x, y1: e.y, t: 0.2 });
    audio.fire(this.combo);

    // combo milestones: the big hit of dopamine
    for (const m of MILESTONES) if (before < m && this.combo >= m) this.milestone(m);
    if (Math.floor(before / 10) < Math.floor(this.combo / 10) && this.combo <= 30) this.pop(LY.comboX - 50, 110, 'x' + this.mult(), CSS.red, 30);
    this.updateMusic();

    // upgrades that react to a finished word
    const echo = (this.upg('echo') && this.words % 4 === 0) || this.echoNext;
    this.echoNext = false;
    const others = () => this.enemies.filter((o) => o.id !== e.id && o.kind !== 'boss');
    if (e.kind === 'boss') { this.bossWordDone(e); return; }
    if (e.hp > 1) {
      e.hp = 1;
      const [lo, hi] = this.lenRange();
      e.word = e.disp = this.bank.pick(hi, hi + 2, this.usedFirst(e.id), this.usedWords());
      this.rings.push({ x: e.x, y: e.y, t: 0, dur: 0.4, r: 44, col: COL.ink, w: 2 });
      this.burst(e.x, e.y, 10, [COL.ink, COL.grey], 150);
      this.relabel(e); void lo; this.freeze = 0.03;
      return;
    }
    const ex = e.x, ey = e.y;
    this.kill(e, true);
    const chain = this.upg('chain');
    if (chain) {
      const t = others().filter((o) => o.word.length <= 3 + chain).sort((a, b) => Math.hypot(a.x - ex, a.y - ey) - Math.hypot(b.x - ex, b.y - ey))[0];
      if (t) { this.shots.push({ x1: t.x, y1: t.y, t: 0.2 }); this.kill(t, false); }
    }
    const sp = this.upg('splash');
    if (sp) for (const o of others()) if (o.word.length <= 4 && Math.hypot(o.x - ex, o.y - ey) < 70 + 30 * sp) this.kill(o, false);
    if (echo) {
      const t = others().sort((a, b) => Math.hypot(a.x - CX, a.y - CY) - Math.hypot(b.x - CX, b.y - CY))[0];
      if (t) { this.pop(t.x, t.y - 30, 'ECHO', CSS.red, 16); this.shots.push({ x1: t.x, y1: t.y, t: 0.2 }); this.kill(t, false); }
    }
  }

  private milestone(m: number) {
    audio.milestone();
    this.freeze = 0.09; this.shake = 12;
    this.flash(CSS.red, 0.22);
    this.rings.push({ x: CX, y: CY, t: 0, dur: 0.7, r: 420, col: COL.red, w: 3 });
    this.rings.push({ x: CX, y: CY, t: 0, dur: 0.9, r: 300, col: COL.ink, w: 2 });
    this.burst(CX, CY, 40, [COL.red, COL.redHi, COL.ink], 420);
    this.tBanner.setText(m + ' COMBO').setColor(CSS.red).setAlpha(1).setScale(SET.reduce ? 1 : 1.6);
    this.tSub.setText(m >= 50 ? 'unstoppable' : m >= 25 ? 'on fire' : 'keep the rhythm').setAlpha(1);
    this.tweens.killTweensOf(this.tBanner); this.tweens.killTweensOf(this.tSub);
    this.tweens.add({ targets: this.tBanner, scale: 1, duration: 180, ease: 'Back.Out' });
    this.tweens.add({ targets: [this.tBanner, this.tSub], alpha: 0, delay: 900, duration: 450 });
  }

  private kill(e: Enemy, byWord: boolean) {
    const big = e.kind === 'splitter' || e.kind === 'shielded';
    audio.kill(this.combo, big);
    this.burst(e.x, e.y, big ? 18 : 12, [COL.red, COL.redHi, COL.ink, COL.grey], big ? 280 : 200);
    this.rings.push({ x: e.x, y: e.y, t: 0, dur: 0.35, r: 36, col: COL.red, w: 2 });
    if (!byWord) { this.score += 5; this.pop(e.x, e.y - 30, '+5', CSS.grey, 14); }
    this.freeze = Math.max(this.freeze, big ? 0.05 : 0.025);
    this.shake = Math.max(this.shake, big ? 7 : 3.5);
    if (this.engine.lockedId === e.id) this.engine.release();
    e.label.destroy(); e.ink.destroy();
    this.enemies = this.enemies.filter((x) => x !== e);
    if (e.kind === 'splitter') {
      const n = 2 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random();
        const w = this.bank.pick(3, 3, this.usedFirst(), this.usedWords());
        this.addEnemy('child', w, e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, (e.speed / 0.9) * SPEED_FACTOR.child);
      }
    }
  }

  // ================================================================ spells
  private castSpell(name: string) {
    if (name === 'finale') {
      if (this.finale < FINALE_NEEDED) { this.toast(`Finale needs a full combo bar (${this.finale}/${FINALE_NEEDED})`, CSS.mid); return; }
      this.finale = 0; audio.spell('finale'); this.flash('#ffffff', 0.55); this.shake = 22; this.freeze = 0.12;
      this.rings.push({ x: CX, y: CY, t: 0, dur: 0.9, r: 700, col: COL.red, w: 5 });
      for (const e of [...this.enemies]) if (e.kind !== 'boss') this.kill(e, false);
      this.burst(CX, CY, 80, [COL.red, COL.redHi, COL.ink], 600);
      const b = this.enemies.find((e) => e.kind === 'boss'); if (b) this.bossWordDone(b);
      this.tBanner.setText('FINALE').setColor(CSS.red).setAlpha(1);
      this.tweens.killTweensOf(this.tBanner); this.tweens.add({ targets: this.tBanner, alpha: 0, delay: 600, duration: 500 });
      return;
    }
    const cost = name === 'edit' ? (this.upg('footnote') ? 1 : 2) : name === 'route' && this.upg('compass') ? 0 : 1;
    if (name === 'ward' && !this.upg('ward')) { this.toast('Ward is not unlocked yet. Pick the Ward upgrade.', CSS.mid); return; }
    const free = this.upg('surge') > 0 && this.combo >= 20;
    if (!free && this.charges < cost) { this.toast('No spell charges. Type clean words to earn them.', CSS.mid); return; }
    if (!free) this.charges -= cost;
    audio.spell(name as 'nova');
    if (name === 'nova') {
      this.rings.push({ x: CX, y: CY, t: 0, dur: 0.55, r: 260, col: COL.red, w: 4 });
      this.shake = 12; this.flash(CSS.red, 0.12);
      for (const e of [...this.enemies]) if (e.kind !== 'boss' && e.word.length <= 5 && Math.hypot(e.x - CX, e.y - CY) <= 260) this.kill(e, false);
    } else if (name === 'slow') {
      this.slowT = 5; this.rings.push({ x: CX, y: CY, t: 0, dur: 0.7, r: 500, col: COL.grey, w: 3 });
    } else if (name === 'erase') {
      if (this.boss) this.boss.mask = 0;
      const t = this.enemies.filter((e) => e.kind !== 'boss').sort((a, b) => Math.hypot(a.x - CX, a.y - CY) - Math.hypot(b.x - CX, b.y - CY))[0];
      if (t) { this.shots.push({ x1: t.x, y1: t.y, t: 0.25 }); this.kill(t, false); }
      this.toast('Erased', CSS.ink);
    } else if (name === 'ward') {
      this.wardHits = 2 + this.upg('ward'); this.rings.push({ x: CX, y: CY, t: 0, dur: 0.4, r: 60, col: COL.red, w: 3 });
    } else if (name === 'echo') {
      this.echoNext = true; this.toast('Echo: your next word fires twice', CSS.red);
    } else if (name === 'route') {
      this.routeAsk = true; this.toast('Choose a side:  N  W  E  S   (Esc cancels)', CSS.red);
    } else if (name === 'edit') {
      this.engine.release();
      for (const e of this.enemies) {
        if (e.kind === 'boss') continue;
        e.word = e.disp = this.bank.pick(3, 4, this.usedFirst(e.id), this.usedWords());
        this.relabel(e);
        this.rings.push({ x: e.x, y: e.y, t: 0, dur: 0.3, r: 30, col: COL.ink, w: 2 });
      }
      this.toast('Rewritten', CSS.ink);
    }
  }

  // ================================================================ enemies
  private usedFirst(except?: number) { return new Set(this.enemies.filter((e) => e.id !== except).map((e) => e.word[0])); }
  private usedWords() { return new Set(this.enemies.map((e) => e.word)); }
  private lenRange(): [number, number] { const [lo, hi] = WORD_LEN[this.tuneW() - 1]; const g = this.upg('gambit') + (this.margin ? 1 : 0); return [lo + g, hi + g]; }

  private addEnemy(kind: Kind, word: string, x: number, y: number, speed: number, disp?: string) {
    const size = kind === 'boss' ? 30 : 24;
    const base = { fontFamily: FONT, fontSize: size + 'px' };
    const res = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
    const label = this.add.text(0, 0, disp ?? word, { ...base, color: CSS.mid }).setOrigin(0, 0.5).setDepth(10).setResolution(res);
    const ink = this.add.text(0, 0, '', { ...base, color: CSS.red }).setOrigin(0, 0.5).setDepth(11).setResolution(res);
    const e: Enemy = { id: this.nextId++, kind, word, disp: disp ?? word, x, y, speed, hp: kind === 'shielded' ? 2 : 1, phase: Math.random() * 6.28, ang: 0, r: RADIUS[kind], t1: kind === 'marker' ? 3 : kind === 'scrambler' ? 2.5 : 0, label, ink };
    this.enemies.push(e);
    return e;
  }
  private relabel(e: Enemy) { e.label.setText(e.disp); this.setInk(e, 0); }
  private setInk(e: Enemy, n: number) { e.ink.setText(e.disp === e.word ? e.word.slice(0, n) : n ? '→ ' + e.word.slice(0, n) : ''); }

  private makePlan(kinds: string[]): Plan {
    const weights: Record<string, number> = { drifter: 3, dasher: 1.2, splitter: 1, shielded: 1, scrambler: 1, inker: 0.8, marker: 0.7 };
    let total = 0; for (const k of kinds) total += weights[k] ?? 1;
    let r = Math.random() * total; let kind = kinds[0] as Kind;
    for (const k of kinds) { r -= weights[k] ?? 1; if (r <= 0) { kind = k as Kind; break; } }

    const [lo, hi] = this.lenRange();
    const uf = this.usedFirst(); const uw = this.usedWords();
    for (const p of this.queue) { uf.add(p.word[0]); uw.add(p.word); }
    let word: string; let cost: number;
    if (kind === 'dasher') { word = this.bank.pick(3, Math.min(4, hi), uf, uw); cost = word.length + 1; }
    else if (kind === 'splitter') { word = this.bank.pick(Math.max(lo, 4), Math.max(hi, 5), uf, uw); cost = word.length + 9; }
    else if (kind === 'shielded') { word = this.bank.pick(lo, lo + 1, uf, uw); cost = word.length + hi + 3; }
    else if (kind === 'scrambler') { word = this.bank.pick(Math.max(lo, 4), Math.max(hi, 5), uf, uw); cost = word.length + 3; }
    else if (kind === 'marker') { word = this.bank.pick(Math.max(lo, 4), Math.max(hi, 5), uf, uw); cost = word.length + 2; }
    else { word = this.bank.pick(lo, hi, uf, uw); cost = word.length + 1; }

    const m = 50; let side: number;
    const ymin = MOBILE ? 190 : 100; const xm = MOBILE ? 50 : 140;
    if (this.routeSide !== null && this.routeT > 0) side = this.routeSide;
    else { const roll = Math.random(); side = roll < 0.3 ? 0 : roll < 0.58 ? 1 : roll < 0.86 ? 2 : 3; }
    if (MOBILE && side === 3) side = 0; // the bottom is the keyboard
    let x: number, y: number;
    if (side === 0) { x = xm + Math.random() * (W - 2 * xm); y = -m; }
    else if (side === 1) { x = -m; y = ymin + Math.random() * (PLAY_B - ymin - 180); }
    else if (side === 2) { x = W + m; y = ymin + Math.random() * (PLAY_B - ymin - 180); }
    else { x = xm + Math.random() * (W - 2 * xm); y = H + m; }
    return { kind, word, x, y, cost };
  }

  private spawn(kinds: string[], load: number, burst = false) {
    const w = this.tuneW();
    const depth = this.shipId === 'cartographer' && !burst ? 3 : 1;
    let plan: Plan;
    if (burst) plan = this.makePlan(kinds);
    else { while (this.queue.length < depth) this.queue.push(this.makePlan(kinds)); plan = this.queue.shift()!; }
    let word = plan.word;
    if (this.usedFirst().has(word[0]) || this.usedWords().has(word)) word = this.bank.pick(Math.max(3, word.length - 1), word.length + 1, this.usedFirst(), this.usedWords());
    if (!burst) while (this.queue.length < depth) this.queue.push(this.makePlan(kinds));

    const wpm = WPM_LEVELS[this.diff];
    const cross = CROSS_SECONDS[w - 1] * Math.pow(40 / wpm, 0.4);
    const speedMul = SET.speed * (this.margin ? 1.15 : 1) * (1 + 0.025 * Math.max(0, this.stageIdx)) * (this.easeT > 0 ? 0.85 : 1);
    this.addEnemy(plan.kind, word, plan.x, plan.y, (560 / cross) * SPEED_SCALE * SPEED_FACTOR[plan.kind] * speedMul);
    if (burst) return;
    const cps = (wpm * 5) / 60;
    const ramp = Math.min(1, 0.75 + this.stageT / 20);
    this.spawnT = plan.cost / (cps * load * ramp);
  }

  private scramble(e: Enemy) {
    const keep = Math.max(1, this.engine.lockedId === e.id ? this.engine.progress : 1);
    const tail = e.word.slice(keep).split('');
    if (tail.length < 2) return;
    const head = e.word.slice(0, keep); const orig = tail.join('');
    for (let t = 0; t < 6; t++) { for (let i = tail.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [tail[i], tail[j]] = [tail[j], tail[i]]; } if (tail.join('') !== orig) break; }
    e.word = e.disp = head + tail.join('');
    e.label.setText(e.word);
    this.rings.push({ x: e.x, y: e.y, t: 0, dur: 0.3, r: 30, col: COL.ink, w: 1.5 });
    audio.select();
  }

  private markerPulse(m: Enemy) {
    this.rings.push({ x: m.x, y: m.y, t: 0, dur: 0.7, r: 260, col: COL.red, w: 2.5 });
    audio.lock();
    const [lo] = this.lenRange();
    for (const o of this.enemies) {
      if (o === m || o.kind === 'boss' || Math.hypot(o.x - m.x, o.y - m.y) > 260) continue;
      if (o.kind === 'shielded' && o.hp < 2) { o.hp = 2; o.word = o.disp = this.bank.pick(lo, lo + 1, this.usedFirst(o.id), this.usedWords()); this.relabel(o); this.pop(o.x, o.y - 40, 'healed', CSS.red, 15); if (this.engine.lockedId === o.id) this.engine.release(); }
      else if (this.engine.lockedId === o.id && this.engine.progress > 0) { this.engine.progress = 0; this.setInk(o, 0); this.pop(o.x, o.y - 40, 'healed', CSS.red, 15); }
    }
  }

  // ================================================================ boss
  private spawnBossWord() {
    const b = this.boss!; const pair = b.def.phases[b.phase][b.idx];
    const e = this.addEnemy('boss', pair[1], CX, LY.bossWordY, 0, pair[0]);
    b.wordId = e.id;
  }

  private bossWordDone(e: Enemy) {
    const b = this.boss; if (!b) return;
    audio.bossHit(); this.shake = Math.max(this.shake, 14); this.freeze = 0.1; b.hit = 1; b.done++;
    this.burst(CX, LY.bossBodyY, 24, [COL.red, COL.ink], 360);
    this.rings.push({ x: CX, y: LY.bossBodyY, t: 0, dur: 0.5, r: 120, col: COL.red, w: 3 });
    if (this.engine.lockedId === e.id) this.engine.release();
    e.label.destroy(); e.ink.destroy(); this.enemies = this.enemies.filter((x) => x !== e);
    b.wordId = null; b.idx++;
    if (b.idx >= b.def.phases[b.phase].length) {
      b.phase++; b.idx = 0;
      if (b.phase >= b.def.phases.length) { this.bossDefeated(); return; }
      b.wait = 2.2;
      this.toast(`Phase ${b.phase + 1}`, CSS.red);
      for (let i = 0; i < (this.margin ? 3 : 2); i++) this.spawn(['drifter', 'dasher'], 0.4, true);
    } else b.wait = 0.2;
  }

  private bossDefeated() {
    const b = this.boss!; this.boss = null; this.bossesDown++; this.easeT = 12; this.inset = 0;
    audio.bossDie(); this.shake = 26; this.freeze = 0.25; this.flash('#ffffff', 0.7);
    this.score += 1000;
    for (const e of [...this.enemies]) this.kill(e, false);
    for (let i = 0; i < 5; i++) this.rings.push({ x: CX, y: LY.bossBodyY, t: -i * 0.1, dur: 0.9, r: 200 + i * 90, col: i % 2 ? COL.ink : COL.red, w: 3 });
    this.burst(CX, LY.bossBodyY, 120, [COL.red, COL.redHi, COL.ink, COL.grey], 700);
    this.tBanner.setText(b.def.name.toUpperCase()).setColor(CSS.red).setAlpha(1).setScale(1.5);
    this.tSub.setText('defeated').setAlpha(1);
    this.tweens.killTweensOf(this.tBanner); this.tweens.killTweensOf(this.tSub);
    this.tweens.add({ targets: this.tBanner, scale: 1, duration: 250, ease: 'Back.Out' });
    this.tweens.add({ targets: [this.tBanner, this.tSub], alpha: 0, delay: 1400, duration: 500 });
    this.mode = 'clearing'; this.clearT = 5.2; // brief beat of calm, then the upgrade pick
    this.stageT = 1e9;
  }

  // ================================================================ upgrades pick
  private openPick(forceRare: boolean) {
    this.mode = 'pick'; this.pickBuf = '';
    this.cards = drawCards(this.stacks, this.shipId, save.getUnlocks(), this.stageIdx >= 2 || forceRare, forceRare);
    this.buildPick(); this.updateMusic();
  }

  private doReroll() {
    if (!this.rerollLeft) return;
    this.rerollLeft--; this.cards = drawCards(this.stacks, this.shipId, save.getUnlocks(), this.stageIdx >= 2, false); this.buildPick();
  }

  private buildPick() {
    this.pickObjs.forEach((o) => o.destroy()); this.pickObjs = []; this.pickInk = [];
    const bg = this.add.rectangle(W / 2, H / 2, W, H, COL.paper, MOBILE ? 1 : 0.93).setDepth(40);
    const mch = Math.min(190, Math.floor((PLAY_B - 52 - 120 - 20) / 3));
    const t1 = txt(this, CX, MOBILE ? 60 : 182, 'CHOOSE AN UPGRADE', MOBILE ? 28 : 36, CSS.ink, 0.5, 0.5, FONT_C).setDepth(41);
    const t2 = txt(this, CX, MOBILE ? 100 : 192, MOBILE ? 'type the word, or tap a card' : 'type the word on a card' + (this.rerollLeft ? '      !redraw to shuffle (once)' : ''), MOBILE ? 15 : 18, CSS.mid).setDepth(41);
    this.pickObjs.push(bg, t1, t2);
    if (MOBILE && this.rerollLeft) {
      const rb = this.add.zone(CX, PLAY_B - 24, 200, 40).setDepth(46).setInteractive();
      rb.on('pointerdown', () => this.doReroll());
      const rt = txt(this, CX, PLAY_B - 24, 'shuffle cards (1)', 16, CSS.red, 0.5, 0.5, FONT_C).setDepth(46);
      const rg = this.add.graphics().setDepth(46); rg.lineStyle(1, COL.red, 1).strokeRect(CX - 100, PLAY_B - 44, 200, 40);
      this.pickObjs.push(rb, rt, rg);
    }
    this.cards.forEach((u, i) => {
      const cw = MOBILE ? W - 40 : 300, ch = MOBILE ? mch : 270;
      const x = MOBILE ? CX : CX + (i - 1) * 350; const y = MOBILE ? 120 + i * (mch + 10) : 250;
      const g = this.add.graphics().setDepth(41);
      g.fillStyle(COL.white, 0.9).fillRect(x - cw / 2, y, cw, ch);
      g.lineStyle(u.rare ? 2 : 1.2, u.rare ? COL.red : COL.grey, 1).strokeRect(x - cw / 2, y, cw, ch);
      const own = this.upg(u.id);
      const title = txt(this, x, y + (MOBILE ? mch * 0.17 : 46), u.title, MOBILE ? 24 : 28, CSS.ink, 0.5, 0.5, FONT_C).setDepth(42);
      const tag = txt(this, x, y + (MOBILE ? mch * 0.32 : 78), u.rare ? 'RARE' : u.ship ? 'SHIP PERK' : own ? `owned x${own}` : 'new', 12, u.rare ? CSS.red : CSS.grey, 0.5, 0.5, FONT_C).setDepth(42);
      const desc = txt(this, x, y + (MOBILE ? mch * 0.52 : 140), u.desc, MOBILE ? 15 : 17, CSS.mid).setDepth(42).setWordWrapWidth(cw - 50).setAlign('center');
      const kb = this.add.graphics().setDepth(42);
      const ky = y + (MOBILE ? mch - 44 : 205); const kh = MOBILE ? 34 : 42;
      kb.lineStyle(1, COL.red, 1).strokeRect(x - 100, ky, 200, kh);
      const kw = txt(this, x, ky + kh / 2, u.word, MOBILE ? 22 : 26, CSS.grey, 0.5, 0.5).setDepth(43);
      const ki = txt(this, x - kw.width / 2, ky + kh / 2, '', MOBILE ? 22 : 26, CSS.red, 0, 0.5).setDepth(44);
      this.pickInk.push(ki);
      const zone = this.add.zone(x, y + ch / 2, cw, ch).setDepth(44).setInteractive();
      zone.on('pointerdown', () => { if (this.mode === 'pick') this.choose(u); });
      const objs = [g, title, tag, desc, kb, kw, ki];
      objs.forEach((o, j) => { (o as Phaser.GameObjects.Text).setAlpha?.(0); this.tweens.add({ targets: o, alpha: 1, delay: i * 90 + j * 10, duration: 260 }); });
      this.pickObjs.push(...objs, zone);
    });
  }

  private handlePick(k: string) {
    if (k === 'Backspace') { this.pickBuf = this.pickBuf.slice(0, -1); this.updPickInk(); return; }
    if (k.length !== 1) return;
    if (k === '!' || this.pickBuf.startsWith('!')) {
      const nb = this.pickBuf + k;
      if ('!redraw'.startsWith(nb)) {
        this.pickBuf = nb; audio.select();
        if (nb === '!redraw') {
          this.pickBuf = '';
          if (this.rerollLeft) { this.rerollLeft--; this.cards = drawCards(this.stacks, this.shipId, save.getUnlocks(), this.stageIdx >= 2, false); this.buildPick(); }
        }
      } else { this.pickBuf = ''; audio.typo(); }
      return;
    }
    const nb = this.pickBuf + k;
    const card = this.cards.find((c) => c.word.startsWith(nb));
    if (!card) { this.pickBuf = ''; audio.typo(); this.updPickInk(); return; }
    this.pickBuf = nb; audio.key(nb.length * 2); this.updPickInk();
    if (card.word === nb) this.choose(card);
  }
  private updPickInk() {
    this.cards.forEach((c, i) => this.pickInk[i]?.setText(c.word.startsWith(this.pickBuf) && !this.pickBuf.startsWith('!') ? this.pickBuf : ''));
  }

  private choose(u: Upgrade) {
    this.stacks[u.id] = this.upg(u.id) + 1;
    if (u.id === 'plating') { this.maxHp++; this.hp = Math.min(this.maxHp, this.hp + 1); }
    if (u.id === 'ward' && !this.engine.spells.includes('ward')) this.engine.spells.push('ward');
    audio.pick(); this.flash(CSS.red, 0.15);
    this.pickObjs.forEach((o) => o.destroy()); this.pickObjs = []; this.pickInk = [];
    this.pickBuf = '';
    this.nextStage();
  }

  // ================================================================ loop
  update(_t: number, delta: number) {
    const raw = Math.min(delta / 1000, 0.05);
    this.pulse += raw;
    if (this.paused || this.mode === 'pick' || this.mode === 'ending') { this.render(); return; }
    if (this.freeze > 0) { this.freeze = SET.reduce ? 0 : this.freeze - raw; if (this.freeze > 0) { this.render(); return; } }
    this.sim(raw);
    this.render();
  }

  private sim(dt: number) {
    this.elapsed += dt; this.stageT += dt;
    const s = this.stage();
    this.shake *= Math.pow(0.0008, dt);
    if (this.smudgeT > 0) this.smudgeT -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    if (this.typoFlash > 0) this.typoFlash -= dt;
    this.gauge = Math.max(0, this.gauge - 4 * dt);
    if (this.routeT > 0) this.routeT -= dt;
    if (this.easeT > 0) this.easeT -= dt;

    if (this.mode === 'bossintro') { this.introT -= dt; if (this.introT <= 0) this.mode = 'play'; }

    if (this.mode === 'play') {
      if (s.t === 'wave') {
        this.spawnT -= dt;
        if (this.spawnT <= 0) { if (this.enemies.length >= MAX_ALIVE[s.w - 1]) this.spawnT = 0.4; else this.spawn(WAVE_KINDS[s.w - 1], LOAD[s.w - 1]); }
        if (this.stageT >= WAVE_SECONDS) { this.mode = 'clearing'; this.clearT = 0; }
      } else if (this.boss) {
        const b = this.boss;
        this.spawnT -= dt;
        if (this.spawnT <= 0) { if (this.enemies.filter((e) => e.kind !== 'boss').length >= 5) this.spawnT = 0.5; else this.spawn(['drifter', 'dasher'], b.def.gimmick === 'page' ? (this.margin ? 0.3 : 0.22) : this.margin ? 0.42 : 0.3); }
        if (b.hit > 0) b.hit -= dt * 3;
        if (b.wordId === null) { b.wait -= dt; if (b.wait <= 0) this.spawnBossWord(); }
        if (b.def.gimmick === 'page') {
          b.foldT -= dt;
          if (b.fold === 0 && b.foldT <= 0) { b.fold = 1; b.foldT = 3.4; this.toast('The page folds in...', CSS.red); audio.spell('slow'); }
          else if (b.fold === 1 && b.foldT <= 0) {
            b.fold = 0; b.foldT = this.margin ? 7 : 11;
            this.toast('The paper tears open! Everything is loose.', CSS.red); audio.bossHit(); this.shake = 22; this.flash(CSS.red, 0.3);
            for (const k of [...WAVE_KINDS[4]].sort(() => Math.random() - 0.5).slice(0, this.margin ? 6 : 5)) if (this.enemies.length < 14) this.spawn([k], 0, true);
          }
          this.inset += ((b.fold === 1 ? LY.inset : 0) - this.inset) * Math.min(1, dt * 4);
        }
        if (b.def.gimmick === 'blot') {
          b.blotT -= dt; if (b.mask > 0) b.mask -= dt;
          if (b.blotT <= 0) {
            b.blotT = this.margin ? 6 : 9; b.mask = 4.5; b.splats = Array.from({ length: 7 }, () => ({ x: CX + (Math.random() - 0.5) * 520, y: 110 + Math.random() * 190 }));
            this.toast(MOBILE ? 'The Blot spits ink! Tap ERASE to wipe it.' : 'The Blot spits ink! Type !erase to wipe it.', CSS.red); this.shake = Math.max(this.shake, 8); audio.bossHit();
          }
        }
      }
    }
    if (this.mode === 'clearing') {
      this.clearT += dt;
      if (s.t === 'wave' && (this.enemies.length === 0 || this.clearT > 2.5)) {
        for (const e of [...this.enemies]) this.kill(e, false);
        this.endStage(); return;
      }
      if (s.t === 'boss' && this.clearT >= 6) { this.clearT = 0; this.endStage(); return; }
    }

    const slow = this.slowT > 0 ? 0.5 : 1;
    let nearest = 1e9;
    for (const e of [...this.enemies]) {
      if (e.kind === 'boss') continue;
      const dx = CX - e.x, dy = CY - e.y; const d = Math.hypot(dx, dy) || 1;
      e.ang = Math.atan2(dy, dx);
      e.x += (dx / d) * e.speed * slow * dt; e.y += (dy / d) * e.speed * slow * dt;
      if (e.kind === 'drifter') { e.phase += dt * 2; e.x += (-dy / d) * Math.sin(e.phase) * 22 * dt; e.y += (dx / d) * Math.sin(e.phase) * 22 * dt; }
      nearest = Math.min(nearest, d);
      if (e.kind === 'scrambler') { e.t1 -= dt; if (e.t1 <= 0) { e.t1 = 3.2; this.scramble(e); } }
      if (e.kind === 'marker') { e.t1 -= dt; if (e.t1 <= 0) { e.t1 = 5.5; this.markerPulse(e); } }
      if (d < 40) this.hit(e);
    }
    // urgency: alarm beeps when something is close, heartbeat when nearly dead
    this.alarmT -= dt; this.beatT -= dt;
    if (nearest < 150 && this.alarmT <= 0) { audio.alarm(); this.alarmT = 0.45; }
    if (this.hp <= 1 && this.beatT <= 0 && this.mode === 'play') { audio.heartbeat(); this.beatT = 0.85; }

    for (const sh of this.shots) sh.t -= dt;
    this.shots = this.shots.filter((x) => x.t > 0);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.dur);
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; }
    this.parts = this.parts.filter((p) => p.life > 0);
    if (Math.floor(this.elapsed) % 4 === 0) this.updateMusic();
  }

  private hit(e: Enemy) {
    this.combo = 0; this.finale = Math.max(0, this.finale - 10); this.updateMusic();
    if (this.wardHits > 0) {
      this.wardHits--; audio.spell('ward'); this.rings.push({ x: CX, y: CY, t: 0, dur: 0.4, r: 70, col: COL.red, w: 3 });
    } else if (!GOD) {
      this.hp--; audio.hurt(); this.shake = 20; this.flash(CSS.red, 0.35); this.freeze = 0.08;
      this.rings.push({ x: CX, y: CY, t: 0, dur: 0.6, r: 150, col: COL.red, w: 5 });
      this.burst(CX, CY, 30, [COL.red, COL.ink], 380);
    }
    this.kill(e, false);
    if (this.hp <= 0) this.finish(false);
  }

  private calcInk(won = false) {
    const base = Math.floor(this.score / 40) + Math.max(0, this.stageIdx) * 6 + this.bossesDown * 40 + (won ? 80 : 0);
    let ink = base * INK_MULT[this.diff] * (1 + 0.25 * this.upg('gambit')) * (this.margin ? 1.5 : 1);
    if (this.diff >= 2) ink += 10 + this.bossesDown * 5; // tier 3 and up grants bonus ink
    return Math.round(ink);
  }

  private finish(won: boolean) {
    if (this.mode === 'ending') return;
    this.mode = 'ending';
    music.stop();
    if (won) { audio.win(); this.flash('#ffffff', 0.5); } else { audio.lose(); this.shake = 24; this.flash(CSS.red, 0.5); }
    this.tBanner.setText(won ? 'PAGE COMPLETE' : 'PAGE TORN').setColor(won ? CSS.ink : CSS.red).setAlpha(1).setScale(1);
    this.tSub.setText('').setAlpha(0);
    const ink = this.calcInk(won);
    save.addInk(ink); save.addBossKills(this.bossesDown);
    const firstWin = won && !save.getWon(); if (won) save.setWon();
    const tot = this.engine.correctKeys + this.engine.typos;
    const acc = tot ? this.engine.correctKeys / tot : 1;
    const wpm = this.engine.correctKeys / 5 / Math.max(this.elapsed / 60, 1 / 60);
    const bb = save.getBests();
    const nb = { wpm: wpm > bb.wpm, acc: tot >= 30 && acc > bb.acc, combo: this.bestCombo > bb.combo, longest: this.longest.length > bb.longest, score: this.score > bb.score };
    save.setBests({ wpm: Math.max(bb.wpm, wpm), acc: tot >= 30 ? Math.max(bb.acc, acc) : bb.acc, combo: Math.max(bb.combo, this.bestCombo), longest: Math.max(bb.longest, this.longest.length), score: Math.max(bb.score, this.score) });
    const newBest = this.score > save.getBest(this.diff);
    if (newBest) save.setBest(this.diff, this.score);
    const st = this.stage();
    const data: RunSummary = {
      won, wave: st.t === 'wave' ? st.w : st.b === 0 ? 2 : st.b === 1 ? 4 : 5, stage: Math.max(1, this.stageIdx + 1), stages: STAGES.length,
      score: this.score, wpm, accuracy: acc, bestCombo: this.bestCombo,
      longest: this.longest, words: this.words, ink, diff: this.diff, newBest,
      perfects: this.perfects, bosses: this.bossesDown,
      upgrades: UPGRADES.filter((u) => this.upg(u.id)).map((u) => u.title + (this.upg(u.id) > 1 ? ' x' + this.upg(u.id) : '')),
      ship: this.shipId, nb, margin: this.margin, marginNew: firstWin,
    };
    this.time.delayedCall(1600, () => this.scene.start('Summary', data));
  }

  // ================================================================ juice helpers
  private burst(x: number, y: number, n: number, cols: number[], speed: number) {
    if (SET.reduce) n = Math.ceil(n * 0.3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const v = speed * (0.25 + Math.random() * 0.75);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.5, max: 0.85, size: 2 + Math.random() * 4, col: cols[(Math.random() * cols.length) | 0], line: Math.random() < 0.4 });
    }
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
  }
  private flash(color: string | number, a: number) {
    if (SET.reduce) a *= 0.25;
    const c = typeof color === 'string' ? Phaser.Display.Color.HexStringToColor(color).color : color;
    this.flashRect.setFillStyle(c, 1).setAlpha(a);
    this.tweens.killTweensOf(this.flashRect);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 350 });
  }
  private pop(x: number, y: number, s: string, color: string, size: number) {
    const t = txt(this, x, y, s, size, color, 0.5, 0.5, FONT_C).setDepth(25);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 800, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }
  private toast(s: string, color = CSS.red) {
    this.tToast.setText(s).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.tToast);
    this.tweens.add({ targets: this.tToast, alpha: 0, delay: 1200, duration: 500 });
  }
  private banner(a: string, b: string) {
    this.tBanner.setText(a).setColor(a === 'BOSS' || a.startsWith('THE ') ? CSS.red : CSS.ink).setAlpha(1).setScale(1.25);
    this.tSub.setText(b).setAlpha(1);
    this.tweens.killTweensOf(this.tBanner); this.tweens.killTweensOf(this.tSub);
    this.tweens.add({ targets: this.tBanner, scale: 1, duration: 220, ease: 'Back.Out' });
    this.tweens.add({ targets: [this.tBanner, this.tSub], alpha: 0, delay: 1900, duration: 600 });
  }

  private buildPause() {
    const bg = this.add.rectangle(W / 2, H / 2, W, H, COL.paper, 0.95).setDepth(50).setInteractive();
    bg.on('pointerdown', () => { if (this.paused) this.setPaused(false); });
    const t1 = txt(this, W / 2, MOBILE ? 130 : 160, 'PAUSED', MOBILE ? 44 : 60, CSS.ink, 0.5, 0.5, FONT_C).setDepth(51);
    const t2 = txt(this, W / 2, MOBILE ? 440 : 400,
      'Spells: type ! then the word\n\n!nova    blast short words near the ship\n!slow    half-speed enemies for 5 seconds\n!erase   remove the nearest enemy, wipe boss ink\n!ward    absorb hits (needs the Ward upgrade)\n!edit    Scribe only: rewrite every word shorter\n!echo    next word fires twice (needs the Echo unlock)\n!route   Cartographer only: choose where enemies arrive\n!finale  clear the page when the combo bar is full\n\n' +
      'Tab = next target     Backspace twice = drop target\n\nEsc resume        M mute', MOBILE ? 14 : 22, CSS.mid).setDepth(51).setAlign('center').setWordWrapWidth(W - 30);
    const t3 = MOBILE ? txt(this, W / 2, 240, 'Tap the spell buttons to cast.\nTap anywhere to resume.', 18, CSS.red).setDepth(51).setAlign('center') : null;
    this.pauseObjs = t3 ? [bg, t1, t2, t3] : [bg, t1, t2];
    this.pauseObjs.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
  }
  private setPaused(p: boolean) {
    this.paused = p;
    this.pauseObjs.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(p));
    if (p) music.stop(); else music.start();
  }

  // ================================================================ drawing
  private render() {
    const g = this.g; g.clear(); const hud = this.hud; hud.clear();
    const t = this.time.now / 1000;
    const ox = SET.reduce ? 0 : (Math.random() - 0.5) * this.shake, oy = SET.reduce ? 0 : (Math.random() - 0.5) * this.shake;
    g.setPosition(ox, oy);

    // low-health vignette
    const danger = this.hp <= 2 && this.mode !== 'ending' ? (SET.reduce ? 0.3 : 0.35 + 0.35 * Math.sin(t * (this.hp <= 1 ? 7 : 4))) : 0;
    this.vig.setAlpha(Math.max(0, danger));

    if (this.mode === 'bossintro' && this.boss) { g.fillStyle(COL.paper, 0.94).fillRect(-60, -60, W + 120, H + 120); this.drawBossBody(g, t, CX, CY - 40, LY.introScale); }
    else this.drawBossBody(g, t);
    for (const e of this.enemies) this.drawEnemy(g, e, t, ox, oy);
    this.drawInset(g); this.drawPreview(g);
    this.drawShip(g, t);

    for (const sh of this.shots) {
      const a = sh.t / 0.2;
      strokePts(g, [{ x: CX + Math.cos(this.shipAng) * 22, y: CY + Math.sin(this.shipAng) * 22 }, { x: sh.x1, y: sh.y1 }], COL.red, 2.5, a);
      g.fillStyle(COL.redHi, a).fillCircle(sh.x1, sh.y1, 6 * a + 2);
    }
    for (const r of this.rings) {
      if (r.t < 0) continue; const p = r.t / r.dur;
      g.lineStyle(r.w * (1 - p) + 0.5, r.col, 1 - p).strokeCircle(r.x, r.y, r.r * (0.15 + 0.85 * Math.sqrt(p)));
    }
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.max);
      if (p.line) strokePts(g, [{ x: p.x, y: p.y }, { x: p.x - p.vx * 0.04, y: p.y - p.vy * 0.04 }], p.col, 1.5, a);
      else g.fillStyle(p.col, a).fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    this.drawHud(hud, t);
  }

  private drawInset(g: Phaser.GameObjects.Graphics) {
    if (this.inset < 1) return;
    const a = Math.min(0.55, (this.inset / LY.inset) * 0.55); const i = this.inset;
    g.fillStyle(COL.ink, a);
    g.fillRect(-80, -80, W + 160, i + 80); g.fillRect(-80, H - i, W + 160, i + 80);
    g.fillRect(-80, -80, i + 80, H + 160); g.fillRect(W - i, -80, i + 80, H + 160);
    g.lineStyle(2, COL.red, 0.8).strokeRect(i, i, W - 2 * i, H - 2 * i);
  }

  /** Cartographer: reveals the next three arrivals, and highlights a chosen route. */
  private drawPreview(g: Phaser.GameObjects.Graphics) {
    const on = this.shipId === 'cartographer' && this.mode === 'play';
    this.previewTexts.forEach((tx, i) => {
      const p = this.queue[i];
      if (!on || !p) { tx.setVisible(false); return; }
      const px = Phaser.Math.Clamp(p.x, 40, W - 40), py = Phaser.Math.Clamp(p.y, LY.labelMin, PLAY_B - 110);
      g.lineStyle(1.2, COL.grey, 0.9 - i * 0.2).strokeCircle(px, py, 9 - i);
      strokePts(g, [{ x: px, y: py }, { x: px + (CX - px) * 0.08, y: py + (CY - py) * 0.08 }], COL.grey, 1.2, 0.7);
      tx.setText(p.kind + ': ' + p.word).setPosition(px, py + (py < CY ? 20 : -20)).setVisible(true).setAlpha(0.9 - i * 0.25);
    });
    if (this.routeT > 0 && this.routeSide !== null) {
      const sd = this.routeSide; const a = Math.min(1, this.routeT / 2);
      const l = sd === 0 ? [0, 92, W, 92] : sd === 1 ? [4, 0, 4, H] : sd === 2 ? [W - 4, 0, W - 4, H] : [0, H - 4, W, H - 4];
      g.lineStyle(3, COL.red, a).lineBetween(l[0], l[1], l[2], l[3]);
    }
  }

  private kindIcon(g: Phaser.GameObjects.Graphics, kind: Kind, x: number, y: number) {
    g.lineStyle(1.5, COL.ink, 1); g.fillStyle(COL.red, 1);
    if (kind === 'drifter' || kind === 'child') g.strokeCircle(x, y, 6);
    else if (kind === 'dasher') fillPts(g, rotPts([{ x: 7, y: 0 }, { x: -5, y: -6 }, { x: -5, y: 6 }], x, y, 0), COL.red, 1);
    else if (kind === 'splitter') strokePts(g, regPoly(x, y, 7, 5, -Math.PI / 2), COL.ink, 1.5);
    else if (kind === 'shielded') fillPts(g, regPoly(x, y, 7, 4, 0), COL.red, 1);
    else if (kind === 'scrambler') { strokePts(g, [{ x: x - 6, y: y - 5 }, { x: x + 6, y: y + 5 }], COL.ink, 1.5); strokePts(g, [{ x: x - 6, y: y + 5 }, { x: x + 6, y: y - 5 }], COL.ink, 1.5); }
    else if (kind === 'inker') g.fillStyle(COL.ink, 1).fillRect(x - 5, y - 5, 10, 10);
    else if (kind === 'marker') { strokePts(g, [{ x: x - 6, y }, { x: x + 6, y }], COL.red, 2.5); strokePts(g, [{ x, y: y - 6 }, { x, y: y + 6 }], COL.red, 2.5); }
  }

  private drawShip(g: Phaser.GameObjects.Graphics, t: number) {
    const ready = this.finale >= FINALE_NEEDED;
    if (ready) g.fillStyle(COL.red, 0.08 + 0.06 * Math.sin(t * 6)).fillCircle(CX, CY, 46 + 4 * Math.sin(t * 6));
    g.lineStyle(1, COL.light, 1).strokeCircle(CX, CY, 30);
    g.lineStyle(2.5, COL.ink, 1).strokeCircle(CX, CY, 17);
    g.fillStyle(COL.red, 1).fillCircle(CX, CY, 4.5);
    const a = this.shipAng;
    strokePts(g, [{ x: CX + Math.cos(a) * 21, y: CY + Math.sin(a) * 21 }, { x: CX + Math.cos(a) * 34, y: CY + Math.sin(a) * 34 }], COL.red, 3);
    if (this.shipId === 'scribe') strokePts(g, regPoly(CX, CY, 24, 4, a + Math.PI / 4), COL.grey, 1);
    if (this.shipId === 'cartographer') strokePts(g, regPoly(CX, CY, 25, 3, a), COL.grey, 1);
    if (this.wardHits > 0) g.lineStyle(2.5, COL.red, 0.9).strokeCircle(CX, CY, 42);
    if (this.slowT > 0) g.lineStyle(1, COL.grey, 0.7).strokeCircle(CX, CY, 52 + 3 * Math.sin(t * 5));
    if (this.smudgeT > 0) {
      for (let i = 0; i < 6; i++) g.fillStyle(COL.ink, 0.35).fillCircle(CX + Math.cos(i * 1.7) * 26, CY + Math.sin(i * 2.3) * 26, 5 + (i % 3) * 3);
    }
    for (let i = 0; i < this.maxHp; i++) { // health pips
      const x = CX + (i - (this.maxHp - 1) / 2) * 13, y = CY + 52;
      if (i < this.hp) g.fillStyle(COL.ink, 1).fillRect(x - 4, y - 4, 8, 8);
      else g.lineStyle(1, COL.grey, 1).strokeRect(x - 4, y - 4, 8, 8);
    }
  }

  private drawEnemy(g: Phaser.GameObjects.Graphics, e: Enemy, t: number, ox: number, oy: number) {
    const { x, y } = e;
    switch (e.kind) {
      case 'drifter':
        g.lineStyle(1.8, COL.ink, 1).strokeCircle(x, y, 11 + Math.sin(e.phase) * 0.8);
        g.fillStyle(COL.red, 1).fillCircle(x, y, 3.8);
        break;
      case 'dasher': {
        const tri: P[] = [{ x: 15, y: 0 }, { x: -9, y: -9 }, { x: -9, y: 9 }];
        fillPts(g, rotPts(tri, x, y, e.ang), COL.red, 1);
        for (let i = 1; i <= 3; i++) strokePts(g, rotPts([{ x: -12 - i * 7, y: 0 }, { x: -16 - i * 7, y: 0 }], x, y, e.ang), COL.grey, 1.5, 1 - i * 0.25);
        break;
      }
      case 'splitter': {
        strokePts(g, regPoly(x, y, 18, 5, t * 0.4 + e.phase), COL.ink, 1.8);
        fillPts(g, regPoly(x, y, 7, 5, -t * 0.6), COL.red, 1);
        break;
      }
      case 'shielded':
        if (e.hp > 1) g.lineStyle(1.8, COL.ink, 1).strokeCircle(x, y, 22);
        fillPts(g, regPoly(x, y, 10, 4, 0), COL.red, 1);
        break;
      case 'child':
        g.lineStyle(1.2, COL.ink, 1).strokeCircle(x, y, 8); g.fillStyle(COL.red, 1).fillCircle(x, y, 3);
        break;
      case 'scrambler':
        for (let k = 0; k < 3; k++) { const a = t * 1.6 + k * 2.09; g.lineStyle(1.4, COL.ink, 1).strokeCircle(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 9); }
        g.fillStyle(COL.red, 1).fillCircle(x, y, 2.5);
        break;
      case 'inker':
        g.fillStyle(COL.ink, 0.88).fillCircle(x, y, 11);
        for (let k = 0; k < 6; k++) { const a = k * 1.047 + Math.sin(t * 2 + k) * 0.25; strokePts(g, [{ x: x + Math.cos(a) * 11, y: y + Math.sin(a) * 11 }, { x: x + Math.cos(a) * 19, y: y + Math.sin(a) * 19 }], COL.ink, 1.8); }
        g.fillStyle(COL.red, 1).fillCircle(x, y, 3.2);
        g.lineStyle(1, COL.ink, 0.2).strokeCircle(x, y, 190);
        break;
      case 'marker':
        g.lineStyle(1.6, COL.red, 1).strokeCircle(x, y, 14 + Math.sin(t * 4) * 1.2);
        strokePts(g, [{ x: x - 8, y }, { x: x + 8, y }], COL.red, 3); strokePts(g, [{ x, y: y - 8 }, { x, y: y + 8 }], COL.red, 3);
        break;
      case 'boss': break;
    }

    // word in a thin box above (or below near the top edge)
    const locked = this.engine.lockedId === e.id;
    const boss = e.kind === 'boss'; const b = this.boss;
    let want = e.disp;
    if (boss && b && b.def.gimmick === 'blot' && b.mask > 0) {
      const p = locked ? this.engine.progress : 0;
      want = e.word.slice(0, p) + '■'.repeat(e.word.length - p);
    }
    if (!boss && e.kind !== 'inker' && this.enemies.some((o) => o.kind === 'inker' && Math.hypot(o.x - x, o.y - y) < 190)) {
      const p = locked ? this.engine.progress : 0; const ch = want.split('');
      for (const i of [1, 3]) if (i < ch.length && i >= p) ch[i] = '\u25AA';
      want = ch.join('');
    }
    if (e.label.text !== want) e.label.setText(want);
    const lw = e.label.width;
    let ly = boss ? y : y - e.r - 24; if (ly < LY.labelMin) ly = y + e.r + 24;
    ly = Phaser.Math.Clamp(ly, LY.labelMin, PLAY_B - LY.labelPad);
    const lx = Phaser.Math.Clamp(x - lw / 2, SET.cb ? 40 : 14, W - lw - 14);
    const bw = lw + 18, bh = boss ? 44 : 34;
    g.fillStyle(COL.paper, 0.85).fillRect(lx - 9, ly - bh / 2, bw, bh);
    g.lineStyle(locked ? 2 : 1, locked ? COL.red : COL.light, 1).strokeRect(lx - 9, ly - bh / 2, bw, bh);
    if (SET.cb && !boss) this.kindIcon(g, e.kind, lx - 24, ly);
    for (let i = 1; i < e.hp; i++) g.fillStyle(COL.red, 1).fillCircle(lx - 9 + bw - 6 - (i - 1) * 8, ly - bh / 2 + 6, 2.5);
    e.label.setPosition(lx + ox, ly + oy);
    if (locked) {
      if (e.ink.text.length !== (e.disp === e.word ? this.engine.progress : this.engine.progress ? this.engine.progress + 2 : 0)) this.setInk(e, this.engine.progress);
      e.label.setColor(CSS.ink);
    } else { if (e.ink.text.length) this.setInk(e, 0); e.label.setColor(CSS.mid); }
    if (e.disp === e.word) e.ink.setPosition(lx + ox, ly + oy);
    else e.ink.setPosition(lx + ox, ly + bh / 2 + 16 + oy);
    if (!(boss && b && b.def.gimmick === 'blot' && b.mask > 0)) e.label.setColor(locked ? CSS.ink : CSS.mid);

    if (!boss && Math.hypot(x - CX, y - CY) < 190) { // danger tick
      strokePts(g, [{ x: lx + bw - 2, y: ly - bh / 2 - 4 }, { x: lx + bw - 2, y: ly - bh / 2 - 12 }], COL.red, 2.5);
    }
  }

  private drawBossBody(g: Phaser.GameObjects.Graphics, t: number, ocx = CX, ocy = LY.bossBodyY, big = 1) {
    const b = this.boss; if (!b || this.mode === 'ending') return;
    const rings = b.def.phases.length - b.phase + 1;
    const sc = (1 + Math.max(0, b.hit) * 0.25) * big; const cx = ocx, cy = ocy;
    if (b.def.gimmick === 'blot') {
      for (let k = 0; k < rings; k++) {
        const r0 = (62 - k * 12) * sc; const pts: P[] = [];
        for (let i = 0; i <= 36; i++) { const a = (i / 36) * Math.PI * 2; const r = r0 + Math.sin(a * 3 + t * 2 + k) * 5 + Math.sin(a * 5 - t * 3) * 3; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
        if (k === 0) fillPts(g, pts, COL.ink, 0.14);
        strokePts(g, pts, COL.ink, 1.6, 0.85 - k * 0.15);
      }
      g.fillStyle(COL.red, 1).fillCircle(cx, cy, 10 * sc);
      if (b.mask > 0) for (const s of b.splats) g.fillStyle(COL.ink, Math.min(0.3, b.mask * 0.15)).fillCircle(s.x, s.y, 28 + (s.x % 20));
    } else if (b.def.gimmick === 'page') {
      for (let k = 0; k < rings; k++) {
        const ang = (k - 1.5) * 0.14 + Math.sin(t * 0.8 + k) * 0.03; const w = (44 - k * 3) * sc, h = (62 - k * 4) * sc;
        const pts = rotPts([{ x: -w, y: -h }, { x: w, y: -h }, { x: w, y: h }, { x: -w, y: h }, { x: -w, y: -h }], cx, cy, ang);
        if (k === 0) fillPts(g, pts, COL.white, 0.7);
        strokePts(g, pts, COL.ink, 1.5, 0.9 - k * 0.12);
        for (let l = 1; l < 5; l++) strokePts(g, rotPts([{ x: -w * 0.7, y: -h + l * (h * 0.35) }, { x: w * 0.7, y: -h + l * (h * 0.35) }], cx, cy, ang), COL.grey, 1, 0.6 - k * 0.1);
      }
      fillPts(g, rotPts([{ x: 40 * sc, y: 62 * sc }, { x: 40 * sc, y: 32 * sc }, { x: 10 * sc, y: 62 * sc }], cx, cy, 0), COL.red, 1);
    } else {
      for (let k = 0; k < rings; k++) strokePts(g, regPoly(cx, cy, (60 - k * 12) * sc, 4, Math.PI / 4 + t * 0.35 * (k % 2 ? -1 : 1)), COL.red, 1.8, 0.9 - k * 0.15);
      strokePts(g, [{ x: cx, y: cy - 78 * sc }, { x: cx, y: cy + 78 * sc }], COL.red, 1.2, 0.5);
      strokePts(g, [{ x: cx - 78 * sc, y: cy }, { x: cx + 78 * sc, y: cy }], COL.red, 1.2, 0.5);
      fillPts(g, regPoly(cx, cy, 9 * sc, 4, Math.PI / 4), COL.red, 1);
    }
  }

  private drawHud(h: Phaser.GameObjects.Graphics, t: number) {
    // top bar text
    let dim = '', ink = '', pct = '';
    if (this.engine.spell !== null) ink = '!' + this.engine.spell;
    else if (this.engine.lockedId !== null) {
      const e = this.enemies.find((x) => x.id === this.engine.lockedId);
      if (e) { dim = e.word; ink = e.word.slice(0, this.engine.progress); pct = Math.round((this.engine.progress / e.word.length) * 100) + '%'; }
    } else dim = this.mode === 'pick' ? '' : this.boss ? this.boss.def.name.toLowerCase() : 'page ' + (this.stage().t === 'wave' ? (this.stage() as { w: number }).w : '');
    this.tTopDim.setText(dim); this.tTopInk.setText(ink);
    const w = Math.max(this.tTopDim.width, this.tTopInk.width);
    this.tTopDim.setX(CX - w / 2); this.tTopInk.setX(CX - w / 2);
    this.tTopInk.setColor(this.typoFlash > 0 ? CSS.redHi : CSS.red);
    // a thin rule under the word that fills red as you type it
    { const lx0 = CX - LY.ruleW / 2; h.lineStyle(1, COL.light, 1).lineBetween(lx0, LY.ruleY, lx0 + LY.ruleW, LY.ruleY);
      const frac = this.engine.lockedId !== null && this.engine.spell === null ? (() => { const e = this.enemies.find((x) => x.id === this.engine.lockedId); return e ? this.engine.progress / e.word.length : 0; })() : 0;
      if (frac > 0) h.lineStyle(2, COL.red, 1).lineBetween(lx0, LY.ruleY, lx0 + LY.ruleW * frac, LY.ruleY); }
    this.tTopPct.setText(pct);

    // boss health: segmented bar under the top bar
    if (this.boss) {
      const b = this.boss; const bw = MOBILE ? 300 : 360, x0 = CX - bw / 2, y0 = LY.bossHpY;
      h.lineStyle(1, COL.grey, 1).strokeRect(x0, y0, bw, 5);
      h.fillStyle(COL.red, 1).fillRect(x0, y0, bw * (1 - b.done / b.total), 5);
      let acc = 0; for (const ph of b.def.phases.slice(0, -1)) { acc += ph.length; h.lineStyle(1, COL.paper, 1).lineBetween(x0 + (acc / b.total) * bw, y0, x0 + (acc / b.total) * bw, y0 + 5); }
    }

    const s = this.stage();
    const left = Math.floor(this.elapsed);
    const hint = this.boss && this.mode !== 'bossintro' ? (this.boss.def.gimmick === 'blot' && this.boss.mask > 0 ? (MOBILE ? 'Ink! Tap ERASE to reveal the word' : 'Ink! Type !erase to reveal the word') : BOSS_HINT[this.boss.def.gimmick]) : '';
    this.tHint.setText(hint);
    this.tStage.setText(`${s.t === 'wave' ? 'PAGE ' + s.w + ' / 5' : 'BOSS'}${this.margin ? '  \u00B7 MARGIN' : ''}      ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`);
    this.tInk.setText('ink +' + this.calcInk());
    this.chip.clear();
    const cw = Math.max(this.tStage.width, this.tInk.width) + 24;
    this.chip.fillStyle(COL.paper, 0.96).fillRect(MOBILE ? 6 : 14, 8, cw, LY.chipH);
    this.chip.lineStyle(1, COL.light, 1).strokeRect(MOBILE ? 6 : 14, 8, cw, LY.chipH);
    this.tCombo.setText(this.combo ? 'x' + this.mult() : '').setColor(this.mult() >= 3 ? CSS.red : CSS.ink);
    this.tCombo.setScale(1 + (this.combo ? Math.max(0, 0.15 - ((t * 1000) % 1000) / 4000) : 0));
    this.tComboSub.setText(this.combo ? `combo ${this.combo}` : '');
    this.tScore.setText(`score ${this.score}`);

    // combo-to-finale meter under the score
    const mx = LY.meterX, my = LY.meterY, mw = LY.meterW;
    h.lineStyle(1, COL.grey, 1).strokeRect(mx, my, mw, 5);
    h.fillStyle(this.finale >= FINALE_NEEDED ? COL.redHi : COL.red, 1).fillRect(mx, my, mw * (this.finale / FINALE_NEEDED), 5);
    // ink gauge
    h.lineStyle(1, COL.grey, 1).strokeRect(mx, my + 12, mw, 5);
    h.fillStyle(this.smudgeT > 0 ? COL.red : COL.ink, 0.8).fillRect(mx, my + 12, mw * Math.min(1, this.gauge / 100), 5);
    if (this.shipId) { /* labels via small static texts below */ }

    // upgrade list
    const list = UPGRADES.filter((u) => this.upg(u.id)).map((u) => u.title.toLowerCase() + (this.upg(u.id) > 1 ? ' x' + this.upg(u.id) : '')).join('\n');
    if (list !== this.lastUpg) { this.lastUpg = list; this.tUpg.setText(list); }

    // spell slots
    const slots = this.slotDefs();
    slots.forEach((sl, i) => {
      const x = this.slotX(i, slots.length), y = LY.slotY, sz = LY.slotSize;
      let on = false; let note = CSS.grey;
      const free = this.upg('surge') > 0 && this.combo >= 20;
      if (sl.word === 'finale') {
        on = this.finale >= FINALE_NEEDED;
        h.lineStyle(1.2, COL.grey, 1).strokeRect(x - sz / 2, y - sz / 2, sz, sz);
        h.fillStyle(COL.red, on ? 0.9 : 0.35).fillRect(x - sz / 2, y + sz / 2 - sz * (this.finale / FINALE_NEEDED), sz, sz * (this.finale / FINALE_NEEDED));
      } else {
        const cost = sl.word === 'edit' ? (this.upg('footnote') ? 1 : 2) : sl.word === 'route' && this.upg('compass') ? 0 : 1;
        const unlocked = sl.word !== 'ward' || this.upg('ward') > 0;
        on = unlocked && (free || this.charges >= cost);
        h.lineStyle(1.2, unlocked ? COL.ink : COL.light, 1).strokeRect(x - sz / 2, y - sz / 2, sz, sz);
        if (on) h.fillStyle(COL.red, 0.92).fillRect(x - sz / 2, y - sz / 2, sz, sz);
        note = unlocked ? CSS.mid : CSS.light;
      }
      this.slotKeys[i].setColor(on ? CSS.paper : (sl.word === 'finale' ? CSS.grey : CSS.mid));
      this.slotLabels[i].setColor(note);
    });
    for (let i = 0; i < MAX_CHARGES; i++) { // charge pips
      const x = MOBILE ? 18 + i * 14 : CX - (slots.length * 62) / 2 - 24 - i * 14, y = MOBILE ? LY.slotY - 40 : LY.slotY;
      if (i < this.charges) h.fillStyle(COL.red, 1).fillRect(x - 4, y - 4, 8, 8); else h.lineStyle(1, COL.grey, 1).strokeRect(x - 4, y - 4, 8, 8);
    }
    // smudge warning line
    if (this.smudgeT > 0) h.lineStyle(2, COL.red, 0.8).lineBetween(CX - Math.min(240, W / 2 - 20), LY.slotY - 34, CX + Math.min(240, W / 2 - 20), LY.slotY - 34);
  }
}
