import { useState, useEffect, useRef } from 'react';

/**
 * DocumentViewer — Google-Drive-style floating document viewer.
 * - Dark backdrop, floating centered window
 * - Document rendered as white pages on a gray scrollable canvas
 * - Mouse-wheel / touch scroll between pages
 * - Print button prints from the full view (hidden iframe)
 */
export default function DocumentViewer({ url, title, onClose }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const printFrameRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(url + (url.includes('?') ? '&' : '?') + 'embed=1')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load document');
        return res.text();
      })
      .then(text => { if (!cancelled) setHtml(text); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  // Print: load the full view (with toolbar+print css) into a hidden iframe and print
  const handlePrint = () => {
    const iframe = printFrameRef.current;
    if (!iframe) return;
    iframe.src = url;
    iframe.onload = () => {
      setTimeout(() => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { console.error(e); }
      }, 300);
    };
  };

  const handleKey = (e) => {
    if (e.key === 'Escape') onClose();
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
      {/* Sheet styles (mirror of the server's print CSS) */}
      <style>{`
        .doc-sheet { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; }
        .doc-sheet .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; }
        .doc-sheet .doc-header h1 { font-size: 24px; margin: 0; color: #1d4ed8; }
        .doc-sheet .doc-header .number { font-size: 13px; color: #64748b; }
        .doc-sheet .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 13px; margin-bottom: 18px; }
        .doc-sheet .meta b { color: #334155; }
        .doc-sheet table.items { width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0 18px; }
        .doc-sheet table.items th { background: #2563eb; color: #fff; text-align: left; padding: 8px 10px; font-size: 12px; }
        .doc-sheet table.items td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; }
        .doc-sheet table.items tr:nth-child(even) td { background: #f8fafc; }
        .doc-sheet .totals { margin-left: auto; width: 280px; font-size: 14px; }
        .doc-sheet .totals .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0; }
        .doc-sheet .totals .grand { font-weight: 700; font-size: 17px; color: #1d4ed8; border-top: 2px solid #2563eb; border-bottom: none; padding-top: 8px; }
        .doc-sheet .codes { display: flex; gap: 24px; margin: 24px 0; align-items: center; }
        .doc-sheet .codes img { width: 110px; height: 110px; border: 1px solid #e2e8f0; padding: 4px; }
        .doc-sheet .codes .cap { font-size: 11px; color: #64748b; text-align: center; margin-top: 4px; }
        .doc-sheet .footer { border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 12px; font-size: 12px; color: #64748b; text-align: center; }
        .doc-sheet .shipping-box { border: 2px solid #2563eb; border-radius: 10px; padding: 16px; margin: 12px 0; }
        .doc-sheet .shipping-box h3 { margin: 0 0 8px; color: #1d4ed8; font-size: 14px; text-transform: uppercase; }
        .doc-sheet .shipping-box p { margin: 3px 0; font-size: 14px; }
        .doc-sheet .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
        .doc-sheet .badge.green { background: #dcfce7; color: #15803d; }
        .doc-sheet .badge.blue { background: #dbeafe; color: #1d4ed8; }
      `}</style>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Floating window */}
      <div className="relative w-full max-w-4xl h-full max-h-[92vh] bg-gray-200 dark:bg-dark-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-white/10">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-dark-900 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl">📄</span>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{title || 'Document'}</p>
              <p className="text-[11px] text-gray-400">Scroll to view · Print from here</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-semibold bg-primary-600 hover:bg-primary-500 text-white rounded-lg flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold bg-dark-700 hover:bg-dark-600 text-gray-200 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>

        {/* Scrollable page canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
            </div>
          )}
          {error && (
            <div className="text-center py-16 text-red-500 text-sm">{error}</div>
          )}
          {!loading && !error && (
            <div
              className="doc-sheet max-w-[820px] mx-auto bg-white shadow-2xl rounded-sm min-h-[1123px] p-8 sm:p-12"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>

      {/* Hidden iframe for printing */}
      <iframe ref={printFrameRef} title="print-frame" className="hidden" />
    </div>
  );
}
