import { useState, useEffect } from 'react';
import { getSettings, updateSettingsBatch, viewShippingPolicyUrl } from '../../api/adminApi';

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

/**
 * Courier / shipping configuration — lives in Settings -> Documents.
 * Powers the shipping labels and the printable shipping policy.
 */
export default function CourierConfig() {
  const [form, setForm] = useState({
    courier_name: '',
    courier_website: '',
    courier_tracking_prefix: 'CS',
    courier_phone: '',
    shipping_from_address: '',
    shipping_policy: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getSettings()
      .then(res => {
        const all = res.data || [];
        const get = (k, d) => { const s = all.find(x => x.key === k); return s && s.parsed_value !== undefined && s.parsed_value !== null ? s.parsed_value : d; };
        setForm({
          courier_name: get('courier_name', ''),
          courier_website: get('courier_website', ''),
          courier_tracking_prefix: get('courier_tracking_prefix', 'CS'),
          courier_phone: get('courier_phone', ''),
          shipping_from_address: get('shipping_from_address', ''),
          shipping_policy: get('shipping_policy', ''),
        });
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateSettingsBatch([
        { key: 'courier_name', value: form.courier_name },
        { key: 'courier_website', value: form.courier_website },
        { key: 'courier_tracking_prefix', value: form.courier_tracking_prefix || 'CS' },
        { key: 'courier_phone', value: form.courier_phone },
        { key: 'shipping_from_address', value: form.shipping_from_address },
        { key: 'shipping_policy', value: form.shipping_policy },
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Shipping / Courier</h2>
          <p className="text-xs text-gray-500 mt-1">
            Used on shipping labels (FedEx / DHL / local couriers) and the printable shipping policy.
          </p>
        </div>
        <a
          href={viewShippingPolicyUrl()}
          target="_blank" rel="noopener noreferrer"
          className="px-3 py-2 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50"
        >
          View Shipping Policy
        </a>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Courier name</label>
          <input className={inputClass} value={form.courier_name} onChange={e => setForm({ ...form, courier_name: e.target.value })} placeholder="e.g. FedEx, DHL, Aramex" />
        </div>
        <div>
          <label className={labelClass}>Courier website (tracking)</label>
          <input className={inputClass} value={form.courier_website} onChange={e => setForm({ ...form, courier_website: e.target.value })} placeholder="https://www.fedex.com" />
        </div>
        <div>
          <label className={labelClass}>Tracking prefix</label>
          <input className={inputClass} value={form.courier_tracking_prefix} onChange={e => setForm({ ...form, courier_tracking_prefix: e.target.value })} placeholder="CS" />
        </div>
        <div>
          <label className={labelClass}>Courier phone</label>
          <input className={inputClass} value={form.courier_phone} onChange={e => setForm({ ...form, courier_phone: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Sender address (on labels)</label>
          <input className={inputClass} value={form.shipping_from_address} onChange={e => setForm({ ...form, shipping_from_address: e.target.value })} placeholder="Store address used as the FROM on shipping labels" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Shipping policy text</label>
          <textarea rows={4} className={inputClass} value={form.shipping_policy} onChange={e => setForm({ ...form, shipping_policy: e.target.value })} placeholder="Delivery times, costs, coverage areas, returns..." />
        </div>
      </div>

      {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <div className="mt-4 flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Courier Settings'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved ✓</span>}
      </div>
    </div>
  );
}
