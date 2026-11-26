import Phaser from 'phaser';
import { W, H } from './config';
import { TitleScene } from './scenes/title';
import { GameScene } from './scenes/game';
import { SummaryScene } from './scenes/summary';
import { NotebookScene } from './scenes/notebook';
import { SettingsScene } from './scenes/settings';
import { applySettings } from './style';

applySettings();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game',
  backgroundColor: '#f3ead3',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true },
  input: { activePointers: 4 },
  scene: [TitleScene, NotebookScene, SettingsScene, GameScene, SummaryScene],
});

// Phones: keep Phaser's idea of where the canvas is in sync with the real page, so taps land where they are drawn.
// Safari's toolbars and the visual viewport can move the canvas without a normal resize event.
const syncBounds = () => { try { game.scale.updateBounds(); } catch { /* ignore */ } };
let lastTouchAt = -1e9;
window.addEventListener('touchstart', () => { lastTouchAt = performance.now(); syncBounds(); }, { capture: true, passive: true });
// Some mobile browsers send an extra mouse event after a tap. Swallow those before the game sees them.
for (const t of ['mousedown', 'mouseup', 'click']) window.addEventListener(t, (e) => { if (performance.now() - lastTouchAt < 900) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
window.addEventListener('mousedown', syncBounds, true);
window.addEventListener('resize', () => { setTimeout(() => game.scale.refresh(), 60); });
window.visualViewport?.addEventListener('resize', () => game.scale.refresh());
window.visualViewport?.addEventListener('scroll', syncBounds);
window.addEventListener('orientationchange', () => setTimeout(() => location.reload(), 250));
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Handy for debugging and automated checks.
(window as unknown as { __game: Phaser.Game }).__game = game;
