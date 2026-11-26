# TypingGlyph (prototype)

A typing roguelite. Phaser 3 + TypeScript + Vite. Runs locally in the browser, no server or account needed.

## Run it

Needs Node.js 18+. From this folder:

```powershell
npm install      # first time only
npm run dev      # then open http://localhost:5173
```

Or double-click `start.bat`. `npm run build` makes a static copy in `dist/`.

Test URLs: add `?wave=15` (15 seconds per page), `&god` (no damage), `&unlockall` (everything unlocked, Margin mode available).

## How to play

- Type the word in a box to destroy that enemy. The first letter locks the nearest enemy starting with it.
- `Tab` cycles targets. `Backspace` undoes a letter; twice quickly drops the target.
- A typo drops your combo to its last checkpoint and fills the ink gauge. A full gauge smudges the ship: the next word must be typed twice. A word typed with no typo is PERFECT. Typos on a boss cost ink, not combo.
- Every few clean words earns a spell charge. Spells: `!nova`, `!slow`, `!erase` (also wipes boss ink), `!ward` (Ward upgrade), `!echo` (Echo unlock), `!edit` (Scribe), `!route` (Cartographer, then N/W/E/S). `!finale` clears the page when the combo bar (top right) is full.
- After each page and each boss you pick an upgrade by typing its word. `!redraw` shuffles the cards once per run.
- Run: 5 pages and 3 bosses, about 5 minutes. Bosses: The Blot (hides the word with ink, `!erase` wipes it), The Red Pen (type the corrected spelling), The Last Page (the screen folds in, then tears open and frees every enemy type).
- Enemies: Drifter, Dasher, Splitter, Shielded (two words), Scrambler (shuffles its letters), Inker (hides letters of nearby words), Marker (heals: restores shields and undoes your typing progress on nearby words).
- `Esc` pauses (cheat sheet), `M` mutes while paused.

## Title screen keys

`←/→` difficulty (40/55/70/85 WPM, harder pays more ink) · `S` ship (Quill, Scribe, Cartographer) · `T` word theme · `P` paper · `G` Margin mode (after beating The Last Page: faster, longer words, harder boss twists, x1.5 ink) · `N` notebook (spend ink) · `O` settings · `I` import word list (.txt, one word per line, 20+ words) · `R` built-in words.

## Notebook (spend ink)

Scribe (needs 1 boss defeated), Cartographer (3 bosses), Ward card, Echo spell and card, five word themes (nature, space, food, fantasy, code), three paper types (graph, napkin, parchment).

## Settings (`O`)

Dyslexia-friendly font, word speed 50-150%, reduce motion (no shake, flashes or hit pauses, fewer particles), colour-blind markers (a shape icon beside every word), music and effects volume, export and import your save as a file.

## Code map

- `src/scenes/game.ts` run loop, stages, enemies, bosses, upgrades, drawing
- `src/typing.ts` pure typing engine
- `src/upgrades.ts` upgrade data and card drawing
- `src/sfx.ts` sound effects and music, all synthesized
- `src/config.ts` tuning numbers (pacing, word lengths, speeds, load per wave)
- `src/themes.ts` word themes, `src/words.ts` word picker and import
- `src/save.ts` everything stored in localStorage, `src/style.ts` palette, fonts, backdrops
