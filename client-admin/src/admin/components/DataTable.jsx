import { useMemo, useState } from 'react';
import { useLanguage } from '../../i18n';

/**
 * Shared table primitive used across the ERP (16+ pages).
 *
 * Upgraded (additive only — existing consumers are unchanged):
 *   - column-aware loading skeleton (renders the real header + pulse cells)
 *   - `error` prop → explicit error state (no more blank tables)
 *   - `stickyHeader` + `maxHeight` → thead sticks to the top of a scroll container
 *   - opt-in client-side sorting on columns marked `sortable: true`
 *   - `scope="col"` on headers; logical `text-end` for right-aligned columns (RTL-safe)
 */
export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  error,
  emptyMessage = 'No data found.',
  emptyAction,
  onRowClick,
  keyField = 'id',
  stickyHeader = true,
  maxHeight,        // e.g. '64vh' — when set the body scrolls and the header sticks
  sortable = false, // master switch; individual columns opt in with `sortable: true`
}) {
  const { t } = useLanguage();
  const [sort, setSort] = useState(null); // { key, dir }

  const cycleSort = (key) => {
    setSort(s => (s && s.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));
  };

  const sorted = useMemo(() => {
    if (!sortable || !sort || !data) return data;
    const col = columns.find(c => c.key === sort.key);
    if (!col || !col.sortable) return data;
    const get = c => (col.sortValue ? col.sortValue(c) : c[col.key]);
    return [...data].sort((a, b) => {
      const av = get(a), bv = get(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [data, sort, sortable, columns]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {columns.map((col, i) => (
                  <th key={col.key || i} className="text-start px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-gray-600">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[0, 1, 2, 3].map(r => (
                <tr key={r}>
                  {columns.map((col, i) => (
                    <td key={col.key || i} className="px-4 sm:px-6 py-3 sm:py-4">
                      <div className="h-5 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
        <p className="text-sm text-red-700">{error}</p>
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="text-gray-500">{t(emptyMessage)}</p>
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className={`overflow-x-auto ${maxHeight ? 'overflow-y-auto' : ''}`} style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col, i) => (
                <th
                  key={col.key || i}
                  scope="col"
                  onClick={sortable && col.sortable ? () => cycleSort(col.key) : undefined}
                  className={`text-start px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-gray-600 ${
                    col.align === 'right' ? 'text-end' : ''
                  } ${col.className || ''} ${stickyHeader ? 'sticky top-0 z-10 bg-gray-50' : ''} ${
                    sortable && col.sortable ? 'cursor-pointer select-none' : ''
                  }`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                  {sortable && col.sortable && sort?.key === col.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((row, ri) => (
              <tr
                key={row[keyField] || ri}
                className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col, ci) => (
                  <td
                    key={col.key || ci}
                    className={`px-4 sm:px-6 py-3 sm:py-4 text-sm ${
                      col.align === 'right' ? 'text-end' : ''
                    } ${col.cellClass || ''}`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
