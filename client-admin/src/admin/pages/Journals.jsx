import { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import {
  getJournals, getAccounts, createJournal, updateJournal, deleteJournalDraft,
  postJournal, unpostJournal, getJournal, getJournalTimeline,
} from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';
import { centsToEGPInput, egpToCents } from '../../utils/money';

// mventor-ticket-092 — journals: the one ledger model. Manual entries start
// as DRAFTS here and become books only through /post (server re-validates
// balance, accounts, cents, and the fail-closed period gate). SOURCE journals
// (purchases, supplier payments, sales settlements) are shown for what they
// are: machine-owned, immutable history — the UI offers no mutation because
// the server refuses one.

const SOURCE_LABEL = { order: 'sales bridge', inventory_movement: 'inventory bridges (receipts/stock)', supplier_payment: 'supplier payments' };

function emptyLine() { return { account_id: '', debitEGP: '', creditEGP: '', description: '' }; }

export default function Journals() {
  const { format } = useAdminCurrency();
  const [filters, setFilters] = useState({ from: '', to: '', status: '', source: '', account: '', q: '' });
  const [page, setPage] = useState({ rows: [], total: 0 });
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null); // {id?, entry_date, description, lines[], busy, err}
  const [detail, setDetail] = useState(null); // { entry, events }
  const LIMIT = 25;

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit: LIMIT, offset, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')) };
    getJournals(params)
      .then((res) => { setPage(res.data.data || { rows: [], total: 0 }); setError(''); })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load journals'))
      .finally(() => setLoading(false));
  }, [filters, offset]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getAccounts().then((r) => setAccounts(r.data.data || [])).catch(() => {}); }, []);

  const openCreate = () => setEditor({ entry_date: '', description: '', lines: [emptyLine(), emptyLine()], busy: false, err: '' });
  const openEdit = async (row) => {
    try {
      const res = await getJournal(row.id);
      const e = res.data.data;
      setEditor({
        id: e.id, entry_date: e.entry_date, description: e.description || '', busy: false, err: '',
        lines: e.lines.map((l) => ({ account_id: String(l.account_id), debitEGP: centsToEGPInput(l.debit), creditEGP: centsToEGPInput(l.credit), description: l.description || '' })),
      });
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
  };
  const openDetail = async (row) => {
    try {
      const [entryRes, timelineRes] = await Promise.all([getJournal(row.id), getJournalTimeline(row.id).catch(() => null)]);
      setDetail({ entry: entryRes.data.data, events: timelineRes?.data?.data || [] });
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
  };

  const setLine = (i, patch) => setEditor((ed) => ({ ...ed, lines: ed.lines.map((l, ix) => (ix === i ? { ...l, ...patch } : l)) }));
  const addLine = () => setEditor((ed) => ({ ...ed, lines: [...ed.lines, emptyLine()] }));
  const removeLine = (i) => setEditor((ed) => ({ ...ed, lines: ed.lines.filter((_, ix) => ix !== i) }));

  const toCents = (v) => { const c = egpToCents(v); return typeof c === 'number' && Number.isInteger(c) ? c : null; };
  const editorTotals = (() => {
    if (!editor) return null;
    let d = 0; let c = 0; let bad = false;
    for (const l of editor.lines) {
      if (l.debitEGP !== '') { const v = toCents(l.debitEGP); if (v === null) bad = true; d += v || 0; }
      if (l.creditEGP !== '') { const v = toCents(l.creditEGP); if (v === null) bad = true; c += v || 0; }
    }
    return { d, c, bad, diff: d - c };
  })();

  const save = async (andPost) => {
    const lines = editor.lines
      .filter((l) => l.account_id && (l.debitEGP !== '' || l.creditEGP !== ''))
      .map((l) => ({
        account_id: parseInt(l.account_id, 10),
        debit: l.debitEGP === '' ? 0 : toCents(l.debitEGP),
        credit: l.creditEGP === '' ? 0 : toCents(l.creditEGP),
        description: l.description || '',
      }));
    setEditor((ed) => ({ ...ed, busy: true, err: '' }));
    try {
      const body = { entry_date: editor.entry_date || undefined, description: editor.description, lines };
      let id = editor.id;
      if (id) await updateJournal(id, body); else { const res = await createJournal(body); id = res.data.data.id; }
      if (andPost) await postJournal(id);
      setEditor(null);
      load();
    } catch (err) {
      setEditor((ed) => ({ ...ed, busy: false, err: err.response?.data?.error || 'Save failed' }));
    }
  };

  const act = async (fn, okMsg) => {
    setError('');
    try { await fn(); if (okMsg) { setDetail(null); } load(); }
    catch (err) { setError(err.response?.data?.error || 'Action failed'); load(); }
  };

  const columns = [
    { key: 'entry_no', label: 'Entry', render: (r) => <button onClick={() => openDetail(r)} className="font-mono text-xs font-semibold text-primary-700 hover:underline">{r.entry_no}</button> },
    { key: 'entry_date', label: 'Date', render: (r) => <span className="text-xs text-gray-600">{r.entry_date}</span> },
    { key: 'status', label: 'Status', align: 'center', render: (r) => (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.status}</span>
    ) },
    { key: 'source', label: 'Source', render: (r) => (
      r.source_type
        ? <span className="text-xs text-gray-500" title="Machine-owned, immutable — corrections happen through its own flow">{SOURCE_LABEL[r.source_type] || r.source_type} · #{r.source_id}<span className="text-gray-300"> · {r.source_event}</span></span>
        : <span className="text-xs text-blue-600">manual</span>
    ) },
    { key: 'description', label: 'Description', render: (r) => <span className="text-sm text-gray-700 line-clamp-1">{r.description || '—'}</span> },
    { key: 'total_cents', label: 'Total', align: 'right', render: (r) => <span className="text-sm font-medium">{format(r.total_cents || 0)}</span> },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex items-center justify-end gap-1.5">
        {r.status === 'draft' && !r.source_type && (
          <>
            <button onClick={() => act(() => postJournal(r.id))} className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Post</button>
            <button onClick={() => openEdit(r)} className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Edit</button>
            <button onClick={() => { if (window.confirm('Discard this draft journal?')) act(() => deleteJournalDraft(r.id)); }}
              className="px-2.5 py-1 text-xs bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Discard</button>
          </>
        )}
        {r.status === 'posted' && !r.source_type && (
          <button onClick={() => { if (window.confirm('Unpost returns this manual journal to draft and REMOVES it from the books (period-locked; audited).')) act(() => unpostJournal(r.id)); }}
            className="px-2.5 py-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100">Unpost</button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journals</h1>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">Every posting lives here — manual drafts you author, and machine journals from the purchase, supplier-payment and sales-settlement bridges. Posted sourced journals are immutable; corrections are new reversing entries.</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">+ New entry</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-gray-600">From<input type="date" value={filters.from} onChange={(e) => { setFilters((f) => ({ ...f, from: e.target.value })); setOffset(0); }} className="ml-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></label>
        <label className="text-xs text-gray-600">To<input type="date" value={filters.to} onChange={(e) => { setFilters((f) => ({ ...f, to: e.target.value })); setOffset(0); }} className="ml-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></label>
        <label className="text-xs text-gray-600">Status
          <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setOffset(0); }} className="ml-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
            <option value="">any</option><option value="draft">draft</option><option value="posted">posted</option>
          </select>
        </label>
        <label className="text-xs text-gray-600">Origin
          <select value={filters.source} onChange={(e) => { setFilters((f) => ({ ...f, source: e.target.value })); setOffset(0); }} className="ml-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
            <option value="">any</option><option value="manual">manual</option><option value="order">sales bridge</option><option value="inventory_movement">stock bridges</option><option value="supplier_payment">supplier payment</option>
          </select>
        </label>
        <label className="text-xs text-gray-600">Account
          <select value={filters.account} onChange={(e) => { setFilters((f) => ({ ...f, account: e.target.value })); setOffset(0); }} className="ml-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white max-w-[10rem]">
            <option value="">any</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600 flex-1 min-w-[10rem]">Search
          <input value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setOffset(0); }} placeholder="entry no / description" className="ml-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-48" />
        </label>
      </div>

      {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">{error}</div>}

      <div className="flex gap-3 flex-wrap mb-5">
        <StatCard label="Matching journals" value={String(page.total || 0)} tone="primary" icon="clipboard" />
      </div>

      <DataTable columns={columns} data={page.rows} loading={loading} emptyMessage="No journals match" keyField="id" />
      <div className="flex justify-end gap-2 mt-3">
        <button disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - LIMIT))} className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">← Prev</button>
        <span className="px-3 py-1.5 text-sm text-gray-500">{offset + 1}–{Math.min(offset + LIMIT, page.total)} of {page.total}</span>
        <button disabled={offset + LIMIT >= page.total} onClick={() => setOffset((o) => o + LIMIT)} className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">Next →</button>
      </div>

      {/* Editor (manual draft authoring — amounts in EGP, cents enforced server-side) */}
      {editor && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" role="presentation">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto p-6" role="dialog" aria-modal="true">
            <h3 className="text-lg font-bold text-gray-900">{editor.id ? 'Edit draft journal' : 'New manual journal'}</h3>
            <p className="text-xs text-gray-500 mt-1">Drafts touch nothing until POSTED; posting re-validates balance, accounts, cents and the period lock on the server.</p>
            <div className="mt-3 flex gap-3">
              <label className="text-sm text-gray-700 flex-1">Entry date
                <input type="date" value={editor.entry_date} onChange={(e) => setEditor((ed) => ({ ...ed, entry_date: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="text-sm text-gray-700 flex-[2]">Description
                <input value={editor.description} maxLength={255} onChange={(e) => setEditor((ed) => ({ ...ed, description: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </label>
            </div>
            <table className="w-full mt-4 text-sm">
              <thead><tr className="text-left text-xs font-semibold text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-2">Account</th><th className="py-2 pr-2 w-28">Debit (EGP)</th><th className="py-2 pr-2 w-28">Credit (EGP)</th><th className="py-2 pr-2">Line note</th><th />
              </tr></thead>
              <tbody>
                {editor.lines.map((l, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 pr-2">
                      <select value={l.account_id} onChange={(e) => setLine(i, { account_id: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                        <option value="">—</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2"><input value={l.debitEGP} onChange={(e) => setLine(i, { debitEGP: e.target.value, creditEGP: '' })} placeholder="0" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></td>
                    <td className="py-1.5 pr-2"><input value={l.creditEGP} onChange={(e) => setLine(i, { creditEGP: e.target.value, debitEGP: '' })} placeholder="0" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></td>
                    <td className="py-1.5 pr-2"><input value={l.description} maxLength={200} onChange={(e) => setLine(i, { description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></td>
                    <td className="py-1.5">{editor.lines.length > 2 && <button onClick={() => removeLine(i)} className="text-xs text-red-500 hover:underline">✕</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex items-center justify-between">
              <button onClick={addLine} className="text-sm text-primary-700 hover:underline">+ Add line</button>
              {editorTotals && (
                <span className={`text-sm font-medium ${editorTotals.bad ? 'text-red-600' : editorTotals.diff === 0 && editorTotals.d > 0 ? 'text-green-700' : 'text-amber-600'}`}>
                  Dr {format(editorTotals.d)} · Cr {format(editorTotals.c)} {editorTotals.bad ? '(invalid amounts)' : editorTotals.diff === 0 && editorTotals.d > 0 ? '— balanced ✓' : `— out of balance by ${format(Math.abs(editorTotals.diff))}`}
                </span>
              )}
            </div>
            {editor.err && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{editor.err}</div>}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setEditor(null)} disabled={editor.busy} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={() => save(false)} disabled={editor.busy} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">{editor.id ? 'Save draft' : 'Create draft'}</button>
              <button onClick={() => save(true)} disabled={editor.busy || (editorTotals && (editorTotals.bad || editorTotals.diff !== 0 || editorTotals.d <= 0))}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">{editor.busy ? '…' : 'Save & post'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail + audit timeline */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" role="presentation">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-auto p-6" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 font-mono">{detail.entry.entry_no} <span className="font-sans text-sm font-normal text-gray-500">· {detail.entry.entry_date} · {detail.entry.status}</span></h3>
              <button onClick={() => setDetail(null)} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">Close</button>
            </div>
            {detail.entry.description && <p className="mt-1 text-sm text-gray-600">{detail.entry.description}</p>}
            <p className="mt-1 text-xs text-gray-500">
              {detail.entry.source_type
                ? <>Machine journal: <b>{SOURCE_LABEL[detail.entry.source_type] || detail.entry.source_type}</b> #{detail.entry.source_id} · {detail.entry.source_event} — immutable; correct through its own flow.</>
                : <>Manual entry{detail.entry.posted_by ? ` posted by ${detail.entry.posted_by}` : ''}.</>}
            </p>
            <table className="w-full mt-4 text-sm">
              <thead><tr className="text-left text-xs font-semibold text-gray-500 border-b border-gray-200">
                <th className="py-2">Account</th><th className="py-2 text-end">Debit</th><th className="py-2 text-end">Credit</th><th className="py-2">Note</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {(detail.entry.lines || []).map((l, i) => (
                  <tr key={i}>
                    <td className="py-1.5"><span className="font-mono text-xs">{l.account_code}</span> {l.account_name}</td>
                    <td className="py-1.5 text-end">{l.debit ? format(l.debit) : '—'}</td>
                    <td className="py-1.5 text-end">{l.credit ? format(l.credit) : '—'}</td>
                    <td className="py-1.5 text-xs text-gray-500">{l.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.events.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Audit trail</div>
                <div className="space-y-1.5">
                  {detail.events.slice().reverse().map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 text-xs text-gray-600">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 font-medium">{ev.event_type.replace(/_/g, ' ')}</span>
                      <span className="text-gray-400">{new Date(ev.created_at).toLocaleString('en-GB')}</span>
                      <span className="text-gray-400">{ev.user_id || 'system'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detail.entry.status === 'posted' && !detail.entry.source_type && (
              <div className="mt-4 flex justify-end">
                <button onClick={() => { if (window.confirm('Unpost back to draft? The entry leaves the books immediately (audited; period-locked).')) act(() => unpostJournal(detail.entry.id), true); }}
                  className="px-4 py-2 text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100">Unpost (manual journal)</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
