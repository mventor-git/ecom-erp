import { createContext, useContext, useState, useEffect } from 'react';

const AdminAuthContext = createContext({
  user: null,
  roles: [],
  permissions: [],
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  refresh: () => Promise.resolve(),
});

export function AdminAuthProvider({ children }) {
  const [state, setState] = useState({ user: null, roles: [], permissions: [], loading: true, isAdmin: false, isSuperAdmin: false });
  const refresh = () => {
    setState(s => ({ ...s, loading: true }));
    return fetch('/api/admin/me', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : { isAdmin: false, user: null }))
      .then(d => {
        if (d.isAdmin && d.user) {
          setState({ user: d.user, roles: d.user.roles || [], permissions: d.user.permissions || [], loading: false, isAdmin: d.isAdmin, isSuperAdmin: d.user.isSuperAdmin || false });
        } else {
          setState({ user: null, roles: [], permissions: [], loading: false, isAdmin: false, isSuperAdmin: false });
        }
      })
      .catch(() => setState(s => ({ ...s, loading: false })));
  };
  useEffect(() => { refresh(); }, []);
  return <AdminAuthContext.Provider value={{ ...state, refresh }}>{children}</AdminAuthContext.Provider>;
}
export const useAdminAuth = () => useContext(AdminAuthContext);
