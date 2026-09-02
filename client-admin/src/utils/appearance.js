import { getSettings } from '../api/adminApi';

/**
 * Runtime appearance engine for the admin panel.
 * Reads Settings -> Appearance (theme, primary color, font family, rounded corners)
 * and injects CSS overrides so the values actually take effect.
 */

let styleElement = null;
let applied = false;

function injectStyle(css) {
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.setAttribute('data-appearance', 'admin');
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = css;
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  if (isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(hex, target, weight) {
  const c = hexToRgb(hex);
  if (!c) return null;
  const t = hexToRgb(target);
  const r = Math.round(c.r + (t.r - c.r) * weight);
  const g = Math.round(c.g + (t.g - c.g) * weight);
  const b = Math.round(c.b + (t.b - c.b) * weight);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Generate a Tailwind-like 50-900 ramp from a base color */
function generateShades(hex) {
  const shades = {};
  shades[50] = mix(hex, '#ffffff', 0.88);
  shades[100] = mix(hex, '#ffffff', 0.76);
  shades[200] = mix(hex, '#ffffff', 0.56);
  shades[300] = mix(hex, '#ffffff', 0.36);
  shades[400] = mix(hex, '#ffffff', 0.18);
  shades[500] = hex;
  shades[600] = mix(hex, '#000000', 0.12);
  shades[700] = mix(hex, '#000000', 0.24);
  shades[800] = mix(hex, '#000000', 0.38);
  shades[900] = mix(hex, '#000000', 0.52);
  return shades;
}

function applyPrimary(hex) {
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return;
  const s = generateShades(hex);
  injectStyle(`
    .bg-primary-50{background-color:${s[50]}!important}
    .bg-primary-100{background-color:${s[100]}!important}
    .bg-primary-500{background-color:${s[500]}!important}
    .bg-primary-600{background-color:${s[600]}!important}
    .bg-primary-700{background-color:${s[700]}!important}
    .text-primary-500{color:${s[500]}!important}
    .text-primary-600{color:${s[600]}!important}
    .text-primary-700{color:${s[700]}!important}
    .border-primary-200{border-color:${s[200]}!important}
    .border-primary-300{border-color:${s[300]}!important}
    .border-primary-500{border-color:${s[500]}!important}
    .ring-primary-500{--tw-ring-color:${s[500]}!important}
    .focus\\:ring-primary-500:focus{--tw-ring-color:${s[500]}!important}
    .hover\\:bg-primary-50:hover{background-color:${s[50]}!important}
    .hover\\:bg-primary-600:hover{background-color:${s[600]}!important}
    .hover\\:bg-primary-700:hover{background-color:${s[700]}!important}
    .hover\\:text-primary-600:hover{color:${s[600]}!important}
    .hover\\:text-primary-700:hover{color:${s[700]}!important}
    .peer:checked ~ .peer-checked\\:bg-primary-600{background-color:${s[600]}!important}
    .peer:checked ~ .peer-checked\\:translate-x-4{transform:translateX(1rem)!important}
    .bg-gradient-to-r.from-primary-600.to-primary-700{background-image:linear-gradient(to right,${s[600]},${s[700]})!important}
  `);
}

function applyFont(family) {
  if (!family || typeof family !== 'string') return;
  const clean = family.trim();
  if (!clean) return;
  document.documentElement.style.fontFamily = `'${clean}', system-ui, -apple-system, sans-serif`;
}

function applyRounded(enabled) {
  injectStyle(`
    ${enabled ? '' : '*{border-radius:0!important}'}
  `);
}

function applyTheme(theme) {
  const apply = (dark) => {
    document.documentElement.classList.toggle('admin-dark', dark);
  };
  if (theme === 'dark') { apply(true); return; }
  if (theme === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = e => apply(e.matches);
    apply(mq.matches);
    mq.addEventListener('change', handler);
    window.__adminThemeCleanup && window.__adminThemeCleanup();
    window.__adminThemeCleanup = () => mq.removeEventListener('change', handler);
    return;
  }
  apply(false);
}

export function applyAppearanceSettings() {
  if (applied) return Promise.resolve();
  applied = true; // run once per session
  return getSettings()
    .then(res => {
      const s = res.data || [];
      const get = (k, d) => {
        const r = s.find(x => x.key === k);
        if (!r) return d;
        const v = r.parsed_value !== undefined && r.parsed_value !== null ? r.parsed_value : r.value;
        return v === undefined || v === null || v === '' ? d : v;
      };
      // Locked decision: Admin primary = Clinical Teal. Default injected value
      // is teal (was #2563eb blue). If the setting is explicitly set elsewhere
      // it still wins, but unset/future defaults are now teal.
      applyPrimary(String(get('appearance_primary_color', '#1f857a')));
      applyFont(String(get('appearance_font_family', 'Inter')));
      applyRounded(get('appearance_rounded_corners', true));
      applyTheme(String(get('appearance_theme', 'light')));
    })
    .catch(() => {});
}

// Dark-mode overrides for the admin panel surfaces
const darkStyle = document.createElement('style');
darkStyle.setAttribute('data-appearance', 'admin-dark');
darkStyle.textContent = `
  .admin-dark{background:#0f172a;color:#e2e8f0}
  .admin-dark .bg-gray-50{background:#0f172a!important}
  .admin-dark .bg-white{background:#1e293b!important}
  .admin-dark .bg-gray-100{background:#1e293b!important}
  .admin-dark .text-gray-900{color:#f1f5f9!important}
  .admin-dark .text-gray-800{color:#e2e8f0!important}
  .admin-dark .text-gray-700{color:#cbd5e1!important}
  .admin-dark .text-gray-600{color:#94a3b8!important}
  .admin-dark .text-gray-500{color:#64748b!important}
  .admin-dark .text-gray-400{color:#475569!important}
  .admin-dark .border-gray-200{border-color:#334155!important}
  .admin-dark .border-gray-300{border-color:#475569!important}
  .admin-dark .divide-gray-100>*{border-color:#334155!important}
  .admin-dark .divide-gray-200>*{border-color:#334155!important}
  .admin-dark .hover\\:bg-gray-50:hover{background:#1e293b!important}
  .admin-dark .hover\\:bg-gray-100:hover{background:#1e293b!important}
  .admin-dark .shadow-sm{box-shadow:none!important}
`;
document.head.appendChild(darkStyle);
