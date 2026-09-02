import { useState } from 'react';
import AdminLayout from '../layouts/AdminLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { adminApi } from '../services/api';

export default function AdminSalePage() {
  const [qty, setQty] = useState(12);
  const [price, setPrice] = useState(1500);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await adminApi.createSale({ productId: 1, qty, warehouseId: 1, basePrice: price, finalPrice: price });
      setResult(res.data);
    } catch (e) { setError(e.response?.data?.error || 'Sale failed'); }
    setLoading(false);
  };

  const cogs = result?.fifoResult?.costSnapshot || 0;
  const revenue = price * qty;
  const profit = revenue - cogs;
  const margin = revenue ? ((profit / revenue) * 100).toFixed(2) : 0;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-extrabold text-amber-400 tracking-tight">Admin Sale — FIFO</h1>
        <Card title="Create Sale">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Quantity</label>
              <input type="number" value={qty} onChange={e=>setQty(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Selling Price</label>
              <input type="number" value={price} onChange={e=>setPrice(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500" />
            </div>
            <div className="flex items-end">
              <Button onClick={submit} className="w-full" disabled={loading}>{loading ? 'Processing...' : 'Confirm Sale'}</Button>
            </div>
          </div>
          {error && <p className="mt-3 text-rose-400 text-sm">{error}</p>}
        </Card>
        {result && (
          <Card title="Sale Result — Real Database">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><div className="text-slate-400">Order</div><div className="font-bold text-amber-300">#{result.order?.id}</div></div>
              <div><div className="text-slate-400">Qty</div><div className="font-bold">{qty}</div></div>
              <div><div className="text-slate-400">Price</div><div className="font-bold">{price} EGP</div></div>
              <div><div className="text-slate-400">Revenue</div><div className="font-bold text-emerald-400">{revenue.toLocaleString()} EGP</div></div>
              <div><div className="text-slate-400">COGS (FIFO)</div><div className="font-bold text-rose-400">{cogs.toLocaleString()} EGP</div></div>
              <div><div className="text-slate-400">Profit</div><div className="font-bold text-amber-300">{profit.toLocaleString()} EGP</div></div>
              <div><div className="text-slate-400">Margin</div><div className="font-bold">{margin}%</div></div>
              <div><div className="text-slate-400">Status</div><div className="font-bold">{result.order?.status}</div></div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
              cost_snapshot={result.orderItem?.cost_snapshot || result.fifoResult?.costSnapshot} (FIFO, not cost_price). Inventory layers: 0 / 18 / 15.
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
