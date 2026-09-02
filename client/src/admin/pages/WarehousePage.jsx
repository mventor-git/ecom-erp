import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../services/api';
import AdminLayout from '../layouts/AdminLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export default function WarehousePage() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi.getWarehouses().then(r => {
      setWarehouses(r.data || []);
    }).catch(e => setError(e.response?.data?.error || 'Failed to load warehouses'));
    setLoading(false);
  }, []);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold text-amber-400 tracking-tight">Warehouses</h1>
          <Link to="/admin/inventory"><Button>Inventory →</Button></Link>
        </div>
        <Card title="Active Warehouses (Real DB)">
          {loading && <p className="text-slate-400">Loading...</p>}
          {error && <p className="text-rose-400">{error}</p>}
          {warehouses.length === 0 && !loading && <p className="text-slate-500">No warehouses found. Real DB has warehouses table.</p>}
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-slate-400 bg-slate-950">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Code</th><th className="px-4 py-2">Address</th><th className="px-4 py-2">Stock</th><th className="px-4 py-2">Products</th><th className="px-4 py-2">Locations</th></tr>
            </thead>
            <tbody>
              {warehouses.map(w => (
                <tr key={w.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                  <td className="px-4 py-2 font-medium">{w.name}</td>
                  <td className="px-4 py-2 text-slate-300">{w.code}</td>
                  <td className="px-4 py-2 text-slate-400">{w.address || '-'}</td>
                  <td className="px-4 py-2">{w.total_stock ?? 0}</td>
                  <td className="px-4 py-2">{w.product_count ?? 0}</td>
                  <td className="px-4 py-2">{w.location_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-xs text-slate-400">
          Source: /api/warehouses (routes/warehouses.js). Uses warehouses + inventory + locations tables.
        </div>
      </div>
    </AdminLayout>
  );
}
