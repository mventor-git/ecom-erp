import { useState, useEffect } from 'react';
import DocumentViewer from '../components/DocumentViewer';
import {
  getPickingTasks, updatePickingStatus,
  getPackingTasks, getPackingStats, assignPackingTask, updatePackingStatus,
  getUsers, viewPickingSheetUrl,
} from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';
import { useLanguage } from '../../i18n';

const PICKING_STATUS = ['pending', 'in_progress', 'picked'];
const PACKING_STATUS = ['pending', 'in_progress', 'packed', 'problem', 'completed'];

// English labels for status slugs (translated at render via t()).
const STATUS_LABEL = {
  pending: 'Pending', in_progress: 'In progress', picked: 'Picked',
  packed: 'Packed', problem: 'Problem', completed: 'Completed',
};

const STATUS_STYLE = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  packed: 'bg-green-100 text-green-700',
  problem: 'bg-red-100 text-red-700',
  completed: 'bg-gray-200 text-gray-600',
  picked: 'bg-green-100 text-green-700',
};

export default function PickingDashboard() {
  const { format } = useAdminCurrency();
  const { t } = useLanguage();
  const [tab, setTab] = useState('picking');
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
        // picking list endpoint returns {items, pagination} (service shape);
        // packing/users return bare arrays — normalize so TaskList always gets an array.
        const pickD = pickRes.data;
        const packD = packRes.data;
        const userD = usersRes.data;
        setPickingTasks(Array.isArray(pickD) ? pickD : (pickD?.items || []));
        setPackingTasks(Array.isArray(packD) ? packD : (packD?.items || []));
        setStats(statsRes.data || {});
        setUsers(Array.isArray(userD) ? userD : []);
      })
      .catch(err => console.error('Error loading tasks:', err))
      .finally(() => setLoading(false));
  }

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handlePicking = async (task, status) => {
    try {
      await updatePickingStatus(task.id, status, notes[`p-${task.id}`] || '');
      flash(t('Picking task #{id} → {status}').replace('{id}', task.id).replace('{status}', t(STATUS_LABEL[status] || status)));
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || t('Failed to update'));
    }
  };

  const handlePacking = async (task, status) => {
    try {
      await updatePackingStatus(task.id, status, notes[`k-${task.id}`] || '');
      flash(t('Packing task #{id} → {status}').replace('{id}', task.id).replace('{status}', t(STATUS_LABEL[status] || status)));
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || t('Failed to update'));
    }
  };

  const handleAssign = async (task, assigneeId) => {
    try {
      await assignPackingTask(task.id, assigneeId);
      flash(t('Task #{id} assigned').replace('{id}', task.id));
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || t('Failed to assign'));
    }
  };

  const statusBadge = (s) => <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[s] || 'bg-gray-100 text-gray-600'}`}>{t(STATUS_LABEL[s] || s)}</span>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Picking & Packing')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Pending')} {stats.pending || 0} · {t('In progress')} {stats.in_progress || 0} · {t('Packed')} {stats.packed || 0} · {t('Problem')} {stats.problem || 0} · {t('Completed')} {stats.completed || 0}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTab('picking')} className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'picking' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            🏭 {t('Picking')}
          </button>
          <button onClick={() => setTab('packing')} className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'packing' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            📦 {t('Packing')}
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
          title={t('Picking Tasks')}
          empty={t('No picking tasks — confirmed orders create them when moved to Warehouse Picking')}
          notes={notes}
          setNotes={setNotes}
          noteKey={t => `p-${t.id}`}
          actions={(row) => (
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button onClick={() => setViewDoc({ url: viewPickingSheetUrl(row.order_id), title: `Picking Sheet #${row.order_id}` })} className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50">🖨 {t('Sheet')}</button>
              {row.status === 'pending' && <button onClick={() => handlePicking(row, 'in_progress')} className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('Start')}</button>}
              {row.status !== 'picked' && <button onClick={() => handlePicking(row, 'picked')} className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">{t('Picked ✓')}</button>}
            </div>
          )}
          statusBadge={statusBadge}
          format={format}
          tr={t}
        />
      ) : (
        <TaskList
          tasks={packingTasks}
          title={t('Packing Tasks')}
          empty={t('No packing tasks — they appear when orders reach the Packing stage')}
          notes={notes}
          setNotes={setNotes}
          noteKey={t => `k-${t.id}`}
          users={users}
          onAssign={handleAssign}
          actions={(row) => (
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <select
                value={row.assignee_id || ''}
                onChange={e => handleAssign(row, e.target.value ? parseInt(e.target.value) : null)}
                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">{t('Assign to…')}</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
              {row.status === 'pending' && <button onClick={() => handlePacking(row, 'in_progress')} className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('Start')}</button>}
              {['pending', 'in_progress'].includes(row.status) && <button onClick={() => handlePacking(row, 'packed')} className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">{t('Packed ✓')}</button>}
              {['pending', 'in_progress'].includes(row.status) && <button onClick={() => handlePacking(row, 'problem')} className="px-2.5 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">{t('Problem')}</button>}
              {row.status === 'packed' && <button onClick={() => handlePacking(row, 'completed')} className="px-2.5 py-1 text-xs bg-gray-700 text-white rounded-lg hover:bg-gray-800">{t('Complete')}</button>}
            </div>
          )}
          statusBadge={statusBadge}
          format={format}
          tr={t}
        />
      )}

      {viewDoc && <DocumentViewer url={viewDoc.url} title={viewDoc.title} onClose={() => setViewDoc(null)} />}
    </div>
  );
}

function TaskList({ tasks, title, empty, notes, setNotes, noteKey, actions, statusBadge, format, tr, users, onAssign }) {
  const list = Array.isArray(tasks) ? tasks : []; // never white-screen on a shape change
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">{title} ({list.length})</h2>
      </div>
      {list.length === 0 ? (
        <div className="p-12 text-center text-sm text-gray-400">{empty}</div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-[34rem] overflow-y-auto">
          {list.map(t => (
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
                      {tr('Assigned to: ')}{t.assignee_name || `User #${t.assignee_id}`}
                    </p>
                  )}
                  {t.notes && <p className="text-xs text-gray-500 mt-1 italic">{t.notes}</p>}
                </div>
                {actions(t)}
              </div>
              <input
                value={notes[noteKey(t)] || ''}
                onChange={e => setNotes(prev => ({ ...prev, [noteKey(t)]: e.target.value }))}
                placeholder={tr('Note (optional)')}
                className="mt-2 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
