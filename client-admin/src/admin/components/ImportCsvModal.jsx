import { useRef, useState } from 'react';
import { FileSpreadsheet, Eye, UploadCloud, CheckCircle2, XCircle, FolderOpen, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { importProductsFile } from '../../api/adminApi';

const TEMPLATE_HEADER =
  'name,description,price_wholesale,category,brand,stock,sku,barcode,min_stock,reorder_point,active,image_url';

const COLUMN_GUIDE = [
  ['name', 'Product name (required)'],
  ['description', 'Short details'],
  ['price_wholesale', 'The price YOU bought it at — your cost (required). Selling prices are set later in Warehouse → Pricing.'],
  ['category', 'Category name — created automatically if new'],
  ['brand', 'Brand name (optional)'],
  ['stock', 'Initial quantity → recorded as an Opening Balance movement'],
  ['sku', 'Your internal product code, e.g. KB-PRO-01 (uppercase, unique, no spaces)'],
  ['barcode', 'The number under the striped label (digits only). Reuse the supplier\'s or print your own labels.'],
  ['min_stock', 'Low-stock warning threshold'],
  ['reorder_point', 'Appears in Low Stock report at this level'],
  ['active', '1 = visible in store, 0 = hidden'],
  ['image_url', 'Photo: local path (/images/products/x/main.jpg) OR internet URL (https://…)'],
];

/** Download the headers-only CSV template (UTF-8 BOM so Excel renders correctly). */
function downloadTemplate() {
  const blob = new Blob(['\ufeff' + TEMPLATE_HEADER + '\n'], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'products-import-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * CSV import popup (mventor-ticket-053/058).
 * Show Example → column guide + downloadable headers-only template.
 * Import CSV → file picker; results open in-place after import.
 */
export default function ImportCsvModal({ onClose, onImported }) {
  const [view, setView] = useState('menu'); // menu | example | importing | result
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  function pickFile() {
    fileRef.current?.click();
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setView('importing');
    setError('');
    try {
      const res = await importProductsFile(file);
      setResult(res.data);
      setView('result');
      onImported?.(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed');
      setView('menu');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="w-[18px] h-[18px] text-primary-600" />
                Import Products from CSV / Excel
              </CardTitle>
              <CardDescription className="mt-1">
                New products enter the warehouse through an Opening Balance movement.
                Existing products are never re-stocked by imports.
              </CardDescription>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Close">×</button>
          </div>
        </CardHeader>
        <CardContent>
          {view === 'menu' && (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setView('example')}
                  className="flex flex-col items-start gap-2 rounded-xl border border-gray-200 p-4 text-left hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                >
                  <Eye className="w-5 h-5 text-primary-600" />
                  <span className="text-sm font-semibold text-gray-900">Show Example</span>
                  <span className="text-xs text-gray-500">Column guide + download the ready template.</span>
                </button>
                <button
                  onClick={pickFile}
                  className="flex flex-col items-start gap-2 rounded-xl border border-gray-200 p-4 text-left hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                >
                  <UploadCloud className="w-5 h-5 text-primary-600" />
                  <span className="text-sm font-semibold text-gray-900">Import CSV</span>
                  <span className="text-xs text-gray-500">Choose your .csv / .xlsx file and start.</span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
            </>
          )}

          {view === 'example' && (
            <div>
              <button
                onClick={downloadTemplate}
                className="w-full mb-4 inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Template (CSV)
              </button>

              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-2.5 py-2 font-semibold text-gray-700 w-40">Column</th>
                      <th className="px-2.5 py-2 font-semibold text-gray-700">What to put</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COLUMN_GUIDE.map(([col, meaning]) => (
                      <tr key={col} className="border-t border-gray-100">
                        <td className="px-2.5 py-2 font-mono font-semibold text-primary-700 whitespace-nowrap">{col}</td>
                        <td className="px-2.5 py-2 text-gray-600">{meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                The downloaded template contains the header row only — fill one row per product,
                save as <b>CSV UTF-8</b>, then import it.
              </p>

              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setView('menu')} className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Back
                </button>
                <button onClick={pickFile} className="h-9 px-4 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 inline-flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4" /> Choose File
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
            </div>
          )}

          {view === 'importing' && (
            <div className="py-12 flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              <p className="text-sm text-gray-600">Importing and recording warehouse movements…</p>
            </div>
          )}

          {view === 'result' && result && (
            <div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg border border-gray-200 p-3 text-center">
                  <p className="text-lg font-semibold text-gray-900">{result.imported}</p>
                  <p className="text-xs text-gray-500">Rows read</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                  <p className="text-lg font-semibold text-emerald-700">{result.created}</p>
                  <p className="text-xs text-emerald-700">Created (+stock movement)</p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-center">
                  <p className="text-lg font-semibold text-sky-700">{result.updated}</p>
                  <p className="text-xs text-sky-700">Updated (stock untouched)</p>
                </div>
              </div>

              {(result.imported_rows?.length || 0) > 0 && (
                <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-2.5 py-2 font-semibold text-gray-700">#</th>
                        <th className="px-2.5 py-2 font-semibold text-gray-700">Product</th>
                        <th className="px-2.5 py-2 font-semibold text-gray-700">Result</th>
                        <th className="px-2.5 py-2 font-semibold text-gray-700 text-right">Wholesale</th>
                        <th className="px-2.5 py-2 font-semibold text-gray-700 text-right">Initial Stock</th>
                        <th className="px-2.5 py-2 font-semibold text-gray-700">Photo Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.imported_rows.map(r => (
                        <tr key={`${r.result}-${r.id}`} className="border-t border-gray-100">
                          <td className="px-2.5 py-2 text-gray-500">{r.line}</td>
                          <td className="px-2.5 py-2 font-medium text-gray-900">{r.name}</td>
                          <td className="px-2.5 py-2">
                            <span className={`inline-flex items-center gap-1 ${r.result === 'created' ? 'text-emerald-700' : 'text-sky-700'}`}>
                              {r.result === 'created'
                                ? <CheckCircle2 className="w-3.5 h-3.5" />
                                : <XCircle className="w-3.5 h-3.5 opacity-40" />}
                              {r.result}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 text-right text-gray-700">{(r.price / 100).toFixed(2)} EGP</td>
                          <td className="px-2.5 py-2 text-right text-gray-700">{r.stock_requested}</td>
                          <td className="px-2.5 py-2 text-gray-500 max-w-[220px] truncate" title={r.image_url}>{r.image_url || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.errors?.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 mb-4">
                  <p className="text-xs font-semibold text-red-700 mb-1">{result.errors.length} row(s) had errors:</p>
                  <ul className="text-xs text-red-700 space-y-0.5 list-disc list-inside">
                    {result.errors.slice(0, 6).map((e, i) => <li key={i}>Line {e.line}: {e.error}</li>)}
                  </ul>
                </div>
              )}

              {result.saved_path && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <FolderOpen className="w-4 h-4 shrink-0" />
                  <span>A copy of your file was saved to <code className="text-primary-700">{result.saved_path}</code></span>
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={onClose} className="h-9 px-4 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">
                  Done
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
