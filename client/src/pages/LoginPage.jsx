import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../utils/format';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={location.state?.from || '/dashboard'} replace />;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!email.includes('@') || password.length < 8) {
      setError('Enter a valid email and password (8+ characters).');
      return;
    }
    setLoading(true);
    try {
      const nextUser = await login(email, password);
      navigate(nextUser.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Unable to sign in'));
    } finally {
      setLoading(false);
    }
  }

  function fillCredentials(fillEmail, fillPassword) {
    setEmail(fillEmail);
    setPassword(fillPassword);
    setError('');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8">
      <div className="grid w-full gap-10 lg:grid-cols-2">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Internal access only</p>
          <h1 className="mt-3 font-display text-5xl leading-tight">VaultLedger</h1>
          <p className="mt-4 max-w-md text-lg text-stone-600">
            Publish, share, and control documents with document-specific permissions. Authentication identifies you;
            access is decided per document.
          </p>
          <div className="mt-8 hidden rounded-2xl border border-stone-200/80 bg-white/50 p-5 lg:block">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Need an account?</h3>
            <p className="mt-2 text-sm text-stone-600">
              New employees and administrators can be provisioned by logging in with an Admin account and navigating to the User Management dashboard.
            </p>
          </div>
        </div>

        <div>
          <form onSubmit={submit} className="card p-8">
            <h2 className="font-display text-2xl">Sign in</h2>
            {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            <label className="mt-6 block text-sm font-medium">
              Email
              <input
                type="email"
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-stone-900 focus:border-stone-400 focus:outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Password
              <input
                type="password"
                autoComplete="current-password"
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-stone-900 focus:border-stone-400 focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button
              disabled={loading}
              className="mt-6 w-full rounded-full bg-ink py-3 font-semibold text-white transition hover:bg-ink/90 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Continue'}
            </button>

            {/* Demo & Test Credentials Section */}
            <div className="mt-8 border-t border-stone-200/80 pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Demo & Testing Credentials
                </span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                  Click to auto-fill
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                {/* Admin Option */}
                <div className="flex items-center justify-between rounded-xl border border-accent/20 bg-accent/5 p-3 text-xs transition hover:border-accent/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
                        Admin
                      </span>
                      <span className="font-semibold text-stone-800">mohit@company.com</span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-stone-500">
                      Password: <span className="font-semibold text-stone-700">123456789</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fillCredentials('mohit@company.com', '123456789')}
                    className="ml-3 shrink-0 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 font-semibold text-accent shadow-sm transition hover:bg-stone-50 active:scale-95"
                  >
                    Auto-fill
                  </button>
                </div>

                {/* Employee Option */}
                <div className="flex items-center justify-between rounded-xl border border-moss/20 bg-moss/5 p-3 text-xs transition hover:border-moss/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-moss/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-moss">
                        Employee
                      </span>
                      <span className="font-semibold text-stone-800">casey@company.com</span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-stone-500">
                      Password: <span className="font-semibold text-stone-700">Employee123!@#</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fillCredentials('casey@company.com', 'Employee123!@#')}
                    className="ml-3 shrink-0 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 font-semibold text-moss shadow-sm transition hover:bg-stone-50 active:scale-95"
                  >
                    Auto-fill
                  </button>
                </div>
              </div>

              {/* Informational Guidance */}
              <div className="mt-4 rounded-xl bg-stone-50/80 p-3 text-xs text-stone-600 space-y-1">
                <p>
                  ℹ️ <strong>Note:</strong> There are more employees seeded in the database.
                </p>
                <p>
                  🔑 You can create an employee or admin by logging in as admin (presently use the admin ID above).
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
