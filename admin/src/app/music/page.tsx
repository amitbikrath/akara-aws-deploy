'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RouteGuard from '@/components/RouteGuard';
import { getAccessToken } from '@/lib/auth';
import { getCatalog, manageCatalog } from '@/lib/api';
import { cdnUrl } from '@/lib/cdn';

function MusicPageContent() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    loadMusic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMusic = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!getAccessToken()) {
        router.push('/login.html');
        return;
      }

      const data = await getCatalog({ type: 'music', limit: 200, includeArchived: true });
      if (data.ok) {
        setItems(data.items || []);
      } else {
        setError(data.error || 'Failed to load music');
      }
    } catch (err: any) {
      console.error('Error loading music:', err);
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login.html');
        return;
      }
      setError(err.message || 'Failed to load music');
    } finally {
      setLoading(false);
    }
  };

  const filtered = items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(q) ||
      (item.caption || '').toLowerCase().includes(q)
    );
  });

  const handleArchiveToggle = async (item: any) => {
    const action = item.archived ? 'unarchive' : 'archive';
    const label = item.archived ? 'unarchive' : 'archive';
    if (!window.confirm(`Are you sure you want to ${label} "${item.title || item.id}"?`)) return;
    try {
      setBusyId(item.id);
      await manageCatalog({ action, type: 'music', id: item.id, version: item.version || '1' });
      await loadMusic();
    } catch (err: any) {
      setError(err.message || `Failed to ${label} item`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: any) => {
    if (!window.confirm(`Delete "${item.title || item.id}" permanently? This cannot be undone.`)) return;
    try {
      setBusyId(item.id);
      await manageCatalog({ action: 'delete', type: 'music', id: item.id, version: item.version || '1' });
      await loadMusic();
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading music...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
        <button
          onClick={loadMusic}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Music</h2>
          <p className="text-gray-600 mt-1">Manage tracks ({filtered.length} items)</p>
        </div>
        <Link
          href="/music/upload"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-transform duration-150 ease-out motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:hover:bg-indigo-700 active:scale-[0.97] motion-reduce:active:scale-100"
        >
          Upload new
        </Link>
      </div>

      <div className="glass-panel space-y-4 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or lyrics…"
              className="glass-input"
            />
          </div>
          <div className="flex items-end justify-end gap-2">
            <button onClick={loadMusic} className="glass-chip px-3 py-2 text-sm text-black">
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-black/10">
            <thead className="bg-white/35">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">
                  Art
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">
                  Title
                </th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 lg:table-cell">
                  Audio file
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 bg-white/30">
              {filtered.map((item) => {
                const artKey = item.thumbKey || item.albumArtKey || '';
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors duration-150 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/45 ${item.archived ? 'opacity-60' : ''}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 sm:px-6">
                      {artKey ? (
                        <div className="h-14 w-14 overflow-hidden rounded-lg border border-black/10 bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cdnUrl(String(artKey))}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-black/15 bg-white/50 text-[10px] text-gray-400">
                          No art
                        </div>
                      )}
                    </td>
                    <td className="max-w-[200px] px-4 py-3 sm:max-w-xs sm:px-6">
                      <div className="text-sm font-medium text-gray-900">{item.title || item.id}</div>
                      {item.caption ? (
                        <div className="line-clamp-2 text-xs text-gray-500">{item.caption}</div>
                      ) : null}
                    </td>
                    <td className="hidden whitespace-nowrap px-6 py-3 text-sm text-gray-700 lg:table-cell">
                      {item.fileKey ? (
                        <code className="text-xs">{String(item.fileKey).split('/').pop()}</code>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm sm:px-6">
                      {item.archived ? (
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">Archived</span>
                      ) : (
                        <span className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                        <Link
                          href={`/music/edit?id=${item.id}`}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-center text-sm font-medium text-white transition-transform duration-150 ease-out motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:hover:bg-indigo-700 active:scale-[0.97] motion-reduce:active:scale-100"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleArchiveToggle(item)}
                          disabled={busyId === item.id}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 transition-transform duration-150 ease-out motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-amber-100 active:scale-[0.97] motion-reduce:active:scale-100"
                        >
                          {item.archived ? 'Unarchive' : 'Archive'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={busyId === item.id}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 transition-transform duration-150 ease-out motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-red-100 active:scale-[0.97] motion-reduce:active:scale-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No music items found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function MusicPage() {
  return (
    <RouteGuard>
      <MusicPageContent />
    </RouteGuard>
  );
}
