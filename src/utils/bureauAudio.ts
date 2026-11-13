function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    return new AudioCtx();
  } catch {
    return null;
  }
}

// #49: Typewriter Bell "Ding!"
export function playTypewriterDing() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1980, now);
  osc.frequency.exponentialRampToValueAtTime(1960, now + 0.6);
  gain.gain.setValueAtTime(0.24, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.68);
  osc.onended = () => ctx.close().catch(() => {});
}

// #14 & #50: Heavy Rubber Stamp Thud
export function playStampThud() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
  gain.gain.setValueAtTime(0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.18);
  osc.onended = () => ctx.close().catch(() => {});
}

// #43: Vintage Camera Flash Shutter
export function playCameraShutterFlash() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const duration = 0.09;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = Math.pow(1 - i / data.length, 2);
    data[i] = (Math.random() * 2 - 1) * env * 0.4;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1800;
  src.connect(filter);
  filter.connect(ctx.destination);
  src.start();
  src.onended = () => ctx.close().catch(() => {});
}

// #37: Paper Crumple into Tin Trash
export function playPaperCrumple() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const duration = 0.34;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const burst = Math.sin((i / data.length) * Math.PI * 6) > 0 ? 1 : 0.35;
    data[i] = (Math.random() * 2 - 1) * burst * (1 - i / data.length) * 0.38;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2100;
  src.connect(filter);
  filter.connect(ctx.destination);
  src.start();
  src.onended = () => ctx.close().catch(() => {});
}

// #34: Rolling Date Stamp Mechanical "Click-Clack"
export function playDateClick() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(620, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.045);
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.005, now + 0.05);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.06);
  osc.onended = () => ctx.close().catch(() => {});
}
