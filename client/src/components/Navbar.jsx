import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { getPublicSetting } from '../api/settings';
import UserAvatar from './UserAvatar';
import SmartSearch from './SmartSearch';
import useSiteIdentity from '../hooks/useSiteIdentity';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { useLanguage } from '../i18n';

export default function Navbar() {
  const { cartCount, setIsOpen } = useCart();
  const { user, loading, logout } = useAuth();
  const { count: wishlistCount, setIsOpen: setWishlistOpen } = useWishlist();
  const { t } = useLanguage();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoLink, setLogoLink] = useState('/');
  const navRef = useRef(null);
  const userMenuRef = useRef(null);

  // Logo click destination is admin-configurable (settings key `logo_link`)
  useEffect(() => {
    getPublicSetting('logo_link', '/').then(value => {
      if (typeof value === 'string' && (value.startsWith('/') || value.startsWith('http'))) {
        setLogoLink(value);
      }
    });
  }, []);

  // Close menus on click/tap outside
  useEffect(() => {
    function handleClick(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick, { passive: true });
    };
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close menus on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { to: '/', label: t('Welcome') },
    { to: '/home', label: t('Home') },
    { to: '/products', label: t('Products') },
  ];

  // Logo content (shared between internal Link and external <a>)
  const identity = useSiteIdentity();
  const logoIsExternal = logoLink.startsWith('http');
  const logoContent = (
    <>
      <div className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 overflow-hidden group-hover:border-primary-500/30 transition-all shrink-0">
        {identity.logoUrl ? (
          <img src={identity.logoUrl} alt={`${identity.name} logo`} className="h-7 w-auto object-contain" style={{ imageRendering: 'auto' }} />
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#c65f3e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
        )}
      </div>
      <span className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">{identity.name}</span>
    </>
  );
  const logoClasses = 'flex items-center gap-2 sm:gap-3 group min-w-0';

  return (
    <nav ref={navRef} className="navbar-glass sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Top row */}
        <div className="flex justify-between h-16 sm:h-20 items-center gap-2 sm:gap-4">
          {/* Logo (destination is admin-configurable) */}
          {logoIsExternal ? (
            <a href={logoLink} className={logoClasses} target="_blank" rel="noopener noreferrer">
              {logoContent}
            </a>
          ) : (
            <Link to={logoLink} className={logoClasses}>
              {logoContent}
            </Link>
          )}

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-[15px] font-semibold tracking-tight transition-all whitespace-nowrap relative px-1 py-0.5 rounded-md hover:bg-primary-50 dark:hover:bg-white/5 ${
                  isActive(link.to)
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {link.label}
                {isActive(link.to) && (
                  <span className="absolute -bottom-1 start-0 end-0 h-0.5 bg-primary-500 rounded-full" />
                )}
              </Link>
            ))}
          </div>

          {/* Smart Search — desktop */}
          <div className="hidden md:block flex-1 max-w-md mx-4">
            <SmartSearch />
          </div>

          {/* Actions: User + Cart + Mobile Menu */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Theme + Language toggles (desktop only — they're in the mobile menu too) */}
            <div className="hidden md:block">
              <LanguageToggle />
            </div>
            <div className="hidden md:block">
              <ThemeToggle />
            </div>

            {/* User Menu */}
            {!loading && (
              <div className="relative" ref={userMenuRef}>
                {user ? (
                  <>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100/50 dark:hover:bg-white/5 transition-colors"
                      aria-label={t('Account menu')}
                    >
                      <UserAvatar user={user} size="sm" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden lg:block">
                        {user.name?.split(' ')[0] || t('Account')}
                      </span>
                    </button>

                    {userMenuOpen && (
                      <div className="absolute end-0 mt-2 w-48 rounded-xl shadow-glass-lg border border-gray-200/50 dark:border-white/10 py-1 z-50 animate-slide-down bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl">
                        <div className="px-4 py-2 border-b border-gray-100 dark:border-white/5">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user.email}</p>
                        </div>
                        <Link
                          to="/account"
                          onClick={() => setUserMenuOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                          {t('My Account')}
                        </Link>
                        <Link
                          to="/track-orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                          {t('Track Orders')}
                        </Link>
                        <button
                          onClick={() => { setUserMenuOpen(false); logout(); }}
                          className="block w-full text-start px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                          {t('Sign Out')}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    to="/login"
                    className="flex items-center gap-1.5 p-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-white/5 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="hidden sm:inline">{t('Sign In')}</span>
                  </Link>
                )}
              </div>
            )}

            {/* Wishlist */}
            <button
              onClick={() => setWishlistOpen(true)}
              className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-xl hover:bg-gray-100/50 dark:hover:bg-white/5"
              aria-label={t('Open wishlist')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -end-1 bg-pink-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-glow">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Cart */}
            <button
              onClick={() => setIsOpen(true)}
              className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-xl hover:bg-gray-100/50 dark:hover:bg-white/5"
              aria-label={t('Open cart')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -end-1 bg-primary-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-glow">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-100/50 dark:hover:bg-white/5 transition-colors"
              aria-label={t('Toggle menu')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile search row — always visible on phones */}
        <div className="md:hidden pb-2.5">
          <SmartSearch />
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-100 dark:border-white/5 pt-2 animate-slide-down">
            {/* Theme + Language toggles */}
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('Theme')}</span>
              <ThemeToggle />
            </div>
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('Language')}</span>
              <LanguageToggle />
            </div>

            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2.5 text-sm font-medium rounded-lg px-3 transition-colors ${
                  isActive(link.to)
                    ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-gray-100 dark:border-white/5 mt-2 pt-2">
              {user ? (
                <>
                  <Link
                    to="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-lg px-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {t('My Account')}
                  </Link>
                  <Link
                    to="/track-orders"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-lg px-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {t('Track Orders')}
                  </Link>
                  <button
                    onClick={() => { setMobileMenuOpen(false); logout(); }}
                    className="block w-full text-start py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-lg px-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {t('Sign Out')}
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-lg px-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  {t('Sign In')}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
