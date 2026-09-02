import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInAppNotifications, markNotificationRead } from '../../api/adminApi';

/**
 * NotificationCenter — bell with unread count + dropdown panel (STEP 16).
 * Polls every 30s; marks notifications read on open.
 */
const POLL_MS = 30000;

export default function NotificationCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = (silent = true) => {
    getInAppNotifications({ limit: 15 })
      .then(res => {
        const list = res.data || [];
        setItems(list);
        setUnread(list.filter(n => !n.is_read).length);
      })
      .catch(err => {
        // Logged out / session expired — stop hammering the API
        if (err?.response?.status === 401) {
          setStopped(true);
          return false;
        }
        return null;
      });
    return null;
  };
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    if (!stopped) {
      load();
      const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
      return () => clearInterval(t);
    }
  }, [stopped]);

  // close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = (n) => {
    if (n.link) navigate(n.link);
    if (!n.is_read) {
      markNotificationRead(n.id).catch(() => {});
      setUnread(prev => Math.max(0, prev - 1));
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    }
    setOpen(false);
  };

  const markAllRead = () => {
    items.filter(n => !n.is_read).forEach(n => markNotificationRead(n.id).catch(() => {}));
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4.5 min-w-[18px] px-1 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
            {items.length === 0 && (
              <div className="p-10 text-center text-sm text-gray-400">No notifications yet</div>
            )}
            {items.map(n => (
              <button
                key={n.id}
                onClick={() => handleOpen(n)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/60' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary-600 mt-1.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString('en-GB')}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
