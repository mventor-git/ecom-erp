import { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * Site Identity hook — the single source of brand truth.
 * Reads public settings (store_name / site_logo_url / site_tagline)
 * set from Admin → Settings → Site Identity. No hardcoded brands anywhere.
 */
export default function useSiteIdentity(fallback = 'Mventor-Store.Com') {
  const [identity, setIdentity] = useState({
    name: localStorage.getItem('site_name') || fallback,
    logoUrl: localStorage.getItem('site_logo_url') || '',
    tagline: localStorage.getItem('site_tagline') || '',
  });

  useEffect(() => {
    let cancelled = false;
    axios.get('/api/settings/public')
      .then(res => {
        if (cancelled) return;
        const rows = res.data || [];
        const pick = key => rows.find(r => r.key === key)?.value ?? '';
        const next = {
          name: pick('store_name') || fallback,
          logoUrl: pick('site_logo_url') || '',
          tagline: pick('site_tagline') || '',
        };
        setIdentity(next);
        // The browser tab follows the brand too — name as title, logo as icon
        document.title = `${next.name} · Admin`;
        {
          const link = document.querySelector("link[rel~='icon']");
          if (next.logoUrl) {
            let l = link;
            if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
            l.href = next.logoUrl + (next.logoUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();
          } else if (link && link.getAttribute('href') !== '/vite.svg') {
            // no logo configured — revert to the neutral default icon
            link.href = '/vite.svg';
          }
        }
        localStorage.setItem('site_name', next.name);
        localStorage.setItem('site_logo_url', next.logoUrl);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fallback]);

  return identity;
}
