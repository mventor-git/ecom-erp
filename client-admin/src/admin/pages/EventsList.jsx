import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import { getEvents, getEventCounts } from '../../api/adminApi';

const EVENT_TYPE_COLORS = {
  'product.created': 'bg-green-100 text-green-700',
  'product.updated': 'bg-blue-100 text-blue-700',
  'product.deleted': 'bg-red-100 text-red-700',
  'order.created': 'bg-green-100 text-green-700',
  'order.status_changed': 'bg-blue-100 text-blue-700',
  'inventory.movement': 'bg-purple-100 text-purple-700',
  'po.created': 'bg-indigo-100 text-indigo-700',
  'po.sent': 'bg-blue-100 text-blue-700',
  'po.confirmed': 'bg-green-100 text-green-700',
  'po.received': 'bg-green-100 text-green-700',
  'po.cancelled': 'bg-red-100 text-red-700',
  'supplier.created': 'bg-green-100 text-green-700',
  'supplier.updated': 'bg-blue-100 text-blue-700',
  'user.created': 'bg-green-100 text-green-700',
  'user.updated': 'bg-blue-100 text-blue-700',
  'settings.updated': 'bg-yellow-100 text-yellow-700',
};

export default function EventsList() {
  const [events, setEvents] = useState([]);
  const [counts, setCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ event_type: '', entity_type: '', limit: 50 });
  const [page, setPage] = useState(0);

  useEffect(() => { loadEvents(); }, [filter, page]);
  useEffect(() => { loadCounts(); }, []);

  function loadEvents() {
    setLoading(true);
    const params = { limit: filter.limit, offset: page * filter.limit };
    if (filter.event_type) params.event_type = filter.event_type;
    if (filter.entity_type) params.entity_type = filter.entity_type;

    getEvents(params)
      .then(res => setEvents(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function loadCounts() {
    getEventCounts()
      .then(res => setCounts(res.data || []))
      .catch(() => {});
  }

  const totalEvents = counts.reduce((sum, c) => sum + (c.count || 0), 0);

  const columns = [
    { key: 'created_at', label: 'Time', render: (row) => (
      <span className="text-xs text-gray-500">{new Date(row.created_at).toLocaleString()}</span>
    )},
    { key: 'event_type', label: 'Event', render: (row) => (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_TYPE_COLORS[row.event_type] || 'bg-gray-100 text-gray-700'}`}>
        {row.event_type}
      </span>
    )},
    { key: 'entity_type', label: 'Entity', render: (row) => (
      <span className="text-xs font-mono text-gray-600">{row.entity_type}#{row.entity_id}</span>
    )},
    { key: 'user_id', label: 'User', render: (row) => row.user_id || 'system' },
    { key: 'payload', label: 'Details', render: (row) => {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload || '{}') : (row.payload || {});
      const summary = Object.entries(payload).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ');
      return <span className="text-xs text-gray-500 truncate max-w-xs block">{summary || '—'}</span>;
    }},
  ];

  const eventTypes = counts.map(c => c.event_type).sort();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events & Audit Trail</h1>
          <p className="text-sm text-gray-500 mt-1">{totalEvents.toLocaleString()} events recorded</p>
        </div>
      </div>

      {/* Event Type Summary */}
      {eventTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setFilter({...filter, event_type: ''})}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!filter.event_type ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All ({totalEvents})
          </button>
          {counts.map(countItem => (
            <button key={countItem.event_type} onClick={() => setFilter({...filter, event_type: countItem.event_type})}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter.event_type === countItem.event_type ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {countItem.event_type} ({countItem.count})
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select value={filter.entity_type} onChange={e => { setFilter({...filter, entity_type: e.target.value}); setPage(0); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2">
          <option value="">All Entities</option>
          <option value="product">Products</option>
          <option value="order">Orders</option>
          <option value="purchase_order">Purchase Orders</option>
          <option value="supplier">Suppliers</option>
          <option value="user">Users</option>
          <option value="warehouse">Warehouses</option>
          <option value="inventory">Inventory</option>
          <option value="settings">Settings</option>
        </select>
        <select value={filter.limit} onChange={e => { setFilter({...filter, limit: parseInt(e.target.value)}); setPage(0); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2">
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>

      <DataTable columns={columns} data={events} loading={loading} emptyMessage="No events found" />

      {/* Pagination */}
      {events.length >= filter.limit && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg disabled:opacity-50">Previous</button>
          <span className="px-4 py-2 text-sm text-gray-500">Page {page + 1}</span>
          <button onClick={() => setPage(page + 1)}
            className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg">Next</button>
        </div>
      )}
    </div>
  );
}
