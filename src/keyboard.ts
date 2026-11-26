import Phaser from 'phaser';
import { W, H } from './config';
import { COL, CSS, FONT_C, txt } from './style';

/**
 * On-screen QWERTY keyboard for phones, so the system keyboard never opens.
 * Every key press is forwarded as the same key name a real keyboard would give
 * ("a".."z", "Backspace", "Tab"), so the game logic is identical on both.
 */
export class OnScreenKeyboard {
  private g: Phaser.GameObjects.Graphics;
  private flash = new Map<string, number>();
  private keys: { id: string; x: number; y: number; w: number; h: number }[] = [];
  readonly top: number;

  constructor(private scene: Phaser.Scene, private send: (k: string) => void, depth = 45) {
    const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    const kh = 54, gap = 6, margin = 6;
    const kw = (W - margin * 2 - gap * 9) / 10;
    this.top = H - 14 - 3 * kh - 2 * gap;
    this.g = scene.add.graphics().setDepth(depth);
    rows.forEach((row, r) => {
      const y = this.top + r * (kh + gap);
      let x = margin + (r === 1 ? (kw + gap) / 2 : 0);
      if (r === 2) { // Tab and Backspace flank the bottom row
        const sw = (W - margin * 2 - (kw + gap) * 7 - gap * 1) / 2;
        this.add('Tab', 'tab', margin, y, sw, kh, depth);
        x = margin + sw + gap;
        for (const ch of row) { this.add(ch, ch, x, y, kw, kh, depth); x += kw + gap; }
        this.add('Backspace', '\u232B', x, y, W - margin - x, kh, depth);
        return;
      }
      for (const ch of row) { this.add(ch, ch, x, y, kw, kh, depth); x += kw + gap; }
    });
    scene.input.addPointer(3); // allow fast two-thumb typing
    scene.events.on('postupdate', this.draw, this);
    scene.events.once('shutdown', () => scene.events.off('postupdate', this.draw, this));
    this.draw();
  }

  private add(id: string, label: string, x: number, y: number, w: number, h: number, depth: number) {
    this.keys.push({ id, x, y, w, h });
    const big = id.length === 1;
    txt(this.scene, x + w / 2, y + h / 2 + (big ? 1 : 0), label, big ? 24 : 16, CSS.ink, 0.5, 0.5, FONT_C).setDepth(depth + 1);
    const z = this.scene.add.zone(x + w / 2, y + h / 2, w, h).setDepth(depth + 2).setInteractive();
    z.on('pointerdown', () => { this.flash.set(id, 0.12); this.send(id); });
  }

  private draw() {
    const g = this.g; g.clear();
    const dt = 1 / 60;
    for (const k of this.keys) {
      const f = this.flash.get(k.id) ?? 0;
      if (f > 0) this.flash.set(k.id, f - dt);
      g.fillStyle(f > 0 ? COL.red : COL.white, f > 0 ? 0.85 : 0.96).fillRect(k.x, k.y, k.w, k.h);
      g.lineStyle(1, f > 0 ? COL.red : COL.light, 1).strokeRect(k.x, k.y, k.w, k.h);
    }
  }
}
