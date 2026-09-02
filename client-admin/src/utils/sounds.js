/**
 * Admin UI sound feedback — synthesized via WebAudio, zero asset files.
 * Global click listener plays a soft tick on interactive elements;
 * playTone() exposes richer cues (success/error/toggle) for flows.
 * Mute state persists in localStorage ('admin-sound-muted').
 */

let audioCtx = null;

function ctx() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function isMuted() {
  try { return localStorage.getItem('admin-sound-muted') === '1'; } catch { return false; }
}
export function setMuted(v) {
  try { localStorage.setItem('admin-sound-muted', v ? '1' : '0'); } catch { /* ignore */ }
}

/** One soft, rounded blip — lowpassed sine with a gentle swell envelope.
    Tuned to match the panel's smooth prestige motion language. */
function blip({ freq = 1200, endFreq = null, dur = 0.055, type = 'sine', gain = 0.028, delay = 0 }) {
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const filter = ac.createBiquadFilter();
  const g = ac.createGain();
  filter.type = 'lowpass';
  filter.frequency.value = 2400;
  filter.Q.value = 0.4;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.35);          // soft swell
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);          // silky tail
  osc.connect(filter).connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

const CUES = {
  click: () => blip({ freq: 1250, endFreq: 980, dur: 0.06, gain: 0.026 }),
  nav:   () => blip({ freq: 620,  endFreq: 830, dur: 0.075, gain: 0.024 }),
  toggle:() => blip({ freq: 520,  endFreq: 700, dur: 0.08, gain: 0.03 }),
  success:() => { blip({ freq: 587, dur: 0.1, gain: 0.03 });
                  blip({ freq: 880, dur: 0.14, gain: 0.03, delay: 0.09 }); },
  pour:  () => {
    // milk into coffee: soft filtered-noise pour + a warm "plip"
    const ac = ctx();
    if (!ac) return;
    const t0 = ac.currentTime;
    const len = 0.5;
    const buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / data.length) * Math.PI);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2600, t0);
    f.frequency.exponentialRampToValueAtTime(500, t0 + len);   // liquid darkening
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.03, t0 + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    src.connect(f).connect(g).connect(ac.destination);
    src.start(t0);
    blip({ freq: 420, endFreq: 300, dur: 0.09, gain: 0.02, delay: 0.42 });
  },
  error: () => { blip({ freq: 260, endFreq: 200, dur: 0.16, type: 'sine', gain: 0.032 }); },
};

export function playTone(name) {
  if (isMuted()) return;
  (CUES[name] || CUES.click)();
}

/** Install the global interaction listener (call once at app boot). */
export function installClickSounds() {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', (e) => {
    if (isMuted()) return;
    const el = e.target.closest('button, [role="button"], a, label input[type="checkbox"], select, summary');
    if (!el || el.disabled) return;
    if (el.matches('a')) playTone('nav');
    else if (el.type === 'checkbox' || el.closest('label')) playTone('toggle');
    else playTone('click');
  }, true);
}
