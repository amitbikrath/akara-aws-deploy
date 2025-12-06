'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RouteGuard from '@/components/RouteGuard';
import { getCatalog } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

function WallpapersList() {
  const router = useRouter();
  const [wallpapers, setWallpapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStyle, setFilterStyle] = useState('');
  const [filterRatio, setFilterRatio] = useState('');

  useEffect(() => {
    loadWallpapers();
  }, []);

  const loadWallpapers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getAccessToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const data = await getCatalog({ type: 'wallpaper', limit: 100 });
      
      if (data.ok) {
        setWallpapers(data.items || []);
      } else {
        setError(data.error || 'Failed to load wallpapers');
      }
    } catch (err: any) {
      console.error('Error loading wallpapers:', err);
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login');
        return;
      }
      setError(err.message || 'Failed to load wallpapers');
    } finally {
      setLoading(false);
    }
  };

  const filteredWallpapers = wallpapers.filter(wp => {
    const matchesSearch = !searchTerm || 
      wp.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wp.caption?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStyle = !filterStyle || wp.style === filterStyle;
    const matchesRatio = !filterRatio || wp.ratio === filterRatio;
    return matchesSearch && matchesStyle && matchesRatio;
  });

  const styles = Array.from(new Set(wallpapers.map(wp => wp.style).filter(Boolean))).sort();
  const ratios = Array.from(new Set(wallpapers.map(wp => wp.ratio).filter(Boolean))).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading wallpapers...</p>
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
          onClick={loadWallpapers}
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
          <h2 className="text-2xl font-bold text-gray-900">Wallpapers</h2>
          <p className="text-gray-600 mt-1">
            Manage your wallpaper collection ({filteredWallpapers.length} items)
          </p>
        </div>
        <Link
          href="/upload"
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
        >
          Upload New
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or caption..."
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Style
            </label>
            <select
              value={filterStyle}
              onChange={(e) => setFilterStyle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Styles</option>
              {styles.map(style => (
                <option key={style} value={style}>{style}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aspect Ratio
            </label>
            <select
              value={filterRatio}
              onChange={(e) => setFilterRatio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Ratios</option>
              {ratios.map(ratio => (
                <option key={ratio} value={ratio}>{ratio}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thumbnail
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Style
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ratio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredWallpapers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No wallpapers found. <Link href="/upload" className="text-indigo-600 hover:underline">Upload one?</Link>
                  </td>
                </tr>
              ) : (
                filteredWallpapers.map((wp) => (
                  <tr key={wp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {wp.thumbKey ? (
                        <div className="w-16 h-16 bg-gray-200 rounded overflow-hidden">
                          <img
                            src={wp.thumbKey.startsWith('http') ? wp.thumbKey : `/${wp.thumbKey}`}
                            alt={wp.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">
                          No thumb
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{wp.title || 'Untitled'}</div>
                      {wp.caption && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">{wp.caption}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {wp.style || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {wp.ratio || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {wp.createdAt ? new Date(wp.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/wallpapers/${wp.id}`}
                        className="text-indigo-600 hover:text-indigo-900 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function WallpapersPage() {
  return (
    <RouteGuard>
      <WallpapersList />
    </RouteGuard>
  );
}

