import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { checkAdmin, fetchCsrfToken, getSetupStatus } from '../api/adminApi';
import { initAdminCurrency } from '../utils/currency';
import { applyAppearanceSettings } from '../utils/appearance';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(() => sessionStorage.getItem('setup-banner-dismissed') === '1');

  useEffect(() => {
    let cancelled = false;
    checkAdmin()
      .then(res => {
        if (cancelled) return;
        if (!res.data.isAdmin) {
          navigate('/', { replace: true });
          return;
        }
        return fetchCsrfToken();
      })
      .then(() => { if (!cancelled) setReady(true); })
      .catch(() => { if (!cancelled) navigate('/', { replace: true }); });
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    // Restore persisted desktop choice; mobile always starts collapsed
    const savedCollapsed = localStorage.getItem('cs-sidebar-collapsed') === '1';
    setSidebarOpen(mq.matches ? false : !savedCollapsed);
    const handler = (e) => setSidebarOpen(!e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      try { localStorage.setItem('cs-sidebar-collapsed', next ? '0' : '1'); } catch { /* ignore */ }
      return next;
    });
  };

  // Load platform-wide currency + appearance settings once authenticated
  useEffect(() => {
    if (!ready) return;
    initAdminCurrency();
    applyAppearanceSettings();
  }, [ready]);

  // First-run guidance (094): derived setup status; the dashboard lands on the
  // wizard once per session while core setup is unfinished (never a lock-in —
  // free navigation always remains).
  useEffect(() => {
    if (!ready) return;
    getSetupStatus()
      .then((res) => {
        const s = res.data.data;
        setSetup(s);
        if (!s.setup_complete && location.pathname === '/dashboard' && !sessionStorage.getItem('setup-redirected')) {
          sessionStorage.setItem('setup-redirected', '1');
          navigate('/setup', { replace: true });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Refresh the banner after navigations (setup may have just been completed).
  useEffect(() => {
    if (!ready || !setup || setup.setup_complete) return;
    getSetupStatus().then((res) => setSetup(res.data.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const showBanner = ready && setup && !setup.setup_complete && !bannerDismissed && location.pathname !== '/setup';

  if (!ready) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar collapsed={!sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuToggle={toggleSidebar} />
        {showBanner && (
          <div className="bg-primary-600 text-white px-4 py-2 flex items-center gap-3 text-sm" role="status">
            <span className="font-medium">
              This install is intentionally empty — {setup.remaining_core.length} core setup step{(setup.remaining_core.length === 1 ? '' : 's')} left (
              {setup.items.filter((i) => i.core && !i.done).map((i) => i.label).join(', ')}).
            </span>
            <Link to="/setup" className="underline font-semibold shrink-0">Open setup</Link>
            <button
              onClick={() => { sessionStorage.setItem('setup-banner-dismissed', '1'); setBannerDismissed(true); }}
              className="ms-auto shrink-0 text-white/80 hover:text-white"
              aria-label="Dismiss">✕</button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
