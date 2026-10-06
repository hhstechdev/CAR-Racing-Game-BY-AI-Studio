/**
 * High-performance Web Audio API procedural sound synthesizer for 3D racing
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engineGain: GainNode | null = null;

  // Engine oscillators
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private isEngineRunning = false;

  // Tire screech
  private screechSource: AudioBufferSourceNode | null = null;
  private screechGain: GainNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;

  // Boost noise
  private boostSource: AudioBufferSourceNode | null = null;
  private boostGain: GainNode | null = null;

  private isMuted = false;
  private masterVolume = 0.8;

  constructor() {
    // AudioContext will be initialized on first user interaction to comply with autoplay policies
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      this.engineGain.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  // --- Engine Audio ---
  public startEngine(carType: string = 'starter') {
    this.initContext();
    if (!this.ctx || !this.engineGain || this.isEngineRunning) return;

    try {
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineFilter = this.ctx.createBiquadFilter();

      this.engineOsc1.type = carType === 'ferrari' ? 'sawtooth' : 'triangle';
      this.engineOsc2.type = 'sawtooth';

      this.engineOsc1.frequency.setValueAtTime(55, this.ctx.currentTime);
      this.engineOsc2.frequency.setValueAtTime(110, this.ctx.currentTime);

      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(600, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

      const oscGain1 = this.ctx.createGain();
      const oscGain2 = this.ctx.createGain();
      oscGain1.gain.setValueAtTime(0.6, this.ctx.currentTime);
      oscGain2.gain.setValueAtTime(0.4, this.ctx.currentTime);

      this.engineOsc1.connect(oscGain1);
      this.engineOsc2.connect(oscGain2);

      oscGain1.connect(this.engineFilter);
      oscGain2.connect(this.engineFilter);

      this.engineFilter.connect(this.engineGain);
      this.engineGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

      this.engineOsc1.start();
      this.engineOsc2.start();
      this.isEngineRunning = true;
    } catch {
      // Audio fallback
    }
  }

  public updateEngine(speedNormalized: number, isAccelerating: boolean, isBoosting: boolean) {
    if (!this.isEngineRunning || !this.ctx || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineGain) return;

    const baseFreq = 50 + speedNormalized * 180 + (isAccelerating ? 25 : 0) + (isBoosting ? 60 : 0);
    const filterFreq = 400 + speedNormalized * 2200 + (isAccelerating ? 400 : 0);

    const now = this.ctx.currentTime;
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.05);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.06);

    const targetGain = 0.2 + speedNormalized * 0.25 + (isAccelerating ? 0.1 : 0);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
  }

  public stopEngine() {
    if (!this.isEngineRunning) return;
    try {
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
      this.engineOsc1?.disconnect();
      this.engineOsc2?.disconnect();
      this.isEngineRunning = false;
    } catch {
      // ignore
    }
  }

  // --- Tire Screech ---
  public updateScreech(intensity: number) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    if (intensity > 0.15) {
      if (!this.screechSource) {
        // Create noise buffer
        const bufferSize = this.ctx.sampleRate * 1.5;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        this.screechSource = this.ctx.createBufferSource();
        this.screechSource.buffer = noiseBuffer;
        this.screechSource.loop = true;

        this.screechFilter = this.ctx.createBiquadFilter();
        this.screechFilter.type = 'bandpass';
        this.screechFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
        this.screechFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

        this.screechGain = this.ctx.createGain();
        this.screechGain.gain.setValueAtTime(0, this.ctx.currentTime);

        this.screechSource.connect(this.screechFilter);
        this.screechFilter.connect(this.screechGain);
        this.screechGain.connect(this.sfxGain);

        this.screechSource.start();
      }

      if (this.screechGain) {
        const targetVol = Math.min(0.4, (intensity - 0.15) * 0.7);
        this.screechGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.04);
      }
    } else if (this.screechGain) {
      this.screechGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  // --- Boost Sound ---
  public setBoostAudio(active: boolean) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    if (active) {
      if (!this.boostSource) {
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.8;
        }

        this.boostSource = this.ctx.createBufferSource();
        this.boostSource.buffer = noiseBuffer;
        this.boostSource.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(700, this.ctx.currentTime);

        this.boostGain = this.ctx.createGain();
        this.boostGain.gain.setValueAtTime(0, this.ctx.currentTime);

        this.boostSource.connect(filter);
        filter.connect(this.boostGain);
        this.boostGain.connect(this.sfxGain);

        this.boostSource.start();
      }

      if (this.boostGain) {
        this.boostGain.gain.setTargetAtTime(0.35, this.ctx.currentTime, 0.08);
      }
    } else if (this.boostGain) {
      this.boostGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }

  // --- SFX Events ---
  public playCollision(force: number = 1) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.15);

      const impactVol = Math.min(0.6, force * 0.4);
      gain.gain.setValueAtTime(impactVol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch {
      // ignore
    }
  }

  public playBoostPickup() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const notes = [587.33, 880, 1174.66]; // D5, A5, D6
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.05);

        gain.gain.setValueAtTime(0, this.ctx!.currentTime + idx * 0.05);
        gain.gain.linearRampToValueAtTime(0.2, this.ctx!.currentTime + idx * 0.05 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.05 + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxGain!);

        osc.start(this.ctx!.currentTime + idx * 0.05);
        osc.stop(this.ctx!.currentTime + idx * 0.05 + 0.2);
      });
    } catch {
      // ignore
    }
  }

  public playCoinReward() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    try {
      // High arcade reward ping
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, this.ctx.currentTime + 0.06); // E6

      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.32);
    } catch {
      // ignore
    }
  }

  public playCountdownBeep(isGo: boolean = false) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      const freq = isGo ? 1760 : 880; // A6 for GO, A5 for 3-2-1
      const duration = isGo ? 0.6 : 0.2;

      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // ignore
    }
  }

  public playFinishFanfare() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const chords = [523.25, 659.25, 783.99, 1046.5]; // C major
      chords.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0.2, this.ctx!.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.08 + 0.8);

        osc.connect(gain);
        gain.connect(this.sfxGain!);

        osc.start(this.ctx!.currentTime + idx * 0.08);
        osc.stop(this.ctx!.currentTime + idx * 0.08 + 0.85);
      });
    } catch {
      // ignore
    }
  }

  public playClick() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {
      // ignore
    }
  }

  public playGearShift(isUpshift: boolean = true) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const now = this.ctx.currentTime;
      // Mechanical gearbox dog-ring engagement clack + pneumatic transmission hiss
      const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.08, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.015));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = isUpshift ? 'bandpass' : 'highpass';
      filter.frequency.setValueAtTime(isUpshift ? 2400 : 1800, now);
      filter.Q.setValueAtTime(2.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      noise.start(now);

      // Low mechanical thunk
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isUpshift ? 180 : 120, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.06);

      oscGain.gain.setValueAtTime(0.4, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(oscGain);
      oscGain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // ignore
    }
  }

  public playRevLimiter() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(280, now + 0.02);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // ignore
    }
  }
}

export const soundEngine = new SoundEngine();
