import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DollarSign, Package, Clock, TrendingUp, Target, ShoppingCart, BarChart2, Calendar } from 'lucide-react';
import { getAdminOrders, getAdminOrderStats } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';

/**
 * DashboardDetailPage — customized drill-down pages for each dashboard stat card.
 * Metrics: revenue | orders | pending | today-sales | avg-order | today-orders
 */
const METRICS = {
  revenue: { label: 'Total Revenue', icon: DollarSign, color: 'text-green-600' },
  orders: { label: 'Total Orders', icon: Package, color: 'text-blue-600' },
  pending: { label: 'Pending Orders', icon: Clock, color: 'text-yellow-600' },
  'today-sales': { label: "Today's Sales", icon: TrendingUp, color: 'text-primary-600' },
  'avg-order': { label: 'Average Order Value', icon: Target, color: 'text-gray-600' },
  'today-orders': { label: "Today's Orders", icon: ShoppingCart, color: 'text-primary-600' },
};

const STATUS_STYLE = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  shipped: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  completed: 'bg-gray-200 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-purple-100 text-purple-700',
};

export default function DashboardDetailPage() {
  const { metric } = useParams();
  const { format } = useAdminCurrency();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const meta = METRICS[metric] || METRICS.revenue;

  useEffect(() => {
    setLoading(true);
    Promise.all([getAdminOrders({ limit: 200 }), getAdminOrderStats()])
      .then(([ordersRes, statsRes]) => {
        setOrders(ordersRes.data?.orders || []);
        setStats(statsRes.data);
      })
      .catch(err => console.error('Error loading dashboard detail:', err))
      .finally(() => setLoading(false));
  }, [metric]);

  const today = new Date().toISOString().slice(0, 10);

  let filtered = orders;
  if (metric === 'pending') {
    filtered = orders.filter(o => ['pending', 'payment_pending', 'admin_review'].includes(o.status));
  } else if (metric === 'today-sales' || metric === 'today-orders') {
    filtered = orders.filter(o => (o.created_at || '').slice(0, 10) === today);
  } else if (metric === 'revenue' || metric === 'avg-order') {
    filtered = orders.filter(o => ['paid', 'delivered', 'completed', 'refunded'].includes(o.status));
  }

  const total = filtered.reduce((s, o) => s + (o.total || 0), 0);
  const avg = filtered.length ? Math.round(total / filtered.length) : 0;
  const paidTotal = orders.filter(o => ['paid', 'delivered', 'completed', 'refunded'].includes(o.status)).reduce((s, o) => s + (o.total || 0), 0);

  const periodRevenue = {
    today: orders.filter(o => (o.created_at || '').slice(0, 10) === today && ['paid', 'delivered', 'completed', 'refunded'].includes(o.status)).reduce((s, o) => s + (o.total || 0), 0),
    sevenDays: orders.filter(o => {
      const d = new Date(o.created_at || 0);
      return Date.now() - d.getTime() < 7 * 86400000 && ['paid', 'delivered', 'completed', 'refunded'].includes(o.status);
    }).reduce((s, o) => s + (o.total || 0), 0),
    thirtyDays: orders.filter(o => {
      const d = new Date(o.created_at || 0);
      return Date.now() - d.getTime() < 30 * 86400000 && ['paid', 'delivered', 'completed', 'refunded'].includes(o.status);
    }).reduce((s, o) => s + (o.total || 0), 0),
  };

  const summaryCards = [
    { label: 'Orders shown', value: String(filtered.length), icon: Package },
    { label: 'Revenue (shown)', value: format(total), icon: DollarSign },
    { label: 'Avg order (shown)', value: format(avg), icon: Target },
    ...(metric === 'revenue' ? [
      { label: 'Revenue — today', value: format(periodRevenue.today), icon: TrendingUp },
      { label: 'Revenue — 7 days', value: format(periodRevenue.sevenDays), icon: BarChart2 },
      { label: 'Revenue — 30 days', value: format(periodRevenue.thirtyDays), icon: Calendar },
    ] : []),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-primary-600">← Dashboard</Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><meta.icon className="w-6 h-6" /> {meta.label}</h1>
            <p className="text-sm text-gray-500 mt-1">{stats ? `All-time paid revenue: ${format(paidTotal)} · ${stats.totalOrders || 0} orders total` : ''}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {summaryCards.map(c => (
              <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <p className="text-xs text-gray-500 flex items-center gap-1"><c.icon className="w-3.5 h-3.5" /> {c.label}</p>
                <p className="text-lg font-bold text-gray-900 mt-1 truncate">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Orders table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Orders ({filtered.length})</h2>
            </div>
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">No orders for this view.</div>
            ) : (
              <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">#</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Customer</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600">Total</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900">#{o.id}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">{o.customer_name || o.shipping_name || '—'}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-right">{format(o.total)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">{new Date(o.created_at).toLocaleDateString('en-GB')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
