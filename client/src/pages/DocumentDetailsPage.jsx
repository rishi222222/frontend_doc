import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import Badge from '../components/Badge';
import ConfirmDialog from '../components/ConfirmDialog';
import { errorMessage, formatBytes, formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';

export default function DocumentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [doc, setDoc] = useState(null);
  const [perms, setPerms] = useState([]);
  const [versions, setVersions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [replaceFile, setReplaceFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  async function load() {
    const [d, p, v, a] = await Promise.all([
      api.get(`/documents/${id}`),
      api.get(`/documents/${id}/permissions`),
      api.get(`/documents/${id}/versions`),
      api.get(`/documents/${id}/audit-logs`, { params: { limit: 12 } }),
    ]);
    setDoc(d.data.document);
    setTitle(d.data.document.title);
    setDescription(d.data.document.description || '');
    setPerms(p.data.items);
    setVersions(v.data.items);
    setActivity(a.data.items);
  }

  useEffect(() => {
    load().catch((err) => setError(errorMessage(err, 'Document unavailable')));
  }, [id]);

  const previewable = Boolean(doc && ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'].includes(doc.mimeType));

  useEffect(() => {
    if (!doc || !previewable) return;
    let cancelled = false;
    let createdUrl = null;

    setPreviewLoading(true);
    setPreviewError('');

    api
      .get(`/documents/${id}/preview`, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        const blob = new Blob([res.data], { type: doc.mimeType });
        createdUrl = URL.createObjectURL(blob);
        setPreviewBlobUrl(createdUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        setPreviewError(errorMessage(err, 'Unable to load preview'));
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [id, doc?.version, previewable]);

  const access = doc?.access || {};

  async function saveMeta(e) {
    e.preventDefault();
    const data = new FormData();
    data.append('title', title);
    data.append('description', description);
    if (replaceFile) data.append('file', replaceFile);
    await api.patch(`/documents/${id}`, data);
    setReplaceFile(null);
    await load();
  }

  async function changeVisibility(visibility) {
    await api.patch(`/documents/${id}/visibility`, { visibility });
    await load();
  }

  async function searchUsers(e) {
    e.preventDefault();
    const res = await api.get('/users/search', { params: { q: query } });
    setResults(res.data.items);
  }

  async function grant(userId, permission) {
    await api.put(`/documents/${id}/permissions/${userId}`, { permission });
    setResults([]);
    setQuery('');
    await load();
  }

  async function revoke(userId) {
    await api.delete(`/documents/${id}/permissions/${userId}`);
    await load();
  }

  async function download(version) {
    const res = await api.get(`/documents/${id}/download`, {
      params: version ? { version } : {},
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.originalFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return <div className="card p-8 text-rose-700">{error}</div>;
  }
  if (!doc) return <p>Loading…</p>;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-stone-500">Document {doc.id}</p>
          <h1 className="font-display text-4xl">{doc.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge value={access.role} />
            <Badge value={doc.visibility} />
            <Badge value={`v${doc.version}`} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {access.canDownload ? (
            <button onClick={() => download()} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
              Download
            </button>
          ) : null}
          {access.canDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="rounded-full bg-rose-700 px-4 py-2 text-sm font-semibold text-white">
              Delete
            </button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-6 space-y-4">
          <h2 className="font-display text-2xl">Details</h2>
          <p className="text-stone-600">{doc.description || 'No description.'}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">Publisher</dt>
              <dd className="font-medium">{doc.publisher?.name} · {doc.publisher?.email}</dd>
            </div>
            <div>
              <dt className="text-stone-500">File</dt>
              <dd>{doc.originalFilename} ({formatBytes(doc.size)})</dd>
            </div>
            <div>
              <dt className="text-stone-500">Updated</dt>
              <dd>{formatDate(doc.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Your access</dt>
              <dd>
                {access.role === 'publisher' && 'Publisher — you can read, edit, share, and delete.'}
                {access.role === 'admin' && 'Administrator — you can read, edit, share, and delete.'}
                {access.role === 'editor' && 'Editor — you can read and replace the file. You cannot change sharing.'}
                {access.role === 'viewer' && 'Viewer — you can read this document. You cannot edit.'}
                {access.role === 'org-viewer' && 'Organization reader — you can read this document. You cannot edit unless granted Editor.'}
                {!['publisher', 'admin', 'editor', 'viewer', 'org-viewer'].includes(access.role) && 'No access.'}
              </dd>
            </div>
          </dl>

          {previewable ? (
            <div className="space-y-2">
              {previewLoading && (
                <div className="flex h-64 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-500">
                  Loading preview…
                </div>
              )}
              {previewError && !previewLoading && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {previewError}
                </div>
              )}
              {previewBlobUrl && !previewLoading && (
                <>
                  {doc.mimeType.startsWith('image/') ? (
                    <div className="flex justify-center rounded-xl border border-stone-200 bg-stone-50 p-2">
                      <img src={previewBlobUrl} alt={doc.title} className="max-h-96 rounded-lg object-contain" />
                    </div>
                  ) : (
                    <iframe title="Preview" className="h-96 w-full rounded-xl border border-stone-200" src={previewBlobUrl} />
                  )}
                  <div className="flex justify-end">
                    <a
                      href={previewBlobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-accent underline hover:opacity-80"
                    >
                      Open preview in new tab ↗
                    </a>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-stone-500">Preview is available for PDF, images, and text files.</p>
          )}

          {access.canEdit ? (
            <form onSubmit={saveMeta} className="space-y-3 border-t border-stone-100 pt-4">
              <h3 className="font-semibold">Edit document</h3>
              <p className="text-sm text-stone-600">
                File contents are not edited in the browser. Download the file, change it in Word or Acrobat, then upload the
                new file here as a replacement. Title and description can be updated without replacing the file.
              </p>
              <label className="block text-sm font-medium">
                Title
                <input className="mt-1 w-full rounded-xl border px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="block text-sm font-medium">
                Description
                <textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows="3" value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label className="block text-sm font-medium">
                Replace file (new version)
                <input className="mt-1 w-full text-sm" type="file" onChange={(e) => setReplaceFile(e.target.files?.[0] || null)} />
                <span className="mt-1 block text-xs font-normal text-stone-500">
                  Optional. The previous file is kept in version history. Current version: v{doc.version}.
                  {replaceFile ? ` Selected: ${replaceFile.name}` : ''}
                </span>
              </label>
              <button className="rounded-full bg-moss px-4 py-2 text-sm font-semibold text-white">Save changes</button>
            </form>
          ) : (
            <p className="border-t border-stone-100 pt-4 text-sm text-stone-500">
              You have read access only. Ask the publisher or an administrator for Editor permission if you need to replace the file.
            </p>
          )}
        </section>

        <div className="space-y-6">
          {(access.canManagePermissions || isAdmin) && (
            <section className="card p-6 space-y-4">
              <h2 className="font-display text-2xl">Access</h2>
              <p className="text-sm text-stone-600">
                <strong>Viewer</strong> can read (and download if allowed). <strong>Editor</strong> can read and replace the file.
                Editors cannot invite others. Visibility only controls who can discover the document.
              </p>
              {isAdmin || access.role === 'publisher' ? (
                <label className="block text-sm">
                  Who can read it
                  <select
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={doc.visibility}
                    onChange={(e) => changeVisibility(e.target.value)}
                  >
                    <option value="private">Private — publisher and admin only</option>
                    <option value="restricted">Restricted — invited viewers and editors</option>
                    {isAdmin ? <option value="organization">Organization-wide — all employees can read</option> : null}
                  </select>
                </label>
              ) : null}
              <form onSubmit={searchUsers} className="flex gap-2">
                <input className="flex-1 rounded-xl border px-3 py-2 text-sm" placeholder="Search employee to grant access" value={query} onChange={(e) => setQuery(e.target.value)} />
                <button className="rounded-full bg-ink px-3 py-2 text-sm text-white">Find</button>
              </form>
              {results.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-sm">
                  <span>{u.name} · {u.email}</span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => grant(u.id, 'viewer')} className="underline">Viewer (read)</button>
                    <button type="button" onClick={() => grant(u.id, 'editor')} className="underline">Editor (replace file)</button>
                  </span>
                </div>
              ))}
              <ul className="space-y-2 text-sm">
                {perms.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-xl border border-stone-100 px-3 py-2">
                    <span>
                      {p.user?.name} · {p.user?.email}
                      <Badge value={p.permission} />
                    </span>
                    <span className="flex gap-2">
                      {p.permission === 'viewer' ? (
                        <button type="button" onClick={() => grant(p.user.id, 'editor')} className="text-moss">Upgrade</button>
                      ) : (
                        <button type="button" onClick={() => grant(p.user.id, 'viewer')} className="text-accent">Downgrade</button>
                      )}
                      <button type="button" onClick={() => revoke(p.user.id)} className="text-rose-700">Revoke</button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-6">
            <h2 className="font-display text-2xl">Versions</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {versions.map((v) => (
                <li key={v.versionNumber} className="flex items-center justify-between">
                  <span>
                    v{v.versionNumber} · {v.changeDescription || 'Update'} · {formatDate(v.createdAt)}
                  </span>
                  {access.canDownload ? (
                    <button type="button" className="underline" onClick={() => download(v.versionNumber)}>
                      Download
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-6">
            <h2 className="font-display text-2xl">Activity</h2>
            <ul className="mt-3 space-y-2 text-sm text-stone-600">
              {activity.map((item) => (
                <li key={item.id}>
                  {formatDate(item.timestamp)} · {item.action} {item.actor ? `· ${item.actor.name}` : ''}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete document"
          body="This hides the document from all users. Historical versions remain in private storage."
          confirmLabel="Delete"
          danger
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await api.delete(`/documents/${id}`);
            navigate('/published');
          }}
        />
      ) : null}
    </div>
  );
}
