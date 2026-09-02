import axios from 'axios';

// Shared helper for PUBLIC settings (no auth required).
// Results are cached in memory so multiple components (Navbar, Footer)
// don't re-fetch on every mount.

let publicSettingsCache = null;
let fetchPromise = null;

export async function getPublicSettings() {
  if (publicSettingsCache) return publicSettingsCache;
  if (!fetchPromise) {
    fetchPromise = axios
      .get('/api/settings/public')
      .then(res => {
        publicSettingsCache = res.data || [];
        return publicSettingsCache;
      })
      .catch(err => {
        fetchPromise = null;
        throw err;
      });
  }
  return fetchPromise;
}

/** Get a public setting value by key with a default fallback */
export async function getPublicSetting(key, defaultValue = null) {
  try {
    const settings = await getPublicSettings();
    const found = settings.find(s => s.key === key);
    return found ? found.value : defaultValue;
  } catch {
    return defaultValue;
  }
}
