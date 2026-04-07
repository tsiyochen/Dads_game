/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let audioCtx: AudioContext | null = null;

export const initAudio = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {
    console.warn('AudioContext not supported or blocked', e);
  }
};

const playTone = (freq: number, type: OscillatorType, startTimeOffset: number, duration: number, vol: number) => {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTimeOffset);
    
    // Smooth envelope to avoid clicking sounds
    gain.gain.setValueAtTime(0, audioCtx.currentTime + startTimeOffset);
    gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + startTimeOffset + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + startTimeOffset + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(audioCtx.currentTime + startTimeOffset);
    osc.stop(audioCtx.currentTime + startTimeOffset + duration);
  } catch (e) {
    console.warn('Error playing tone', e);
  }
};

export const playWinSound = () => {
  if (!audioCtx) return;
  // Happy ascending arpeggio (C5, E5, G5, C6) - Bright and cheerful
  playTone(523.25, 'sine', 0, 0.3, 0.5);
  playTone(659.25, 'sine', 0.15, 0.3, 0.5);
  playTone(783.99, 'sine', 0.3, 0.3, 0.5);
  playTone(1046.50, 'sine', 0.45, 0.6, 0.5);
};

export const playLoseSound = () => {
  if (!audioCtx) return;
  // Sad descending tones (G4, Gb4, F4, E4) - Gentle but clearly negative
  playTone(392.00, 'triangle', 0, 0.4, 0.5);
  playTone(369.99, 'triangle', 0.3, 0.4, 0.5);
  playTone(349.23, 'triangle', 0.6, 0.4, 0.5);
  playTone(329.63, 'triangle', 0.9, 0.8, 0.5);
};

export const playDrawSound = () => {
  if (!audioCtx) return;
  // Neutral tones (A4, A4) - Informative but not overly emotional
  playTone(440, 'sine', 0, 0.3, 0.4);
  playTone(440, 'sine', 0.4, 0.4, 0.4);
};
