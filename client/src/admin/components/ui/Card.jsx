// Card — consistent container for all admin pages
export function Card({ children, title, className = '' }) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6 text-slate-100 ${className}`}>
      {title && <h2 className="text-xl font-bold text-amber-400 mb-4 tracking-tight">{title}</h2>}
      {children}
    </div>
  );
}
