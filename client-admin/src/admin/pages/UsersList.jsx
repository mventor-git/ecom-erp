import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import { useLanguage } from '../../i18n';
import { getUsers, createUser, updateUser, deleteUser, getRoles, getPermissions, getUserRoles, setUserRoles, checkAdmin } from '../../api/adminApi';

const ROLE_LABEL_KEYS = {
  super_admin: 'Super Admin',
  site_manager: 'Site Manager',
  warehouse_manager: 'Warehouse Manager',
  delivery_partner: 'Delivery Partner',
  support: 'Support',
  viewer: 'Viewer',
};

export default function UsersList() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [me, setMe] = useState(null);
  // filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // multi-role editor state
  const [rolesUser, setRolesUser] = useState(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [rolesSaving, setRolesSaving] = useState(false);

  const isSuperAdmin = !!(me?.isSuperAdmin || me?.roles?.includes('super_admin'));

  const openRoles = async (user) => {
    if (!isSuperAdmin && user.roles?.includes('super_admin')) return;
    setRolesUser(user);
    try {
      const res = await getUserRoles(user.id);
      setSelectedRoleIds(res.data || []);
    } catch {
      setSelectedRoleIds([user.role_id].filter(Boolean));
    }
  };

  const saveRoles = async () => {
    if (!rolesUser || selectedRoleIds.length === 0) return;
    setRolesSaving(true);
    try {
      await setUserRoles(rolesUser.id, selectedRoleIds);
      setRolesUser(null);
      const usersRes = await getUsers();
      setUsers(usersRes.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save roles');
    } finally {
      setRolesSaving(false);
    }
  };
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', name: '', role_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  function loadData() {
    setLoading(true);
    Promise.all([getUsers(), getRoles(), getPermissions(), checkAdmin()])
      .then(([usersRes, rolesRes, permsRes, meRes]) => {
        setUsers(usersRes.data || []);
        setRoles(rolesRes.data || []);
        setPermissions(permsRes.data || []);
        setMe(meRes.data?.user || null);
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }

  function openCreate() {
    setEditing(null);
    setForm({ email: '', password: '', name: '', role_id: roles[0]?.id || '' });
    setError('');
    setShowForm(true);
  }

  function openEdit(user) {
    setEditing(user);
    setForm({ email: user.email || '', password: '', name: user.name || '', role_id: user.role_id || '' });
    setError('');
    setShowForm(true);
  }

  function handleSave() {
    if (!form.email || !form.name || !form.role_id) { setError(t('Email, name, and role are required')); return; }
    if (!editing && !form.password) { setError(t('Password is required for new users')); return; }
    if (form.password && form.password.length < 6) { setError(t('Password must be at least 6 characters')); return; }

    setSaving(true);
    setError('');
    const data = { email: form.email, name: form.name, role_id: parseInt(form.role_id) };
    if (form.password) data.password = form.password;

    const promise = editing ? updateUser(editing.id, data) : createUser(data);
    promise
      .then(() => { setShowForm(false); loadData(); })
      .catch(err => setError(err.response?.data?.error || 'Failed to save'))
      .finally(() => setSaving(false));
  }

  function handleToggleActive(user) {
    const action = user.is_active ? 'Deactivate' : 'Activate';
    if (!confirm(`${action} user "${user.name}"?`)) return;
    updateUser(user.id, { is_active: !user.is_active })
      .then(() => loadData())
      .catch(err => setError(err.response?.data?.error || 'Failed to update user'));
  }

  function handleDelete(user) {
    if (!confirm(`Deactivate user "${user.name}"? This will remove their access.`)) return;
    deleteUser(user.id)
      .then(() => loadData())
      .catch(err => setError(err.response?.data?.error || 'Failed to deactivate user'));
  }

  // Client-side filtering
  const filtered = users.filter(u => {
    if (search) {
      const q = search.toLowerCase();
      if (!u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
    }
    if (roleFilter && !(u.roles || []).includes(roleFilter) && u.role_name !== roleFilter) return false;
    if (statusFilter === 'active' && !u.is_active) return false;
    if (statusFilter === 'inactive' && u.is_active) return false;
    return true;
  });

  const roleBadge = (name) => (
    <span
      key={name}
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        name === 'super_admin'
          ? 'bg-purple-50 text-purple-700 border border-purple-200'
          : 'bg-primary-50 text-primary-700'
      }`}
    >
      {t(ROLE_LABEL_KEYS[name] || name)}
    </span>
  );

  const columns = [
    { key: 'name', label: 'Name', render: (row) => (
      <div>
        <span className="font-medium text-gray-900">{row.name}</span>
        {!row.is_active && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t('Inactive')}</span>}
      </div>
    )},
    { key: 'email', label: 'Email' },
    { key: 'role_name', label: 'Roles', render: (row) => (
      <div className="flex flex-wrap gap-1">
        {(row.roles && row.roles.length > 0 ? [...row.roles].sort() : [row.role_name].filter(Boolean))
          .map(name => roleBadge(name))}
      </div>
    )},
    { key: 'last_login_at', label: 'Last Login', render: (row) => row.last_login_at ? new Date(row.last_login_at).toLocaleString() : t('Never') },
    { key: 'created_at', label: 'Created', render: (row) => new Date(row.created_at).toLocaleDateString() },
    { key: 'actions', label: '', render: (row) => {
      const targetsSuperAdmin = (row.roles || []).includes('super_admin');
      const rolesDisabled = !isSuperAdmin && targetsSuperAdmin;
      return (
        <div className="flex gap-2 justify-end">
          <button onClick={() => openRoles(row)} disabled={rolesDisabled}
            title={rolesDisabled ? t('Only a super admin can manage super admin accounts') : undefined}
            className="text-xs px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">{t('Roles')}</button>
          <button onClick={() => openEdit(row)} className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">{t('Edit')}</button>
          <button onClick={() => handleToggleActive(row)}
            className={`text-xs px-3 py-1 rounded-lg ${row.is_active ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
            {row.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      );
    }},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Staff Accounts')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('Manage staff accounts, roles, and access control')}</p>
        </div>
        <button onClick={openCreate} className="text-sm px-4 py-2 bg-primary-600 rounded-lg text-white hover:bg-primary-700 font-medium">
          + {t('Add User')}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`${t('Search')}...`}
          className="sm:max-w-xs w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">{t('All roles')}</option>
          {roles.map(r => <option key={r.id} value={r.name}>{t(ROLE_LABEL_KEYS[r.name] || r.name)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">{t('All statuses')}</option>
          <option value="active">{t('Active')}</option>
          <option value="inactive">{t('Inactive')}</option>
        </select>
      </div>

      {/* Roles Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {roles.map(role => (
          <div key={role.id} className="bg-white rounded-xl p-3 border border-gray-200">
            <p className="text-xs text-gray-500">{t(ROLE_LABEL_KEYS[role.name] || role.name)}</p>
            <p className="text-lg font-bold text-gray-900">{role.user_count || 0}</p>
            <p className="text-xs text-gray-400">{t('users')}</p>
          </div>
        ))}
      </div>

      <DataTable columns={columns} data={filtered} loading={loading} emptyMessage={t('No users found')} />

      {/* Multi-role editor */}
      {rolesUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">{t('Roles')} — {rolesUser.name}</h2>
              <button onClick={() => setRolesUser(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5 space-y-2 max-h-80 overflow-y-auto">
              {roles.map(role => (
                <label key={role.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={e => {
                      setSelectedRoleIds(prev => e.target.checked ? [...prev, role.id] : prev.filter(r => r !== role.id));
                    }}
                    className="rounded border-gray-300 text-primary-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t(ROLE_LABEL_KEYS[role.name] || role.name)}</p>
                    {role.description && <p className="text-xs text-gray-400">{role.description}</p>}
                  </div>
                </label>
              ))}
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setRolesUser(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">{t('Cancel')}</button>
              <button onClick={saveRoles} disabled={rolesSaving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {rolesSaving ? t('Saving...') : t('Save Roles')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Reference */}
      {permissions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('Permissions Reference')}</h2>
          <div className="flex flex-wrap gap-2">
            {permissions.map(perm => (
              <span key={perm.id} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">{perm.name}</span>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editing ? t('Edit User') : t('New User')}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Name')} *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Email')} *</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Password')} {editing && `(${t('(leave blank to keep current)')})`}
                </label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  placeholder={editing ? '••••••' : t('Min 6 characters')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Role')} *</label>
                <select value={form.role_id} onChange={e => setForm({...form, role_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">{t('Select role...')}</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{t(ROLE_LABEL_KEYS[r.name] || r.name)}</option>)}
                </select>
                {!isSuperAdmin && (
                  <p className="mt-1 text-xs text-gray-400">{t('Only a super admin can manage super admin accounts')}</p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('Cancel')}</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {saving ? t('Saving...') : editing ? t('Update') : t('Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
