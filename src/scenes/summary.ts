import Phaser from 'phaser';
import { W, MOBILE, WPM_LEVELS } from '../config';
import { COL, CSS, FONT_C, button, drawBackdrop, txt } from '../style';
import { save } from '../save';
import { audio } from '../sfx';

export interface RunSummary {
  won: boolean; wave: number; stage: number; stages: number; score: number; wpm: number; accuracy: number;
  bestCombo: number; longest: string; words: number; ink: number; diff: number; newBest: boolean;
  perfects: number; bosses: number; upgrades: string[]; ship: string;
  nb: { wpm: boolean; acc: boolean; combo: boolean; longest: boolean; score: boolean }; margin: boolean; marginNew: boolean;
}

export class SummaryScene extends Phaser.Scene {
  constructor() { super('Summary'); }

  create(d: RunSummary) {
    drawBackdrop(this);
    const PW = MOBILE ? W - 30 : 660, PX = (W - PW) / 2, PY = MOBILE ? 30 : 50, PH = MOBILE ? 760 : 620;
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(COL.white, 0.9).fillRect(PX, PY, PW, PH);
    g.lineStyle(1.2, d.won ? COL.ink : COL.red, 1).strokeRect(PX, PY, PW, PH);

    txt(this, W / 2, PY + 60, d.won ? 'PAGE COMPLETE' : 'PAGE TORN', MOBILE ? 40 : 58, d.won ? CSS.ink : CSS.red, 0.5, 0.5, FONT_C).setDepth(3);
    txt(this, W / 2, PY + 110, d.won ? 'You finished the notebook.' : `Stage ${d.stage} of ${d.stages}`, MOBILE ? 16 : 20, CSS.mid).setDepth(3);

    const rows: [string, string, boolean][] = [
      ['speed', `${d.wpm.toFixed(0)} WPM   (target ${WPM_LEVELS[d.diff]})`, d.nb.wpm],
      ['accuracy', `${(d.accuracy * 100).toFixed(0)}%`, d.nb.acc],
      ['words typed', `${d.words}   (${d.perfects} perfect)`, false],
      ['best combo', String(d.bestCombo), d.nb.combo],
      ['longest word', d.longest || '-', d.nb.longest],
      ['bosses defeated', String(d.bosses), false],
      ['score', String(d.score), d.nb.score],
    ];
    const lx = PX + 40, rx = PX + PW - (MOBILE ? 56 : 60);
    rows.forEach(([k, v, best], i) => {
      const y = PY + 175 + i * (MOBILE ? 44 : 40);
      txt(this, lx, y, k.toUpperCase(), MOBILE ? 12 : 15, CSS.grey, 0, 0.5, FONT_C).setDepth(3);
      txt(this, rx, y, v, MOBILE ? 18 : 22, best ? CSS.red : CSS.ink, 1, 0.5).setDepth(3);
      if (best) txt(this, rx + 6, y, 'BEST', 11, CSS.red, 0, 0.5, FONT_C).setDepth(3);
    });
    const yb = PY + 175 + 7 * (MOBILE ? 44 : 40) + 20;
    txt(this, W / 2, yb, d.upgrades.length ? 'upgrades: ' + d.upgrades.join(', ') : 'no upgrades picked', 13, CSS.grey).setDepth(3).setWordWrapWidth(PW - 60).setAlign('center');
    if (d.newBest) txt(this, W / 2, yb + 40, 'NEW PERSONAL BEST', MOBILE ? 18 : 22, CSS.red, 0.5, 0.5, FONT_C).setDepth(3);
    txt(this, W / 2, yb + 80, `+${d.ink} ink     total ${save.getInk()}`, MOBILE ? 22 : 28, CSS.red, 0.5, 0.5, FONT_C).setDepth(3);
    if (d.marginNew) txt(this, W / 2, yb + 118, MOBILE ? 'MARGIN MODE UNLOCKED  (toggle on the title screen)' : 'MARGIN MODE UNLOCKED  (press G on the title screen)', MOBILE ? 13 : 16, CSS.red).setDepth(3);

    if (MOBILE) {
      button(this, W / 2, PY + PH + 50, 300, 70, 'PLAY AGAIN', () => { audio.ensure(); this.scene.start('Game'); }, 26, true);
      button(this, 20 + 105, PY + PH + 130, 210, 50, 'TITLE', () => this.scene.start('Title'), 16);
      button(this, W - 20 - 105, PY + PH + 130, 210, 50, 'NOTEBOOK', () => this.scene.start('Notebook'), 16);
    } else {
      txt(this, W / 2, 695, 'Enter  new run        N  notebook        Esc  title', 20, CSS.mid).setDepth(3);
    }

    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'Enter' || ev.key === ' ') this.scene.start('Game');
      else if (ev.key === 'Escape') this.scene.start('Title');
      else if (ev.key.toLowerCase() === 'n') this.scene.start('Notebook');
    });
  }
}
