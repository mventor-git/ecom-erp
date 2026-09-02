import { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

const AXIS_TICK = { fontSize: 11, fill: '#78716c' };

function shortDay(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function TooltipBox({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-gray-900">{payload[0].payload.day}</p>
      <p className="text-xs text-gray-600 mt-0.5">{payload[0].payload.display}</p>
    </div>
  );
}

/**
 * Animated sales area chart (revenue or orders view).
 * Shared by the dashboard trend card and the Revenue detail page.
 * Animations: ease-out draw-in on mount + on every data change.
 */
export default function SalesChart({ series = [], metric = 'revenue', height = 260 }) {
  const data = useMemo(() => series.map(p => ({
    day: shortDay(p.day),
    display: metric === 'revenue'
      ? `Revenue: ${(p.revenue / 100).toLocaleString('en-EG', { minimumFractionDigits: 2 })} EGP`
      : `Orders: ${p.orders}`,
    value: metric === 'revenue' ? p.revenue / 100 : p.orders,
  })), [series, metric]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="tealFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f857a" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#1f857a" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
        <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={6} />
        <YAxis
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={v => (metric === 'revenue' ? `${(v / 1000).toFixed(v >= 1000 ? 0 : 1)}k` : v)}
        />
        <Tooltip content={<TooltipBox />} cursor={{ stroke: '#d6d3d1', strokeDasharray: '4 4' }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#1f857a"
          strokeWidth={2}
          fill="url(#tealFill)"
          dot={false}
          activeDot={{ r: 4, fill: '#1f857a', stroke: '#fff', strokeWidth: 2 }}
          isAnimationActive
          animationDuration={900}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
