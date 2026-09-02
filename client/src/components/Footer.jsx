import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useSiteIdentity from '../hooks/useSiteIdentity';
import { getPublicSetting } from '../api/settings';
import { useLanguage } from '../i18n';

export default function Footer() {
  const { t } = useLanguage();
  const identity = useSiteIdentity();
  const [logoLink, setLogoLink] = useState('/');
  const [logoIsExternal, setLogoIsExternal] = useState(false);

  // Logo click destination is admin-configurable (settings key `logo_link`)
  useEffect(() => {
    getPublicSetting('logo_link', '/').then(value => {
      if (typeof value === 'string' && (value.startsWith('/') || value.startsWith('http'))) {
        setLogoLink(value);
        setLogoIsExternal(value.startsWith('http'));
      }
    });
  }, []);

  const logoContent = (
    <>
      <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden">
        {identity.logoUrl ? (
          <img src={identity.logoUrl} alt={`${identity.name} logo`} className="h-8 w-auto object-contain" />
        ) : (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#c65f3e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
        )}
      </div>
      <span className="font-bold text-xl text-white">{identity.name}</span>
    </>
  );

  return (
    <footer className="bg-dark-900 dark:bg-dark-950 text-gray-300 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            {logoIsExternal ? (
              <a href={logoLink} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-3 mb-4">
                {logoContent}
              </a>
            ) : (
              <Link to={logoLink} className="flex items-center space-x-3 mb-4">
                {logoContent}
              </Link>
            )}
            <p className="text-sm text-gray-400">
              {t('Your trusted online store for quality products.', 'متجرك الموثوق لمنتجات عالية الجودة.')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('Quick Links')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-white transition-colors">{t('Welcome')}</Link></li>
              <li><Link to="/home" className="hover:text-white transition-colors">{t('Home')}</Link></li>
              <li><Link to="/products" className="hover:text-white transition-colors">{t('Products')}</Link></li>
              <li><Link to="/cart" className="hover:text-white transition-colors">{t('Cart')}</Link></li>
              <li><Link to="/account" className="hover:text-white transition-colors">{t('Account')}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('Contact')}</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {identity.contactEmail || t('Contact via settings', 'تواصل عبر الإعدادات')}
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {identity.phone || t('Phone via settings', 'الهاتف عبر الإعدادات')}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-8 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} {identity.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
