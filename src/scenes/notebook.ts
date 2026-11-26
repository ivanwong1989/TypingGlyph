import Phaser from 'phaser';
import { W, MOBILE } from '../config';
import { COL, CSS, FONT_C, button, drawBackdrop, txt } from '../style';
import { save } from '../save';
import { audio } from '../sfx';

interface Item { id: string; group: string; name: string; cost: number; bosses?: number; desc: string }
const ITEMS: Item[] = [
  { id: 'scribe', group: 'SHIP', name: 'The Scribe', cost: 120, bosses: 1, desc: 'A ship. !edit rewrites every enemy word into a short one for 2 charges. Charges arrive more slowly. Needs 1 boss defeated.' },
  { id: 'cartographer', group: 'SHIP', name: 'The Cartographer', cost: 200, bosses: 3, desc: 'A ship. Reveals the next three arrivals and !route makes enemies arrive from the side you choose. Needs 3 bosses defeated.' },
  { id: 'ward', group: 'CARD', name: 'Ward card', cost: 60, desc: 'Adds the Ward upgrade to your upgrade pool: !ward absorbs the next hits.' },
  { id: 'echo', group: 'CARD', name: 'Echo', cost: 90, desc: 'Adds the !echo spell (your next word fires twice) and the rare Echo upgrade to your pool.' },
  { id: 'theme_nature', group: 'WORDS', name: 'Nature words', cost: 40, desc: 'A word theme: trees, rivers, weather. Pick themes on the title screen.' },
  { id: 'theme_space', group: 'WORDS', name: 'Space words', cost: 40, desc: 'A word theme: planets, rockets, stars.' },
  { id: 'theme_food', group: 'WORDS', name: 'Food words', cost: 40, desc: 'A word theme: ingredients and dishes.' },
  { id: 'theme_fantasy', group: 'WORDS', name: 'Fantasy words', cost: 40, desc: 'A word theme: dragons, runes, wizards.' },
  { id: 'theme_code', group: 'WORDS', name: 'Code words', cost: 40, desc: 'A word theme: keywords and programming terms.' },
  { id: 'page_graph', group: 'PAPER', name: 'Graph paper', cost: 30, desc: 'A cosmetic paper type. Pick it on the title screen.' },
  { id: 'page_napkin', group: 'PAPER', name: 'Napkin', cost: 30, desc: 'A cosmetic paper type with an embossed dot pattern.' },
  { id: 'page_parchment', group: 'PAPER', name: 'Parchment', cost: 30, desc: 'A cosmetic paper type, warm and stained.' },
];

export class NotebookScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private names: Phaser.GameObjects.Text[] = [];
  private stat: Phaser.GameObjects.Text[] = [];
  private inkText!: Phaser.GameObjects.Text;
  private msg!: Phaser.GameObjects.Text;
  private desc!: Phaser.GameObjects.Text;
  private cur = 0;

  constructor() { super('Notebook'); }

  /** Row centre and box size for item i (two columns on desktop, one on phones). */
  private pos(i: number) {
    if (MOBILE) return { x: W / 2, y: 190 + i * 58, bw: W - 40, bh: 48 };
    const col = Math.floor(i / 6), row = i % 6;
    return { x: 340 + col * 520 + 8, y: 200 + row * 56, bw: 480, bh: 44 };
  }

  create() {
    this.names = []; this.stat = []; this.cur = 0;
    drawBackdrop(this);
    this.g = this.add.graphics().setDepth(2);
    txt(this, W / 2, MOBILE ? 50 : 62, 'NOTEBOOK', MOBILE ? 38 : 50, CSS.ink, 0.5, 0.5, FONT_C).setDepth(3);
    txt(this, W / 2, MOBILE ? 92 : 106, 'spend ink on things that widen your choices', MOBILE ? 13 : 16, CSS.mid).setDepth(3);
    this.inkText = txt(this, W / 2, MOBILE ? 130 : 140, '', MOBILE ? 20 : 24, CSS.red, 0.5, 0.5, FONT_C).setDepth(3);
    this.desc = txt(this, W / 2, MOBILE ? 905 : 578, '', MOBILE ? 15 : 18, CSS.ink).setDepth(3).setWordWrapWidth(MOBILE ? W - 50 : 760).setAlign('center');
    this.msg = txt(this, W / 2, MOBILE ? 960 : 640, '', MOBILE ? 14 : 17, CSS.red).setDepth(3).setWordWrapWidth(W - 40).setAlign('center');
    if (MOBILE) button(this, W / 2, 1005, 200, 44, 'BACK', () => this.scene.start('Title'), 16);
    else txt(this, W / 2, 690, 'arrows move        Enter buys        Esc back', 18, CSS.mid).setDepth(3);
    ITEMS.forEach((it, i) => {
      const p = this.pos(i);
      if (MOBILE) {
        this.names.push(txt(this, p.x - p.bw / 2 + 14, p.y, it.name, 18, CSS.ink, 0, 0.5).setDepth(3));
        this.stat.push(txt(this, p.x + p.bw / 2 - 14, p.y, '', 15, CSS.red, 1, 0.5, FONT_C).setDepth(3));
        const z = this.add.zone(p.x, p.y, p.bw, p.bh).setDepth(4).setInteractive();
        z.on('pointerdown', () => { audio.ensure(); if (this.cur === i) this.buy(it); else this.cur = i; });
      } else {
        txt(this, p.x - 228, p.y, it.group, 11, CSS.grey, 0, 0.5, FONT_C).setDepth(3);
        this.names.push(txt(this, p.x - 168, p.y, it.name, 22, CSS.ink, 0, 0.5).setDepth(3));
        this.stat.push(txt(this, p.x + 212, p.y, '', 18, CSS.red, 1, 0.5, FONT_C).setDepth(3));
      }
    });
    if (MOBILE) txt(this, W / 2, 168, 'tap an item, then tap it again to buy', 12, CSS.grey).setDepth(3);
    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { this.scene.start('Title'); return; }
      const col = Math.floor(this.cur / 6), row = this.cur % 6;
      if (ev.key === 'ArrowDown') this.cur = col * 6 + (row + 1) % 6;
      else if (ev.key === 'ArrowUp') this.cur = col * 6 + (row + 5) % 6;
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') this.cur = (1 - col) * 6 + row;
      else if (ev.key === 'Enter') this.buy(ITEMS[this.cur]);
      audio.ensure();
    });
  }

  private buy(it: Item) {
    if (save.hasUnlock(it.id)) { this.msg.setText('Already unlocked.'); return; }
    if (it.bosses && save.getBossKills() < it.bosses) { this.msg.setText(`Defeat ${it.bosses} boss${it.bosses > 1 ? 'es' : ''} first (you have ${save.getBossKills()}).`); audio.typo(); return; }
    if (save.getInk() < it.cost) { this.msg.setText(`Not enough ink: need ${it.cost}.`); audio.typo(); return; }
    save.spendInk(it.cost); save.addUnlock(it.id); audio.pick(); this.msg.setText(`${it.name} unlocked.`);
  }

  update() {
    this.inkText.setText('ink ' + save.getInk());
    this.desc.setText(ITEMS[this.cur].desc);
    const g = this.g; g.clear();
    ITEMS.forEach((it, i) => {
      const p = this.pos(i);
      const own = save.hasUnlock(it.id);
      const locked = !!it.bosses && save.getBossKills() < it.bosses;
      if (i === this.cur) g.lineStyle(1.5, COL.red, 1).strokeRect(p.x - p.bw / 2, p.y - p.bh / 2, p.bw, p.bh);
      else g.lineStyle(1, COL.light, 1).strokeRect(p.x - p.bw / 2, p.y - p.bh / 2, p.bw, p.bh);
      this.names[i].setColor(own ? CSS.mid : CSS.ink);
      this.stat[i].setText(own ? 'UNLOCKED' : locked ? `${it.bosses} BOSS${it.bosses! > 1 ? 'ES' : ''}` : `${it.cost} ink`)
        .setColor(own ? CSS.grey : locked ? CSS.grey : save.getInk() >= it.cost ? CSS.red : CSS.grey);
    });
  }
}
