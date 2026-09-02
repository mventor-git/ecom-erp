import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MapsAddressPicker from '../components/MapsAddressPicker';
import { getCustomerStatus, saveCustomerProfile, verifyCustomerCode, resendVerificationCode } from '../api/products';

const inputClass = 'w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-dark-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50';

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const [step, setStep] = useState('form'); // form | otp | verified
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState({ address: '', city: '', governorate: '', latitude: null, longitude: null });
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [timer, setTimer] = useState(0);

  // Load existing profile
  useEffect(() => {
    getCustomerStatus()
      .then(res => {
        setPhone(res.data?.phone || '');
        setLocation({
          address: res.data?.address || '',
          city: res.data?.city || '',
          governorate: res.data?.governorate || '',
          latitude: res.data?.latitude || null,
          longitude: res.data?.longitude || null,
        });
        if (res.data?.is_verified) setStep('verified');
      })
      .catch(() => {});
  }, []);

  // resend cooldown timer
  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const handleSaveProfile = async () => {
    if (!phone.trim()) return setError('Phone number is required');
    if (!location.address.trim() || !location.city.trim()) return setError('Address and city are required');
    setLoading(true);
    setError('');
    try {
      await saveCustomerProfile({ phone: phone.trim(), ...location });
      setStep('otp');
      setMsg('Verification code sent to your email');
      setTimer(60);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) return setError('Enter the verification code');
    setLoading(true);
    setError('');
    try {
      const res = await verifyCustomerCode(code.trim());
      setStep('verified');
      setUser(prev => ({ ...prev, is_verified: true, needs_onboarding: false }));
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    setError('');
    try {
      await resendVerificationCode();
      setMsg('New code sent');
      setTimer(60);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend');
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="glass-card p-6 sm:p-8">
        {step === 'verified' ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-500/15 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">You're an authorized customer! </h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Your phone number is verified. Welcome aboard.</p>
            <Link to="/home" className="btn-primary inline-block mt-6">Continue Shopping</Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {step === 'form' ? 'Complete your profile' : 'Verify your phone'}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {step === 'form'
                ? 'Add your phone number and delivery address so we can serve you better.'
                : `We sent a code to your email for phone ${phone}.`}
            </p>

            {error && <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-sm text-red-700 dark:text-red-300">{error}</div>}
            {msg && <div className="mt-4 p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl text-sm text-green-700 dark:text-green-300">{msg}</div>}

            {step === 'form' && (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Phone number *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+20 1xx xxx xxxx"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Delivery address *</label>
                  <MapsAddressPicker value={location} onChange={setLocation} />
                </div>

                <button onClick={handleSaveProfile} disabled={loading} className="btn-primary w-full">
                  {loading ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            )}

            {step === 'otp' && (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Verification code *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className={inputClass + ' text-center text-2xl tracking-[0.5em] font-bold'}
                  />
                </div>
                <button onClick={handleVerify} disabled={loading} className="btn-primary w-full">
                  {loading ? 'Verifying...' : 'Verify & Become Authorized'}
                </button>
                <button
                  onClick={handleResend}
                  disabled={timer > 0}
                  className="w-full text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline disabled:opacity-50"
                >
                  {timer > 0 ? `Resend code in ${timer}s` : 'Resend code'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
