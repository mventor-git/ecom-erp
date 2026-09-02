/**
 * CoffeeSplash — the signature admin loading moment.
 * A steaming cup of coffee at center; a ribbon of milk pours in and swirls
 * into the crema. Pairs with the soft "pour" sound cue (fires only after a
 * real user gesture, per browser autoplay policy).
 */
import { useEffect, useState } from 'react';
import { playTone } from '../../utils/sounds';

export default function CoffeeSplash({ label, duration = 1600, onFinish }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!duration) return undefined;
    const t1 = setTimeout(() => setLeaving(true), duration);
    const t2 = setTimeout(() => onFinish?.(), duration + 450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [duration, onFinish]);

  // Milk-pour cue once the browser lets us play audio
  useEffect(() => {
    const fire = () => playTone('pour');
    window.addEventListener('pointerdown', fire, { once: true });
    return () => window.removeEventListener('pointerdown', fire);
  }, []);

  return (
    <div className={`coffee-splash ${leaving ? 'leaving' : ''}`} role="status" aria-label={label || 'Loading'}>
      <svg viewBox="0 0 200 200" width="220" height="220">
        <defs>
          <linearGradient id="cs-coffee" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8a5a33" />
            <stop offset="100%" stopColor="#4c2f18" />
          </linearGradient>
          <radialGradient id="cs-swirl" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fdf6ec" stopOpacity=".95" />
            <stop offset="55%" stopColor="#e9d9c3" stopOpacity=".55" />
            <stop offset="100%" stopColor="#e9d9c3" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* saucer */}
        <ellipse cx="100" cy="168" rx="58" ry="10" fill="#101c2c" opacity=".12" />

        {/* handle */}
        <path d="M138 96 q26 -2 24 20 q-2 22 -28 18" fill="none"
              stroke="#1f857a" strokeWidth="11" strokeLinecap="round" />

        {/* cup body */}
        <path d="M62 84 h76 l-7 62 q-1 12 -13 12 h-36 q-12 0 -13 -12 z" fill="#ffffff"
              stroke="#d8d2c4" strokeWidth="3" />
        {/* coffee surface */}
        <ellipse cx="100" cy="88" rx="38" ry="9.5" fill="url(#cs-coffee)" />

        {/* realistic milk pour: tapered ribbon that thins as it falls */}
        <g className="cs-stream">
          <path d="M96 -70 C94 20 91 58 92 82 L108 82 C109 58 107 20 105 -70 Z"
                fill="#fffdf8" opacity=".94" />
          <path d="M99.5 -70 C98.4 18 96.4 52 97 80"
                stroke="#e8ddcf" strokeWidth="1.1" fill="none" opacity=".5" />
          {/* impact droplet */}
          <circle className="cs-drop" cx="101" cy="87" r="4.6" fill="#fffdf8" />
          {/* expanding surface ripple */}
          <ellipse className="cs-ripple" cx="101" cy="88" rx="4" ry="1.6"
                   fill="none" stroke="#fdf6ec" strokeWidth="1.4" />
        </g>

        {/* latte-art marbling: thin crema arcs folding into each other */}
        <g>
          <path className="cs-latte cs-latte-a" d="M84 88 Q100 78 116 88 Q100 96 84 88 Z"
                fill="#f3e7d3" opacity=".85" />
          <path className="cs-latte cs-latte-b" d="M90 87 Q102 81 112 88 Q101 94 90 87 Z"
                fill="#fff8ea" opacity=".9" />
          <path className="cs-latte cs-latte-c" d="M94 88.5 Q101 85 108 88.5 Q101 92 94 88.5 Z"
                fill="#ffffff" opacity=".95" />
        </g>

        {/* steam */}
        <g fill="none" stroke="#b9b1a1" strokeWidth="4" strokeLinecap="round" opacity=".55">
          <path className="cs-steam cs-steam-1" d="M86 56 q6 -12 0 -22 q-5 -9 2 -17" />
          <path className="cs-steam cs-steam-2" d="M108 54 q7 -13 1 -24 q-5 -9 3 -16" />
        </g>
      </svg>

      {label && <p className="cs-label">{label}</p>}
    </div>
  );
}
