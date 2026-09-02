/**
 * Premium full-screen transition for language & theme switches.
 * A colored circle wipes outward from the clicked control, the change is
 * applied underneath, and an elegantly-typeset label fades through.
 * Arabic labels automatically get calligraphy-safe typography (no letterspacing).
 * Respects prefers-reduced-motion (applies instantly).
 */

const ARABIC_RE = /[؀-ۿ]/;

export function animateSwitch({ content = '', apply, origin, color = '#0f172a', textColor = '#ffffff' }) {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { apply(); return; }

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  // Radius large enough to cover every corner from the click point
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const overlay = document.createElement('div');
  overlay.className = 'fx-wipe';
  overlay.style.background = color;

  const label = document.createElement('div');
  label.className = ARABIC_RE.test(content) ? 'fx-label fx-label-ar' : 'fx-label';
  label.textContent = content;
  label.style.color = textColor;
  overlay.appendChild(label);
  document.body.appendChild(overlay);

  // Paint initial state, then expand the circle from the click point
  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.style.clipPath = `circle(${r}px at ${x}px ${y}px)`;
  }));

  setTimeout(apply, 320);                                   // flip underneath, mid-wipe
  setTimeout(() => { overlay.classList.add('leaving'); }, 820);
  setTimeout(() => overlay.remove(), 1300);
}


/** Heat micro-interaction: any clicked nav/control glows gold then decays. */
export function installHeat() {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', (e) => {
    const el = e.target.closest('a, button, [role="button"], .card');
    if (!el) return;
    el.classList.remove('nav-heat');
    void el.offsetWidth; // restart animation
    el.classList.add('nav-heat');
    setTimeout(() => el.classList.remove('nav-heat'), 1300);
  }, true);
}
