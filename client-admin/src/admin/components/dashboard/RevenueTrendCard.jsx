import { useNavigate } from 'react-router-dom';
import { PackageOpen, ArrowUpRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Select } from '../../../components/ui/select';
import { Skeleton } from '../../../components/ui/skeleton';
import SalesChart from './SalesChart';

export const RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export const METRIC_OPTIONS = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'orders', label: 'Orders' },
];

/**
 * Dashboard trend card. Controlled by the metric + range selects in its
 * header; clicking anywhere else opens the full Revenue detail page.
 */
export default function RevenueTrendCard({ series, metric, range, onMetricChange, onRangeChange, loading }) {
  const navigate = useNavigate();
  const hasData = series.some(p => (metric === 'revenue' ? p.revenue : p.orders) > 0);

  const openDetail = () => navigate('/dashboard-detail/revenue');

  return (
    <Card
      className="lg:col-span-2 cursor-pointer group hover:border-primary-300 hover:shadow-md transition-all"
      onClick={openDetail}
      role="link"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') openDetail(); }}
      aria-label="Open detailed revenue page"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-1.5">
              {metric === 'revenue' ? 'Revenue Trend' : 'Orders Trend'}
              <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-600 transition-colors" />
            </CardTitle>
            <CardDescription>
              {metric === 'revenue'
                ? 'Daily sales — cancelled orders excluded · click for details'
                : 'Daily order volume · click for details'}
            </CardDescription>
          </div>
          {/* Controls must NOT trigger the card's navigation */}
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <Select
              value={metric}
              onChange={e => onMetricChange(e.target.value)}
              options={METRIC_OPTIONS}
              aria-label="Chart metric"
            />
            <Select
              value={range}
              onChange={e => onRangeChange(e.target.value)}
              options={RANGE_OPTIONS}
              aria-label="Chart range"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[260px] w-full rounded-lg" />
        ) : !hasData ? (
          <div className="h-[260px] flex flex-col items-center justify-center text-center gap-2">
            <PackageOpen className="w-10 h-10 text-gray-400" strokeWidth={1.5} />
            <p className="text-sm font-medium text-gray-700">No sales in this period</p>
            <p className="text-xs text-gray-500">Charts fill in automatically as orders arrive.</p>
          </div>
        ) : (
          <SalesChart series={series} metric={metric} height={260} />
        )}
      </CardContent>
    </Card>
  );
}
