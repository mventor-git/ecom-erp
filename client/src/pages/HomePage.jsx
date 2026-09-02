import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductGrid from '../components/ProductGrid';
import HeroSlider from '../components/HeroSlider';
import CartDrawer from '../components/CartDrawer';
import ConfigLink from '../components/ConfigLink';
import { getProducts, getFeatured, getTopSelling, getCategoryShowcase } from '../api/products';
import { getPublicSetting } from '../api/settings';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../i18n';
import Icon from '../components/Icon';

// Fallbacks used when the admin has not configured these sections yet
// (no currency hardcoded â€” the active currency is applied at render time)
const DEFAULT_TRUST_BADGES = [
  { icon: 'truck', title: 'Free Shipping', description: 'On orders over 500', link: '' },
  { icon: 'shield', title: 'Secure Payment', description: '100% protected payments', link: '' },
  { icon: 'return', title: 'Easy Returns', description: '30-day return policy', link: '' },
  { icon: 'chat', title: '24/7 Support', description: 'Dedicated customer service', link: '' },
];

const DEFAULT_FEATURES = [
  { icon: 'star', title: 'Quality Guaranteed', description: 'Every product is checked before it ships — quality you can trust.', link: '' },
  { icon: 'bolt', title: 'Fast Delivery', description: 'Quick and reliable delivery. Get what you need when you need it.', link: '' },
  { icon: 'stetho', title: 'Expert Support', description: 'Questions about a product? Our team of specialists is here to help you choose.', link: '' },
];

export default function HomePage() {
  const { t, lang } = useLanguage();
  const { format } = useCurrency();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [topSelling, setTopSelling] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showcaseEnabled, setShowcaseEnabled] = useState(true);
  const [trustBadges, setTrustBadges] = useState(DEFAULT_TRUST_BADGES);
  const [sectionHeaders, setSectionHeaders] = useState(null); // admin-editable bilingual headings
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [announcements, setAnnouncements] = useState([]);
  const [currentAnnouncement, setCurrentAnnouncement] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getFeatured(10).catch(() => ({ data: [] })),
      getTopSelling(4).catch(() => ({ data: [] })),
      getCategoryShowcase().catch(() => ({ data: { enabled: true, items: [] } })),
      fetch('/api/announcements/active').then(res => res.json()).catch(() => []),
      getPublicSetting('home_trust_badges', DEFAULT_TRUST_BADGES),
      getPublicSetting('home_features', DEFAULT_FEATURES),
      getPublicSetting('home_section_headers', null),
    ])
      .then(([featRes, topRes, showcaseRes, announcementsData, trustData, featureData, headersData]) => {
        const featured = featRes.data || [];
        setFeaturedProducts(featured.length > 0 ? featured : []);
        setTopSelling(topRes.data || []);
        const showcase = showcaseRes.data || { enabled: true, items: [] };
        setShowcaseEnabled(showcase.enabled !== false);
        setCategories(showcase.items || []);
        setAnnouncements(Array.isArray(announcementsData) ? announcementsData : []);
        if (Array.isArray(trustData) && trustData.length > 0) setTrustBadges(trustData);
        if (Array.isArray(featureData) && featureData.length > 0) setFeatures(featureData);
        if (headersData && typeof headersData === 'object') setSectionHeaders(headersData);
        // If no featured products, fall back to regular products
        if (featured.length === 0) {
          getProducts().then(prodRes => {
            setFeaturedProducts(prodRes.data.slice(0, 8));
          }).catch(() => {});
        }
      })
      .catch(err => console.error('Error loading products:', err))
      .finally(() => setLoading(false));
  }, []);

  // Auto-rotate announcements
  useEffect(() => {
    if (announcements.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentAnnouncement((prev) => (prev + 1) % announcements.length);
    }, 5000); // Rotate every 5 seconds

    return () => clearInterval(interval);
  }, [announcements.length]);

  // Admin-editable section headings (Site Config → Homepage), falling back
  // to the i18n dictionary when a field is blank.
  const sectionHeading = (key, fallbackTitleKey, fallbackSubKey) => {
    const h = (sectionHeaders && sectionHeaders[key]) || {};
    return {
      title: (lang === 'ar' ? h.title_ar : h.title_en) || t(fallbackTitleKey),
      sub: (lang === 'ar' ? h.sub_ar : h.sub_en) || t(fallbackSubKey),
    };
  };
  const categoriesHead = sectionHeading('categories', 'Shop by Category', 'Find exactly what you need');
  const featuredHead = sectionHeading('featured', 'Featured Products', 'Handpicked just for you');
  const whyUsHead = sectionHeading('why_us', 'Why Shop With Us', 'Trusted by healthcare professionals');

  const categoryIcons = {
    'Exercise & Fitness': 'dumbbell',
    'Orthopedic Support': 'cross',
    'Insoles & Foot Care': 'shield',
    'Massage & Therapy': 'heart',
    'Mobility & Rehabilitation': 'bike',
    'Accessories': 'box',
  };

  // Show the default "On orders over 500" style text in the active currency
  const localizeDescription = (desc) => {
    if (!desc) return '';
    return desc.replace(/^(On orders over )(\d+)(?: Ø¬\.Ù…)?$/, (m, p, n) => `${p}${format(Number(n) * 100, 0)}`);
  };

  return (
    <>
      {/* â”€â”€ Announcement Bar â”€â”€ */}
      {announcements.length > 0 && (
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 text-white text-center py-2 text-sm relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4">
            {announcements.map((announcement, index) => (
              <div
                key={announcement.id}
                className={`transition-opacity duration-500 ${
                  index === currentAnnouncement ? 'opacity-100' : 'opacity-0 absolute inset-0'
                }`}
              >
                <span className="mr-2">{announcement.icon || ''}</span>
                <span className="font-medium">{announcement.text}</span>
              </div>
            ))}
          </div>
          {announcements.length > 1 && (
            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-1">
              {announcements.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentAnnouncement(index)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    index === currentAnnouncement ? 'bg-white' : 'bg-white/40'
                  }`}
                  aria-label={t('announcement.go_to', { index: index + 1 })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ Hero Slider â”€â”€ */}
      <HeroSlider />

      {/* â”€â”€ Category Showcase (admin-configured) â”€â”€ */}
      {showcaseEnabled && categories.length > 0 && (
        <section className="bg-gray-50 dark:bg-dark-900/50 section-padding">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center section-heading-gap animate-enter">
              <h2 className="font-h2 text-gray-900 dark:text-white">{categoriesHead.title}</h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">{categoriesHead.sub}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map(cat => (
                <Link
                  key={cat.id}
                  to={`/products?category=${cat.slug}`}
                  className="group glass-card p-6 text-center hover:shadow-glass-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                    {cat.icon || categoryIcons[cat.name] || 'box'}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {cat.name}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* â”€â”€ Featured Products â”€â”€ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 section-padding">
        <div className="flex items-center justify-between section-heading-gap">
          <div className="brand-rule pt-4 animate-enter">
            <h2 className="font-h2 text-gray-900 dark:text-white">{featuredHead.title}</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">{featuredHead.sub}</p>
          </div>
          <Link to="/products" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium hidden sm:flex items-center gap-1 group">
            {t('View All')}
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        <ProductGrid products={featuredProducts} loading={loading} />
        <div className="mt-8 text-center sm:hidden">
          <Link to="/products" className="btn-primary inline-block">{t('View All Products')}</Link>
        </div>
      </section>

      {/* â”€â”€ Trust Badges (admin-configured, click/hold redirects) â”€â”€ */}
      {trustBadges.length > 0 && (
        <section className="bg-white dark:bg-dark-800/30 py-16 border-y border-gray-100 dark:border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {trustBadges.map((badge, idx) => (
                <ConfigLink
                  key={idx}
                  href={badge.link}
                  className="text-center group"
                >
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary-50 dark:bg-primary-500/10 rounded-full flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                    {/^\w+$/.test(badge.icon || '') ? <Icon name={badge.icon} className="w-6 h-6 text-primary-600" /> : (badge.icon || null)}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{(lang === 'ar' && badge.title_ar) ? badge.title_ar : t(badge.title || '')}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{localizeDescription(badge.description)}</p>
                </ConfigLink>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* â”€â”€ Why Choose Us (admin-configured, click/hold redirects) â”€â”€ */}
      {features.length > 0 && (
        <section className="bg-gray-50 dark:bg-dark-900/50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{whyUsHead.title}</h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">{whyUsHead.sub}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {features.map((feature, idx) => (
                <ConfigLink
                  key={idx}
                  href={feature.link}
                  className="glass-card p-8 text-center hover:shadow-glass-lg transition-all"
                >
                  <div className="text-5xl mb-4 flex justify-center">
                    {/^\w+$/.test(feature.icon || '')
                      ? <Icon name={feature.icon} className="w-12 h-12 text-primary-600" />
                      : (feature.icon || null)}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{(lang === 'ar' && feature.title_ar) ? feature.title_ar : t(feature.title || '')}</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{(lang === 'ar' && feature.description_ar) ? feature.description_ar : (feature.description || '')}</p>
                </ConfigLink>
              ))}
            </div>
          </div>
        </section>
      )}

      <CartDrawer />
    </>
  );
}
