import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin, checkAdmin, fetchCsrfToken } from '../api/adminApi';
import { useLanguage } from '../i18n';
import LanguageToggle from '../admin/components/LanguageToggle';
import CoffeeSplash from '../admin/components/CoffeeSplash';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if already logged in
  useEffect(() => {
    let active = true;
    checkAdmin()
      .then(async res => {
        if (active && res.data.isAdmin) {
          const token = await fetchCsrfToken();
          if (token && active) navigate('/dashboard');
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminLogin(username, password);
      const token = await fetchCsrfToken();
      if (!token) throw new Error('Admin session could not be established');
      navigate('/dashboard');
    } catch (err) {
      setError(t(err.response?.data?.error || err.message) || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CoffeeSplash label="Brewing your session" duration={0} />;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* ── Brand panel (desktop split) ── */}
      <div className="hidden lg:flex w-[44%] relative overflow-hidden bg-gray-950 text-white flex-col justify-between p-12">
        {/* ambient gradients */}
        <div className="absolute -top-40 -left-32 w-[32rem] h-[32rem] rounded-full bg-primary-700/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-primary-500/20 blur-3xl translate-x-1/3" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-primary-400/10 blur-2xl" />
        {/* fine grid texture */}
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

        <div className="relative z-10 flex items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-600/30">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="font-bold tracking-tight">Ecom-ERP</p>
            <p className="text-xs text-white/50">Operations Platform</p>
          </div>
        </div>

        <div className="relative z-10 animate-slide-up">
          <p className="text-[0.8rem] uppercase tracking-[0.2em] text-primary-400 mb-4">{t('The control center for your business')}</p>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight">
            {t('One connected system.')}
            <br />
            <span className="text-primary-400">{t('One source of truth.')}</span>
          </h1>
          <p className="mt-5 max-w-md text-white/60 text-sm leading-relaxed">
            {t('Manage orders, inventory, pricing, finance and delivery from a single calm, trustworthy workspace.')}
          </p>
        </div>

        <div className="relative z-10 text-xs text-white/40 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {t('All systems operational')}
        </div>
      </div>

      {/* ── Form panel ── */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-md animate-slide-up" style={{ animationDelay: '80ms' }}>
          {/* mobile brand header */}
          <div className="lg:hidden text-center mb-8 animate-fade-in">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary-600/25">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Ecom-ERP</h1>
            <p className="text-sm text-gray-500 mt-1">{t('Sign in to manage your store')}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 relative">
            <div className="absolute top-4 end-4">
              <LanguageToggle />
            </div>
            <div className="hidden lg:block text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">{t('Welcome back')}</h1>
              <p className="text-gray-500 mt-1">{t('Sign in to manage your store')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('Username')}</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="input-field w-full transition focus:ring-2 focus:ring-primary-500/30"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('Password')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field w-full transition focus:ring-2 focus:ring-primary-500/30"
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full !py-3 transition-all hover:-translate-y-px hover:shadow-md active:translate-y-0 disabled:opacity-60"
              >
                {loading ? t('Signing in...') : t('Sign In')}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              <a href="http://localhost:5173" className="text-primary-600 hover:text-primary-700">{t('Back to Store')}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}