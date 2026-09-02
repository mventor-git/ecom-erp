import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  getWarehouseLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../../api/adminApi';

export default function WarehousesList() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', address: '' });
  const [locationFormData, setLocationFormData] = useState({ name: '', barcode: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (selectedWarehouse) {
      loadLocations(selectedWarehouse.id);
    }
  }, [selectedWarehouse]);

  function loadWarehouses() {
    setLoading(true);
    getWarehouses()
      .then(res => {
        setWarehouses(res.data || []);
        if (!selectedWarehouse && res.data?.length > 0) {
          setSelectedWarehouse(res.data[0]);
        }
      })
      .catch(err => console.error('Error loading warehouses:', err))
      .finally(() => setLoading(false));
  }

  function loadLocations(warehouseId) {
    setLoadingLocations(true);
    getWarehouseLocations(warehouseId)
      .then(res => setLocations(res.data || []))
      .catch(err => console.error('Error loading locations:', err))
      .finally(() => setLoadingLocations(false));
  }

  function openCreateForm() {
    setEditingWarehouse(null);
    setFormData({ name: '', code: '', address: '' });
    setError('');
    setShowForm(true);
  }

  function openEditForm(warehouse) {
    setEditingWarehouse(warehouse);
    setFormData({ name: warehouse.name, code: warehouse.code, address: warehouse.address || '' });
    setError('');
    setShowForm(true);
  }

  async function handleSave() {
    try {
      setError('');
      if (!formData.name.trim() || !formData.code.trim()) {
        setError('Name and code are required');
        return;
      }
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse.id, formData);
      } else {
        await createWarehouse(formData);
      }
      setShowForm(false);
      loadWarehouses();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save warehouse');
    }
  }

  async function handleDelete(warehouse) {
    if (!window.confirm(`Deactivate warehouse "${warehouse.name}"? This cannot be undone.`)) return;
    try {
      await deleteWarehouse(warehouse.id);
      if (selectedWarehouse?.id === warehouse.id) {
        setSelectedWarehouse(null);
      }
      loadWarehouses();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to deactivate warehouse');
    }
  }

  async function handleCreateLocation() {
    if (!selectedWarehouse) return;
    try {
      if (!locationFormData.name.trim()) {
        setError('Location name is required');
        return;
      }
      await createLocation(selectedWarehouse.id, locationFormData);
      setShowLocationForm(false);
      setLocationFormData({ name: '', barcode: '' });
      loadLocations(selectedWarehouse.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create location');
    }
  }

  async function handleDeleteLocation(location) {
    if (!window.confirm(`Deactivate location "${location.name}"?`)) return;
    try {
      await deleteLocation(location.id);
      loadLocations(selectedWarehouse.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to deactivate location');
    }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    {
      key: 'total_stock',
      label: 'Total Stock',
      align: 'right',
      render: (row) => (
        <span className="font-semibold">{(row.total_stock || 0).toLocaleString()}</span>
      ),
    },
    {
      key: 'product_count',
      label: 'Products',
      align: 'right',
    },
    {
      key: 'location_count',
      label: 'Locations',
      align: 'right',
    },
    {
      key: 'address',
      label: 'Address',
      render: (row) => row.address || '—',
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); openEditForm(row); }}
            className="text-xs px-2 py-1 text-primary-600 hover:bg-primary-50 rounded"
          >
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
            className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
          >
            Deactivate
          </button>
        </div>
      ),
    },
  ];

  const locationColumns = [
    { key: 'name', label: 'Location Name' },
    { key: 'barcode', label: 'Barcode', render: (row) => row.barcode || '—' },
    {
      key: 'total_stock',
      label: 'Stock',
      align: 'right',
      render: (row) => (
        <span className="font-semibold">{(row.total_stock || 0).toLocaleString()}</span>
      ),
    },
    {
      key: 'product_count',
      label: 'Products',
      align: 'right',
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
          row.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <button
          onClick={() => handleDeleteLocation(row)}
          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
        >
          Deactivate
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warehouses</h1>
          <p className="text-sm text-gray-500 mt-1">Manage storage locations and bins</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/inventory"
            className="text-sm px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            ← Back to Inventory
          </a>
          <button
            onClick={openCreateForm}
            className="text-sm px-4 py-2 bg-primary-600 rounded-lg text-white hover:bg-primary-700 font-medium"
          >
            + New Warehouse
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {editingWarehouse ? 'Edit Warehouse' : 'New Warehouse'}
          </h3>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Main Warehouse"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="WH-MAIN"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="123 Main St"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="text-sm px-4 py-2 bg-primary-600 rounded-lg text-white hover:bg-primary-700 font-medium"
            >
              {editingWarehouse ? 'Update' : 'Create'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-sm px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={warehouses}
        loading={loading}
        emptyMessage="No warehouses found"
        onRowClick={(row) => setSelectedWarehouse(row)}
      />

      {selectedWarehouse && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedWarehouse.name} — Locations
              </h2>
              <p className="text-sm text-gray-500">
                {selectedWarehouse.code} {selectedWarehouse.address ? `• ${selectedWarehouse.address}` : ''}
              </p>
            </div>
            <button
              onClick={() => { setShowLocationForm(true); setError(''); }}
              className="text-sm px-4 py-2 bg-primary-600 rounded-lg text-white hover:bg-primary-700 font-medium"
            >
              + Add Location
            </button>
          </div>

          {showLocationForm && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex flex-wrap gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Location Name *</label>
                  <input
                    type="text"
                    value={locationFormData.name}
                    onChange={(e) => setLocationFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Aisle A-01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={locationFormData.barcode}
                    onChange={(e) => setLocationFormData(prev => ({ ...prev, barcode: e.target.value }))}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Optional"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleCreateLocation}
                    className="text-sm px-4 py-2 bg-primary-600 rounded-lg text-white hover:bg-primary-700 font-medium"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowLocationForm(false)}
                    className="text-sm px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <DataTable
            columns={locationColumns}
            data={locations}
            loading={loadingLocations}
            emptyMessage="No locations in this warehouse"
          />
        </div>
      )}
    </div>
  );
}
