import { useState, useEffect } from 'react';
import { getSettings, updateSettingsBatch } from '../../api/adminApi';
import Toggle from '../components/Toggle';

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

/**
 * WorkflowConfig — the quadruple confirmation engine + order lifecycle settings.
 * Lives in Settings -> Orders.
 */
export default function WorkflowConfig() {
  const [form, setForm] = useState({
    order_flow_enabled: false,
    confirm_payment_verified: true,
    confirm_stock_available: true,
    confirm_manual_approval: true,
    confirm_auto_timeout_hours: 24,
    estimated_delivery_hours: 48,
    order_statuses: [],
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getSettings().then(res => {
      const all = res.data || [];
      const get = (k, d) => { const s = all.find(x => x.key === k); return s && s.parsed_value !== undefined && s.parsed_value !== null ? s.parsed_value : d; };
      setForm({
        order_flow_enabled: !!get('order_flow_enabled', false),
        confirm_payment_verified: !!get('confirm_payment_verified', true),
        confirm_stock_available: !!get('confirm_stock_available', true),
        confirm_manual_approval: !!get('confirm_manual_approval', true),
        confirm_auto_timeout_hours: Number(get('confirm_auto_timeout_hours', 24)) || 24,
        estimated_delivery_hours: Number(get('estimated_delivery_hours', 48)) || 48,
        order_statuses: Array.isArray(get('order_statuses', [])) ? get('order_statuses', []) : [],
      });
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateSettingsBatch([
        { key: 'order_flow_enabled', value: form.order_flow_enabled },
        { key: 'confirm_payment_verified', value: form.confirm_payment_verified },
        { key: 'confirm_stock_available', value: form.confirm_stock_available },
        { key: 'confirm_manual_approval', value: form.confirm_manual_approval },
        { key: 'confirm_auto_timeout_hours', value: Number(form.confirm_auto_timeout_hours) || 0 },
        { key: 'estimated_delivery_hours', value: Number(form.estimated_delivery_hours) || 0 },
        { key: 'order_statuses', value: form.order_statuses },
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save workflow settings');
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ label, hint, checked, onChange }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        onClick={() => onChange(!checked)}
        className="shrink-0"
      >
        <Toggle checked={checked} onChange={onChange} label={label} />
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Order Workflow & Confirmation</h2>
      <p className="text-xs text-gray-500 mt-1 mb-4">
        Quadruple confirmation: payment verified + stock available + manual approval + auto-approval timeout.
        Enabling the full flow activates the complete lifecycle (draft → … → completed).
      </p>

      <div className="divide-y divide-gray-100">
        <Toggle
          label="Enable full order lifecycle"
          hint="OFF = legacy flow (pending/paid/shipped) — ON = draft → completed with warehouse/packing/shipping steps"
          checked={form.order_flow_enabled}
          onChange={v => setForm({ ...form, order_flow_enabled: v })}
        />
        <Toggle
          label="Confirmation: payment verified required"
          hint="Order confirms only when payment is verified (gateway webhook / manual)"
          checked={form.confirm_payment_verified}
          onChange={v => setForm({ ...form, confirm_payment_verified: v })}
        />
        <Toggle
          label="Confirmation: stock available required"
          hint="Order confirms only when all items have enough stock"
          checked={form.confirm_stock_available}
          onChange={v => setForm({ ...form, confirm_stock_available: v })}
        />
        <Toggle
          label="Confirmation: manual admin approval required"
          hint="Order waits in 'Under Review' until an admin approves"
          checked={form.confirm_manual_approval}
          onChange={v => setForm({ ...form, confirm_manual_approval: v })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <div>
          <label className={labelClass}>Auto-approval timeout (hours)</label>
          <input type="number" min="0" className={inputClass} value={form.confirm_auto_timeout_hours}
            onChange={e => setForm({ ...form, confirm_auto_timeout_hours: e.target.value })} />
          <p className="text-[11px] text-gray-400 mt-1">0 = never auto-approve. Auto-approval is logged and notified.</p>
        </div>
        <div>
          <label className={labelClass}>Estimated delivery (hours)</label>
          <input type="number" min="1" className={inputClass} value={form.estimated_delivery_hours}
            onChange={e => setForm({ ...form, estimated_delivery_hours: e.target.value })} />
          <p className="text-[11px] text-gray-400 mt-1">Shown to customers in order confirmations + tracker.</p>
        </div>
      </div>

      {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <div className="mt-4 flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Workflow Settings'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved ✓</span>}
      </div>
    </div>
  );
}
