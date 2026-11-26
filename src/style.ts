import Phaser from 'phaser';
import { W, H } from './config';
import { save, Settings, DEFAULT_SETTINGS } from './save';
import { audio } from './sfx';

// Muted off-white paper, graphite, and one deep red accent.
export const COL = {
  paper: 0xe9e8df,
  white: 0xf6f5ee,
  ink: 0x3a3a37,
  grey: 0x8e8d86,
  light: 0xc4c3b8,
  red: 0x9a3b40,
  redHi: 0xc4474e,
};
export const CSS = { ink: '#3a3a37', grey: '#8e8d86', mid: '#6e6d66', light: '#c4c3b8', red: '#9a3b40', redHi: '#c4474e', paper: '#e9e8df', white: '#f6f5ee' };
// Fonts and motion settings are live bindings so the Settings screen can change them.
export let FONT = "'Segoe UI','Helvetica Neue',Arial,sans-serif";
export let FONT_C = "Bahnschrift,'Arial Narrow','Segoe UI',sans-serif";
export const SET: Settings = { ...DEFAULT_SETTINGS };
export function applySettings(s: Settings = save.getSettings()) {
  Object.assign(SET, s);
  // Dyslexia-friendly: a wide, plain face with distinct letter shapes.
  FONT = s.dys ? "Verdana,'Trebuchet MS','Comic Sans MS',sans-serif" : "'Segoe UI','Helvetica Neue',Arial,sans-serif";
  FONT_C = s.dys ? "Verdana,'Trebuchet MS','Comic Sans MS',sans-serif" : "Bahnschrift,'Arial Narrow','Segoe UI',sans-serif";
  audio.setVolumes(s.music, s.sfx);
}

export interface P { x: number; y: number }

export function strokePts(g: Phaser.GameObjects.Graphics, pts: P[], color: number, width = 1.5, alpha = 1) {
  if (pts.length < 2) return;
  g.lineStyle(width, color, alpha);
  g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.strokePath();
}
export function fillPts(g: Phaser.GameObjects.Graphics, pts: P[], color: number, alpha = 1) {
  g.fillStyle(color, alpha); g.fillPoints(pts as never, true);
}
export function regPoly(cx: number, cy: number, r: number, n: number, rot = 0): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) { const a = rot + (i / n) * Math.PI * 2; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
  return pts;
}
export function rotPts(pts: P[], cx: number, cy: number, ang: number): P[] {
  const c = Math.cos(ang), s = Math.sin(ang);
  return pts.map((p) => ({ x: cx + p.x * c - p.y * s, y: cy + p.x * s + p.y * c }));
}

/** Soft vignetted paper, generated once. */
export function drawBackdrop(scene: Phaser.Scene) {
  const page = save.getPage(); const key = 'backdrop_' + page;
  if (!scene.textures.exists(key)) {
    const t = scene.textures.createCanvas(key, W, H)!;
    const c = t.getContext();
    const tones: Record<string, [string, string]> = { plain: ['#efeee6', '#d6d5ca'], graph: ['#f1f0e8', '#d9d8cd'], napkin: ['#f6f4ee', '#e0ddd2'], parchment: ['#ecdfbd', '#c9b88c'] };
    const [a, b] = tones[page] || tones.plain;
    const g = c.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, a); g.addColorStop(1, b);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { // faint paper grain
      c.fillStyle = `rgba(80,78,66,${Math.random() * 0.035})`;
      c.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }
    if (page === 'graph') { // very faint squared grid
      c.strokeStyle = 'rgba(90,100,110,0.10)'; c.lineWidth = 1;
      for (let x = 0; x < W; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
      for (let y = 0; y < H; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    } else if (page === 'napkin') { // embossed dot pattern
      c.fillStyle = 'rgba(120,115,100,0.07)';
      for (let x = 12; x < W; x += 24) for (let y = 12; y < H; y += 24) { c.beginPath(); c.arc(x + ((y / 24) % 2) * 12, y, 2, 0, 6.3); c.fill(); }
    } else if (page === 'parchment') { // stains
      for (let i = 0; i < 10; i++) { c.fillStyle = 'rgba(120,90,40,0.04)'; c.beginPath(); c.arc(Math.random() * W, Math.random() * H, 60 + Math.random() * 160, 0, 6.3); c.fill(); }
    }
    t.refresh();
  }
  return scene.add.image(0, 0, key).setOrigin(0).setDepth(0);
}

export function ensureTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists('topbar')) {
    const t = scene.textures.createCanvas('topbar', 640, 54)!; const c = t.getContext();
    const g = c.createLinearGradient(0, 0, 640, 0);
    g.addColorStop(0, 'rgba(46,46,42,0)'); g.addColorStop(0.18, 'rgba(46,46,42,0.93)'); g.addColorStop(0.82, 'rgba(46,46,42,0.93)'); g.addColorStop(1, 'rgba(46,46,42,0)');
    c.fillStyle = g; c.fillRect(0, 0, 640, 54); t.refresh();
  }
  if (!scene.textures.exists('dangerVig')) {
    const t = scene.textures.createCanvas('dangerVig', W, H)!; const c = t.getContext();
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, 'rgba(154,59,64,0)'); g.addColorStop(1, 'rgba(154,59,64,0.55)');
    c.fillStyle = g; c.fillRect(0, 0, W, H); t.refresh();
  }
}

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size: number, color: string, ox = 0.5, oy = 0.5, font = FONT) {
  return scene.add
    .text(x, y, s, { fontFamily: font, fontSize: size + 'px', color })
    .setOrigin(ox, oy)
    .setResolution(Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
}

export interface Btn { setLabel: (s: string) => void; setActive: (a: boolean) => void; objs: Phaser.GameObjects.GameObject[] }

/** A tappable outlined button in the paper style (used by the mobile screens). */
export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onTap: () => void, size = 22, accent = false, depth = 5): Btn {
  const g = scene.add.graphics().setDepth(depth);
  const t = txt(scene, x, y, label, size, accent ? CSS.white : CSS.ink, 0.5, 0.5, FONT_C).setDepth(depth + 1).setAlign('center');
  const z = scene.add.zone(x, y, w, h).setDepth(depth + 2).setInteractive();
  let active = false;
  const draw = (down: boolean) => {
    g.clear();
    if (accent) g.fillStyle(COL.red, down ? 0.8 : 1).fillRect(x - w / 2, y - h / 2, w, h);
    else if (down || active) g.fillStyle(COL.light, 0.8).fillRect(x - w / 2, y - h / 2, w, h);
    g.lineStyle(active ? 2 : 1.2, accent || active ? COL.red : COL.ink, 1).strokeRect(x - w / 2, y - h / 2, w, h);
  };
  z.on('pointerdown', () => draw(true));
  z.on('pointerout', () => draw(false));
  z.on('pointerup', () => { draw(false); onTap(); });
  draw(false);
  return { setLabel: (s) => t.setText(s), setActive: (a) => { active = a; draw(false); t.setColor(accent ? CSS.white : a ? CSS.red : CSS.ink); }, objs: [g, t, z] };
}
