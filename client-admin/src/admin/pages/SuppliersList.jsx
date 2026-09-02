import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../api/adminApi';
import { useLanguage } from '../../i18n';

export default function SuppliersList() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', contact_name: '', email: '', phone: '', address: '', notes: '', lead_time_days: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toDeactivate, setToDeactivate] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => { loadSuppliers(); }, []);

  function loadSuppliers() {
    setLoading(true);
    getSuppliers()
      .then(res => setSuppliers(res.data || []))
      .catch(() => setError('Failed to load suppliers'))
      .finally(() => setLoading(false));
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', contact_name: '', email: '', phone: '', address: '', notes: '', lead_time_days: 0 });
    setError('');
    setShowForm(true);
  }

  function openEdit(supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name || '',
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      lead_time_days: supplier.lead_time_days || 0,
    });
    setError('');
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    const promise = editing
      ? updateSupplier(editing.id, form)
      : createSupplier(form);
    promise
      .then(() => { setShowForm(false); loadSuppliers(); })
      .catch(err => setError(err.response?.data?.error || 'Failed to save'))
      .finally(() => setSaving(false));
  }

  function handleDeactivate() {
    if (!toDeactivate) return;
    setDeactivating(true);
    deleteSupplier(toDeactivate.id)
      .then(() => { setToDeactivate(null); loadSuppliers(); })
      .catch(() => { setError('Failed to deactivate'); setToDeactivate(null); })
      .finally(() => setDeactivating(false));
  }

  const columns = [
    { key: 'name', label: 'Name', render: (row) => (
      <div>
        <span className="font-medium text-gray-900">{row.name}</span>
        {!row.is_active && <span className="ms-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
      </div>
    )},
    { key: 'contact_name', label: 'Contact', render: (row) => row.contact_name || '—' },
    { key: 'email', label: 'Email', render: (row) => row.email || '—' },
    { key: 'phone', label: 'Phone', render: (row) => row.phone || '—' },
    { key: 'lead_time_days', label: 'Lead Time', render: (row) => `${row.lead_time_days || 0} days` },
    { key: 'product_count', label: 'Products', render: (row) => (
      <span className="font-medium">{row.product_count || 0}</span>
    )},
    { key: 'actions', label: '', render: (row) => (
      <div className="flex gap-1.5 justify-end">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/erp/suppliers/${row.id}`); }} className="text-xs px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">View</button>
        <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Edit</button>
        {row.is_active !== 0 && (
          <button onClick={(e) => { e.stopPropagation(); setToDeactivate(row); }} className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">Deactivate</button>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage vendors and product suppliers</p>
        </div>
        <button onClick={openCreate} className="text-sm px-4 py-2 bg-primary-600 rounded-lg text-white hover:bg-primary-700 font-medium">
          + Add Supplier
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <DataTable
        columns={columns}
        data={suppliers}
        loading={loading}
        emptyMessage={t('No suppliers yet')}
        onRowClick={(row) => navigate(`/erp/suppliers/${row.id}`)}
      />

      <ConfirmDialog
        open={!!toDeactivate}
        title={t('Deactivate supplier?')}
        message={toDeactivate ? `${t('This supplier will be deactivated. Historical purchase costs and records are preserved.')} (${toDeactivate.name})` : ''}
        confirmLabel={deactivating ? t('Deactivating…') : t('Deactivate')}
        tone="danger"
        onConfirm={handleDeactivate}
        onCancel={() => setToDeactivate(null)}
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Supplier' : 'New Supplier'}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                  <input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lead Time (days)</label>
                  <input type="number" value={form.lead_time_days} onChange={e => setForm({...form, lead_time_days: parseInt(e.target.value) || 0})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
