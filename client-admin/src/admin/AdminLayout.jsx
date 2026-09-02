import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { checkAdmin, fetchCsrfToken } from '../api/adminApi';
import { initAdminCurrency } from '../utils/currency';
import { applyAppearanceSettings } from '../utils/appearance';

export default function AdminLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ready, setReady] = useState(false);

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
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
