import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import { getNotificationRules, createNotificationRule, getInAppNotifications, markNotificationRead } from '../../api/adminApi';

export default function NotificationsPage() {
  const [tab, setTab] = useState('rules');
  const [rules, setRules] = useState([]);
  const [inApp, setInApp] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', event_type: '', channel: 'email', recipient_type: 'email', recipient_value: '', template: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, [tab]);

  function loadData() {
    setLoading(true);
    setError('');
    const promise = tab === 'rules' ? getNotificationRules() : getInAppNotifications();
    promise
      .then(res => {
        if (tab === 'rules') setRules(res.data || []);
        else setInApp(res.data || []);
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }

  function openCreate() {
    setForm({ name: '', event_type: '', channel: 'email', recipient_type: 'email', recipient_value: '', template: '' });
    setError('');
    setShowForm(true);
  }

  function handleCreate() {
    if (!form.name || !form.event_type || !form.channel || !form.recipient_type) {
      setError('Name, event type, channel, and recipient type are required');
      return;
    }
    setSaving(true);
    const data = { ...form };
    if (form.template) {
      try { data.template = JSON.parse(form.template); } catch { data.template = form.template; }
    }
    createNotificationRule(data)
      .then(() => { setShowForm(false); loadData(); })
      .catch(err => setError(err.response?.data?.error || 'Failed to create'))
      .finally(() => setSaving(false));
  }

  function handleMarkRead(id) {
    markNotificationRead(id)
      .then(() => loadData())
      .catch(() => {});
  }

  const rulesColumns = [
    { key: 'name', label: 'Name', render: (row) => (
      <div>
        <span className="font-medium text-gray-900">{row.name}</span>
        {row.is_active === 0 && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
      </div>
    )},
    { key: 'event_type', label: 'Event Type', render: (row) => (
      <span className="font-mono text-xs text-gray-600">{row.event_type}</span>
    )},
    { key: 'channel', label: 'Channel', render: (row) => (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        row.channel === 'email' ? 'bg-blue-100 text-blue-700' :
        row.channel === 'webhook' ? 'bg-purple-100 text-purple-700' :
        'bg-green-100 text-green-700'
      }`}>{row.channel}</span>
    )},
    { key: 'recipient_type', label: 'Recipient Type' },
    { key: 'recipient_value', label: 'Recipient', render: (row) => (
      <span className="text-xs text-gray-500 truncate max-w-xs block">{row.recipient_value || '—'}</span>
    )},
  ];

  const inAppColumns = [
    { key: 'created_at', label: 'Time', render: (row) => (
      <span className="text-xs text-gray-500">{new Date(row.created_at).toLocaleString()}</span>
    )},
    { key: 'title', label: 'Title', render: (row) => (
      <span className={`font-medium ${row.is_read ? 'text-gray-500' : 'text-gray-900'}`}>{row.title}</span>
    )},
    { key: 'message', label: 'Message', render: (row) => (
      <span className="text-sm text-gray-600 truncate max-w-md block">{row.message}</span>
    )},
    { key: 'is_read', label: 'Status', render: (row) => (
      row.is_read ? <span className="text-xs text-gray-400">Read</span> :
      <button onClick={() => handleMarkRead(row.id)} className="text-xs px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full hover:bg-primary-100">Mark Read</button>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">Manage notification rules and view alerts</p>
        </div>
        {tab === 'rules' && (
          <button onClick={openCreate} className="text-sm px-4 py-2 bg-primary-600 rounded-lg text-white hover:bg-primary-700 font-medium">
            + New Rule
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('rules')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === 'rules' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          Rules ({rules.length})
        </button>
        <button onClick={() => setTab('in-app')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === 'in-app' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          In-App ({inApp.filter(n => !n.is_read).length} unread)
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {tab === 'rules' && (
        <DataTable columns={rulesColumns} data={rules} loading={loading} emptyMessage="No notification rules configured" />
      )}

      {tab === 'in-app' && (
        <DataTable columns={inAppColumns} data={inApp} loading={loading} emptyMessage="No notifications" />
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">New Notification Rule</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type *</label>
                <input value={form.event_type} onChange={e => setForm({...form, event_type: e.target.value})}
                  placeholder="e.g. order.created, inventory.low_stock"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel *</label>
                  <select value={form.channel} onChange={e => setForm({...form, channel: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="email">Email</option>
                    <option value="in_app">In-App</option>
                    <option value="webhook">Webhook</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Type *</label>
                  <select value={form.recipient_type} onChange={e => setForm({...form, recipient_type: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="email">Email</option>
                    <option value="user_id">User ID</option>
                    <option value="role">Role</option>
                    <option value="webhook_url">Webhook URL</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Value</label>
                <input value={form.recipient_value} onChange={e => setForm({...form, recipient_value: e.target.value})}
                  placeholder="email@example.com or user ID or URL"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template (JSON or text)</label>
                <textarea value={form.template} onChange={e => setForm({...form, template: e.target.value})} rows={4}
                  placeholder='{"subject": "New Order", "body": "Order {{order_id}} received"}'
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
