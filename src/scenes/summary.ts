import Phaser from 'phaser';
import { W, WPM_LEVELS } from '../config';
import { COL, CSS, FONT_C, drawBackdrop, txt } from '../style';
import { save } from '../save';

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
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(COL.white, 0.9).fillRect(310, 50, 660, 620);
    g.lineStyle(1.2, d.won ? COL.ink : COL.red, 1).strokeRect(310, 50, 660, 620);

    txt(this, W / 2, 110, d.won ? 'PAGE COMPLETE' : 'PAGE TORN', 58, d.won ? CSS.ink : CSS.red, 0.5, 0.5, FONT_C).setDepth(3);
    txt(this, W / 2, 160, d.won ? 'You finished the notebook.' : `Stage ${d.stage} of ${d.stages}`, 20, CSS.mid).setDepth(3);

    const rows: [string, string, boolean][] = [
      ['speed', `${d.wpm.toFixed(0)} WPM   (target ${WPM_LEVELS[d.diff]})`, d.nb.wpm],
      ['accuracy', `${(d.accuracy * 100).toFixed(0)}%`, d.nb.acc],
      ['words typed', `${d.words}   (${d.perfects} perfect)`, false],
      ['best combo', String(d.bestCombo), d.nb.combo],
      ['longest word', d.longest || '-', d.nb.longest],
      ['bosses defeated', String(d.bosses), false],
      ['score', String(d.score), d.nb.score],
    ];
    rows.forEach(([k, v, best], i) => {
      txt(this, 370, 225 + i * 40, k.toUpperCase(), 15, CSS.grey, 0, 0.5, FONT_C).setDepth(3);
      txt(this, 910, 225 + i * 40, v, 22, best ? CSS.red : CSS.ink, 1, 0.5).setDepth(3);
      if (best) txt(this, 930, 225 + i * 40, 'BEST', 12, CSS.red, 0, 0.5, FONT_C).setDepth(3);
    });
    txt(this, W / 2, 530, d.upgrades.length ? 'upgrades: ' + d.upgrades.join(', ') : 'no upgrades picked', 14, CSS.grey).setDepth(3).setWordWrapWidth(540).setAlign('center');
    if (d.newBest) txt(this, W / 2, 575, 'NEW PERSONAL BEST', 22, CSS.red, 0.5, 0.5, FONT_C).setDepth(3);
    txt(this, W / 2, 618, `+${d.ink} ink     total ${save.getInk()}`, 28, CSS.red, 0.5, 0.5, FONT_C).setDepth(3);
    if (d.marginNew) txt(this, W / 2, 655, 'MARGIN MODE UNLOCKED  (press G on the title screen)', 16, CSS.red).setDepth(3);
    txt(this, W / 2, 695, 'Enter  new run        N  notebook        Esc  title', 20, CSS.mid).setDepth(3);

    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'Enter' || ev.key === ' ') this.scene.start('Game');
      else if (ev.key === 'Escape') this.scene.start('Title');
      else if (ev.key.toLowerCase() === 'n') this.scene.start('Notebook');
    });
  }
}
