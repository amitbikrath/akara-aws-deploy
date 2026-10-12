'use client';

import { useState } from 'react';
import RouteGuard from '@/components/RouteGuard';
import { apiRequest } from '@/lib/api';

interface Match { wmId: string; email: string; sub: string; createdAt: string; z: number }
interface Result { itemId: string; candidates: number; matches: Match[]; top?: Match[] }

// Shrink big screenshots before upload: API Gateway caps bodies at 10 MB, and
// the fingerprint lives at a coarse scale, so 1600 px is plenty.
async function toJpegBase64(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.92);
}

function FindDownloader() {
  const [preview, setPreview] = useState<string | null>(null);
  const [itemId, setItemId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (file: File) => {
    setBusy(true); setError(null); setResults(null); setNote(null);
    try {
      const image = await toJpegBase64(file);
      setPreview(image);
      const res = await apiRequest('/api/darshan/find', {
        method: 'POST',
        body: JSON.stringify({ image, ...(itemId.trim() ? { itemId: itemId.trim() } : {}) }),
      });
      const data = await res.json();
      if (res.status === 403) throw new Error('Your login is not in the admin group yet. Sign out and sign in again.');
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResults(data.results || []);
      if (data.note) setNote(data.note);
    } catch (e: any) {
      setError(e.message || 'Lookup failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Find downloader</h2>
        <p className="text-gray-600 mt-1">
          Found an Akara image used somewhere it should not be? Upload the copy. Every signed-in download carries an
          invisible mark; this checks which account it came from. Works on resized, re-saved and moderately cropped
          copies. A heavy crop or an AI redraw can remove the mark.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Artwork ID (optional)</label>
          <input
            type="text" value={itemId} onChange={(e) => setItemId(e.target.value)}
            placeholder="Leave empty to recognise the artwork automatically"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
          />
        </div>
        <label className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-indigo-400 text-gray-500">
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />
          {busy ? 'Checking…' : 'Choose or drop the found image'}
        </label>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">{error}</div>}
      {note && <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded">{note}</div>}

      {results && (
        <div className="bg-white rounded-lg shadow p-6 flex gap-6">
          {preview && <img src={preview} alt="" className="w-40 rounded object-cover" />}
          <div className="flex-1 space-y-4">
            {results.length === 0 && <p className="text-gray-600">No match.</p>}
            {results.map((r) => (
              <div key={r.itemId}>
                <p className="text-xs text-gray-400 font-mono">artwork {r.itemId} · {r.candidates} logged download{r.candidates === 1 ? '' : 's'}</p>
                {r.matches.length ? r.matches.map((m) => (
                  <div key={m.wmId} className="mt-2 p-3 rounded bg-green-50 border border-green-200">
                    <p className="font-semibold text-green-900">{m.email || '(no email on record)'}</p>
                    <p className="text-sm text-green-800">Downloaded {new Date(m.createdAt).toLocaleString()} · match score {m.z} (needs 6)</p>
                    <p className="text-xs text-green-700 font-mono">user {m.sub} · mark {m.wmId}</p>
                  </div>
                )) : (
                  <p className="mt-2 text-gray-600 text-sm">
                    No logged download matches{r.top?.length ? ` (best score ${r.top[0].z}, needs 6)` : ''}. The copy may come
                    from before downloads were marked, from a screenshot of the watermarked preview, or it was edited too much.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FindPage() {
  return (
    <RouteGuard>
      <FindDownloader />
    </RouteGuard>
  );
}
