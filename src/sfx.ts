// All audio is synthesized with WebAudio: no asset files. M mutes (while paused).
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  muted = false;
  musicVol = 0.8;
  sfxVol = 1;
  setVolumes(m: number, s: number) {
    this.musicVol = m; this.sfxVol = s;
    if (this.ctx && this.musicBus && this.sfxBus) { this.musicBus.gain.setTargetAtTime(0.55 * m, this.ctx.currentTime, 0.02); this.sfxBus.gain.setTargetAtTime(s, this.ctx.currentTime, 0.02); }
  }
  ctx?: AudioContext;
  private master?: GainNode;
  private sfxBus?: GainNode;
  private musicBus?: GainNode;
  private noiseBuf?: AudioBuffer;
  private shaper?: WaveShaperNode;

  ensure(): AudioContext | undefined {
    if (!this.ctx) {
      try {
        const c = new AudioContext();
        this.ctx = c;
        this.master = c.createGain(); this.master.gain.value = 0.9;
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
        this.master.connect(comp).connect(c.destination);
        this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(this.master);
        this.musicBus = c.createGain(); this.musicBus.gain.value = 0.55 * this.musicVol; this.musicBus.connect(this.master);
        const n = c.sampleRate;
        this.noiseBuf = c.createBuffer(1, n, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.shaper = c.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(x * 4); }
        this.shaper.curve = curve;
        this.shaper.connect(this.sfxBus);
      } catch { return undefined; }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);
  }

  get musicOut() { return this.musicBus; }

  /** Oscillator with optional pitch slide and a fast attack / exponential decay. */
  osc(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, dist = false) {
    const c = this.ensure(); if (!c || this.muted) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dist && this.shaper ? this.shaper : this.sfxBus!);
    o.start(t); o.stop(t + dur + 0.03);
  }

  noise(dur: number, vol: number, hp = 800, lp = 12000, delay = 0, dist = false) {
    const c = this.ensure(); if (!c || this.muted || !this.noiseBuf) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
    const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(h).connect(l).connect(g).connect(dist && this.shaper ? this.shaper : this.sfxBus!);
    s.start(t, Math.random()); s.stop(t + dur + 0.03);
  }

  duck(amount = 0.25, secs = 0.35) {
    const c = this.ctx; if (!c || !this.musicBus) return;
    const t = c.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, t);
    this.musicBus.gain.linearRampToValueAtTime(0.55 * this.musicVol * amount, t + 0.02);
    this.musicBus.gain.linearRampToValueAtTime(0.55 * this.musicVol, t + secs);
  }

  // ----- effects (each is short, layered, and pitched up with the streak) -----
  key(streak: number) {
    const f = 700 + Math.min(streak, 40) * 22;
    this.osc('square', f, f * 0.7, 0.04, 0.05);
    this.noise(0.025, 0.07, 4000);
  }
  lock() { this.osc('triangle', 520, 780, 0.07, 0.08); }
  fire(streak: number) {
    const f = 300 + Math.min(streak, 30) * 14;
    this.osc('sawtooth', f * 2, f * 0.5, 0.12, 0.09);
    this.noise(0.06, 0.12, 2500);
  }
  kill(streak: number, big = false) {
    this.osc('sine', 150, 38, big ? 0.5 : 0.22, big ? 0.55 : 0.4);
    this.noise(big ? 0.45 : 0.2, big ? 0.3 : 0.18, 1200);
    this.osc('square', 880 + Math.min(streak, 30) * 25, 1760, 0.09, 0.06, 0.02);
  }
  perfect() { this.osc('triangle', 1320, 1320, 0.25, 0.07, 0.03); this.osc('triangle', 1980, 1980, 0.3, 0.05, 0.06); }
  typo() {
    this.osc('sawtooth', 130, 70, 0.2, 0.18, 0, true);
    this.noise(0.12, 0.2, 300, 3000, 0, true);
    this.duck(0.5, 0.25);
  }
  hurt() {
    this.osc('sine', 90, 25, 0.6, 0.9, 0, true);
    this.noise(0.5, 0.45, 150, 5000, 0, true);
    this.osc('sawtooth', 220, 60, 0.35, 0.2, 0, true);
    this.duck(0.15, 0.7);
  }
  alarm() { this.osc('square', 1050, 1050, 0.07, 0.07); this.osc('square', 1050, 1050, 0.07, 0.07, 0.11); }
  heartbeat() { this.osc('sine', 70, 40, 0.16, 0.5); this.osc('sine', 62, 36, 0.2, 0.4, 0.17); }
  milestone() { [0, 4, 7, 12, 16].forEach((n, i) => this.osc('square', midi(69 + n), midi(69 + n), 0.16, 0.08, i * 0.055)); this.noise(0.25, 0.12, 6000, 12000, 0.2); }
  spell(kind: 'nova' | 'slow' | 'erase' | 'ward' | 'edit' | 'finale') {
    if (kind === 'nova') { this.osc('sawtooth', 120, 900, 0.4, 0.2); this.noise(0.5, 0.35, 400); this.osc('sine', 100, 30, 0.5, 0.6); }
    else if (kind === 'slow') { this.osc('sine', 900, 120, 0.7, 0.25); this.osc('triangle', 450, 60, 0.7, 0.2); }
    else if (kind === 'erase') { this.noise(0.3, 0.3, 2000, 9000); this.osc('square', 1500, 300, 0.2, 0.08); }
    else if (kind === 'ward') { this.osc('triangle', 400, 800, 0.4, 0.2); this.osc('triangle', 600, 1200, 0.4, 0.15, 0.05); }
    else if (kind === 'edit') { [0, 3, 5].forEach((n, i) => this.osc('square', midi(72 + n), midi(72 + n), 0.07, 0.09, i * 0.05)); this.noise(0.1, 0.15, 3000); }
    else { this.osc('sawtooth', 60, 1200, 1.1, 0.3); this.noise(1.2, 0.5, 200, 9000); this.osc('sine', 80, 20, 1.2, 0.9); }
  }
  chargeUp() { this.osc('triangle', 880, 1760, 0.14, 0.1); }
  pick() { [0, 4, 7, 12].forEach((n, i) => this.osc('triangle', midi(60 + n), midi(60 + n), 0.5, 0.12, i * 0.04)); }
  select() { this.osc('square', 660, 660, 0.05, 0.06); }
  bossIntro() { this.osc('sawtooth', 55, 40, 2.4, 0.35, 0, true); this.noise(2, 0.15, 100, 1500); this.osc('sine', 40, 28, 2.4, 0.6); }
  bossHit() { this.osc('sine', 110, 30, 0.4, 0.7); this.noise(0.3, 0.3, 300, 6000, 0, true); }
  bossDie() { this.osc('sine', 120, 20, 1.6, 1); this.noise(1.6, 0.6, 100, 8000, 0, true); [0, 4, 7, 12, 16, 19].forEach((n, i) => this.osc('square', midi(60 + n), midi(60 + n), 0.3, 0.1, 0.5 + i * 0.09)); }
  win() { [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.osc('triangle', midi(64 + n), midi(64 + n), 0.8, 0.12, i * 0.1)); }
  lose() { this.osc('sawtooth', 200, 30, 1.6, 0.4, 0, true); this.noise(1.2, 0.3, 80, 2000, 0, true); }
}
export const audio = new AudioEngine();

/** Procedural background music: A minor loop that adds layers (kick, hats, arp, lead) as intensity rises. */
class Music {
  private timer?: number;
  private step = 0;
  private nextT = 0;
  bpm = 88;
  intensity = 0;
  private playing = false;

  start() {
    const c = audio.ensure(); if (!c || this.playing) return;
    this.playing = true; this.step = 0; this.nextT = c.currentTime + 0.15;
    this.timer = window.setInterval(() => this.sched(), 25);
  }
  stop() { this.playing = false; if (this.timer) clearInterval(this.timer); this.timer = undefined; }
  set(intensity: number, bpm: number) { this.intensity = intensity; this.bpm = bpm; }

  private sched() {
    const c = audio.ctx; if (!c || !this.playing) return;
    while (this.nextT < c.currentTime + 0.14) {
      this.play(this.step, this.nextT);
      this.nextT += 60 / this.bpm / 4; this.step++;
    }
  }

  private n(type: OscillatorType, f: number, t: number, dur: number, vol: number, lp = 3000) {
    const c = audio.ctx!; const out = audio.musicOut!;
    const o = c.createOscillator(); const g = c.createGain(); const l = c.createBiquadFilter();
    l.type = 'lowpass'; l.frequency.value = lp;
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(l).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  private drum(kind: 'kick' | 'hat' | 'snare', t: number, vol: number) {
    const c = audio.ctx!; const out = audio.musicOut!;
    if (kind === 'kick') {
      const o = c.createOscillator(); const g = c.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.22);
    } else {
      const n = Math.floor(c.sampleRate * 0.12); const b = c.createBuffer(1, n, c.sampleRate);
      const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const s = c.createBufferSource(); s.buffer = b;
      const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = kind === 'hat' ? 7000 : 1800;
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'hat' ? 0.05 : 0.14));
      s.connect(h).connect(g).connect(out); s.start(t);
    }
  }

  private play(s: number, t: number) {
    const roots = [57, 53, 48, 55]; // Am F C G
    const chords = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
    const bar = Math.floor(s / 16) % 4; const i = s % 16; const root = roots[bar]; const ch = chords[bar];
    const beat = 60 / this.bpm; const I = this.intensity;
    if (i === 0) { // pad
      for (const k of ch) { this.n('sawtooth', midi(root + 12 + k), t, beat * 4, 0.022, 700); this.n('sawtooth', midi(root + 12 + k) * 1.006, t, beat * 4, 0.018, 700); }
    }
    // bass: quarters, or eighths when it gets tense
    if (i % 4 === 0 || (I >= 2 && i % 2 === 0)) this.n('triangle', midi(root - 12), t, beat * 0.45, 0.16, 500);
    if (I >= 1) { if (i % 8 === 0 || (I >= 2 && i % 4 === 0)) this.drum('kick', t, 0.5); }
    if (I >= 2 && (i === 4 || i === 12)) this.drum('snare', t, 0.12);
    if (I >= 1 && i % 2 === 0) this.drum('hat', t, I >= 3 ? 0.07 : 0.04);
    if (I >= 3 && i % 2 === 1) this.drum('hat', t, 0.04);
    if (I >= 2 && i % 2 === 0) { // arpeggio
      const seq = [0, 1, 2, 3, 2, 1, 2, 1]; const tones = [...ch, ch[0] + 12];
      this.n('square', midi(root + 24 + tones[seq[(i / 2) % 8]]), t, beat * 0.3, 0.035, 2200);
    }
    if (I >= 3 && (i === 0 || i === 6 || i === 10)) this.n('sawtooth', midi(root + 36 + ch[(i / 2) % 3]), t, beat * 0.6, 0.03, 2600);
  }
}
export const music = new Music();

// Backwards-compatible alias used by scenes.
export const sfx = audio;
