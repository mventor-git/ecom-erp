/**
 * Supplier Detail — the operational view of one vendor (mventor supplier UI).
 *
 * Purely a READ surface over the existing, server-authoritative endpoints:
 *   GET  /api/admin/suppliers/:id         (identity)
 *   GET  /api/admin/suppliers/:id/products (current sourced products + unit cost)
 *   GET  /api/admin/suppliers/:id/history (REAL purchase-order cost history)
 *
 * No server-side calculation is duplicated in React. The page lets an operator
 * see who the supplier is, which products they supply at what cost, and the
 * historical cost trail that drives LATEST / HIGHEST / FIFO. Money is read from
 * the database in INTEGER cents and formatted with the shared currency helper.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  getSupplier, getSupplierProducts, getSupplierHistory, deleteSupplier,
} from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';
import { useLanguage } from '../../i18n';

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { format } = useAdminCurrency();

  const [supplier, setSupplier] = useState(null);
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      getSupplier(id),
      getSupplierProducts(id).catch(() => ({ data: [] })),
      getSupplierHistory(id).catch(() => ({ data: null })),
    ])
      .then(([supRes, prodRes, histRes]) => {
        setSupplier(supRes.data);
        setProducts(prodRes.data || []);
        setHistory(histRes.data);
      })
      .catch(err => setError(err.response?.data?.error || t('Failed to load supplier')))
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => { load(); }, [load]);

  // Merge live product_suppliers rows with their cost-history summary so the
  // current / latest / highest story sits on one line. All costs are INTEGER cents.
  const costsMap = new Map((history?.productCosts || []).map(pc => [pc.product_id, pc]));
  const productRows = products.map(p => {
    const pc = costsMap.get(p.product_id);
    return { ...p, latest: pc?.latest, highest: pc?.highest };
  });

  const handleDeactivate = () => {
    setDeactivating(true);
    deleteSupplier(id)
      .then(() => navigate('/erp/suppliers'))
      .catch(err => { setError(err.response?.data?.error || t('Failed to deactivate')); setConfirmDeactivate(false); })
      .finally(() => setDeactivating(false));
  };

  const productColumns = [
    { key: 'product_name', label: t('Product'), render: (r) => (
      <div>
        <span className="font-medium text-gray-900">{r.product_name || `#${r.product_id}`}</span>
        <span className="hidden sm:inline text-xs text-gray-400 ms-2">#{r.product_id}</span>
      </div>
    )},
    { key: 'is_preferred', label: t('Preferred'), align: 'center', render: (r) => r.is_preferred ? (
      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">★ {t('Yes')}</span>
    ) : <span className="text-gray-300">—</span>},
    { key: 'unit_cost', label: t('Current Cost'), align: 'end', render: (r) => r.unit_cost != null ? format(r.unit_cost) : '—' },
    { key: 'latest', label: t('Latest Cost'), align: 'end', render: (r) => r.latest != null ? format(r.latest) : '—' },
    { key: 'highest', label: t('Highest Cost'), align: 'end', render: (r) => r.highest != null ? format(r.highest) : '—' },
  ];

  const purchaseColumns = [
    { key: 'date', label: t('Date'), render: (r) => String(r.date || '').slice(0, 10) || '—' },
    { key: 'source', label: t('Source'), render: (r) => (
      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-semibold ${r.source === 'supply_order' ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>
        {r.source === 'supply_order' ? t('Supply') : t('Purchase Order')}
      </span>
    )},
    { key: 'product_name', label: t('Product'), render: (r) => r.product_name || `#${r.product_id}` },
    { key: 'qty', label: t('Qty'), align: 'center' },
    { key: 'unit_cost', label: t('Unit Cost'), align: 'end', render: (r) => format(r.unit_cost) },
    { key: 'reference', label: t('Reference'), render: (r) => r.reference || '—' },
  ];

  const perProduct = (history?.productCosts || []).map(pc => ({
    ...pc,
    costsText: pc.costs.length ? pc.costs.map(c => format(c)).join(' · ') : '—',
  }));

  return (
    <div>
      <button
        onClick={() => navigate('/erp/suppliers')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-700 mb-4 font-medium"
      >
        <span className="text-lg leading-none">‹</span> {t('Back to Suppliers')}
      </button>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{supplier?.name || t('Loading…')}</h1>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${supplier?.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {supplier?.is_active ? t('Active') : t('Inactive')}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {supplier ? `${t('Supplies')} ${supplier.product_count || 0} ${t('product(s)')}` : ''}
            </p>
          </div>
          {supplier?.is_active !== 0 && (
            <button onClick={() => setConfirmDeactivate(true)} className="px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium">
              {t('Deactivate')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <Info label={t('Contact')} value={supplier?.contact_name || '—'} />
          <Info label={t('Email')} value={supplier?.email || '—'} />
          <Info label={t('Phone')} value={supplier?.phone || '—'} />
          <Info label={t('Lead Time')} value={supplier?.lead_time_days ? `${supplier.lead_time_days} ${t('days')}` : '—'} />
          <Info label={t('Address')} value={supplier?.address || '—'} span2 />
          <Info label={t('Notes')} value={supplier?.notes || '—'} span2 wide />
        </div>
      </div>

      <Section title={t('Products Supplied')}>
        <DataTable
          columns={productColumns}
          data={productRows}
          loading={loading}
          emptyMessage={t('No products linked to this supplier')}
        />
      </Section>

      <Section title={t('Procurement History')}>
        <DataTable
          columns={purchaseColumns}
          data={history?.entries || history?.purchases || []}
          loading={loading}
          emptyMessage={t('No procurement history yet')}
        />
      </Section>

      <Section title={t('Cost History by Product')}>
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-gray-400">{t('Loading…')}</p>
          ) : perProduct.length === 0 ? (
            <p className="text-sm text-gray-400">{t('No cost history yet')}</p>
          ) : (
            perProduct.map(pc => (
              <div key={pc.product_id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-gray-900">{pc.product_name || `#${pc.product_id}`}</span>
                    <span className="text-xs text-gray-400 ms-2">{t('Total units')} {pc.units}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Pill label={t('Latest')} value={pc.latest != null ? format(pc.latest) : '—'} />
                    <Pill label={t('Highest')} value={pc.highest != null ? format(pc.highest) : '—'} />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">{t('History')}: {pc.costsText}</p>
              </div>
            ))
          )}
        </div>
      </Section>

      <ConfirmDialog
        open={confirmDeactivate}
        title={t('Deactivate supplier?')}
        message={t('This supplier will be deactivated. Historical purchase costs and records are preserved.')}
        confirmLabel={deactivating ? t('Deactivating…') : t('Deactivate')}
        tone="danger"
        onConfirm={handleDeactivate}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </div>
  );
}

function Info({ label, value, span2, wide }) {
  return (
    <div className={`${span2 ? 'sm:col-span-2' : ''} ${wide ? 'lg:col-span-2' : ''}`}>
      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{label}</p>
      <p className="text-sm text-gray-800 mt-1 break-words">{value}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Pill({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-700">
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
