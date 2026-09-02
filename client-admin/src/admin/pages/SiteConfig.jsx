import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getSettings, updateSettingsBatch,
  uploadImage,
} from '../../api/adminApi';
import AdminIcon from '../components/AdminIcon';
import Toggle from '../components/Toggle';
import StoreIconPicker from '../components/StoreIconPicker';
import { playTone } from '../../utils/sounds';
import { useLanguage } from '../../i18n';
import AISettings from '../../pages/AISettings';
import AnnouncementsList from '../../pages/AnnouncementsList';
import HeroSlidesList from '../../pages/HeroSlidesList';
import WelcomeSlidesList from './WelcomeSlidesList';
import FeaturedList from './FeaturedList';

/**
 * Site Config — one page, six sub-tabs:
 *   Homepage · Featured · AI Assistant · Announcements · Hero Slider ·
 *   Welcome Slides
 *
 * The Homepage tab edits the public `frontend`/`general` settings the
 * customer site reads (identity, trust badges, features, toggles) plus the
 * storefront pricing defaults (default price list + default markup %).
 */

const TABS = [
  { id: 'homepage', label: 'Homepage', icon: 'home' },
  { id: 'featured', label: 'Featured', icon: 'star' },
  { id: 'ai', label: 'AI Assistant', icon: 'sparkle' },
  { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
  { id: 'hero', label: 'Hero Slider', icon: 'image' },
  { id: 'welcome', label: 'Welcome Slides', icon: 'film' },
];

const EMPTY_BADGE = { icon: '', title: '', title_ar: '', description: '', description_ar: '', link: '' };

const toList = (v) => (Array.isArray(v) ? v : []);

export default function SiteConfig() {
  const { tab: tabParam } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const activeTab = TABS.some(x => x.id === tabParam) ? tabParam : 'homepage';

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AdminIcon name="home" className="w-6 h-6 text-primary-600" />
            {t('Site Config')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Everything the customer site shows — homepage, AI, announcements and sliders')}
          </p>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div className="flex flex-wrap gap-1.5 mb-6 p-1 bg-gray-100 rounded-xl w-fit max-w-full overflow-x-auto">
        {TABS.map(tb => (
          <button
            key={tb.id}
            onClick={() => navigate(`/site-config/${tb.id}`)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tb.id
                ? 'bg-white text-primary-700 shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <AdminIcon name={tb.icon} className="w-4 h-4" />
            {t(tb.label)}
          </button>
        ))}
      </div>

      {activeTab === 'homepage' && <HomepageConfig />}
      {activeTab === 'featured' && <FeaturedList />}
      {activeTab === 'ai' && <AISettings />}
      {activeTab === 'announcements' && <AnnouncementsList />}
      {activeTab === 'hero' && <HeroSlidesList />}
      {activeTab === 'welcome' && <WelcomeSlidesList />}
    </div>
  );
}

/* ═══════════════════════ Homepage sub-tab ═══════════════════════ */

function HomepageConfig() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null);

  // settings key -> editable value
  const [identity, setIdentity] = useState({ store_name: '', site_logo_url: '', site_tagline: '', logo_link: '/' });
  const [badges, setBadges] = useState([]);
  const [features, setFeatures] = useState([]);
  const [toggles, setToggles] = useState({ reviews_enabled: true, home_categories_enabled: true });
  // Homepage section headings, fully bilingual (EN + AR title & subtitle)
  const emptyHead = { title_en: '', title_ar: '', sub_en: '', sub_ar: '' };
  const [headings, setHeadings] = useState({
    categories: { ...emptyHead },
    featured: { ...emptyHead },
    why_us: { ...emptyHead },
  });

  const load = useCallback(async () => {
    try {
      const res = await getSettings();
      const map = {};
      (res.data || []).forEach(s => { map[s.key] = s.parsed_value; });
      setIdentity({
        store_name: map.store_name ?? '',
        site_logo_url: map.site_logo_url ?? '',
        site_tagline: map.site_tagline ?? '',
        logo_link: map.logo_link ?? '/',
      });
      setBadges(toList(map.home_trust_badges));
      setFeatures(toList(map.home_features));
      setToggles({
        reviews_enabled: map.reviews_enabled !== false && map.reviews_enabled !== 0,
        home_categories_enabled: map.home_categories_enabled !== false && map.home_categories_enabled !== 0,
      });
      const h = map.home_section_headers;
      if (h && typeof h === 'object') {
        setHeadings(prev => {
          const next = {};
          for (const key of Object.keys(prev)) {
            next[key] = { ...emptyHead, ...(h[key] || {}) };
          }
          return next;
        });
      }
    } catch { /* keep UI */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flashMsg = (ok, text) => {
    playTone(ok ? 'success' : 'error');
    setFlash({ ok, text });
    setTimeout(() => setFlash(null), 2600);
  };

  const save = async () => {
    setSaving(true);
    try {
      // batch endpoint expects [{key, value}, …]; values serialize per the
      // stored setting type (json / boolean / number / string)
      await updateSettingsBatch([
        { key: 'store_name', value: identity.store_name },
        { key: 'site_logo_url', value: identity.site_logo_url },
        { key: 'site_tagline', value: identity.site_tagline },
        { key: 'logo_link', value: identity.logo_link },
        { key: 'home_trust_badges', value: badges },
        { key: 'home_features', value: features },
        { key: 'reviews_enabled', value: toggles.reviews_enabled },
        { key: 'home_categories_enabled', value: toggles.home_categories_enabled },
        { key: 'home_section_headers', value: headings },
      ]);
      flashMsg(true, t('Saved — live on the customer site'));
    } catch (err) {
      flashMsg(false, err.response?.data?.error || t('Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />;

  return (
    <div className="space-y-6">
      {/* ── Identity ── */}
      <Card title={t('Brand & Identity')} icon="badge">
        <Field label={t('Site name')}>
          <input className={inputCls} value={identity.store_name}
            onChange={e => setIdentity(s => ({ ...s, store_name: e.target.value }))} />
        </Field>
        <Field label={t('Tagline')}>
          <input className={inputCls} value={identity.site_tagline}
            onChange={e => setIdentity(s => ({ ...s, site_tagline: e.target.value }))} />
        </Field>
        <Field label={t('Logo — browse a file from your PC, or paste a URL')}>
          <LogoInput value={identity.site_logo_url} onUploaded={url => setIdentity(s => ({ ...s, site_logo_url: url }))}
            onChange={url => setIdentity(s => ({ ...s, site_logo_url: url }))} flashMsg={flashMsg} />
        </Field>
        <Field label={t('Logo click destination')}>
          <input className={inputCls} placeholder="/" value={identity.logo_link}
            onChange={e => setIdentity(s => ({ ...s, logo_link: e.target.value }))} />
        </Field>
      </Card>

      {/* ── Section headings (bilingual) ── */}
      <Card title={t('Homepage section headings')} icon='edit'
            hint={t('The big titles under the hero — control exactly what customers read in English and Arabic. Blank fields fall back to defaults.')}>
        <div className="space-y-5">
          {[
            { key: 'categories', label: t('Shop by Category section') },
            { key: 'featured', label: t('Featured Products section') },
            { key: 'why_us', label: t('Why Shop With Us section') },
          ].map(sec => {
            const h = headings[sec.key] || emptyHead;
            const patch = (k, v) => setHeadings(prev => ({ ...prev, [sec.key]: { ...prev[sec.key], [k]: v } }));
            return (
              <div key={sec.key} className="rounded-lg border border-gray-200 p-3 bg-gray-50/60">
                <p className="text-xs font-semibold text-gray-700 mb-2">{sec.label}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label={t('Title (English)')}>
                    <input className={inputCls} value={h.title_en}
                      onChange={e => patch('title_en', e.target.value)} />
                  </Field>
                  <Field label={t('Title (Arabic)')}>
                    <input dir="rtl" className={`${inputCls} font-[Cairo]`} value={h.title_ar}
                      onChange={e => patch('title_ar', e.target.value)} />
                  </Field>
                  <Field label={t('Subtitle (English)')}>
                    <input className={inputCls} value={h.sub_en}
                      onChange={e => patch('sub_en', e.target.value)} />
                  </Field>
                  <Field label={t('Subtitle (Arabic)')}>
                    <input dir="rtl" className={`${inputCls} font-[Cairo]`} value={h.sub_ar}
                      onChange={e => patch('sub_ar', e.target.value)} />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Trust badges ── */}
      <ListEditor
        title={t('Trust Badges')}
        subtitle={t('Shown under the hero — free shipping, secure payment…')}
        items={badges} setItems={setBadges} empty={EMPTY_BADGE}
      />

      {/* ── Features ("Why choose us") ── */}
      <ListEditor
        title={t('Features — Why Choose Us')}
        subtitle={t('The three-column highlights section')}
        items={features} setItems={setFeatures} empty={EMPTY_BADGE}
      />

      {/* ── Toggles ── */}
      <Card title={t('Sections')} icon="grid">
        <ToggleRow label={t('Show product reviews & ratings')}
          checked={toggles.reviews_enabled}
          onChange={v => setToggles(s => ({ ...s, reviews_enabled: v }))} />
        <ToggleRow label={t('Show "Shop by Category" on homepage')}
          checked={toggles.home_categories_enabled}
          onChange={v => setToggles(s => ({ ...s, home_categories_enabled: v }))} />
      </Card>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-10 flex justify-end">
        <button onClick={save} disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold shadow-lg hover:bg-primary-500 disabled:opacity-50 transition-colors">
          {saving ? t('Saving…') : t('Save changes')}
        </button>
      </div>

      {flash && (
        <div className={`fixed bottom-6 end-6 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg ${
          flash.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {flash.text}
        </div>
      )}
    </div>
  );
}

/* ── shared bits ─────────────────────────────────────────────────── */

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none transition-colors';

/** Logo input: URL box + "Browse from PC" upload → stored under /images, URL saved in settings. */
function LogoInput({ value, onChange, onUploaded, flashMsg }) {
  const { t } = useLanguage();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const res = await uploadImage(file);
      const url = res.data?.url || '';
      onChange(url);
      onUploaded?.(url);
      flashMsg(true, t('Logo uploaded — click Save to apply'));
    } catch (err) {
      flashMsg(false, err.response?.data?.error || t('Upload failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {value && (
        <img src={value} alt="logo preview" referrerPolicy="no-referrer"
          className="w-9 h-9 rounded-lg border border-gray-200 bg-white object-contain shrink-0" />
      )}
      <input className={inputCls} placeholder="/images/logo.png or https://…" value={value}
        onChange={e => onChange(e.target.value)} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
        className="shrink-0 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:border-primary-400 hover:text-primary-700 disabled:opacity-50 transition-colors">
        <span className="inline-flex items-center gap-1.5">
          <AdminIcon name="image" className="w-4 h-4" />
          {busy ? t('Uploading…') : t('Browse')}
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  );
}

function Card({ title, icon, hint, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <AdminIcon name={icon} className="w-4 h-4 text-primary-600" />
        {title}
      </h2>
      {hint && <p className="text-xs text-gray-400 mb-4">{hint}</p>}
      <div className={hint ? '' : 'mt-4'}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-4 last:mb-0">
      <span className="block text-xs font-medium text-gray-500 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <Toggle checked={checked} onChange={onChange} size="sm" label={label} />
    </div>
  );
}

function ListEditor({ title, subtitle, items, setItems, empty }) {
  const { t } = useLanguage();
  const patch = (i, key, val) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };

  return (
    <Card title={title} icon="megaphone">
      <p className="text-xs text-gray-400 -mt-3 mb-4">{subtitle}</p>
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-3 bg-gray-50/60">
            <div className="flex items-center gap-2 mb-2">
              <StoreIconPicker value={it.icon || ''} onChange={v => patch(i, 'icon', v)} />
              <input className={`${inputCls} font-medium`} placeholder={t('Title')}
                value={it.title || ''} onChange={e => patch(i, 'title', e.target.value)} />
              <div className="flex shrink-0">
                <button onClick={() => move(i, -1)} disabled={i === 0}
                  className="px-2 py-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1}
                  className="px-2 py-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">↓</button>
                <button onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                  className="px-2 py-1 text-red-400 hover:text-red-600 transition-colors">✕</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <input className={inputCls} placeholder={t('Description')}
                value={it.description || ''} onChange={e => patch(i, 'description', e.target.value)} />
              <input dir="rtl" className={`${inputCls} font-[Cairo]`} placeholder='الوصف بالعربي'
                value={it.description_ar || ''} onChange={e => patch(i, 'description_ar', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder='العنوان بالعربي'
                dir="rtl" value={it.title_ar || ''} onChange={e => patch(i, 'title_ar', e.target.value)} />
              <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={t('Link (optional)')}
                value={it.link || ''} onChange={e => patch(i, 'link', e.target.value)} />
            </div>
          </div>
        ))}
        {!items.length && (
          <p className="text-xs text-gray-400 py-2">{t('Nothing here yet — add the first one.')}</p>
        )}
        <button onClick={() => setItems([...items, { ...empty }])}
          className="text-xs font-semibold text-primary-700 hover:text-primary-600 px-1 transition-colors">
          + {t('Add item')}
        </button>
      </div>
    </Card>
  );
}
