import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getTheme, toggleTheme } from '../../utils/theme';
import { animateSwitch } from '../../utils/fx';
import { isMuted, setMuted, playTone } from '../../utils/sounds';
import { TrendingUp } from 'lucide-react';
import useSiteIdentity from '../../hooks/useSiteIdentity';
import { useLanguage } from '../../i18n';
import AdminIcon from './AdminIcon';

/**
 * Modular, sectionized, collapsible sidebar.
 * - Custom stroke icons (AdminIcon) everywhere — no emoji.
 * - Pricing Engine sits as a top-level flagship entry.
 * - Rail mode persisted by AdminLayout; sections persisted per browser.
 */

const SECTIONS = [
  {
    id: 'sales', label: 'Sales', icon: 'clipboard',
    items: [
      { to: '/orders', label: 'Orders', icon: 'clipboard' },
      { to: '/erp/customers', label: 'Customers', icon: 'user' },
      { to: '/erp/issue-orders', label: 'Issue Receipts', icon: 'document' },
    ],
  },
  {
    id: 'products', label: 'Products', icon: 'box',
    items: [
      { to: '/products', label: 'Products', icon: 'box' },
      { to: '/categories', label: 'Categories', icon: 'folder' },
      { to: '/brands', label: 'Brands', icon: 'tag' },
    ],
  },
  {
    id: 'purchasing', label: 'Purchasing', icon: 'truck',
    items: [
      { to: '/erp/suppliers', label: 'Suppliers', icon: 'user' },
      { to: '/erp/purchase-orders', label: 'Purchase Orders', icon: 'clipboard' },
    ],
  },
  {
    id: 'inventory', label: 'Inventory', icon: 'box',
    items: [
      { to: '/inventory', label: 'Stock', icon: 'chart' },
      { to: '/inventory/movement', label: 'Movements', icon: 'arrows' },
      { to: '/inventory/warehouses', label: 'Warehouses & Shelves', icon: 'building' },
    ],
  },
  {
    id: 'pricing', label: 'Pricing', icon: 'gauge',
    items: [
      { to: '/pricing-engine', label: 'Retail Pricing', icon: 'gauge' },
      { to: '/erp/price-lists', label: 'Price Lists', icon: 'tag' },
      { to: '/pricing-engine/profits', label: 'Pricing Insights', icon: 'trending' },
    ],
  },
  {
    id: 'operations', label: 'Operations', icon: 'wrench',
    items: [
      { to: '/erp/picking', label: 'Picking', icon: 'box' },
      { to: '/erp/packing', label: 'Packing', icon: 'box' },
      { to: '/erp/shipping', label: 'Delivery', icon: 'truck' },
    ],
  },
  {
    id: 'finance', label: 'Finance', icon: 'banknote',
    items: [
      { to: '/dashboard-detail/revenue', label: 'Accounting', icon: 'chart' },
      { to: '/erp/reports', label: 'Reports', icon: 'bars' },
      { to: '/erp/financial-periods', label: 'Financial Periods', icon: 'calendar' },
      { to: '/erp/kashier', label: 'Payments & Reconciliation', icon: 'banknote' },
    ],
  },
  { id: 'website', label: 'Website', icon: 'globe', items: [{ to: '/site-config', label: 'Site Config', icon: 'globe' }] },
  { id: 'notifications', label: 'Notifications', icon: 'bell', items: [{ to: '/erp/notifications', label: 'Notifications', icon: 'bell' }] },
  {
    id: 'system', label: 'System', icon: 'shield',
    items: [
      { to: '/erp/users', label: 'Users & Roles', icon: 'shield' },
      { to: '/erp/events', label: 'Audit Log', icon: 'settings' },
      { to: '/erp/integrations', label: 'Integrations', icon: 'settings' },
      { to: '/erp/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const OPEN_KEY = 'cs-sidebar-open-sections';

function loadOpenSections() {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { catalog: true, warehouse: true };
}

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const [openSections, setOpenSections] = useState(loadOpenSections);
  const [theme, setThemeState] = useState(getTheme);
  const [soundOff, setSoundOff] = useState(isMuted);
  const identity = useSiteIdentity();
  const { t } = useLanguage();

  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(openSections)); } catch { /* ignore */ }
  }, [openSections]);

  // Keep the section containing the active page expanded
  useEffect(() => {
    const active = SECTIONS.find(s => s.items.some(i => isActive(i.to)));
    if (active && !openSections[active.id]) {
      setOpenSections(prev => ({ ...prev, [active.id]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const isSectionActive = (section) => section.items.some(i => isActive(i.to));

  const toggleSection = (id) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSectionClick = (section) => {
    if (collapsed) {
      onToggle?.();
      setOpenSections(prev => ({ ...prev, [section.id]: true }));
      return;
    }
    toggleSection(section.id);
  };

  const handleThemeToggle = (e) => {
    const goingDark = theme !== 'dark';
    animateSwitch({
      content: goingDark ? t('Dark Mode') : t('Light Mode'),
      origin: e ? { x: e.clientX, y: e.clientY } : undefined,
      color: goingDark ? '#101c2c' : '#f7f5ef',
      textColor: goingDark ? '#e9c46a' : '#1a2332',
      apply: () => setThemeState(toggleTheme()),
    });
  };

  const navLink = (item) => (
    <Link
      key={item.to}
      to={item.to}
      onClick={() => window.innerWidth < 1024 && onToggle?.()}
      className={`
        flex items-center gap-2.5 ps-9 pe-3 py-2 rounded-lg text-sm transition-colors
        ${isActive(item.to)
          ? 'bg-primary-50 text-primary-700 font-semibold'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
      `}
      title={collapsed ? t(item.label) : undefined}
    >
      <AdminIcon name={item.icon} className="w-[17px] h-[17px]" />
      {!collapsed && <span className="truncate">{t(item.label)}</span>}
    </Link>
  );

  return (
    <>
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        bg-white border-e border-gray-200
        flex flex-col
        transition-all duration-300 ease-in-out
        ${collapsed ? '-translate-x-full lg:translate-x-0 lg:w-[68px]' : 'translate-x-0 w-64'}
      `}>
        {/* Brand */}
        <div className="h-16 flex items-center px-4 border-b border-gray-200 shrink-0">
          <Link to="/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gray-100 border border-gray-200 overflow-hidden">
              {identity.logoUrl ? (
                <img
                  src={identity.logoUrl}
                  alt={`${identity.name} logo`}
                  className="h-6 w-auto object-contain"
                  style={{ imageRendering: 'auto' }}
                />
              ) : (
                <TrendingUp className="w-4 h-4" style={{ color: '#1f857a' }} strokeWidth={2.5} />
              )}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="font-bold text-gray-900 text-sm block truncate">{identity.name}</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">{t('Admin')}</span>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation tree */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {/* Overview — always visible */}
          <Link
            to="/dashboard"
            onClick={() => window.innerWidth < 1024 && onToggle?.()}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${isActive('/dashboard')
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
            `}
            title={collapsed ? t('Overview') : undefined}
          >
            <AdminIcon name="grid" className="w-[18px] h-[18px]" />
            {!collapsed && <span className="truncate">{t('Overview')}</span>}
          </Link>

          {SECTIONS.map(section => {
            const open = !collapsed && !!openSections[section.id];
            const active = isSectionActive(section);
            return (
              <div key={section.id}>
                <button
                  onClick={() => handleSectionClick(section)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                  `}
                  title={collapsed ? t(section.label) : undefined}
                  aria-expanded={open}
                >
                  <AdminIcon name={section.icon} className="w-[18px] h-[18px]" />
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1 text-start">{t(section.label)}</span>
                      <svg
                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
                {open && (
                  <div className="mt-0.5 mb-1 space-y-0.5">
                    {section.items.map(navLink)}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom utilities */}
        <div className="p-2 border-t border-gray-200 shrink-0 space-y-0.5">
          <a
            href="http://localhost:5173"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors ${collapsed ? 'justify-center' : ''}`}
            title={t('View Store')}
          >
            <AdminIcon name="store" className="w-[18px] h-[18px]" />
            {!collapsed && <span className="truncate">{t('View Store')}</span>}
          </a>

          <button
            onClick={() => { const next = !soundOff; setSoundOff(next); setMuted(next); if (!next) playTone('toggle'); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors ${collapsed ? 'justify-center' : ''}`}
            title={soundOff ? 'Unmute interface sounds' : 'Mute interface sounds'}
          >
            <AdminIcon name={soundOff ? 'mute' : 'speaker'} className="w-[18px] h-[18px]" />
            {!collapsed && <span className="truncate">{soundOff ? t('Sounds Off') : t('Sounds On')}</span>}
          </button>

          <div className={`flex items-center gap-1 ${collapsed ? 'flex-col' : ''}`}>
            <button
              onClick={onToggle}
              className={`hidden lg:flex items-center justify-center px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors`}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span className="shrink-0">{collapsed ? '»' : '«'}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
