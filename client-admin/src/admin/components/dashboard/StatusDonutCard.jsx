import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';

const STATUS_COLORS = {
  paid: '#10b981', completed: '#10b981', delivered: '#10b981',
  pending: '#f59e0b', admin_review: '#f59e0b', payment_pending: '#f59e0b',
  confirmed: '#0ea5e9', shipped: '#0ea5e9', picking: '#0ea5e9',
  packing: '#0ea5e9', ready_for_shipping: '#0ea5e9',
  cancelled: '#ef4444', refunded: '#ef4444',
};
const statusColor = s => STATUS_COLORS[s] || '#78716c';

function DonutTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-gray-900 capitalize">{d.status}</p>
      <p className="text-xs text-gray-600 mt-0.5">{d.count} order(s)</p>
    </div>
  );
}

/** Animated donut of orders by status with a readable legend beside/below it. */
export default function StatusDonutCard({ statusRows = [], total = 0 }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders by Status</CardTitle>
        <CardDescription>Current distribution of all orders</CardDescription>
      </CardHeader>
      <CardContent>
        {statusRows.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center">
            <p className="text-sm text-gray-500">No orders yet</p>
          </div>
        ) : (
          <>
            <div className="relative h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusRows}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={3}
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {statusRows.map(row => (
                      <Cell key={row.status} fill={row.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center total */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-semibold tracking-tight text-gray-900">{total}</span>
                <span className="text-[11px] text-gray-500">orders</span>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5">
              {statusRows.map(row => (
                <li key={row.status} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="text-gray-600 capitalize flex-1 truncate">{row.status.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-gray-900">{row.count}</span>
                  <span className="text-gray-500 w-10 text-right">
                    {total > 0 ? Math.round((row.count / total) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
