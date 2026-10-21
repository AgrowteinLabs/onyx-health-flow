// Audio synthesizer for incoming telehealth consultation ringtone
// Uses Web Audio API without requiring external audio assets

let audioCtx: AudioContext | null = null;
let ringInterval: any = null;
let isRinging = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

function playSingleChime(ctx: AudioContext) {
  if (!ctx || ctx.state === "closed") return;

  const now = ctx.currentTime;

  // Gentle chime chord frequencies (C5, E5, G5)
  const freqs = [523.25, 659.25, 783.99];

  freqs.forEach((freq, idx) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      // Smooth attack and release envelope
      const startTime = now + idx * 0.08;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.85);
    } catch {
      // Audio playback safety catch
    }
  });
}

/**
 * Starts playing an incoming consultation ringtone chime in a loop.
 */
export function startRingtone() {
  if (isRinging) return;
  isRinging = true;

  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    // Play immediate chime
    playSingleChime(ctx);

    // Repeat every 2.4 seconds
    ringInterval = setInterval(() => {
      if (!isRinging) return;
      playSingleChime(ctx);
    }, 2400);
  } catch (err) {
    console.debug("Web Audio ringtone initialization note:", err);
  }
}

/**
 * Stops any playing incoming call ringtone.
 */
export function stopRingtone() {
  isRinging = false;
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
}

/**
 * Check if the ringtone is currently playing.
 */
export function isRingtoneActive(): boolean {
  return isRinging;
}

/**
 * Play a single preview chime
 */
export function playRingtoneChime() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    playSingleChime(ctx);
  } catch (err) {
    console.debug("Web Audio ringtone preview note:", err);
  }
}

