import { useState, useEffect } from 'react';
import {
  getInvoices,
  generateInvoice,
  generateMovementDoc,
  getMovementTypes,
  getInvoiceDownloadUrl,
  getAdminOrders,
  getInventoryMovements,
} from '../../api/adminApi';

/**
 * Invoice Template panel — lives in Settings -> Documents.
 * Generates .xlsx invoices from the admin-configured template
 * (company name, prefix, tax rate, footer, currency) and lists
 * generated files for download. Also generates movement documents
 * (Opening Balance, Receipt, Issue, Adjustment, Transfer, Return,
 * Damage, Inventory Count).
 */
export default function InvoiceTemplate() {
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Movement templates
  const [movementTypes, setMovementTypes] = useState([]);
  const [movements, setMovements] = useState([]);
  const [selectedMovement, setSelectedMovement] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [invRes, ordRes, typesRes, movRes] = await Promise.all([
        getInvoices().catch(() => ({ data: [] })),
        getAdminOrders({ limit: 50 }).catch(() => ({ data: [] })),
        getMovementTypes().catch(() => ({ data: [] })),
        getInventoryMovements({ limit: 30 }).catch(() => ({ data: [] })),
      ]);
      setInvoices(invRes.data || []);
      // /api/admin/orders returns { orders, total } — normalize both shapes
      const ordData = ordRes.data || {};
      setOrders(Array.isArray(ordData) ? ordData : ordData.orders || []);
      // /api/admin/inventory/movements returns { movements, total } — normalize
      const movData = movRes.data || {};
      setMovements(Array.isArray(movData) ? movData : movData.movements || []);
      setMovementTypes(typesRes.data || []);
    } catch (err) {
      console.error('Error loading invoices:', err);
    }
  }

  async function handleGenerate(fromOrder) {
    setGenerating(true);
    setError('');
    setSuccess('');
    try {
      const orderId = fromOrder ? Number(selectedOrder) : null;
      if (fromOrder && !orderId) {
        setError('Select an order first');
        setGenerating(false);
        return;
      }
      const res = await generateInvoice(orderId);
      setSuccess(`Invoice ${res.data.invoiceNumber} generated (${res.data.currency})`);
      setInvoices(await getInvoices().then(r => r.data || []));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate invoice');
    } finally {
      setGenerating(false);
    }
  }

  async function handleMovement(type) {
    setGenerating(true);
    setError('');
    setSuccess('');
    try {
      const movementId = selectedMovement ? Number(selectedMovement) : null;
      const res = await generateMovementDoc(type, movementId);
      setSuccess(`${res.data.docTitle} document ${res.data.docNumber} generated (${res.data.currency})`);
      setInvoices(await getInvoices().then(r => r.data || []));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate document');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Invoice Template (INV)</h2>
          <p className="text-xs text-gray-500 mt-1">
            Generates a styled <strong>.xlsx</strong> invoice using the settings above (company, prefix, tax, footer) and the
            currency from General. Opens in Excel.
          </p>
        </div>
        <button
          onClick={() => handleGenerate(false)}
          disabled={generating}
          className="px-3 py-2 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate Test Invoice'}
        </button>
      </div>

      <div className="mt-4 flex items-end gap-3 flex-wrap">
        <div className="min-w-56">
          <label className="block text-xs font-medium text-gray-600 mb-1">Generate from order (optional)</label>
          <select
            value={selectedOrder}
            onChange={e => setSelectedOrder(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">— Test invoice —</option>
            {orders.map(o => (
              <option key={o.id} value={o.id}>
                #{o.id} · {o.shipping_name || 'Customer'} · {(o.total / 100).toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => handleGenerate(true)}
          disabled={generating || !selectedOrder}
          className="px-4 py-2 text-sm bg-primary-600 rounded-lg text-white hover:bg-primary-700 font-medium disabled:opacity-40"
        >
          Generate Invoice
        </button>
      </div>

      {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {success && <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

      {/* ── Movement document templates ── */}
      <div className="mt-6 pt-5 border-t border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Movement Templates</h2>
        <p className="text-xs text-gray-500 mt-1">
          Excel documents for inventory operations. Uses the same company/footer/currency settings.
          Internal operations (reservation, release, correction) don't need paper documents.
        </p>

        <div className="mt-3 flex items-end gap-3 flex-wrap">
          <div className="min-w-72">
            <label className="block text-xs font-medium text-gray-600 mb-1">Use a real movement (optional — falls back to a test document)</label>
            <select
              value={selectedMovement}
              onChange={e => setSelectedMovement(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">— Test document —</option>
              {movements.map(m => (
                <option key={m.id} value={m.id}>
                  #{m.id} · {m.type} · {m.product_name || `Product #${m.product_id}`} · {m.qty_change > 0 ? '+' : ''}{m.qty_change}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {movementTypes.map(t => (
            <button
              key={t.type}
              onClick={() => handleMovement(t.type)}
              disabled={generating}
              className="px-3 py-2.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 disabled:opacity-50 transition-colors text-left"
            >
              <span className="block font-semibold">{t.label}</span>
              <span className="text-[10px] text-gray-400">{t.prefix}-XXXX.xlsx</span>
            </button>
          ))}
        </div>
      </div>

      {/* Generated invoices */}
      <div className="mt-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Generated Invoices</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-gray-400">No invoices generated yet.</p>
        ) : (
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
            {invoices.map(inv => (
              <div key={inv.filename} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{inv.filename}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(inv.created).toLocaleString()} · {(inv.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <a
                  href={getInvoiceDownloadUrl(inv.filename)}
                  className="ml-3 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shrink-0"
                >
                  Open / Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
