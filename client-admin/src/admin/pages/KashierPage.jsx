/**
 * Kashier — Payment Center (mventor-ticket-061).
 * Operational view of hosted payment sessions. Sandbox/test controls do NOT
 * belong here — they live in Integrations, isolated from live operations.
 */
import { useEffect, useState } from 'react';
import { getKashierSessions } from '../../api/adminApi';
import { useLanguage } from '../../i18n';

export default function KashierPage() {
  const { t } = useLanguage();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await getKashierSessions();
      setSessions(res.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Kashier Payment Center')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('Hosted payment sessions and verification events. Sandbox testing is in Integrations and does not appear in operational activity.')}</p>
        </div>
        <button onClick={load} className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">↻ {t('Refresh')}</button>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">{t('Loading…')}</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-500">{t('No payment sessions yet.')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-start border-b border-gray-200">
                <th className="text-start px-4 py-2.5 font-semibold text-gray-700">{t('Session')}</th>
                <th className="text-start px-4 py-2.5 font-semibold text-gray-700">{t('Amount')}</th>
                <th className="text-start px-4 py-2.5 font-semibold text-gray-700">{t('Status')}</th>
                <th className="text-start px-4 py-2.5 font-semibold text-gray-700">{t('Created')}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700 max-w-[240px] truncate">{s.merchant_order_id}</td>
                  <td className="px-4 py-2.5">{((s.amount_cents || 0) / 100).toFixed(2)} EGP</td>
                  <td className="px-4 py-2.5">{s.status}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{String(s.created_at || '').replace('T', ' ').slice(0, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
