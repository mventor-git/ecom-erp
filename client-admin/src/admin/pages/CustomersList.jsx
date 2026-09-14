import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import {
  getCustomers, getCustomersExportUrl, getCustomerActionsExportUrl,
  createVipInvite, getVipInvites, vipInviteCardUrl, createAdminCustomer,
} from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';
import { useLanguage } from '../../i18n';

/**
 * Customers — two sections plus the invitation module:
 *   · Normal Customers  — everyone on the standard storefront
 *   · VIP Customers     · invited via QR/link, flagged in the database
 *   · VIP Invitations   — create named invites, copy link, print QR card
 */
export default function CustomersList() {
  const { format } = useAdminCurrency();
  const { t, lang } = useLanguage();
  const [tab, setTab] = useState('normal');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', name: '', phone: '', city: '', address: '' });
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState('');

  const loadCustomers = () => {
    setLoading(true);
    getCustomers({ q: search || undefined, page: 1, limit: 10 })
      .then(res => setCustomers(res.data?.items || res.data || []))
      .catch(err => setError(err.response?.data?.error || t('Failed to load customers')))
      .finally(() => setLoading(false));
  };

  // 095: manual entry — the book is no longer signup-only; customers.manage gates.
  const submitAdd = async () => {
    setAddErr('');
    if (!addForm.email.trim() || !addForm.name.trim()) { setAddErr('email and name are required'); return; }
    setAddBusy(true);
    try {
      await createAdminCustomer({ email: addForm.email.trim(), name: addForm.name.trim(), phone: addForm.phone.trim(), city: addForm.city.trim(), address: addForm.address.trim() });
      setAddOpen(false);
      setAddForm({ email: '', name: '', phone: '', city: '', address: '' });
      loadCustomers();
    } catch (err) {
      setAddErr(err.response?.data?.error || 'Failed to create customer');
    } finally { setAddBusy(false); }
  };

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = search.toLowerCase().trim();
  const matches = (c) =>
    !q ||
    (c.name || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q) ||
    (c.phone || '').toLowerCase().includes(q);

  const normal = customers.filter(c => !c.vip && matches(c));
  const vips = customers.filter(c => c.vip && matches(c));

  const dateLocale = lang === 'ar' ? 'ar-EG' : 'en-GB';

  const baseColumns = [
    { key: 'name', label: t('Customer'), render: (row) => (
      <div className="flex items-center gap-2.5">
        {row.avatar_url ? (
          <img src={row.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-primary-600 text-xs font-bold">
            {(row.name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate flex items-center gap-1.5">
            {row.name || '—'}
            {row.vip && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold font-bold uppercase tracking-wide">VIP</span>
            )}
          </p>
          <p className="text-xs text-gray-400 truncate">{row.email}</p>
        </div>
      </div>
    )},
    { key: 'phone', label: t('Phone'), render: (row) => row.phone || '—' },
    { key: 'orders_count', label: t('Orders'), align: 'center' },
    {
      key: 'total_revenue', label: t('Revenue'), align: 'right', render: (row) => (
        <span className="font-semibold text-green-600">{format(row.total_revenue || 0)}</span>
      ),
    },
    { key: 'reviews_count', label: t('Reviews'), align: 'center' },
    { key: 'wishlist_count', label: t('Wishlist'), align: 'center' },
    { key: 'last_order_at', label: t('Last Order'), render: (row) => row.last_order_at ? new Date(row.last_order_at).toLocaleDateString(dateLocale) : '—' },
    { key: 'created_at', label: t('Joined'), render: (row) => new Date(row.created_at).toLocaleDateString(dateLocale) },
    {
      key: 'actions', label: '', render: (row) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Link to={`/erp/customers/${row.id}`} className="px-2.5 py-1 text-xs bg-primary-50 text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-100">
            {t('Profile')}
          </Link>
          <a href={getCustomerActionsExportUrl(row.id)} className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50" title={t('Export actions CSV')}>
            {t('⬇ Actions')}
          </a>
        </div>
      ),
    },
  ];

  const TABS = [
    { id: 'normal', label: `${t('Normal Customers')} (${normal.length})` },
    { id: 'vip', label: `${t('VIP Customers')} (${vips.length})` },
    { id: 'invites', label: t('VIP Invitations') },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Customers')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('All signed-in customers with their activity')}</p>
        </div>
        {tab !== 'invites' && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setAddErr(''); setAddOpen(true); }} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">+ Add customer</button>
            <a href={getCustomersExportUrl()} className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
              {t('⌄ Export All CSV')}
            </a>
          </div>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4 p-1 bg-gray-100 rounded-xl w-fit max-w-full overflow-x-auto">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              tab === tb.id ? 'bg-white text-primary-700 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-800'
            }`}>
            {tb.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {(tab === 'normal' || tab === 'vip') && (
        <>
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('Search by name, email or phone...')}
              className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <DataTable
            columns={baseColumns}
            data={tab === 'vip' ? vips : normal}
            loading={loading}
            emptyMessage={tab === 'vip' ? t('No VIP customers yet — send an invitation from the VIP Invitations tab') : t('No customers yet - online/mobile signups and completed orders create customers automatically; you can also import your existing book')}
          />
        </>
      )}

      {tab === 'invites' && <InvitationsPanel dateLocale={dateLocale} />}

      {addOpen && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" role="presentation">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true">
            <h3 className="text-lg font-bold text-gray-900">Add customer to the book</h3>
            <p className="text-xs text-gray-500 mt-1">Manual entry for walk-ins and existing contacts — duplicates are matched by email and refused with the existing record's id.</p>
            <div className="mt-4 space-y-3">
              {[['email', 'Email *', 'text'], ['name', 'Name *', 'text'], ['phone', 'Phone', 'text'], ['city', 'City', 'text'], ['address', 'Address', 'text']].map(([k, label, tpe]) => (
                <label key={k} className="block text-sm text-gray-700">{label}
                  <input type={tpe} value={addForm[k]} maxLength={k === 'address' ? 120 : 60}
                    onChange={(e) => setAddForm((f) => ({ ...f, [k]: e.target.value }))}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </label>
              ))}
              {addErr && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{addErr}</div>}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setAddOpen(false)} disabled={addBusy} className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={submitAdd} disabled={addBusy} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50">{addBusy ? '…' : 'Create customer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ VIP invitation manager ═══════════════ */

function InvitationsPanel({ dateLocale }) {
  const { t } = useLanguage();
  const [invites, setInvites] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  const load = () => getVipInvites()
    .then(r => setInvites(r.data || []))
    .catch(err => setMsg({ ok: false, text: err.response?.data?.error || t('Failed to load invitations') }))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const flash = (ok, text) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const inviteLink = (code) => {
    try {
      return new URL(`login?invite=${code}`, window.location.origin.replace(':5174', ':5173')).href;
    } catch { return `?invite=${code}`; }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createVipInvite(name.trim());
      setName('');
      flash(true, t('Invitation created — copy the link or print the QR card'));
      load();
    } catch (err) {
      flash(false, err.response?.data?.error || t('Failed to create invitation'));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (code) => {
    const link = inviteLink(code);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = link; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(code);
    setTimeout(() => setCopied(''), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Create */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">{t('New VIP invitation')}</h2>
        <p className="text-xs text-gray-400 mb-3">
          {t('Enter the person\'s name — you get a signup link and a printable QR card. Scanning it takes them to the website where they sign up (email or Google) and are added as a VIP customer.')}
        </p>
        <div className="flex items-center gap-2 max-w-xl">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder={t('Person or company name')}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none"
          />
          <button onClick={handleCreate} disabled={busy || !name.trim()}
            className="shrink-0 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-500 disabled:opacity-40 transition-colors">
            {busy ? t('Creating...') : t('Create invitation')}
          </button>
        </div>
        {msg && (
          <p className={`mt-2 text-xs ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-start font-medium px-4 py-3">{t('Name')}</th>
              <th className="text-start font-medium px-4 py-3">{t('Code')}</th>
              <th className="text-start font-medium px-4 py-3">{t('Status')}</th>
              <th className="text-start font-medium px-4 py-3">{t('Created')}</th>
              <th className="text-end font-medium px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invites.map(inv => (
              <tr key={inv.code} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 font-medium text-gray-900">{inv.invite_name}</td>
                <td className="px-4 py-2.5"><code className="text-xs bg-gray-100 rounded px-1.5 py-0.5">{inv.code}</code></td>
                <td className="px-4 py-2.5">
                  {inv.used_by
                    ? <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700">{t('Claimed')}</span>
                    : <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-100 text-yellow-700">{t('Pending')}</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-500">{new Date(inv.created_at).toLocaleDateString(dateLocale)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 justify-end">
                    <button onClick={() => copyLink(inv.code)}
                      className="px-2.5 py-1 text-xs bg-primary-50 text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-100">
                      {copied === inv.code ? t('Copied ✓') : t('Copy link')}
                    </button>
                    <a href={vipInviteCardUrl(inv.code)} target="_blank" rel="noopener noreferrer"
                      className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                      {t('QR card')}
                    </a>
                  </div>
                </td>
              </tr>
            ))}
            {!invites.length && !loading && (
              <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-400">{t('No invitations yet')}</td></tr>
            )}
            {loading && (
              <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-400 animate-pulse">{t('Loading...')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

