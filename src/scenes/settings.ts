import Phaser from 'phaser';
import { W } from '../config';
import { COL, CSS, FONT_C, applySettings, drawBackdrop, txt } from '../style';
import { save, Settings } from '../save';
import { audio } from '../sfx';

type Row = { label: string; get: (s: Settings) => string; change: (s: Settings, d: number) => void; hint: string };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(v * 100) / 100));
const ROWS: Row[] = [
  { label: 'Dyslexia-friendly font', get: (s) => (s.dys ? 'on' : 'off'), change: (s) => { s.dys = !s.dys; }, hint: 'Switches all text to a wide, plain face with distinct letter shapes.' },
  { label: 'Word speed', get: (s) => Math.round(s.speed * 100) + '%', change: (s, d) => { s.speed = clamp(s.speed + d * 0.1, 0.5, 1.5); }, hint: 'How fast enemies approach. Lower is easier.' },
  { label: 'Reduce motion', get: (s) => (s.reduce ? 'on' : 'off'), change: (s) => { s.reduce = !s.reduce; }, hint: 'No screen shake, hit pauses or flashes, and far fewer particles.' },
  { label: 'Colour-blind markers', get: (s) => (s.cb ? 'on' : 'off'), change: (s) => { s.cb = !s.cb; }, hint: 'Adds a shape icon beside every word, so enemy types never rely on colour.' },
  { label: 'Music volume', get: (s) => Math.round(s.music * 100) + '%', change: (s, d) => { s.music = clamp(s.music + d * 0.1, 0, 1); }, hint: '' },
  { label: 'Effects volume', get: (s) => Math.round(s.sfx * 100) + '%', change: (s, d) => { s.sfx = clamp(s.sfx + d * 0.1, 0, 1); }, hint: '' },
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

  create() {
    this.s = save.getSettings(); this.cur = 0; this.rowTexts = []; this.valTexts = [];
    applySettings(this.s);
    drawBackdrop(this);
    this.g = this.add.graphics().setDepth(2);
    txt(this, W / 2, 80, 'SETTINGS', 52, CSS.ink, 0.5, 0.5, FONT_C).setDepth(3);
    ROWS.forEach((r, i) => {
      const y = 190 + i * 58;
      this.rowTexts.push(txt(this, 400, y, r.label, 24, CSS.ink, 0, 0.5).setDepth(3));
      this.valTexts.push(txt(this, 880, y, '', 24, CSS.red, 1, 0.5, FONT_C).setDepth(3));
    });
    this.hint = txt(this, W / 2, 560, '', 17, CSS.mid).setDepth(3);
    this.msg = txt(this, W / 2, 612, '', 16, CSS.red).setDepth(3);
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
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'Enter') {
        ROWS[this.cur].change(this.s, ev.key === 'ArrowLeft' ? -1 : 1);
        save.setSettings(this.s); applySettings(this.s); audio.select();
        this.rowTexts.forEach((t, i) => t.setFontFamily(i >= 0 ? (this.s.dys ? 'Verdana' : 'Segoe UI') : ''));
      } else if (k === 'e') {
        const blob = new Blob([save.exportAll()], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'typingglyph-save.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000); this.msg.setText('Save exported.');
      } else if (k === 'l') inp.click();
    });
  }

  update() {
    const g = this.g; g.clear();
    ROWS.forEach((r, i) => {
      const y = 190 + i * 58;
      g.lineStyle(i === this.cur ? 1.5 : 1, i === this.cur ? COL.red : COL.light, 1).strokeRect(380, y - 26, 520, 52);
      this.valTexts[i].setText(r.get(this.s));
    });
    this.hint.setText(ROWS[this.cur].hint);
  }
}
