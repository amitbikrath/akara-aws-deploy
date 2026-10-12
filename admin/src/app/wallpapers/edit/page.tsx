'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import RouteGuard from '@/components/RouteGuard';
import { getCatalog, manageCatalog } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

// Static export can't build dynamic [id] routes; the live admin uses
// /wallpapers/edit?id=<id>, so this page matches that URL scheme.
// useSearchParams is only ever called client-side because RouteGuard renders
// its "Checking authentication" state during prerender, so no Suspense
// boundary is needed (matches the deployed build).
function WallpaperEdit() {
  const router = useRouter();
  const id = useSearchParams().get('id') || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [version, setVersion] = useState('1');

  const [formData, setFormData] = useState({
    title: '',
    caption: '',
    shloka: '',
    meaning: '',
    style: '',
    ratio: '',
    palette: '',
    hiddenFromPublic: false,
  });

  useEffect(() => {
    loadWallpaper();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadWallpaper = async () => {
    if (!id) {
      setError('Missing wallpaper id');
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

      const data = await getCatalog({
        type: 'wallpaper',
        limit: 1000,
        includeArchived: true,
        includeHidden: true,
      });

      if (data.ok && data.items) {
        const wallpaper = data.items.find((item: any) => item.id === id);

        if (wallpaper) {
          setVersion(wallpaper.version || '1');
          setFormData({
            title: wallpaper.title || '',
            caption: wallpaper.caption || '',
            shloka: wallpaper.shloka || '',
            meaning: wallpaper.meaning || '',
            style: wallpaper.style || '',
            ratio: wallpaper.ratio || '',
            palette: wallpaper.palette || '',
            hiddenFromPublic: !!wallpaper.hiddenFromPublic,
          });
        } else {
          setError('Wallpaper not found');
        }
      } else {
        setError(data.error || 'Failed to load wallpaper');
      }
    } catch (err: any) {
      console.error('Error loading wallpaper:', err);
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login.html');
        return;
      }
      setError(err.message || 'Failed to load wallpaper');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      if (!getAccessToken()) {
        router.push('/login.html');
        return;
      }

      // Re-fetch to get the current version for optimistic locking
      const catalogData = await getCatalog({
        type: 'wallpaper',
        limit: 1000,
        includeArchived: true,
        includeHidden: true,
      });
      const original = catalogData.items?.find((item: any) => item.id === id);

      if (!original) {
        throw new Error('Wallpaper not found');
      }

      const result = await manageCatalog({
        action: 'update',
        type: 'wallpaper',
        id,
        version: version || original.version || '1',
        title: formData.title,
        caption: formData.caption,
        shloka: formData.shloka,
        meaning: formData.meaning,
        ratio: formData.ratio,
        palette: formData.palette,
        style: formData.style,
        hiddenFromPublic: formData.hiddenFromPublic,
      });

      if (result.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/wallpapers');
        }, 1500);
      } else {
        setError(result.error || 'Failed to save wallpaper');
      }
    } catch (err: any) {
      console.error('Error saving wallpaper:', err);
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login.html');
        return;
      }
      setError(err.message || 'Failed to save wallpaper');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading wallpaper...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Edit Wallpaper</h2>
          <p className="text-gray-600 mt-1">Update wallpaper metadata</p>
        </div>
        <Link
          href="/wallpapers"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
        >
          Back to List
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded">
          <p className="font-semibold">Success!</p>
          <p>Wallpaper saved successfully. Redirecting...</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel space-y-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="glass-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Style
            </label>
            <input
              type="text"
              value={formData.style}
              onChange={(e) => setFormData({ ...formData, style: e.target.value })}
              placeholder="e.g., Sacred Art, Modern"
              className="glass-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aspect Ratio
            </label>
            <input
              type="text"
              value={formData.ratio}
              onChange={(e) => setFormData({ ...formData, ratio: e.target.value })}
              placeholder="e.g., 16:9, 9:16, 1:1"
              className="glass-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Palette
            </label>
            <input
              type="text"
              value={formData.palette}
              onChange={(e) => setFormData({ ...formData, palette: e.target.value })}
              placeholder="e.g., warm, cool, vibrant"
              className="glass-input"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Caption
            </label>
            <textarea
              value={formData.caption}
              onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
              rows={3}
              placeholder="Brief description of the wallpaper"
              className="glass-input"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shloka
            </label>
            <textarea
              value={formData.shloka}
              onChange={(e) => setFormData({ ...formData, shloka: e.target.value })}
              rows={2}
              placeholder="Sanskrit verse or quote"
              className="glass-input"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meaning
            </label>
            <textarea
              value={formData.meaning}
              onChange={(e) => setFormData({ ...formData, meaning: e.target.value })}
              rows={2}
              placeholder="Translation or meaning of the shloka"
              className="glass-input"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2 pt-2">
            <input
              id="hide-from-public-edit"
              type="checkbox"
              checked={formData.hiddenFromPublic}
              onChange={(e) => setFormData({ ...formData, hiddenFromPublic: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="hide-from-public-edit" className="text-sm text-gray-700 select-none">
              Hide from public site (admin-only)
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Link
            href="/wallpapers"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function WallpaperEditPage() {
  return (
    <RouteGuard>
      <WallpaperEdit />
    </RouteGuard>
  );
}
