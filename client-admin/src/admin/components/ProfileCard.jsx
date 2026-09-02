import { useState } from 'react';
import { User, Mail, Phone, Calendar, Gift, TrendingUp, CreditCard, ListChecks } from 'lucide-react';

export default function ProfileCard({ profile, format, tabs, activeTab, onTabChange, onExport }) {
  const vipPolicy = profile.vip_policy || {};
  const invitation = profile.invitation || {};
  const [showPhoto, setShowPhoto] = useState(!!(profile.avatar_url || profile.google_profile?.picture));

  return (
    <div className="bg-white dark:bg-[#1c1917] rounded-xl border border-stone-200 dark:border-[#302b28] p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start gap-6">
        <div className="w-20 h-20 rounded-full overflow-hidden shadow-md ring-2 ring-stone-200 dark:ring-[#302b28] shrink-0 bg-stone-100 dark:bg-[#211d1b]">
          {showPhoto ? (
            <img src={profile.avatar_url || profile.google_profile?.picture} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-[#1f857a] to-[#83d2c9] flex items-center justify-center text-white text-2xl font-bold">{(profile.name || '?').charAt(0).toUpperCase()}</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-extrabold text-stone-900 dark:text-[#fafaf9] tracking-tight">{profile.name || '—'}</h2>
          <p className="text-sm text-stone-500 dark:text-[#8b837f] mt-0.5">{profile.email || '—'}</p>
          <div className="flex flex-wrap gap-3 mt-3 text-sm text-stone-600 dark:text-[#a8a29e]">
            <span className="inline-flex items-center gap-1.5" aria-label="Phone"><Phone size={14}/> {profile.phone || '—'}</span>
            <span className="inline-flex items-center gap-1.5" aria-label="Email"><Mail size={14}/> {profile.email || '—'}</span>
            <span className="inline-flex items-center gap-1.5" aria-label="Joined"><Calendar size={14}/> {new Date(profile.created_at || Date.now()).toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        <div className="md:text-right md:min-w-[160px]">
          {onExport && (
            <button onClick={onExport} aria-label="Export actions" className="inline-flex items-center gap-2 rounded-lg bg-stone-900 dark:bg-[#fafaf9] text-white dark:text-stone-900 px-4 py-2 text-sm font-semibold hover:opacity-90 transition shadow-sm">
              <ListChecks size={16}/> Export Actions
            </button>
          )}
          <div className="text-xs uppercase tracking-wider text-stone-400 dark:text-[#6b6560] font-semibold mt-3">Profit Contribution</div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-300">{format ? format(profile.profit_contribution || 0) : '—'}</div>
          <div className="text-xs text-stone-400 dark:text-[#6b6560]">Estimated from orders</div>
        </div>
      </div>

      {/* VIP / Channel / Invitation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-stone-200 dark:border-[#302b28] bg-stone-50 dark:bg-[#211d1b] p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#1f857a] dark:text-[#83d2c9] font-bold mb-1" aria-label="VIP Policy"><Gift size={16}/> VIP Policy</div>
          <div className="text-sm text-stone-700 dark:text-[#d6d3d1]">Discount: <span className="font-extrabold text-[#1f857a] dark:text-[#b3e5de]">{vipPolicy.discount_pct || 0}%</span></div>
          <div className="text-xs text-stone-400 dark:text-[#8b837f]">Active: {vipPolicy.is_active ? 'Yes' : 'No'}</div>
        </div>
        <div className="rounded-lg border border-stone-200 dark:border-[#302b28] bg-stone-50 dark:bg-[#211d1b] p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#1f857a] dark:text-[#83d2c9] font-bold mb-1" aria-label="Channel"><TrendingUp size={16}/> Channel</div>
          <div className="text-sm text-stone-700 dark:text-[#d6d3d1]">Source: <span className="font-extrabold text-stone-900 dark:text-[#fafaf9]">{profile.source || '—'}</span></div>
        </div>
        <div className="rounded-lg border border-stone-200 dark:border-[#302b28] bg-stone-50 dark:bg-[#211d1b] p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#1f857a] dark:text-[#83d2c9] font-bold mb-1" aria-label="Invitation"><CreditCard size={16}/> Invitation</div>
          <div className="text-sm text-stone-700 dark:text-[#d6d3d1]">Invite: <span className="font-extrabold text-stone-900 dark:text-[#fafaf9]">{invitation.code || '—'}</span></div>
          <div className="text-xs text-stone-400 dark:text-[#8b837f]">Segment: {invitation.segment || '—'}</div>
        </div>
      </div>

      {/* Tabs */}
      {tabs && tabs.length > 0 && (
        <div className="flex gap-2 border-b border-stone-200 dark:border-[#302b28]" role="tablist" aria-label="Customer sections">
          {tabs.map(t => (
            <button key={t.key} role="tab" aria-selected={activeTab === t.key} aria-label={t.label}
              onClick={() => onTabChange && onTabChange(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors rounded-t-lg ${activeTab === t.key ? 'bg-white dark:bg-[#1c1917] border border-b-0 border-stone-200 dark:border-[#302b28] text-stone-900 dark:text-[#fafaf9] shadow-sm -mb-px' : 'text-stone-400 dark:text-[#8b837f] hover:text-stone-600 dark:hover:text-[#a8a29e]'}`}>
              {t.label} <span className="ml-1.5 text-xs text-stone-400 dark:text-[#6b6560]">({t.count})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
