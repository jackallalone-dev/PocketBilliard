export class GameAudio {
  constructor() { this.enabled = false; this.lastHit = 0; }
  unlock() {
    if (!this.enabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context ||= new AudioContext();
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
  }
  play(type, strength = 1) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (type === 'collision' || type === 'rail') {
      if (now - this.lastHit < 0.03) return;
      this.lastHit = now;
    }
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const pocket = type === 'pocket';
    const length = pocket ? 0.15 : 0.055;
    oscillator.type = pocket ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(pocket ? 210 : type === 'rail' ? 180 : 740 + Math.random() * 180, now);
    oscillator.frequency.exponentialRampToValueAtTime(pocket ? 65 : 130, now + length);
    gain.gain.setValueAtTime(Math.min(0.15, 0.035 + strength * 0.009), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    oscillator.connect(gain);gain.connect(this.context.destination);
    oscillator.start(now);oscillator.stop(now + length);
    oscillator.onended = () => { oscillator.disconnect();gain.disconnect(); };
  }
}
