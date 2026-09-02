import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n';

const INVITE_KEY = 'vip_invite_code';

/** Read ?invite=CODE from the URL and remember it until it is claimed. */
export function captureInviteCode(searchParams) {
  const code = searchParams.get('invite');
  if (code) {
    try { localStorage.setItem(INVITE_KEY, code); } catch { /* private mode */ }
    return code;
  }
  return null;
}

export function takeInviteCode() {
  try {
    const code = localStorage.getItem(INVITE_KEY);
    if (code) localStorage.removeItem(INVITE_KEY);
    return code;
  } catch { return null; }
}

/** Best-effort invite claim after any successful login/signup. */
export async function claimStoredInvite() {
  const code = takeInviteCode();
  if (!code) return null;
  try {
    const res = await axios.post('/api/customer/claim-invite', { code }, { withCredentials: true });
    return res.data || null;
  } catch {
    // Session may not carry the customer (e.g. JWT-only signup) — keep the
    // code so a later Google sign-in can still claim it.
    try { localStorage.setItem(INVITE_KEY, code); } catch { /* ignore */ }
    return null;
  }
}

export default function LoginPage() {
  const { t, isRTL } = useLanguage();
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  const [inviteName, setInviteName] = useState(null);   // cosmetic: "You've been invited"
  const [showEmail, setShowEmail] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [signupState, setSignupState] = useState({ busy: false, msg: null });

  // Capture VIP invitation codes (?invite=CODE from the admin's QR/link)
  useEffect(() => {
    const code = captureInviteCode(searchParams);
    if (code) setInviteName(code);
  }, [searchParams]);

  // If already logged in, try claiming any stored invite, then go to account
  useEffect(() => {
    if (!loading && user) {
      claimStoredInvite().finally(() => navigate('/account', { replace: true }));
    }
  }, [user, loading, navigate]);

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setSignupState({ busy: true, msg: null });
    try {
      let code = null;
      try { code = localStorage.getItem(INVITE_KEY); } catch { /* ignore */ }
      const res = await axios.post('/api/v1/auth/customer/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        ...(code ? { invite_code: code } : {}),
      });
      if (code) { try { localStorage.removeItem(INVITE_KEY); } catch { /* ignore */ } }
      setSignupState({
        busy: false,
        msg: {
          ok: true,
          text: res.data?.customer?.vip
            ? t('Account created — your VIP invitation is active! You can now sign in.')
            : t('Account created — you can now sign in.'),
        },
      });
      setForm({ name: '', email: '', password: '' });
    } catch (err) {
      setSignupState({
        busy: false,
        msg: { ok: false, text: err.response?.data?.error?.message || t('Signup failed — please check your details') },
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (user) return null; // Will redirect

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="glass-card p-8">
        {/* VIP invitation banner */}
        {inviteName && (
          <div className="mb-6 p-3 bg-gold/10 border border-gold/30 rounded-xl text-sm text-gold flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V7a2 2 0 112 2h-2zm0 0F8.5 7 5 10.5 5 15c0 3.5 3.5 7 7 7s7-3.5 7-7c0-4.5-3.5-8-7-8z" />
            </svg>
            {t("You've been invited to join as a VIP — sign in or create an account to activate it.")}
          </div>
        )}

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-primary-500/20">
            <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('Sign In')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {t('Sign in to see your order history and checkout faster')}
          </p>
        </div>

        {error === 'access_denied' && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-300 text-sm">
            {t('Sign in was cancelled or denied. Please try again.')}
          </div>
        )}

        <button
          onClick={login}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-gray-300 dark:border-white/10 rounded-xl
                     hover:bg-gray-50 dark:hover:bg-white/5 transition-all font-medium text-gray-700 dark:text-gray-200 backdrop-blur-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t('Sign in with Google')}
        </button>

        {/* Normal email signup */}
        <div className="mt-5 text-center">
          <button onClick={() => setShowEmail(s => !s)}
            className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors">
            {showEmail ? t('Hide email signup') : t('Or sign up with email')}
          </button>
        </div>

        {showEmail && (
          <form onSubmit={handleEmailSignup} className="mt-4 space-y-3">
            <input required type="text" placeholder={t('Your name')} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              dir={isRTL ? 'rtl' : 'ltr'}
              className="input-field" />
            <input required type="email" placeholder={t('Email address')} value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              dir={isRTL ? 'rtl' : 'ltr'}
              className="input-field" />
            <input required type="password" minLength={6} placeholder={t('Password (min 6 characters)')} value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              dir={isRTL ? 'rtl' : 'ltr'}
              className="input-field" />
            <button type="submit" disabled={signupState.busy}
              className="btn-primary w-full disabled:opacity-50">
              {signupState.busy ? t('Creating account...') : t('Create account')}
            </button>
          </form>
        )}

        {signupState.msg && (
          <p className={`mt-3 text-sm ${signupState.msg.ok ? 'text-green-600' : 'text-red-500'}`}>{signupState.msg.text}</p>
        )}

        <div className="mt-6 space-y-3 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t('Faster checkout — email pre-filled automatically')}
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t('View your order history anytime')}
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t('No password to remember — we use your Google account')}
          </div>
        </div>
      </div>
    </div>
  );
}
