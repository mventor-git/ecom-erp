import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Banknote, ShoppingCart, Target, Trophy } from 'lucide-react';
import StatCard from '../components/StatCard';
import SalesChart from '../components/dashboard/SalesChart';
import { RANGE_OPTIONS, METRIC_OPTIONS } from '../components/dashboard/RevenueTrendCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Select } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { getSalesDaily } from '../../api/adminApi';

/**
 * Full revenue detail page (mventor-ticket-052).
 * Same animated chart as the dashboard card — larger, with the same
 * metric/range controls — plus totals and a complete daily breakdown.
 */
export default function RevenueDetail() {
  const [series, setSeries] = useState([]);
  const [range, setRange] = useState('30');
  const [metric, setMetric] = useState('revenue');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSalesDaily(Number(range))
      .then(res => { if (!cancelled) setSeries(res.data.series || []); })
      .catch(err => console.error('Error loading revenue series:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  const totals = useMemo(() => {
    const totalRevenue = series.reduce((s, p) => s + p.revenue, 0);
    const totalOrders = series.reduce((s, p) => s + p.orders, 0);
    let best = null;
    for (const p of series) {
      if (!best || p.revenue > best.revenue) best = p;
    }
    return {
      totalRevenue,
      totalOrders,
      avg: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      best,
    };
  }, [series]);

  const fmt = c => `${(c / 100).toLocaleString('en-EG', { minimumFractionDigits: 2 })} EGP`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary-600 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 mt-1">Revenue Details</h1>
          <p className="text-sm text-gray-500 mt-0.5">Daily performance with full breakdown</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={metric}
            onChange={e => setMetric(e.target.value)}
            options={METRIC_OPTIONS}
            aria-label="Chart metric"
          />
          <Select
            value={range}
            onChange={e => setRange(e.target.value)}
            options={RANGE_OPTIONS}
            aria-label="Chart range"
          />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label={`Revenue — last ${range} days`} value={fmt(totals.totalRevenue)} icon={Banknote} tone="success" />
        <StatCard label={`Orders — last ${range} days`} value={totals.totalOrders} icon={ShoppingCart} tone="info" />
        <StatCard label="Average per Order" value={fmt(totals.avg)} icon={Target} tone="neutral" />
        <StatCard
          label="Best Day"
          value={totals.best ? fmt(totals.best.revenue) : '—'}
          sub={totals.best ? totals.best.day : undefined}
          icon={Trophy}
          tone="warning"
        />
      </div>

      {/* Big animated chart */}
      <Card>
        <CardHeader>
          <CardTitle>{metric === 'revenue' ? 'Daily Revenue' : 'Daily Orders'}</CardTitle>
          <CardDescription>Animated draw-in · hover any point for exact figures</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[340px] w-full rounded-lg" />
          ) : (
            <SalesChart series={series} metric={metric} height={340} />
          )}
        </CardContent>
      </Card>

      {/* Daily breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Breakdown</CardTitle>
          <CardDescription>Every day in the selected range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-2.5 pr-4 font-semibold text-gray-700">Date</th>
                  <th className="py-2.5 pr-4 font-semibold text-gray-700 text-right">Orders</th>
                  <th className="py-2.5 pr-4 font-semibold text-gray-700 text-right">Revenue</th>
                  <th className="py-2.5 font-semibold text-gray-700 text-right">Avg / Order</th>
                </tr>
              </thead>
              <tbody>
                {[...series].reverse().map(p => (
                  <tr key={p.day} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-4 text-gray-900 font-medium">{p.day}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-600">{p.orders}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-900">{fmt(p.revenue)}</td>
                    <td className="py-2.5 text-right text-gray-600">
                      {p.orders > 0 ? fmt(Math.round(p.revenue / p.orders)) : '—'}
                    </td>
                  </tr>
                ))}
                {series.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-500">No data for this range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
