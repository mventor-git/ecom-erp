// Shared UI primitive — prestige design token
export function Button({ children, onClick, variant = 'primary', className = '' }) {
  const base = 'inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2';
  const styles = {
    primary: 'bg-amber-500 text-amber-950 hover:bg-amber-600 focus:ring-amber-500 shadow-amber-500/20',
    secondary: 'bg-slate-800 text-white hover:bg-slate-700 focus:ring-amber-500',
    outline: 'bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-800',
  };
  return (
    <button onClick={onClick} className={`${base} ${styles[variant] || styles.primary} ${className}`}>
      {children}
    </button>
  );
}
