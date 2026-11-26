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
  scene: [TitleScene, NotebookScene, SettingsScene, GameScene, SummaryScene],
});

// Handy for debugging and automated checks.
(window as unknown as { __game: Phaser.Game }).__game = game;
