import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import { Button } from '../components/ui/Button';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.login(form);
      if (res.data.success || res.data.isAdmin) navigate('/admin');
    } catch (e) {
      setError(e.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-amber-400 tracking-tight">Ecom-ERP</h1>
          <p className="text-sm text-slate-400 mt-1">Admin Access</p>
        </div>
        <div className="space-y-3">
          <input type="text" placeholder="Username" value={form.username} onChange={e=>setForm({...form, username: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500" />
          <input type="password" placeholder="Password" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500" />
          <Button onClick={submit} className="w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</Button>
        </div>
        {error && <p className="mt-3 text-rose-400 text-sm">{error}</p>}
        <p className="mt-5 text-xs text-slate-500 text-center">Uses real backend auth mechanism POST /api/admin/login. Credentials must exist on server.</p>
      </div>
    </div>
  );
}
