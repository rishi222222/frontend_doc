import { useEffect, useState } from 'react';
import api from '../api/client';
import Badge from '../components/Badge';
import ConfirmDialog from '../components/ConfirmDialog';
import { errorMessage, formatDate } from '../utils/format';

const emptyForm = { name: '', email: '', password: '', role: 'employee', department: '', employeeId: '' };

export default function UserManagementPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);

  async function load(search = q) {
    const res = await api.get('/users', { params: { q: search || undefined, limit: 50 } });
    setItems(res.data.items);
  }

  useEffect(() => {
    load().catch((err) => setError(errorMessage(err)));
  }, []);

  async function createUser(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError('Name must contain at least 2 characters.');
      return;
    }
    if (!form.password || form.password.length < 10) {
      setError('Password must contain at least 10 characters.');
      return;
    }
    try {
      await api.post('/users', form);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not create user'));
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl">User management</h1>
        <p className="mt-1 text-stone-600">Create employees, manage administrators, and deactivate accounts immediately.</p>
      </header>
      {error ? <p className="text-rose-700">{error}</p> : null}

      <form onSubmit={createUser} className="card grid gap-3 p-6 md:grid-cols-2">
        <h2 className="font-display text-2xl md:col-span-2">Create account</h2>
        <label className="text-sm font-medium">
          Name
          <input
            type="text"
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            minLength={2}
            placeholder="Full name"
          />
        </label>
        <label className="text-sm font-medium">
          Email
          <input
            type="email"
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            placeholder="user@company.com"
          />
        </label>
        <label className="text-sm font-medium">
          Password <span className="text-xs font-normal text-stone-500">(at least 10 characters)</span>
          <input
            type="password"
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={10}
            placeholder="Min 10 characters"
          />
        </label>
        <label className="text-sm font-medium">
          Department
          <input
            type="text"
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            placeholder="e.g. HR, Engineering"
          />
        </label>
        <label className="text-sm font-medium">
          Employee ID
          <input
            type="text"
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            placeholder="e.g. EMP-001"
          />
        </label>
        <label className="text-sm font-medium">
          Role
          <select className="mt-1 w-full rounded-xl border px-3 py-2" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="employee">Employee</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
        <div className="md:col-span-2">
          <button className="rounded-full bg-ink px-5 py-2 font-semibold text-white">Create user</button>
        </div>
      </form>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
      >
        <input className="max-w-md flex-1 rounded-full border bg-white px-4 py-2" placeholder="Search name, email, employee ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Search</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-50 text-stone-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-stone-500">{u.email} {u.employeeId ? `· ${u.employeeId}` : ''}</div>
                </td>
                <td className="px-4 py-3 capitalize">{u.role}</td>
                <td className="px-4 py-3"><Badge value={u.isActive ? 'active' : 'deleted'} /></td>
                <td className="px-4 py-3">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setPending(u)}
                  >
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pending ? (
        <ConfirmDialog
          title={pending.isActive ? 'Deactivate account' : 'Activate account'}
          body="Deactivated users lose access immediately. Owned documents remain until an administrator reassigns them."
          confirmLabel={pending.isActive ? 'Deactivate' : 'Activate'}
          danger={pending.isActive}
          onClose={() => setPending(null)}
          onConfirm={async () => {
            await api.patch(`/users/${pending.id}/status`, { isActive: !pending.isActive });
            setPending(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}
