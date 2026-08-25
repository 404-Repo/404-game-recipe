/**
 * All sound is synthesised at runtime. No files, nothing to download, nothing
 * licensed — the same rule the assets follow. A warehouse is a big reverberant
 * concrete box, so everything goes through one convolver whose impulse response
 * is generated from noise, which is most of what makes a gunshot indoors sound
 * like a gunshot indoors.
 */
export class Audio {
  constructor() {
    this.ok = false;
    this.ctx = null;
  }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    this.dry = ctx.createGain(); this.dry.gain.value = 0.82; this.dry.connect(this.master);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.40;
    this.conv = ctx.createConvolver();
    this.conv.buffer = this._ir(1.9, 2.6);
    this.conv.connect(this.wet); this.wet.connect(this.master);

    this.bus = ctx.createGain();
    this.bus.connect(this.dry); this.bus.connect(this.conv);

    this._noise = this._noiseBuffer(2.0);
    this.ok = true;
    this._ambience();
  }

  _noiseBuffer(sec) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  _ir(sec, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        // a couple of discrete early reflections, then a smooth tail
        let v = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
        if (i > 1700 && i < 1760) v += (Math.random() * 2 - 1) * 0.55;
        if (i > 3900 && i < 3980) v += (Math.random() * 2 - 1) * 0.35;
        d[i] = v;
      }
    }
    return b;
  }

  _env(node, peak, a, d, when) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + a);
    g.gain.exponentialRampToValueAtTime(0.0001, when + a + d);
    node.connect(g); g.connect(this.bus);
    return g;
  }

  _noiseSrc(when, dur, type, freq, q) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._noise; s.loop = true;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    let last = s;
    if (type) {
      const f = this.ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      s.connect(f); last = f;
    }
    s.start(when); s.stop(when + dur + 0.05);
    return last;
  }

  shot() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // crack: short bright noise burst
    this._env(this._noiseSrc(t, 0.16, 'highpass', 1400), 0.72, 0.0016, 0.10, t);
    // body: band-limited mid
    this._env(this._noiseSrc(t, 0.22, 'bandpass', 620, 1.1), 0.55, 0.003, 0.15, t);
    // thump: pitched-down sine
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    this._env(o, 0.60, 0.002, 0.12, t); o.start(t); o.stop(t + 0.2);
    // mechanical action
    this._env(this._noiseSrc(t + 0.028, 0.05, 'bandpass', 2600, 3), 0.10, 0.002, 0.04, t + 0.028);
  }

  enemyShot(dist) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + Math.min(0.25, dist / 340);
    const k = Math.max(0.06, 1 - dist / 42);
    this._env(this._noiseSrc(t, 0.14, 'highpass', 900), 0.34 * k, 0.002, 0.10, t);
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.10);
    this._env(o, 0.28 * k, 0.002, 0.11, t); o.start(t); o.stop(t + 0.2);
  }

  dryFire() { if (!this.ok) return; const t = this.ctx.currentTime;
    this._env(this._noiseSrc(t, 0.04, 'bandpass', 3200, 6), 0.14, 0.001, 0.03, t); }

  reload() { if (!this.ok) return; const t = this.ctx.currentTime;
    this._env(this._noiseSrc(t + 0.02, 0.06, 'bandpass', 1500, 4), 0.16, 0.002, 0.05, t + 0.02);
    this._env(this._noiseSrc(t + 0.30, 0.05, 'bandpass', 900, 3), 0.13, 0.002, 0.05, t + 0.30); }

  magIn() { if (!this.ok) return; const t = this.ctx.currentTime;
    this._env(this._noiseSrc(t, 0.07, 'bandpass', 700, 2.5), 0.20, 0.002, 0.06, t);
    this._env(this._noiseSrc(t + 0.22, 0.05, 'bandpass', 2400, 5), 0.15, 0.001, 0.04, t + 0.22); }

  hitmark(head) { if (!this.ok) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'square';
    o.frequency.value = head ? 1750 : 1150;
    this._env(o, 0.085, 0.001, 0.055, t); o.start(t); o.stop(t + 0.09); }

  impact(kind) { if (!this.ok) return; const t = this.ctx.currentTime;
    const f = kind === 'flesh' ? 300 : kind === 'metal' ? 2100 : 800;
    this._env(this._noiseSrc(t, 0.07, 'bandpass', f, 2), 0.11, 0.001, 0.06, t); }

  step(run) { if (!this.ok) return; const t = this.ctx.currentTime;
    this._env(this._noiseSrc(t, 0.07, 'bandpass', 220 + Math.random() * 120, 1.2), run ? 0.13 : 0.075, 0.004, 0.07, t);
    this._env(this._noiseSrc(t, 0.05, 'highpass', 3600), run ? 0.035 : 0.018, 0.002, 0.05, t); }

  land(k) { if (!this.ok) return; const t = this.ctx.currentTime;
    this._env(this._noiseSrc(t, 0.13, 'lowpass', 340), 0.22 * k, 0.003, 0.13, t); }

  hurt() { if (!this.ok) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.3);
    this._env(o, 0.16, 0.005, 0.32, t); o.start(t); o.stop(t + 0.4); }

  kill() { if (!this.ok) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.22);
    this._env(o, 0.10, 0.004, 0.24, t); o.start(t); o.stop(t + 0.3); }

  _ambience() {
    const ctx = this.ctx, t = ctx.currentTime;
    // the constant electrical hum of a big shed at night, plus wind
    const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 50;
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 160;
    const hg = ctx.createGain(); hg.gain.value = 0.020;
    hum.connect(hf); hf.connect(hg); hg.connect(this.dry); hum.start(t);

    const w = ctx.createBufferSource(); w.buffer = this._noiseBuffer(4); w.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 340; wf.Q.value = 0.5;
    const wg = ctx.createGain(); wg.gain.value = 0.028;
    w.connect(wf); wf.connect(wg); wg.connect(this.dry); w.start(t);
    // slow swell so it does not sit still
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.016;
    lfo.connect(lg); lg.connect(wg.gain); lfo.start(t);
  }
}
