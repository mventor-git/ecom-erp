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
    contactEmail: localStorage.getItem('site_contact_email') || '',
    phone: localStorage.getItem('site_phone') || '',
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
          contactEmail: pick('site_contact_email') || pick('contact_email') || '',
          phone: pick('site_phone') || pick('phone') || '',
        };
        setIdentity(next);
        localStorage.setItem('site_name', next.name);
        localStorage.setItem('site_logo_url', next.logoUrl);
        localStorage.setItem('site_contact_email', next.contactEmail);
        localStorage.setItem('site_phone', next.phone);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fallback]);

  return identity;
}
