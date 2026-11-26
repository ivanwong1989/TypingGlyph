import Phaser from 'phaser';
import { W, H } from './config';
import { COL, CSS, FONT_C, txt } from './style';
import { debugLog } from './debug';

interface Key { id: string; x: number; y: number; w: number; h: number }

/**
 * On-screen QWERTY keyboard for phones, so the system keyboard never opens.
 *
 * Input is read straight from the browser's own touch events on the canvas rather than
 * through the engine's pointer layer, so every finger is handled exactly once:
 * one touchstart = one key. Mouse events are used only on devices with no touch, and
 * the "ghost" mouse events some browsers send after a tap are ignored.
 * Every press is forwarded as the key name a real keyboard would give
 * ("a".."z", "Backspace", "Tab"), so the game logic is identical on both.
 */
export class OnScreenKeyboard {
  private g: Phaser.GameObjects.Graphics;
  private flash = new Map<string, number>();
  private keys: Key[] = [];
  private lastTouchAt = -1e9;
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
        this.add('Backspace', '⌫', x, y, W - margin - x, kh, depth);
        return;
      }
      for (const ch of row) { this.add(ch, ch, x, y, kw, kh, depth); x += kw + gap; }
    });

    const canvas = scene.game.canvas;
    const onTouch = (e: TouchEvent) => {
      this.lastTouchAt = performance.now();
      let used = false;
      for (const t of Array.from(e.changedTouches)) {
        const k = this.hit(t.clientX, t.clientY);
        if (k) { used = true; this.press(k, `touch#${t.identifier}`); }
      }
      if (used && e.cancelable) e.preventDefault(); // no ghost mouse event, no double-tap zoom
    };
    const onMouse = (e: MouseEvent) => {
      if (performance.now() - this.lastTouchAt < 900) { debugLog('ignored ghost mouse'); return; }
      const k = this.hit(e.clientX, e.clientY);
      if (k) this.press(k, 'mouse');
    };
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('mousedown', onMouse);
    scene.events.on('postupdate', this.draw, this);
    scene.events.once('shutdown', () => {
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('mousedown', onMouse);
      scene.events.off('postupdate', this.draw, this);
    });
    this.draw();
  }

  private add(id: string, label: string, x: number, y: number, w: number, h: number, depth: number) {
    this.keys.push({ id, x, y, w, h });
    const big = id.length === 1;
    txt(this.scene, x + w / 2, y + h / 2 + (big ? 1 : 0), label, big ? 24 : 16, CSS.ink, 0.5, 0.5, FONT_C).setDepth(depth + 1);
  }

  /** Which key is under this screen position (CSS pixels)? Uses the canvas's real on-screen box. */
  private hit(clientX: number, clientY: number): string | null {
    const r = this.scene.game.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const x = ((clientX - r.left) * W) / r.width;
    const y = ((clientY - r.top) * H) / r.height;
    // A small slop between keys so a finger on a gap still counts for the nearest key.
    let best: Key | null = null; let bd = 1e9;
    for (const k of this.keys) {
      const dx = Math.max(k.x - x, 0, x - (k.x + k.w)), dy = Math.max(k.y - y, 0, y - (k.y + k.h));
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = k; }
    }
    return best && bd <= 3 ? best.id : null;
  }

  /** Screen position (CSS px) of the centre of a key; used by automated tests. */
  clientCenter(id: string): { x: number; y: number } | null {
    const key = this.keys.find((q) => q.id === id); if (!key) return null;
    const r = this.scene.game.canvas.getBoundingClientRect();
    return { x: r.left + ((key.x + key.w / 2) * r.width) / W, y: r.top + ((key.y + key.h / 2) * r.height) / H };
  }

  private press(id: string, src: string) {
    this.flash.set(id, 0.12);
    debugLog(`key ${id} via ${src}`);
    this.send(id);
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
