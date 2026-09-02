import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet } from 'lucide-react';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import ImportCsvModal from '../components/ImportCsvModal';
import { getInventorySummary, getLowStockItems, getWarehouses, getAdminProducts } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';
import AdminIcon from '../components/AdminIcon';
import { useLanguage } from '../../i18n';

/**
 * Inventory dashboard — stock overview + low-stock alerts, styled to match
 * the panel's shared design system (StatCard / card panels / primary palette,
 * full dark-mode support).
 */
export default function InventoryDashboard() {
  const { format } = useAdminCurrency();
  const { t } = useLanguage();
  const [summary, setSummary] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    loadData();
  }, [filterWarehouse]);

  function loadData() {
    setLoading(true);
    const params = filterWarehouse ? { warehouse_id: filterWarehouse } : {};
    Promise.all([
      getInventorySummary(params),
      getLowStockItems(filterWarehouse || undefined),
      getWarehouses(),
      getAdminProducts().catch(() => ({ data: [] })),
    ])
      .then(([summaryRes, lowStockRes, warehousesRes, productsRes]) => {
        setSummary(summaryRes.data || []);
        setLowStock(lowStockRes.data || []);
        setWarehouses(warehousesRes.data || []);
        setProducts(productsRes.data || []);
      })
      .catch(err => console.error('Error loading inventory:', err))
      .finally(() => setLoading(false));
  }

  const handleMovementSaved = () => {
    setSavedMsg(t('Movement saved — stock updated'));
    setTimeout(() => setSavedMsg(''), 3000);
    loadData();
  };

  const totalProducts = summary.length;
  const totalStock = summary.reduce((sum, item) => sum + (item.qty_on_hand || 0), 0);
  const totalValue = summary.reduce((sum, item) => {
    const costPrice = item.cost_price || 0;
    return sum + (item.qty_on_hand || 0) * costPrice;
  }, 0);
  const lowStockCount = lowStock.length;

  const statCards = [
    { label: t('Total Products'), value: totalProducts, color: 'text-blue-600', icon: 'box' },
    { label: t('Total Stock'), value: totalStock.toLocaleString(), color: 'text-green-600', icon: 'chart' },
    { label: t('Stock Value'), value: format(totalValue), color: 'text-primary-600', icon: 'wallet' },
    { label: t('Low Stock Alerts'), value: lowStockCount, color: lowStockCount > 0 ? 'text-red-600' : 'text-gray-600', icon: 'bell' },
    { label: t('Warehouses'), value: warehouses.length, color: 'text-purple-600', icon: 'building' },
  ];

  const lowStockColumns = [
    { key: 'product_name', label: t('Product') },
    { key: 'sku', label: t('SKU'), render: (row) => row.sku || '—' },
    {
      key: 'qty_on_hand',
      label: t('On Hand'),
      align: 'right',
      render: (row) => (
        <span className={`font-semibold ${row.qty_on_hand <= 0 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
          {row.qty_on_hand}
        </span>
      ),
    },
    { key: 'reorder_point', label: t('Reorder Point'), align: 'right' },
    { key: 'min_stock', label: t('Min Stock'), align: 'right' },
    {
      key: 'status',
      label: t('Status'),
      render: (row) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
          row.qty_on_hand <= 0
            ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400'
        }`}>
          {row.qty_on_hand <= 0 ? t('Out of Stock') : t('Low Stock')}
        </span>
      ),
    },
  ];

  const inventoryColumns = [
    { key: 'product_name', label: t('Product') },
    { key: 'sku', label: t('SKU'), render: (row) => row.sku || '—' },
    { key: 'warehouse_name', label: t('Warehouse') },
    { key: 'location_name', label: t('Location'), render: (row) => row.location_name || '—' },
    {
      key: 'qty_on_hand',
      label: t('On Hand'),
      align: 'right',
      render: (row) => (
        <span className={`font-semibold ${row.qty_on_hand <= 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
          {row.qty_on_hand}
        </span>
      ),
    },
    { key: 'qty_reserved', label: t('Reserved'), align: 'right' },
    {
      key: 'available',
      label: t('Available'),
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-green-600 dark:text-green-400">
          {(row.qty_on_hand || 0) - (row.qty_reserved || 0)}
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><AdminIcon name="chart" className="w-6 h-6 text-primary-600" />{t('Inventory')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('Stock overview and low stock alerts')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {savedMsg && <span className="text-sm text-green-600 dark:text-green-400 font-medium">{savedMsg}</span>}
          <select
            value={filterWarehouse}
            onChange={(e) => setFilterWarehouse(e.target.value)}
            className="text-sm border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{t('All Warehouses')}</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
          <Link
            to="/inventory/movement"
            className="text-sm px-4 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-lg text-gray-700 dark:text-gray-200 hover:border-primary-300 font-medium transition-colors"
          >
            {t('Movements')}
          </Link>
          <Link
            to="/inventory/warehouses"
            className="text-sm px-4 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-lg text-gray-700 dark:text-gray-200 hover:border-primary-300 font-medium transition-colors"
          >
            {t('Warehouses')}
          </Link>
        </div>
      </div>

      {showImportModal && (
        <ImportCsvModal
          onClose={() => setShowImportModal(false)}
          onImported={() => loadData()}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
        {statCards.map(card => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Low stock alerts */}
      {lowStockCount > 0 && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-red-200 dark:border-red-500/20 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <AdminIcon name="bell" className="w-4 h-4 text-red-500" />
              {t('Low Stock Alerts')} ({lowStockCount})
            </h2>
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {t('Import CSV')}
            </button>
          </div>
          <DataTable
            columns={lowStockColumns}
            data={lowStock}
            loading={loading}
            emptyMessage={t('No low stock items')}
          />
        </div>
      )}

      {/* Full summary */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AdminIcon name="box" className="w-4 h-4 text-primary-600" />
            {t('Inventory Summary')} ({totalProducts} {t('products')})
          </h2>
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {t('Import CSV')}
          </button>
        </div>
        <DataTable
          columns={inventoryColumns}
          data={summary}
          loading={loading}
          emptyMessage={t('No inventory records found')}
        />
      </div>
    </div>
  );
}
