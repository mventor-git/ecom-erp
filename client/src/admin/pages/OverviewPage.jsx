import { useState, useEffect } from 'react';
import AdminLayout from '../layouts/AdminLayout';
import { Card } from '../components/ui/Card';
import { getOverview } from '../../api/products';
import { ShoppingCart, Package, Boxes, Truck, Users, DollarSign } from 'lucide-react';

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOverview({ start: '2026-01-01', end: '2030-12-31' })
      .then(r => { setData(r.data); setLoading(false); })
      .catch(e => {
        // Fallback: direct axios call or unavailable state — never fake data
        setData({ status: 'unavailable', message: 'Overview data unavailable — check connection', role: 'admin' });
        setLoading(false);
      });
  }, []);

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-extrabold text-amber-400 tracking-tight">Overview — ERP Command Center</h1>

        {/* Date range info */}
        <div className="flex gap-3 text-xs text-slate-400">
          <span>Period: {data?.dateRange?.start || '—'} → {data?.dateRange?.end || '—'}</span>
          <span>Role: {data?.role || '—'}</span>
        </div>

        {/* KPI Grid — REAL DATA ONLY */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <KPICard icon={<ShoppingCart size={20} />} label="Orders" value={data?.kpi?.ordersCount ?? '—'} />
          <KPICard icon={<DollarSign size={20} />} label="Revenue" value={data?.kpi?.revenue != null ? `${data.kpi.revenue}` : '—'} />
          <KPICard icon={<Users size={20} />} label="Customers" value={data?.kpi?.customers ?? '—'} />
          <KPICard icon={<Package size={20} />} label="Products" value={data?.kpi?.products ?? '—'} />
          <KPICard icon={<Boxes size={20} />} label="Inventory" value={data?.kpi?.inventory ?? '—'} />
          <KPICard icon={<Truck size={20} />} label="Warehouses" value={data?.kpi?.warehouses ?? '—'} />
        </div>

        {/* Charts section — minimal, only if data available */}
        <Card title="Revenue Trend (Real Data)">
          {data?.revenueData?.length ? (
            <div className="text-xs text-slate-300 space-y-1">
              {data.revenueData.map((item) => (
                <div key={item.d} className="flex justify-between">
                  <span>{item.d}</span>
                  <span className="text-amber-400">{item.rev || 0}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No revenue data for selected period.</p>
          )}
        </Card>

        {/* Sales Channel */}
        <Card title="Sales Channel (Real)">
          {data?.channels?.length ? (
            <div className="text-xs text-slate-300 space-y-1">
              {data.channels.map((ch) => (
                <div key={ch.ch} className="flex justify-between">
                  <span>{ch.ch || 'Unknown'}</span>
                  <span className="text-amber-400">{ch.c || 0}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No channel data.</p>
          )}
        </Card>

        {/* Pending Actions */}
        <Card title="Pending Actions">
          <ul className="text-sm text-slate-300 space-y-2">
            <li><a href="/admin/orders" className="text-amber-400 hover:underline">→ Pending Orders</a></li>
            <li><a href="/admin/returns" className="text-amber-400 hover:underline">→ Returns</a></li>
            <li><a href="/admin/refunds" className="text-amber-400 hover:underline">→ Refunds</a></li>
          </ul>
        </Card>

        {/* Quick Launch */}
        <Card title="Quick Launch">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <QuickLink label="Orders" href="/admin/orders" />
            <QuickLink label="Issue Receipt" href="/admin/issue-receipts" />
            <QuickLink label="Inventory" href="/admin/inventory" />
            <QuickLink label="Products" href="/admin/products" />
            <QuickLink label="Customers" href="/admin/customers" />
          </div>
        </Card>

        {/* Status */}
        <div className="text-xs text-slate-500">
          Status: {data?.status || '—'} | Role: {data?.role || '—'}
          {data?.status === 'unavailable' && <span className="ml-2 text-rose-400">{data?.message}</span>}
        </div>
      </div>
    </AdminLayout>
  );
}

function KPICard({ icon, label, value }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:bg-slate-800/50 transition">
      <div className="flex items-center gap-2 text-slate-400 mb-2">{icon}<span className="text-xs font-medium uppercase tracking-wide">{label}</span></div>
      <div className="text-2xl font-extrabold text-amber-400">{value}</div>
    </div>
  );
}

function QuickLink({ label, href }) {
  return (
    <a href={href} className="block bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:text-amber-400 hover:border-amber-500/30 transition">{label}</a>
  );
}
