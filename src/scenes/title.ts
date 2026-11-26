import Phaser from 'phaser';
import { W, WPM_LEVELS, WPM_NAMES, INK_MULT } from '../config';
import { COL, CSS, FONT_C, applySettings, drawBackdrop, fillPts, regPoly, strokePts, txt } from '../style';
import { save, SHIPS } from '../save';
import { parseWords, currentWordSet } from '../words';
import { THEMES } from '../themes';
import { audio } from '../sfx';

const SHIP_INFO: Record<string, string> = {
  quill: 'Quill  ·  the standard ship',
  scribe: 'Scribe  ·  !edit rewrites every word shorter, at a cost',
  cartographer: 'Cartographer  ·  previews arrivals, !route picks where they come from',
};
const PAGE_NAMES: Record<string, string> = { plain: 'plain', graph: 'graph paper', napkin: 'napkin', parchment: 'parchment' };

export class TitleScene extends Phaser.Scene {
  private diff = 1;
  private g!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private multText!: Phaser.GameObjects.Text;
  private wordsText!: Phaser.GameObjects.Text;
  private shipText!: Phaser.GameObjects.Text;
  private pageText!: Phaser.GameObjects.Text;
  private inkText!: Phaser.GameObjects.Text;
  private labelObjs: Phaser.GameObjects.Text[] = [];

  constructor() { super('Title'); }

  create() {
    applySettings();
    this.labelObjs = [];
    drawBackdrop(this);
    this.diff = save.getDiff();
    this.g = this.add.graphics().setDepth(2);

    txt(this, W / 2, 120, 'TYPINGGLYPH', 92, CSS.ink, 0.5, 0.5, FONT_C).setDepth(3);
    txt(this, W / 2, 184, 'every word you type is a weapon', 22, CSS.mid).setDepth(3);
    txt(this, W / 2, 270, 'DIFFICULTY  ·  target typing speed (WPM)', 16, CSS.grey, 0.5, 0.5, FONT_C).setDepth(3);
    this.multText = txt(this, W / 2, 452, '', 16, CSS.red, 0.5, 0.5, FONT_C).setDepth(3);
    this.shipText = txt(this, W / 2, 492, '', 21, CSS.ink).setDepth(3);
    this.wordsText = txt(this, W / 2, 526, '', 16, CSS.mid).setDepth(3);
    this.pageText = txt(this, W / 2, 552, '', 16, CSS.mid).setDepth(3);
    txt(this, W / 2, 598, 'Enter  start     ← →  difficulty     S  ship     T  words     P  paper     G  margin     N  notebook     O  settings', 17, CSS.ink).setDepth(3);
    txt(this, W / 2, 628, 'I  import word list (.txt, one word per line)        R  built-in words', 15, CSS.grey).setDepth(3);
    txt(this, W / 2, 668, 'Type the word under an enemy to destroy it.   Tab or Backspace twice to retarget.   !nova  !slow  !erase  to cast.', 14, CSS.grey).setDepth(3);
    this.status = txt(this, W / 2, 698, '', 15, CSS.red).setDepth(3);
    this.inkText = txt(this, W - 30, 28, '', 22, CSS.red, 1, 0.5, FONT_C).setDepth(3);

    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.txt,text/plain'; inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', async () => {
      const f = inp.files?.[0]; if (!f) return;
      const words = parseWords(await f.text());
      if (words.length < 20) this.status.setText(`Only ${words.length} usable words found. Need at least 20 (letters a-z, 2 to 14 long).`);
      else { save.setWords(f.name, words); this.status.setText(`Imported ${words.length} words from ${f.name}.`); this.refresh(); }
      inp.value = '';
    });
    this.events.once('shutdown', () => inp.remove());

    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => {
      audio.ensure();
      const k = ev.key.toLowerCase();
      if (ev.key === 'ArrowLeft') this.setDiff(this.diff - 1);
      else if (ev.key === 'ArrowRight') this.setDiff(this.diff + 1);
      else if (ev.key === 'Enter' || ev.key === ' ') this.scene.start('Game');
      else if (k === 'i') inp.click();
      else if (k === 'n') this.scene.start('Notebook');
      else if (k === 'o') this.scene.start('Settings');
      else if (k === 's') {
        const own = SHIPS.filter((s) => s === 'quill' || save.hasUnlock(s));
        if (own.length === 1) this.status.setText('Other ships are unlocked in the notebook (N) with ink and boss kills.');
        else { save.setShip(own[(own.indexOf(save.getShip()) + 1) % own.length]); this.status.setText(''); this.refresh(); }
      } else if (k === 't') {
        const own = ['default', ...Object.keys(THEMES).filter((t) => save.hasUnlock('theme_' + t))];
        if (own.length === 1) this.status.setText('Word themes are unlocked in the notebook (N).');
        else { save.clearWords(); save.setTheme(own[(own.indexOf(save.getTheme()) + 1) % own.length]); this.status.setText(''); this.refresh(); }
      } else if (k === 'p') {
        const own = ['plain', ...['graph', 'napkin', 'parchment'].filter((p) => save.hasUnlock('page_' + p))];
        if (own.length === 1) this.status.setText('Paper types are unlocked in the notebook (N).');
        else { save.setPage(own[(own.indexOf(save.getPage()) + 1) % own.length]); this.scene.restart(); }
      } else if (k === 'g') {
        if (!save.getWon()) this.status.setText('Margin mode unlocks when you finish The Last Page.');
        else { save.setMargin(!save.getMargin()); this.refresh(); }
      } else if (k === 'r') { save.clearWords(); save.setTheme('default'); this.status.setText('Using the built-in word list.'); this.refresh(); }
    });
    this.refresh();
  }

  private setDiff(n: number) { this.diff = Phaser.Math.Clamp(n, 0, WPM_LEVELS.length - 1); save.setDiff(this.diff); this.refresh(); }

  private refresh() {
    const ws = currentWordSet();
    this.wordsText.setText(`words: ${ws.name} (${ws.words.length})`);
    const m = save.getMargin();
    this.multText.setText(`INK EARNED x${INK_MULT[this.diff]}${m ? '  x1.5 MARGIN' : ''}${this.diff >= 2 ? '  + TIER BONUS' : ''}`);
    this.inkText.setText('ink ' + save.getInk());
    this.shipText.setText('ship: ' + SHIP_INFO[save.getShip()]);
    this.pageText.setText(`paper: ${PAGE_NAMES[save.getPage()]}     mode: ${m ? 'MARGIN (faster, harder bosses)' : save.getWon() ? 'normal  (G for margin)' : 'normal'}`);
  }

  update() {
    const g = this.g; g.clear();
    const x0 = 340, x1 = 940, y = 375;
    g.lineStyle(1.5, COL.ink, 1).lineBetween(x0, y, x1, y);
    WPM_LEVELS.forEach((wpm, i) => {
      const x = x0 + ((x1 - x0) * i) / (WPM_LEVELS.length - 1);
      g.lineStyle(1.5, COL.ink, 1).lineBetween(x, y - 9, x, y + 9);
      if (!this.labelObjs[i]) this.labelObjs[i] = txt(this, x, y + 52, '', 22, CSS.mid, 0.5, 0.5, FONT_C).setDepth(3);
      const t = this.labelObjs[i];
      t.setText(`${wpm}\n${WPM_NAMES[i]}`).setAlign('center').setColor(i === this.diff ? CSS.red : CSS.mid);
    });
    const kx = x0 + ((x1 - x0) * this.diff) / (WPM_LEVELS.length - 1);
    fillPts(g, regPoly(kx, y, 14, 4, Math.PI / 4), COL.red, 1);
    strokePts(g, regPoly(kx, y, 22, 4, Math.PI / 4 + this.time.now / 2500), COL.red, 1.2);
  }
}
