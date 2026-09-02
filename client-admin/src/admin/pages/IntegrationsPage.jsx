import { useState, useEffect, useCallback } from 'react';
import { Mail, Send, CreditCard, Bot, MapPin, Check, X } from 'lucide-react';
import { getIntegrations, updateIntegrations, testIntegration, testKashierSession } from '../../api/adminApi';

// Field definitions per integration card
const CARDS = [
  {
    id: 'mail',
    title: 'Mail (SMTP)',
    icon: Mail,
    color: 'bg-blue-50 text-blue-600',
    testProvider: 'mail',
    testLabel: 'Send test email',
    fields: [
      { key: 'mail_provider', label: 'Provider', type: 'select', options: [
        { value: 'smtp', label: 'SMTP (Gmail, Hostinger, etc.)' },
        { value: 'sendgrid', label: 'SendGrid (uses SendGrid card key)' },
      ] },
      { key: 'mail_smtp_host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.gmail.com' },
      { key: 'mail_smtp_port', label: 'SMTP Port', type: 'number', placeholder: '587' },
      { key: 'mail_smtp_user', label: 'SMTP Username', type: 'secret' },
      { key: 'mail_smtp_pass', label: 'SMTP Password / App Password', type: 'secret' },
      { key: 'mail_from', label: 'From Email', type: 'text', placeholder: 'noreply@comfortsign.com' },
      { key: 'mail_admin_email', label: 'Admin Notification Email', type: 'text', placeholder: 'you@example.com' },
    ],
    configured: d => !!(d.mail?.mail_smtp_host || d.mail?.mail_smtp_user?.is_set),
  },
  {
    id: 'sendgrid',
    title: 'SendGrid',
    icon: Send,
    color: 'bg-emerald-50 text-emerald-600',
    testProvider: 'sendgrid',
    testLabel: 'Send test email',
    fields: [
      { key: 'sendgrid_api_key', label: 'SendGrid API Key', type: 'secret' },
      { key: 'sendgrid_from_email', label: 'From Email', type: 'text', placeholder: 'noreply@yourstore.com' },
    ],
    configured: d => !!d.sendgrid?.sendgrid_api_key?.is_set,
  },
  {
    id: 'kashier',
    title: 'Kashier',
    icon: CreditCard,
    color: 'bg-emerald-50 text-emerald-700',
    testProvider: 'kashier',
    testLabel: 'Verify keys',
    fields: [
      { key: 'kashier_merchant_id', label: 'Merchant ID (MID)', type: 'text', placeholder: 'MID-XXXX-XXX or UUID' },
      { key: 'kashier_api_key', label: 'API Key (Payment API Keys page)', type: 'secret', placeholder: '' },
      { key: 'kashier_secret_key', label: 'Secret Key (Secret Keys page)', type: 'secret', placeholder: '' },
    ],
    configured: d => !!d.kashier?.kashier_api_key?.is_set,
    webhookGuide: true,
  },
  {
    id: 'ai',
    title: 'AI Assistant',
    icon: Bot,
    color: 'bg-amber-50 text-amber-600',
    testProvider: 'ai',
    testLabel: 'Test connection',
    fields: [
      { key: 'ai_provider', label: 'Provider', type: 'select', options: [
        { value: 'ollama', label: 'Ollama (local)' },
        { value: 'openai', label: 'OpenAI-compatible API' },
      ] },
      { key: 'ai_base_url', label: 'Base URL', type: 'text', placeholder: 'http://localhost:11434' },
      { key: 'ai_model', label: 'Model', type: 'text', placeholder: 'ministral-3:3b' },
      { key: 'ai_api_key', label: 'API Key (cloud providers)', type: 'secret' },
      { key: 'ai_timeout', label: 'Timeout (ms)', type: 'number', placeholder: '15000' },
    ],
    configured: d => !!(d.ai?.ai_base_url || d.ai?.ai_model || d.ai?.ai_api_key?.is_set),
  },
  {
    id: 'google_maps',
    title: 'Google Maps',
    icon: MapPin,
    color: 'bg-green-50 text-green-600',
    testProvider: 'google_maps',
    testLabel: 'Test API key',
    fields: [
      { key: 'google_maps_api_key', label: 'Google Maps API Key', type: 'secret', placeholder: 'AIza...' },
    ],
    configured: d => !!d.google_maps?.google_maps_api_key?.is_set,
  },
];

function StatusBadge({ configured }) {
  return configured
    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Configured</span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Not configured</span>;
}

export default function IntegrationsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [edited, setEdited] = useState({});      // key → new value
  const [saving, setSaving] = useState(null);    // card id being saved
  const [testing, setTesting] = useState(null);  // card id being tested
  const [testResult, setTestResult] = useState({}); // card id → { ok, message, detail }
  const [customKeys, setCustomKeys] = useState([]);
  const [subTab, setSubTab] = useState({});
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getIntegrations()
      .then(res => {
        setData(res.data);
        const custom = res.data.custom || {};
        setCustomKeys(Object.entries(custom).map(([name, value]) => ({ name, value })));
        setEdited({});
      })
      .catch(() => setNotice({ type: 'error', text: 'Failed to load integrations' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function currentValue(cardId, field) {
    if (edited[field.key] !== undefined) return edited[field.key];
    const group = data?.[cardId];
    const val = group?.[field.key];
    if (field.type === 'secret') return ''; // secrets never autofill — blank = keep existing
    return val ?? '';
  }

  function handleChange(cardId, field, value) {
    setEdited(prev => ({ ...prev, [field.key]: value }));
    setTestResult(prev => ({ ...prev, [cardId]: undefined }));
  }

  function cardChanges(cardId) {
    const card = CARDS.find(c => c.id === cardId);
    const changes = [];
    card.fields.forEach(f => {
      if (edited[f.key] === undefined) return;
      if (f.type === 'secret') {
        // Blank secret = keep existing (handled by backend); null = clear
        changes.push({ key: f.key, value: edited[f.key] === '' ? '' : edited[f.key] });
      } else {
        changes.push({ key: f.key, value: edited[f.key] });
      }
    });
    return changes;
  }

  async function handleSave(cardId) {
    const changes = cardChanges(cardId);
    if (changes.length === 0) return;
    setSaving(cardId);
    setNotice('');
    try {
      const res = await updateIntegrations(changes);
      const failed = (res.data.errors || []).filter(e => e.error).length;
      setNotice({ type: failed ? 'error' : 'success', text: failed ? 'Some settings failed to save' : 'Saved successfully' });
      load();
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.error?.message || 'Failed to save' });
    } finally {
      setSaving(null);
    }
  }

  async function handleTest(cardId) {
    const card = CARDS.find(c => c.id === cardId);
    setTesting(cardId);
    setTestResult(prev => ({ ...prev, [cardId]: undefined }));

    // Kashier: real verification — creates a 1 EGP hosted session.
    if (cardId === 'kashier') {
      try {
        const res = await testKashierSession();
        const payUrl = res.data?.pay_url;
        setTestResult(prev => ({
          ...prev,
          [cardId]: {
            success: true,
            message: 'Keys verified — test session created',
            detail: payUrl,
            pay_url: payUrl,
          },
        }));
      } catch (err) {
        setTestResult(prev => ({
          ...prev,
          [cardId]: { success: false, message: err.response?.data?.error || err.message },
        }));
      } finally {
        setTesting(null);
      }
      return;
    }

    try {
      const res = await testIntegration(card.testProvider);
      setTestResult({ ...testResult, [cardId]: res.data });
    } catch (err) {
      setTestResult({ ...testResult, [cardId]: { success: false, message: err.response?.data?.error?.message || 'Test request failed' } });
    } finally {
      setTesting(null);
    }
  }

  function addCustomRow() {
    setCustomKeys([...customKeys, { name: '', value: '' }]);
  }

  function removeCustomRow(i) {
    setCustomKeys(customKeys.filter((_, idx) => idx !== i));
  }

  function updateCustomRow(i, field, value) {
    const next = customKeys.map((row, idx) => idx === i ? { ...row, [field]: value } : row);
    setCustomKeys(next);
  }

  async function saveCustomKeys() {
    const obj = {};
    let valid = true;
    customKeys.forEach(row => {
      if (row.name.trim()) obj[row.name.trim()] = row.value;
      if (!row.name.trim() && row.value) valid = false;
    });
    if (!valid) {
      setNotice({ type: 'error', text: 'Every custom key must have a name' });
      return;
    }
    setSaving('custom');
    try {
      await updateIntegrations([{ key: 'custom_api_keys', value: JSON.stringify(obj) }]);
      setNotice({ type: 'success', text: 'Custom API keys saved' });
      load();
    } catch {
      setNotice({ type: 'error', text: 'Failed to save custom API keys' });
    } finally {
      setSaving(null);
    }
  }

  function renderField(cardId, field) {
    const value = currentValue(cardId, field);

    switch (field.type) {
      case 'select':
        return (
          <select value={value} onChange={e => handleChange(cardId, field, e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            {field.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        );
      case 'number':
        return (
          <input type="number" value={value} onChange={e => handleChange(cardId, field, e.target.value)}
            placeholder={field.placeholder} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
        );
      case 'secret': {
        const group = data?.[cardId];
        const masked = group?.[field.key]?.masked;
        return (
          <div>
            <input type="password" value={value} onChange={e => handleChange(cardId, field, e.target.value)}
              placeholder={masked ? `${masked} — blank keeps current` : field.placeholder || 'Not set'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            {value && (
              <button type="button" onClick={() => handleChange(cardId, field, '')}
                className="mt-1 text-xs text-gray-400 hover:text-gray-600">
                Clear stored value (set to empty)
              </button>
            )}
          </div>
        );
      }
      default:
        return (
          <input type="text" value={value} onChange={e => handleChange(cardId, field, e.target.value)}
            placeholder={field.placeholder} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
        );
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Integrations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your external API keys — changes apply immediately, no restart needed
          </p>
        </div>
      </div>

      {notice && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${notice.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CARDS.map(card => {
          const result = testResult[card.id];
          const hasChanges = card.fields.some(f => edited[f.key] !== undefined);
          return (
            <div key={card.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${card.color}`}><card.icon className="w-5 h-5" /></div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{card.title}</h2>
                    <p className="text-xs text-gray-400">{card.fields.filter(f => f.type === 'secret').length} secret key(s)</p>
                  </div>
                </div>
                <StatusBadge configured={card.configured(data || {})} />
              </div>

              <div className="space-y-3">
                {card.subTabs && (() => {
                  const active = subTab[card.id] || card.subTabs[0].id;
                  const visible = card.fields.filter(f => (f.group || 'keys') === active);
                  const urlValid = u => !u || /^https?:\/\/.+\..+/.test(u.trim());
                  return (
                    <>
                      <div className="flex gap-1 border-b border-gray-200 pb-1.5 mb-1">
                        {card.subTabs.map(t => (
                          <button key={t.id} onClick={() => setSubTab(s => ({ ...s, [card.id]: t.id }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              active === t.id ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                            }`}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                      {visible.map(field => (
                        <div key={field.key}>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {field.label}
                            {field.type === 'url' && edited[field.key] !== undefined && (
                              <span className={`ml-2 font-semibold ${urlValid(edited[field.key]) ? 'text-emerald-600' : 'text-red-500'}`}>
                                {urlValid(edited[field.key]) ? <span className="inline-flex items-center gap-1 text-green-600"><Check className="w-3.5 h-3.5" /> valid</span> : <span className="inline-flex items-center gap-1 text-red-600"><X className="w-3.5 h-3.5" /> invalid URL</span>}
                              </span>
                            )}
                          </label>
                          {renderField(card.id, field)}
                          {field.type === 'url' && edited[field.key] === undefined && data?.[card.id]?.[field.key]?.value && (
                            <p className="text-[11px] mt-0.5 text-gray-400">current: {data[card.id][field.key].value}</p>
                          )}
                        </div>
                      ))}
                    </>
                  );
                })() || card.fields.map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                    {renderField(card.id, field)}
                  </div>
                ))}
              </div>

              {card.webhookGuide && (
                <details className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                  <summary className="font-semibold cursor-pointer text-gray-700">?? Webhook setup guide</summary>
                  <ol className="list-decimal ml-4 mt-2 space-y-1">
                    <li>Save your API Key + Secret Key here and press <b>Verify keys</b>.</li>
                    <li>In the Kashier portal, open <b>Webhooks ? Add endpoint</b>.</li>
                    <li>Paste: <code className="bg-white px-1 rounded">{window.location.origin}/api/kashier/webhook</code></li>
                    <li>Subscribe to <b>transaction-success</b>, <b>trans-capture</b>, <b>transaction-refund</b>, <b>trans-void</b>, <b>transaction-failed</b>.</li>
                    <li>Save — Kashier will now notify your store automatically.</li>
                  </ol>
                  <p className="mt-2 text-[11px] text-gray-500">Note: the URL must be publicly reachable (use your domain or ngrok while testing).</p>
                </details>
              )}
              {result && (
                <div className={`mt-3 p-2.5 rounded-lg text-xs ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <span className="font-medium">{result.message}</span>
                  {result.detail && <div className="mt-0.5 text-gray-500">{result.detail}</div>}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button onClick={() => handleSave(card.id)} disabled={!hasChanges || saving === card.id}
                  className="text-sm px-4 py-2 bg-primary-600 rounded-lg text-white hover:bg-primary-700 font-medium disabled:opacity-40">
                  {saving === card.id ? 'Saving...' : 'Save'}
                </button>

                <button onClick={() => handleTest(card.id)} disabled={testing === card.id}
                  className="text-sm px-4 py-2 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200 font-medium disabled:opacity-50">
                  {testing === card.id ? 'Testing...' : `Test — ${card.testLabel}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom API keys */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-gray-100 text-gray-600">🔑</div>
            <div>
              <h2 className="font-semibold text-gray-900">Custom API Keys</h2>
              <p className="text-xs text-gray-400">Store any other API keys your integrations may need</p>
            </div>
          </div>
          <button onClick={addCustomRow} className="text-sm px-3 py-1.5 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200 font-medium">+ Add key</button>
        </div>

        {customKeys.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No custom keys yet</p>
        ) : (
          <div className="space-y-2">
            {customKeys.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input type="text" value={row.name} placeholder="Key name (e.g. whatsapp_api)" onChange={e => updateCustomRow(i, 'name', e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                <input type="text" value={row.value} placeholder="Value" onChange={e => updateCustomRow(i, 'value', e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                <button onClick={() => removeCustomRow(i)} className="px-2.5 py-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50" title="Remove">✕</button>
              </div>
            ))}
            <button onClick={saveCustomKeys} disabled={saving === 'custom'}
              className="mt-2 text-sm px-4 py-2 bg-primary-600 rounded-lg text-white hover:bg-primary-700 font-medium disabled:opacity-40">
              {saving === 'custom' ? 'Saving...' : 'Save Custom Keys'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
