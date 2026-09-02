import { useState, useEffect } from 'react';
import {
  getPriceLists, createPriceList, updatePriceList, deletePriceList,
  getSettings, updateSettingsBatch,
} from '../../api/adminApi';

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

export default function PriceLists() {
  const [lists, setLists] = useState([]);
  const [storefrontList, setStorefrontList] = useState('retail');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newDiscount, setNewDiscount] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadAll(); }, []);

  function loadAll() {
    setLoading(true);
    Promise.all([getPriceLists(), getSettings().catch(() => ({ data: [] }))])
      .then(([listsRes, settingsRes]) => {
        setLists(listsRes.data || []);
        const s = (settingsRes.data || []).find(x => x.key === 'storefront_price_list');
        if (s) setStorefrontList(String(s.parsed_value ?? s.value ?? 'retail'));
      })
      .catch(err => console.error('Error loading price lists:', err))
      .finally(() => setLoading(false));
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newCode.trim()) return setError('Name and code are required');
    setCreating(true);
    setError('');
    try {
      await createPriceList({ name: newName.trim(), code: newCode.trim(), discountPercent: newDiscount === '' ? null : newDiscount });
      setShowCreate(false);
      setNewName(''); setNewCode(''); setNewDiscount('');
      setSavedMsg('Price list created');
      setTimeout(() => setSavedMsg(''), 2500);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (list) => {
    try {
      await updatePriceList(list.id, { is_active: !list.is_active });
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
    }
  };

  const handleMakeDefault = async (list) => {
    try {
      await updatePriceList(list.id, { is_default: true });
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set default');
    }
  };

  const handleStorefrontChange = async (code) => {
    setStorefrontList(code);
    try {
      await updateSettingsBatch([{ key: 'storefront_price_list', value: code }]);
      setSavedMsg(`Storefront now sells at: ${code}`);
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save storefront list');
    }
  };

  const handleDelete = async (list) => {
    if (!window.confirm(`Delete price list "${list.name}"? Per-product overrides will be removed.`)) return;
    try {
      await deletePriceList(list.id);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Lists</h1>
          <p className="text-sm text-gray-500 mt-1">Retail / Wholesale / Semi-Wholesale / Offer — effective price = override → discount → base</p>
        </div>
        <button onClick={() => { setShowCreate(true); setError(''); }} className="btn-primary">+ New Price List</button>
      </div>

      {savedMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{savedMsg}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Storefront price list selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Storefront Price List</h2>
        <p className="text-xs text-gray-500 mb-3">Which price list the customer storefront displays and charges.</p>
        <select value={storefrontList} onChange={e => handleStorefrontChange(e.target.value)} className={inputClass + ' !w-64'}>
          {lists.filter(l => l.is_active).map(l => (
            <option key={l.id} value={l.code}>{l.name} ({l.code})</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        {lists.length === 0 && <div className="p-10 text-center text-sm text-gray-400">No price lists yet.</div>}
        {lists.map(list => (
          <div key={list.id} className="flex items-center justify-between px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-gray-900">{list.name}</h3>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{list.code}</span>
                {list.is_default && <span className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full font-medium">Default</span>}
                {!list.is_active && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Inactive</span>}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {list.discount_percent !== null && list.discount_percent !== undefined
                  ? `Auto discount: ${list.discount_percent}% off base price`
                  : 'No auto discount — per-product overrides or base price'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <button onClick={() => handleToggle(list)} className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                {list.is_active ? 'Deactivate' : 'Activate'}
              </button>
              {!list.is_default && (
                <button onClick={() => handleMakeDefault(list)} className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
                  Make Default
                </button>
              )}
              {!list.is_default && (
                <button onClick={() => handleDelete(list)} className="px-2.5 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Price List</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Name *</label>
                <input className={inputClass} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. VIP Customers" />
              </div>
              <div>
                <label className={labelClass}>Code *</label>
                <input className={inputClass} value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="e.g. vip" />
              </div>
              <div>
                <label className={labelClass}>Auto discount % (optional)</label>
                <input type="number" min="0" max="100" className={inputClass} value={newDiscount} onChange={e => setNewDiscount(e.target.value)} placeholder="e.g. 10" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
                <button onClick={handleCreate} disabled={creating} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
