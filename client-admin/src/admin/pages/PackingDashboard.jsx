import { useState, useEffect } from 'react';
import { ClipboardList, Package, Printer, Check } from 'lucide-react';
import DocumentViewer from '../components/DocumentViewer';
import {
  getPickingTasks, updatePickingStatus,
  getPackingTasks, getPackingStats, assignPackingTask, updatePackingStatus,
  getUsers, viewPickingSheetUrl, viewPackingSheetUrl,
} from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';

const PICKING_STATUS = ['pending', 'in_progress', 'picked'];
const PACKING_STATUS = ['pending', 'in_progress', 'packed', 'problem', 'completed'];

const STATUS_STYLE = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  packed: 'bg-green-100 text-green-700',
  problem: 'bg-red-100 text-red-700',
  completed: 'bg-gray-200 text-gray-600',
  picked: 'bg-green-100 text-green-700',
};

export default function PackingDashboard() {
  const { format } = useAdminCurrency();
  const [tab, setTab] = useState('packing');
  const [pickingTasks, setPickingTasks] = useState([]);
  const [packingTasks, setPackingTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [viewDoc, setViewDoc] = useState(null);
  const [notes, setNotes] = useState({});

  useEffect(() => { loadAll(); }, [tab]);

  function loadAll() {
    setLoading(true);
    setError('');
    const picking = tab === 'picking' ? getPickingTasks().catch(() => ({ data: [] })) : Promise.resolve({ data: [] });
    Promise.all([
      picking,
      getPackingTasks().catch(() => ({ data: [] })),
      getPackingStats().catch(() => ({ data: {} })),
      getUsers().catch(() => ({ data: [] })),
    ])
      .then(([pickRes, packRes, statsRes, usersRes]) => {
        setPickingTasks(pickRes.data || []);
        setPackingTasks(packRes.data || []);
        setStats(statsRes.data || {});
        setUsers(usersRes.data || []);
      })
      .catch(err => console.error('Error loading tasks:', err))
      .finally(() => setLoading(false));
  }

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handlePicking = async (task, status) => {
    try {
      await updatePickingStatus(task.id, status, notes[`p-${task.id}`] || '');
      flash(`Picking task #${task.id} → ${status}`);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
    }
  };

  const handlePacking = async (task, status) => {
    try {
      await updatePackingStatus(task.id, status, notes[`k-${task.id}`] || '');
      flash(`Packing task #${task.id} → ${status}`);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
    }
  };

  const handleAssign = async (task, assigneeId) => {
    try {
      await assignPackingTask(task.id, assigneeId);
      flash(`Task #${task.id} assigned`);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign');
    }
  };

  const statusBadge = (s) => <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[s] || 'bg-gray-100 text-gray-600'}`}>{s.replace(/_/g, ' ')}</span>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Picking & Packing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pending {stats.pending || 0} · In progress {stats.in_progress || 0} · Packed {stats.packed || 0} · Problem {stats.problem || 0} · Completed {stats.completed || 0}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTab('picking')} className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'picking' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            <ClipboardList className="w-4 h-4 inline" /> Picking
          </button>
          <button onClick={() => setTab('packing')} className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'packing' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            <Package className="w-4 h-4 inline" /> Packing
          </button>
        </div>
      </div>

      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{msg}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : tab === 'picking' ? (
        <TaskList
          tasks={pickingTasks}
          title="Picking Tasks"
          empty="No picking tasks — confirmed orders create them when moved to Warehouse Picking"
          notes={notes}
          setNotes={setNotes}
          noteKey={t => `p-${t.id}`}
          actions={(t) => (
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button onClick={() => setViewDoc({ url: viewPickingSheetUrl(t.order_id), title: `Picking Sheet #${t.order_id}` })} className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50"><Printer className="w-3 h-3 inline" /> Sheet</button>
              {t.status === 'pending' && <button onClick={() => handlePicking(t, 'in_progress')} className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Start</button>}
              {t.status !== 'picked' && <button onClick={() => handlePicking(t, 'picked')} className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Picked <Check className="w-3 h-3 inline" /></button>}
            </div>
          )}
          statusBadge={statusBadge}
          format={format}
        />
      ) : (
        <TaskList
          tasks={packingTasks}
          title="Packing Tasks"
          empty="No packing tasks — they appear when orders reach the Packing stage"
          notes={notes}
          setNotes={setNotes}
          noteKey={t => `k-${t.id}`}
          users={users}
          onAssign={handleAssign}
          actions={(t) => (
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <select
                value={t.assignee_id || ''}
                onChange={e => handleAssign(t, e.target.value ? parseInt(e.target.value) : null)}
                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">Assign to…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
              <button onClick={() => setViewDoc({ url: viewPackingSheetUrl(t.order_id), title: `Packing Sheet #${t.order_id}` })} className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50"><Printer className="w-3 h-3 inline" /> Sheet</button>
              {t.status === 'pending' && <button onClick={() => handlePacking(t, 'in_progress')} className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Start</button>}
              {['in_progress', 'problem'].includes(t.status) && <button onClick={() => handlePacking(t, 'packed')} className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Packed <Check className="w-3 h-3 inline" /></button>}
              {t.status === 'in_progress' && <button onClick={() => handlePacking(t, 'problem')} className="px-2.5 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">Problem</button>}
              {t.status === 'packed' && <button onClick={() => handlePacking(t, 'completed')} className="px-2.5 py-1 text-xs bg-gray-700 text-white rounded-lg hover:bg-gray-800">Complete</button>}
            </div>
          )}
          statusBadge={statusBadge}
          format={format}
        />
      )}

      {viewDoc && <DocumentViewer url={viewDoc.url} title={viewDoc.title} onClose={() => setViewDoc(null)} />}
    </div>
  );
}

function TaskList({ tasks, title, empty, notes, setNotes, noteKey, actions, statusBadge, format, users, onAssign }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">{title} ({tasks.length})</h2>
      </div>
      {tasks.length === 0 ? (
        <div className="p-12 text-center text-sm text-gray-400">{empty}</div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-[34rem] overflow-y-auto">
          {tasks.map(t => (
            <div key={t.id} className="px-5 py-3.5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">Task #{t.id} · Order #{t.order_id}</span>
                    {statusBadge(t.status)}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.customer_name || '—'} · {format(t.total || 0)} · {new Date(t.created_at).toLocaleString('en-GB')}
                  </p>
                  {t.assignee_id && (
                    <p className="text-xs text-primary-600 mt-0.5">
                      Assigned to: {t.assignee_name || `User #${t.assignee_id}`}
                    </p>
                  )}
                  {t.notes && <p className="text-xs text-gray-500 mt-1 italic">{t.notes}</p>}
                </div>
                {actions(t)}
              </div>
              <input
                value={notes[noteKey(t)] || ''}
                onChange={e => setNotes(prev => ({ ...prev, [noteKey(t)]: e.target.value }))}
                placeholder="Note (optional)"
                className="mt-2 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
