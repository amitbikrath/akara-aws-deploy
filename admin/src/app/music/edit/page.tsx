'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import RouteGuard from '@/components/RouteGuard';
import { apiRequest, getCatalog, manageCatalog } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { cdnUrl } from '@/lib/cdn';

const uploadViaPresign = async ({ file, type }: { file: File; type: string }): Promise<{ key: string }> => {
  let data: any;
  const dotIndex = file.name.lastIndexOf('.');
  const fileExt = dotIndex >= 0 ? file.name.slice(dotIndex + 1).toLowerCase() : '';
  const contentType = file.type || 'application/octet-stream';
  const res = await apiRequest('/api/upload-url', {
    method: 'POST',
    body: JSON.stringify({ contentType, fileExt, type, filename: file.name }),
  });
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Bad JSON from presign: ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`Presign failed ${res.status}: ${data?.error || text}`);
  const uploadUrl = data.uploadUrl || data.url;
  const key = data.key;
  if (!uploadUrl || !key) throw new Error('Presign response missing uploadUrl/key');
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!putRes.ok) {
    const body = await putRes.text().catch(() => '');
    throw new Error(`S3 PUT failed ${putRes.status}: ${body.slice(0, 200)}`);
  }
  return { key: String(key) };
};

function MusicEditPageContent() {
  const router = useRouter();
  const id = useSearchParams().get('id') || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [version, setVersion] = useState('1');
  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [thumbKey, setThumbKey] = useState('');

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const loadTrack = useCallback(async () => {
    if (!id) {
      setError('Missing track id');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      if (!getAccessToken()) {
        router.push('/login.html');
        return;
      }

      const data = await getCatalog({ type: 'music', limit: 500, includeArchived: true });
      if (!data.ok || !data.items) {
        setError(data.error || 'Failed to load catalog');
        return;
      }
      const item = data.items.find((it: any) => it.id === id);
      if (!item) {
        setError('Track not found');
        return;
      }
      setVersion(String(item.version || '1'));
      setTitle(String(item.title || ''));
      const caption = item.caption || '';
      const itemLyrics = item.lyrics || '';
      setLyrics(itemLyrics || caption);
      setFileKey(String(item.fileKey || ''));
      setThumbKey(String(item.thumbKey || item.albumArtKey || ''));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load track';
      if (message.includes('401') || message.includes('Unauthorized')) {
        router.push('/login.html');
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadTrack();
  }, [loadTrack]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [coverFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      if (!getAccessToken()) {
        router.push('/login.html');
        return;
      }

      let newFileKey = fileKey;
      let newThumbKey = thumbKey;
      let newAlbumArtKey = thumbKey;

      if (audioFile) {
        const { key } = await uploadViaPresign({ file: audioFile, type: 'music' });
        newFileKey = key;
      }
      if (coverFile) {
        const { key } = await uploadViaPresign({ file: coverFile, type: 'music' });
        newThumbKey = key;
        newAlbumArtKey = key;
      }

      const result = await manageCatalog({
        action: 'update',
        type: 'music',
        id,
        version,
        title: title.trim(),
        caption: lyrics,
        lyrics,
        ...(audioFile ? { fileKey: newFileKey } : {}),
        ...(coverFile ? { thumbKey: newThumbKey, albumArtKey: newAlbumArtKey } : {}),
      });
      if (!result.ok) {
        setError(result.error || 'Failed to save track');
        return;
      }
      setSuccess(true);
      setAudioFile(null);
      setCoverFile(null);
      setFileKey(newFileKey);
      setThumbKey(newThumbKey);
      setTimeout(() => {
        router.push('/music');
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save track');
    } finally {
      setSaving(false);
    }
  };

  const coverSrc = coverPreview || (thumbKey ? cdnUrl(thumbKey) : '');

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-gray-600">Loading track…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Edit track</h2>
          <p className="mt-1 text-gray-600">Update title, lyrics, or replace audio / cover art.</p>
        </div>
        <Link
          href="/music"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-black/10 bg-white/80 px-4 py-2 text-sm font-medium text-gray-800 transition-transform duration-150 ease-out motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white active:scale-[0.97] motion-reduce:active:scale-100"
        >
          Back to music
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      ) : null}

      {success ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
          <p className="font-semibold">Saved</p>
          <p>Redirecting to the music list…</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="glass-panel space-y-6 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="music-title">
            Title
          </label>
          <input
            id="music-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="glass-input"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="music-lyrics">
            Lyrics
          </label>
          <textarea
            id="music-lyrics"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={8}
            className="glass-input"
            placeholder="Lyrics or notes shown with the track"
          />
        </div>

        <div className="grid gap-6 border-t border-black/10 pt-6 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="replace-audio">
              Replace audio (optional)
            </label>
            <input
              id="replace-audio"
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
              className="glass-input text-sm"
            />
            {fileKey ? (
              <p className="mt-1 text-xs text-gray-500">Current: {fileKey.split('/').pop()}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="replace-cover">
              Replace cover art (optional)
            </label>
            <input
              id="replace-cover"
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
              className="glass-input text-sm"
            />
            {coverSrc ? (
              <div className="mt-3 h-28 w-28 overflow-hidden rounded-xl border border-black/10 bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverSrc} alt="" className="h-full w-full object-cover" />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-black/10 pt-4">
          <Link
            href="/music"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-black/10 bg-white/80 px-4 py-2 text-sm font-medium text-gray-800 transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-[0.97] motion-reduce:active:scale-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-transform duration-150 ease-out motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-indigo-700 active:scale-[0.97] motion-reduce:active:scale-100"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function MusicEditPage() {
  return (
    <RouteGuard>
      <MusicEditPageContent />
    </RouteGuard>
  );
}
