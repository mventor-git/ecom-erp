import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCustomerProfile, getCustomerActionsExportUrl } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';
import { TrendingUp, User, Mail, Phone, Gift, Calendar, CreditCard, ListChecks } from 'lucide-react';

export default function CustomerProfile() {
  const { id } = useParams();
  const { format } = useAdminCurrency();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('orders');

  useEffect(() => {
    getCustomerProfile(id).then(res => setProfile(res.data)).catch(err => setError(err.response?.data?.error || 'Failed')).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="bg-white dark:bg-[#1c1917] rounded-xl border border-stone-200 dark:border-[#302b28] p-16 text-center shadow-sm">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1f857a] mx-auto" />
    </div>
  );
  if (error || !profile) return <div className="p-10 text-red-600 dark:text-red-300">{error || 'Not found'}</div>;

  const vipPolicy = profile.vip_policy || {};
  const invitation = profile.invitation || {};
  const tabs = [
    { key: 'orders', label: 'Orders', count: profile.orders?.length || 0 },
    { key: 'reviews', label: 'Reviews', count: profile.reviews?.length || 0 },
    { key: 'wishlist', label: 'Wishlist', count: profile.wishlist?.length || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="bg-white dark:bg-[#1c1917] rounded-xl border border-stone-200 dark:border-[#302b28] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="w-20 h-20 rounded-full overflow-hidden shadow-md ring-2 ring-stone-200 dark:ring-[#302b28] shrink-0 bg-stone-100 dark:bg-[#211d1b]">
            {profile.avatar_url || (profile.google_profile && profile.google_profile.picture) ? (
              <img src={profile.avatar_url || profile.google_profile?.picture} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-[#1f857a] to-[#83d2c9] flex items-center justify-center text-white text-2xl font-bold">{(profile.name || '?').charAt(0).toUpperCase()}</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-extrabold text-stone-900 dark:text-[#fafaf9] tracking-tight">{profile.name || '—'}</h2>
            <p className="text-sm text-stone-500 dark:text-[#8b837f] mt-0.5">{profile.email || '—'}</p>
            <div className="flex flex-wrap gap-3 mt-3 text-sm text-stone-600 dark:text-[#a8a29e]">
              <span className="inline-flex items-center gap-1.5"><Phone size={14}/> {profile.phone || '—'}</span>
              <span className="inline-flex items-center gap-1.5"><Mail size={14}/> {profile.email || '—'}</span>
              <span className="inline-flex items-center gap-1.5"><Calendar size={14}/> {new Date(profile.created_at || Date.now()).toLocaleDateString('en-GB')}</span>
            </div>
          </div>
          <div className="md:text-right md:min-w-[160px]">
            <a href={getCustomerActionsExportUrl ? (getCustomerActionsExportUrl(id) || '#') : '#'} download
               className="inline-flex items-center gap-2 rounded-lg bg-stone-900 dark:bg-[#fafaf9] text-white dark:text-stone-900 px-4 py-2 text-sm font-semibold hover:opacity-90 transition shadow-sm">
              <ListChecks size={16}/> Export Actions
            </a>
            <div className="text-xs uppercase tracking-wider text-stone-400 dark:text-[#6b6560] font-semibold mt-3">Profit Contribution</div>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-300">{format(profile.profit_contribution || 0)}</div>
            <div className="text-xs text-stone-400 dark:text-[#6b6560]">Estimated from orders</div>
          </div>
        </div>

        {/* VIP / Channel / Invitation — theme cards */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-stone-200 dark:border-[#302b28] bg-stone-50 dark:bg-[#211d1b] p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#1f857a] dark:text-[#83d2c9] font-bold mb-1"><Gift size={16}/> VIP Policy</div>
            <div className="text-sm text-stone-700 dark:text-[#d6d3d1]">Discount: <span className="font-extrabold text-[#1f857a] dark:text-[#b3e5de]">{vipPolicy.discount_pct || 0}%</span></div>
            <div className="text-xs text-stone-400 dark:text-[#8b837f]">Active: {vipPolicy.is_active ? 'Yes' : 'No'}</div>
          </div>
          <div className="rounded-lg border border-stone-200 dark:border-[#302b28] bg-stone-50 dark:bg-[#211d1b] p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#1f857a] dark:text-[#83d2c9] font-bold mb-1"><TrendingUp size={16}/> Channel</div>
            <div className="text-sm text-stone-700 dark:text-[#d6d3d1]">Source: <span className="font-extrabold text-stone-900 dark:text-[#fafaf9]">{profile.source || '—'}</span></div>
          </div>
          <div className="rounded-lg border border-stone-200 dark:border-[#302b28] bg-stone-50 dark:bg-[#211d1b] p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#1f857a] dark:text-[#83d2c9] font-bold mb-1"><CreditCard size={16}/> Invitation</div>
            <div className="text-sm text-stone-700 dark:text-[#d6d3d1]">Invite: <span className="font-extrabold text-stone-900 dark:text-[#fafaf9]">{invitation.code || '—'}</span></div>
            <div className="text-xs text-stone-400 dark:text-[#8b837f]">Segment: {invitation.segment || '—'}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-200 dark:border-[#302b28]">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors rounded-t-lg ${tab === t.key ? 'bg-white dark:bg-[#1c1917] border border-b-0 border-stone-200 dark:border-[#302b28] text-stone-900 dark:text-[#fafaf9] shadow-sm -mb-px' : 'text-stone-400 dark:text-[#8b837f] hover:text-stone-600 dark:hover:text-[#a8a29e]'}`}>
            {t.label} <span className="ml-1.5 text-xs text-stone-400 dark:text-[#6b6560]">({t.count})</span>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-[#1c1917] rounded-xl border border-stone-200 dark:border-[#302b28] p-6 shadow-sm">
        {tab === 'orders' && (
          <div>
            <h3 className="text-sm font-extrabold text-stone-900 dark:text-[#fafaf9] mb-4">Orders</h3>
            {profile.orders && profile.orders.length > 0 ? (
              <ul className="divide-y divide-stone-100 dark:divide-[#302b28] text-sm">
                {profile.orders.map(o => (
                  <li key={o.id} className="py-3 flex justify-between">
                    <div>
                      <span className="font-semibold text-stone-800 dark:text-[#e7e5e4]">Order #{o.id}</span>
                      <span className="ml-3 text-xs text-stone-400 dark:text-[#6b6560]">{new Date(o.created_at).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="font-bold text-stone-700 dark:text-[#d6d3d1]">{o.total ? format(o.total) : '—'}</div>
                  </li>
                ))}
              </ul>
            ) : <div className="text-stone-400 dark:text-[#6b6560] text-sm">No orders found.</div>}
          </div>
        )}
        {tab === 'reviews' && (
          <div>
            <h3 className="text-sm font-extrabold text-stone-900 dark:text-[#fafaf9] mb-4">Reviews</h3>
            <div className="text-stone-400 dark:text-[#6b6560] text-sm">{(profile.reviews || []).length === 0 ? 'No reviews yet.' : 'Review cards go here (reuse DataTable pattern, no emoji, AdminIcon icons only).'}</div>
          </div>
        )}
        {tab === 'wishlist' && (
          <div>
            <h3 className="text-sm font-extrabold text-stone-900 dark:text-[#fafaf9] mb-4">Wishlist</h3>
            <div className="text-stone-400 dark:text-[#6b6560] text-sm">{(profile.wishlist || []).length === 0 ? 'No wishlist items.' : 'Wishlist cards go here.'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
