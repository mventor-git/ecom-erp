import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote, ShoppingCart, Hourglass, TrendingUp, Target, CalendarCheck2,
  Plus, BarChart3, Boxes, Trash2, ReceiptText, Eye, EyeOff,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import RevenueTrendCard from '../components/dashboard/RevenueTrendCard';
import StatusDonutCard from '../components/dashboard/StatusDonutCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { getAdminOrderStats, getAdminOrders, getSalesDaily } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';
import { useLanguage } from '../../i18n';

const STATUS_COLORS = {
  paid: '#10b981', completed: '#10b981', delivered: '#10b981',
  pending: '#f59e0b', admin_review: '#f59e0b', payment_pending: '#f59e0b',
  confirmed: '#0ea5e9', shipped: '#0ea5e9', picking: '#0ea5e9',
  packing: '#0ea5e9', ready_for_shipping: '#0ea5e9',
  cancelled: '#ef4444', refunded: '#ef4444',
};
const statusColor = s => STATUS_COLORS[s] || '#78716c';

/** Safe percentage of part within total, rounded (0 when total is 0). */
const totalPct = (total, part) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

export default function Overview() {
  const { format } = useAdminCurrency();
  const { t, lang } = useLanguage();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [series, setSeries] = useState([]);
  const [range, setRange] = useState('14');
  const [metric, setMetric] = useState('revenue');
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);
  // Privacy toggle: hide/show sensitive figures on the KPI cards (persisted)
  const [kpiVisible, setKpiVisible] = useState(() => localStorage.getItem('cs-kpi-visible') !== '0');

  useEffect(() => {
    try { localStorage.setItem('cs-kpi-visible', kpiVisible ? '1' : '0'); } catch { /* ignore */ }
  }, [kpiVisible]);

  const toggleCard = (id) => setExpandedCard(prev => (prev === id ? null : id));

  useEffect(() => {
    Promise.all([
      getAdminOrderStats(),
      getAdminOrders({ limit: 6 }),
    ])
      .then(([statsRes, ordersRes]) => {
        setStats(statsRes.data);
        setRecentOrders(ordersRes.data.orders || []);
      })
      .catch(err => console.error('Error loading dashboard:', err))
      .finally(() => setLoading(false));
  }, []);

  // Refetch the chart series whenever the range control changes
  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    getSalesDaily(Number(range))
      .then(res => { if (!cancelled) setSeries(res.data.series || []); })
      .catch(err => console.error('Error loading sales series:', err))
      .finally(() => { if (!cancelled) setChartLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  const s = stats || {};

  const kpis = [
    {
      id: 'revenue', label: t('Total Revenue'), value: format(s.totalRevenue || 0),
      icon: Banknote, tone: 'success', to: '/dashboard-detail/revenue',
      details: [
        { label: t("Today's sales"), value: format(s.todayRevenue || 0) },
        { label: t('Avg per order'), value: format(s.avgOrderValue || 0) },
        { label: t('Orders counted'), value: s.totalOrders ?? 0 },
      ],
    },
    {
      id: 'orders', label: t('Total Orders'), value: s.totalOrders ?? 0,
      icon: ShoppingCart, tone: 'info', to: '/dashboard-detail/orders',
      details: [
        { label: t('Pending now'), value: s.pendingOrders ?? 0 },
        { label: t("Today's orders"), value: s.todayOrders ?? 0 },
        { label: t('Avg order value'), value: format(s.avgOrderValue || 0) },
      ],
    },
    {
      id: 'pending', label: t('Pending Orders'), value: s.pendingOrders ?? 0,
      icon: Hourglass, tone: 'warning', to: '/dashboard-detail/pending',
      details: [
        { label: t('Share of all orders'), value: `${totalPct(s.totalOrders, s.pendingOrders)}%` },
        { label: t('Action'), value: t('Review & confirm') },
      ],
    },
    {
      id: 'today-sales', label: t("Today's Sales"), value: format(s.todayRevenue || 0),
      icon: TrendingUp, tone: 'primary', to: '/dashboard-detail/today-sales',
      details: [
        { label: t("Today's orders"), value: s.todayOrders ?? 0 },
        { label: t('Share of total revenue'), value: `${totalPct(s.totalRevenue, s.todayRevenue)}%` },
      ],
    },
    {
      id: 'avg-order', label: t('Avg Order Value'), value: format(s.avgOrderValue || 0),
      icon: Target, tone: 'neutral', to: '/dashboard-detail/avg-order',
      details: [
        { label: t('Formula'), value: t('Revenue ÷ Orders') },
        { label: t('Based on'), value: `${s.totalOrders ?? 0} ${t('order(s)')}` },
      ],
    },
    {
      id: 'today-orders', label: t("Today's Orders"), value: s.todayOrders ?? 0,
      icon: CalendarCheck2, tone: 'primary', to: '/dashboard-detail/today-orders',
      details: [
        { label: t("Today's sales"), value: format(s.todayRevenue || 0) },
        { label: t('Share of all orders'), value: `${totalPct(s.totalOrders, s.todayOrders)}%` },
      ],
    },
  ];

  const statusRows = (s.ordersByStatus || []).map(st => ({
    ...st,
    color: statusColor(st.status),
  }));
  const totalStatusOrders = statusRows.reduce((sum, r) => sum + r.count, 0);

  const quickActions = [
    { label: t('Inventory'),   desc: t('Stock & warehouses'),    icon: Boxes,     to: '/inventory' },
    { label: t('Movements'),   desc: t('Movements & new product'), icon: Boxes,     to: '/inventory/movement' },
    { label: t('Reports'),     desc: t('Sales & stock insight'), icon: BarChart3, to: '/erp/reports' },
    { label: t('Trash'),       desc: t('Deleted products'),      icon: Trash2,    to: '/products/trash' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <Skeleton className="lg:col-span-2 h-[340px] rounded-xl" />
          <Skeleton className="h-[340px] rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">{t('Dashboard')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/erp/reports"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ReceiptText className="w-4 h-4" />
            {t('Reports')}
          </Link>
          <Link
            to="/inventory/movement"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t('Inventory Movement')}
          </Link>
        </div>
      </div>

      {/* ── KPI cards (with privacy toggle) ── */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Key Metrics')}</p>
          <button
            type="button"
            onClick={() => { setKpiVisible(v => !v); setExpandedCard(null); }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 transition-colors"
            aria-pressed={!kpiVisible}
            title={kpiVisible ? t('Hide figures') : t('Show figures')}
          >
            {kpiVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {kpiVisible ? t('Hide') : t('Show')}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {kpis.map(k => (
            <StatCard
              key={k.id}
              {...k}
              expanded={expandedCard === k.id}
              onExpand={() => toggleCard(k.id)}
              masked={!kpiVisible}
            />
          ))}
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <RevenueTrendCard
          series={series}
          metric={metric}
          range={range}
          onMetricChange={setMetric}
          onRangeChange={setRange}
          loading={chartLoading}
        />
        <StatusDonutCard statusRows={statusRows} total={totalStatusOrders} />
      </div>

      {/* ── Recent orders + quick actions ── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('Recent Orders')}</CardTitle>
                <CardDescription>{t('Latest activity in your store')}</CardDescription>
              </div>
              <Link to="/orders" className="text-xs font-medium text-primary-600 hover:text-primary-700">
                {t('View all')}
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-gray-700">{t('No orders yet')}</p>
                <p className="text-xs text-gray-500 mt-1">{t('Your first order will appear here the moment it happens.')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentOrders.map(order => (
                  <Link
                    key={order.id}
                    to="/orders"
                    className="flex items-center justify-between py-2.5 group"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-gray-900">#{order.id}</span>
                      <span className="text-sm text-gray-600 ml-2 truncate">
                        {order.customer_name || order.customer_email || t('Guest')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold text-gray-900">{format(order.total)}</span>
                      <Badge status={order.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('Quick Actions')}</CardTitle>
            <CardDescription>{t('Jump straight into daily work')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2.5">
              {quickActions.map(a => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="rounded-lg border border-gray-200 p-3 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                >
                  <a.icon className="w-4.5 h-4.5 w-[18px] h-[18px] text-primary-600" strokeWidth={2} />
                  <p className="text-xs font-semibold text-gray-900 mt-2">{a.label}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{a.desc}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
