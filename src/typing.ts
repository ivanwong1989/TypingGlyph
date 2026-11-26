// Pure typing engine: no rendering, no Phaser. Feed it key presses, get events back.


export interface TargetView { id: number; word: string; distSq: number }

export type TypingEvent =
  | { t: 'letter'; id: number; progress: number }
  | { t: 'complete'; id: number }
  | { t: 'typo' }
  | { t: 'lock'; id: number }
  | { t: 'unlock' }
  | { t: 'spellStart' }
  | { t: 'spellBuf'; buf: string }
  | { t: 'spell'; name: string }
  | { t: 'spellCancel' };

export class TypingEngine {
  spells: string[] = ['nova', 'slow', 'erase'];
  lockedId: number | null = null;
  progress = 0;
  spell: string | null = null; // null = not in spell mode, otherwise letters typed after "!"
  correctKeys = 0;
  typos = 0;
  private lastBackspace = -1e9;

  reset() {
    this.lockedId = null; this.progress = 0; this.spell = null;
    this.correctKeys = 0; this.typos = 0; this.lastBackspace = -1e9;
  }

  /** Re-lock a target with progress cleared (used by the smudge rule). */
  relock(id: number) { this.lockedId = id; this.progress = 0; }
  release() { this.lockedId = null; this.progress = 0; }

  key(k: string, targets: TargetView[], now: number): TypingEvent[] {
    const out: TypingEvent[] = [];

    if (this.spell !== null) {
      if (k === 'Backspace') {
        if (this.spell === '') { this.spell = null; out.push({ t: 'spellCancel' }); }
        else { this.spell = this.spell.slice(0, -1); out.push({ t: 'spellBuf', buf: this.spell }); }
      } else if (/^[a-z]$/.test(k)) {
        const nb = this.spell + k;
        const exact = this.spells.find((s) => s === nb);
        if (exact) { this.spell = null; out.push({ t: 'spell', name: exact }); }
        else if (this.spells.some((s) => s.startsWith(nb))) { this.spell = nb; out.push({ t: 'spellBuf', buf: nb }); }
        else { this.spell = null; out.push({ t: 'spellCancel' }); }
      } else if (k === 'Tab' || k === 'Enter') {
        this.spell = null; out.push({ t: 'spellCancel' });
      }
      return out;
    }

    if (k === '!') { this.spell = ''; out.push({ t: 'spellStart' }); return out; }

    if (k === 'Tab') {
      if (!targets.length) return out;
      const sorted = [...targets].sort((a, b) => a.distSq - b.distSq);
      const idx = sorted.findIndex((t) => t.id === this.lockedId);
      const next = sorted[(idx + 1) % sorted.length];
      this.lockedId = next.id; this.progress = 0;
      out.push({ t: 'lock', id: next.id });
      return out;
    }

    if (k === 'Backspace') {
      if (this.lockedId !== null) {
        if (now - this.lastBackspace < 800) {
          this.release(); out.push({ t: 'unlock' });
        } else if (this.progress > 0) {
          this.progress--; out.push({ t: 'letter', id: this.lockedId, progress: this.progress });
        }
      }
      this.lastBackspace = now;
      return out;
    }

    if (!/^[a-z]$/.test(k)) return out;

    if (this.lockedId !== null && !targets.some((t) => t.id === this.lockedId)) this.release();

    if (this.lockedId !== null) {
      const tg = targets.find((t) => t.id === this.lockedId)!;
      if (tg.word[this.progress] === k) {
        this.progress++; this.correctKeys++;
        if (this.progress >= tg.word.length) {
          const id = tg.id; this.release(); out.push({ t: 'complete', id });
        } else out.push({ t: 'letter', id: tg.id, progress: this.progress });
      } else { this.typos++; out.push({ t: 'typo' }); }
      return out;
    }

    const cands = targets.filter((t) => t.word[0] === k).sort((a, b) => a.distSq - b.distSq);
    if (!cands.length) { this.typos++; out.push({ t: 'typo' }); return out; }
    const tg = cands[0];
    this.correctKeys++;
    out.push({ t: 'lock', id: tg.id });
    if (tg.word.length <= 1) { out.push({ t: 'complete', id: tg.id }); return out; }
    this.lockedId = tg.id; this.progress = 1;
    out.push({ t: 'letter', id: tg.id, progress: 1 });
    return out;
  }
}
