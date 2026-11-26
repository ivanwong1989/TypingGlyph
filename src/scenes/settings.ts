import Phaser from 'phaser';
import { W, H, MOBILE } from '../config';
import { COL, CSS, FONT_C, applySettings, button, drawBackdrop, txt } from '../style';
import { save, Settings } from '../save';
import { audio } from '../sfx';

type Row = { label: string; get: (s: Settings) => string; change: (s: Settings, d: number) => void; hint: string };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(v * 100) / 100));
const wrap = (v: number, d: number, step: number, a: number, b: number) => { const n = Math.round((v + d * step) * 100) / 100; return n > b + 1e-6 ? a : n < a - 1e-6 ? b : n; };
const ROWS: Row[] = [
  { label: 'Dyslexia-friendly font', get: (s) => (s.dys ? 'on' : 'off'), change: (s) => { s.dys = !s.dys; }, hint: 'Switches all text to a wide, plain face with distinct letter shapes.' },
  { label: 'Word speed', get: (s) => Math.round(s.speed * 100) + '%', change: (s, d) => { s.speed = MOBILE ? wrap(s.speed, d, 0.1, 0.5, 1.5) : clamp(s.speed + d * 0.1, 0.5, 1.5); }, hint: 'How fast enemies approach. Lower is easier.' },
  { label: 'Reduce motion', get: (s) => (s.reduce ? 'on' : 'off'), change: (s) => { s.reduce = !s.reduce; }, hint: 'No screen shake, hit pauses or flashes, and far fewer particles.' },
  { label: 'Colour-blind markers', get: (s) => (s.cb ? 'on' : 'off'), change: (s) => { s.cb = !s.cb; }, hint: 'Adds a shape icon beside every word, so enemy types never rely on colour.' },
  { label: 'Music volume', get: (s) => Math.round(s.music * 100) + '%', change: (s, d) => { s.music = MOBILE ? wrap(s.music, d, 0.2, 0, 1) : clamp(s.music + d * 0.1, 0, 1); }, hint: '' },
  { label: 'Effects volume', get: (s) => Math.round(s.sfx * 100) + '%', change: (s, d) => { s.sfx = MOBILE ? wrap(s.sfx, d, 0.2, 0, 1) : clamp(s.sfx + d * 0.1, 0, 1); }, hint: '' },
];

export class SettingsScene extends Phaser.Scene {
  private s!: Settings;
  private cur = 0;
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private valTexts: Phaser.GameObjects.Text[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private hint!: Phaser.GameObjects.Text;
  private msg!: Phaser.GameObjects.Text;

  constructor() { super('Settings'); }

  private rowPos(i: number) {
    return MOBILE ? { y: 200 + i * 78, x0: 20, x1: W - 20, h: 64 } : { y: 190 + i * 58, x0: 380, x1: 900, h: 52 };
  }

  create() {
    this.s = save.getSettings(); this.cur = 0; this.rowTexts = []; this.valTexts = [];
    applySettings(this.s);
    drawBackdrop(this);
    this.g = this.add.graphics().setDepth(2);
    txt(this, W / 2, MOBILE ? 70 : 80, 'SETTINGS', MOBILE ? 38 : 52, CSS.ink, 0.5, 0.5, FONT_C).setDepth(3);
    const change = (i: number, d: number) => {
      ROWS[i].change(this.s, d); save.setSettings(this.s); applySettings(this.s); audio.select();
    };
    ROWS.forEach((r, i) => {
      const p = this.rowPos(i);
      this.rowTexts.push(txt(this, p.x0 + (MOBILE ? 14 : 20), p.y, r.label, MOBILE ? 18 : 24, CSS.ink, 0, 0.5).setDepth(3));
      this.valTexts.push(txt(this, p.x1 - (MOBILE ? 14 : 20), p.y, '', MOBILE ? 20 : 24, CSS.red, 1, 0.5, FONT_C).setDepth(3));
      if (MOBILE) {
        const z = this.add.zone((p.x0 + p.x1) / 2, p.y, p.x1 - p.x0, p.h).setDepth(4).setInteractive();
        z.on('pointerdown', () => { audio.ensure(); this.cur = i; change(i, 1); });
      }
    });
    this.hint = txt(this, W / 2, MOBILE ? H - 190 : 560, '', MOBILE ? 14 : 17, CSS.mid).setDepth(3).setWordWrapWidth(W - 40).setAlign('center');
    this.msg = txt(this, W / 2, MOBILE ? H - 125 : 612, '', 16, CSS.red).setDepth(3);

    if (MOBILE) {
      txt(this, W / 2, 150, 'tap a setting to change it', 13, CSS.grey).setDepth(3);
      button(this, W / 2, H - 56, 200, 44, '← BACK', () => { save.setSettings(this.s); this.scene.start('Title'); }, 18);
      return;
    }
    txt(this, W / 2, 650, 'E  export save to a file        L  import a save file', 18, CSS.ink).setDepth(3);
    txt(this, W / 2, 690, '↑ ↓ choose      ← → / Enter change      Esc back', 18, CSS.mid).setDepth(3);

    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json'; inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', async () => {
      const f = inp.files?.[0]; if (!f) return;
      const ok = save.importAll(await f.text());
      this.msg.setText(ok ? 'Save imported.' : 'That file is not a TypingGlyph save.');
      if (ok) { this.s = save.getSettings(); applySettings(this.s); }
      inp.value = '';
    });
    this.events.once('shutdown', () => inp.remove());

    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => {
      audio.ensure();
      const k = ev.key.toLowerCase();
      if (ev.key === 'Escape') { save.setSettings(this.s); this.scene.start('Title'); return; }
      if (ev.key === 'ArrowDown') this.cur = (this.cur + 1) % ROWS.length;
      else if (ev.key === 'ArrowUp') this.cur = (this.cur + ROWS.length - 1) % ROWS.length;
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'Enter') change(this.cur, ev.key === 'ArrowLeft' ? -1 : 1);
      else if (k === 'e') {
        const blob = new Blob([save.exportAll()], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'typingglyph-save.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000); this.msg.setText('Save exported.');
      } else if (k === 'l') inp.click();
    });
  }

  update() {
    const g = this.g; g.clear();
    ROWS.forEach((r, i) => {
      const p = this.rowPos(i);
      g.lineStyle(i === this.cur ? 1.5 : 1, i === this.cur ? COL.red : COL.light, 1).strokeRect(p.x0, p.y - p.h / 2, p.x1 - p.x0, p.h);
      this.valTexts[i].setText(r.get(this.s));
    });
    this.hint.setText(ROWS[this.cur].hint);
  }
}
