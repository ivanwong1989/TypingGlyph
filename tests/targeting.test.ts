// Run with: npm test   (Node 22.6+ strips the types itself; no extra tooling)
import test from 'node:test';
import assert from 'node:assert/strict';
import { TypingEngine } from '../src/typing.ts';
import type { TypingEvent } from '../src/typing.ts';
import { isVisible, targetViews, PHONE_TOP } from '../src/targeting.ts';

const PORTRAIT = { W: 480, H: 1040, mobile: true };
const DESKTOP = { W: 1280, H: 720, mobile: false };

function typeWord(word: string, enemies: { id: number; word: string; x: number; y: number }[], layout = PORTRAIT, cx = 240, cy = 500) {
  const eng = new TypingEngine();
  const events: TypingEvent[] = [];
  for (const ch of word) events.push(...eng.key(ch, targetViews(enemies, layout, cx, cy), 0));
  return events;
}
const done = (ev: TypingEvent[], id: number) => ev.some((e) => e.t === 'complete' && e.id === id);

test('portrait: an enemy near the top of the playfield locks and is destroyed', () => {
  const ev = typeWord('code', [{ id: 1, word: 'code', x: 218, y: 228 }, { id: 2, word: 'tap', x: 452, y: 420 }]);
  assert.equal(ev.some((e) => e.t === 'typo'), false);
  assert.equal(done(ev, 1), true);
});

test('portrait: an enemy near the right edge is typable once it is on screen', () => {
  assert.equal(done(typeWord('tap', [{ id: 2, word: 'tap', x: 470, y: 420 }]), 2), true);
});

test('every position where a word is shown is typable (portrait and desktop)', () => {
  for (const [layout, cx, cy] of [[PORTRAIT, 240, 500], [DESKTOP, 640, 370]] as const) {
    let n = 0;
    for (let x = -60; x <= layout.W + 60; x += 12) for (let y = -60; y <= layout.H + 60; y += 12) {
      if (!isVisible(x, y, layout)) continue;
      n++;
      assert.equal(done(typeWord('go', [{ id: 7, word: 'go', x, y }], layout, cx, cy), 7), true, `not typable at ${x},${y}`);
    }
    assert.ok(n > 1000);
  }
});

test('enemies still off-screen (or under the phone HUD) are neither shown nor typable', () => {
  const hidden: [typeof PORTRAIT, number, number][] = [[PORTRAIT, 240, -50], [PORTRAIT, 240, 60], [PORTRAIT, 240, 148], [PORTRAIT, -40, 400], [PORTRAIT, 500, 400], [PORTRAIT, 479, 400], [DESKTOP, -30, 300], [DESKTOP, 1300, 300], [DESKTOP, 640, -40]];
  for (const [layout, x, y] of hidden) {
    assert.equal(isVisible(x, y, layout), false, `${x},${y} should be hidden`);
    const ev = typeWord('a', [{ id: 3, word: 'ant', x, y }], layout);
    assert.equal(ev.some((e) => e.t === 'lock'), false);
  }
});

test('portrait: the top edge behaves like the sides (visible the moment it crosses the HUD line)', () => {
  assert.equal(isVisible(240, PHONE_TOP - 1, PORTRAIT), false);
  assert.equal(isVisible(240, PHONE_TOP + 1, PORTRAIT), true);
  assert.equal(isVisible(7, 400, PORTRAIT), false);
  assert.equal(isVisible(9, 400, PORTRAIT), true);
});

test('boss words are always targetable', () => {
  const eng = new TypingEngine();
  const views = targetViews([{ id: 9, word: 'the', x: 240, y: 346, kind: 'boss' }], PORTRAIT, 240, 500);
  assert.equal(eng.key('t', views, 0).some((e) => e.t === 'lock'), true);
});
