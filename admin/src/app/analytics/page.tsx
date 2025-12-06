'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RouteGuard from '@/components/RouteGuard';
import { getCatalog } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

function AnalyticsContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    byStyle: {} as Record<string, number>,
    byRatio: {} as Record<string, number>,
    byPalette: {} as Record<string, number>,
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getAccessToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const data = await getCatalog({ type: 'wallpaper', limit: 1000 });

      if (data.ok && data.items) {
        const items = data.items;
        
        const byStyle: Record<string, number> = {};
        const byRatio: Record<string, number> = {};
        const byPalette: Record<string, number> = {};

        items.forEach((item: any) => {
          if (item.style) {
            byStyle[item.style] = (byStyle[item.style] || 0) + 1;
          }
          if (item.ratio) {
            byRatio[item.ratio] = (byRatio[item.ratio] || 0) + 1;
          }
          if (item.palette) {
            byPalette[item.palette] = (byPalette[item.palette] || 0) + 1;
          }
        });

        setStats({
          total: items.length,
          byStyle,
          byRatio,
          byPalette,
        });
      } else {
        setError(data.error || 'Failed to load analytics');
      }
    } catch (err: any) {
      console.error('Error loading analytics:', err);
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login');
        return;
      }
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
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
          onClick={loadAnalytics}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const sortedStyles = Object.entries(stats.byStyle)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  const sortedRatios = Object.entries(stats.byRatio)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  const sortedPalettes = Object.entries(stats.byPalette)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
        <p className="text-gray-600 mt-1">Platform statistics and insights</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Wallpapers</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Unique Styles</h3>
          <p className="text-3xl font-bold text-gray-900">{Object.keys(stats.byStyle).length}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Aspect Ratios</h3>
          <p className="text-3xl font-bold text-gray-900">{Object.keys(stats.byRatio).length}</p>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Style */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Style</h3>
          {sortedStyles.length === 0 ? (
            <p className="text-gray-500 text-sm">No style data available</p>
          ) : (
            <div className="space-y-3">
              {sortedStyles.map(([style, count]) => (
                <div key={style} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{style || 'Unspecified'}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${(count / stats.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Aspect Ratio */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Aspect Ratio</h3>
          {sortedRatios.length === 0 ? (
            <p className="text-gray-500 text-sm">No ratio data available</p>
          ) : (
            <div className="space-y-3">
              {sortedRatios.map(([ratio, count]) => (
                <div key={ratio} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{ratio || 'Unspecified'}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${(count / stats.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Palette Breakdown */}
      {sortedPalettes.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Palette</h3>
          <div className="space-y-3">
            {sortedPalettes.map(([palette, count]) => (
              <div key={palette} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{palette || 'Unspecified'}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: `${(count / stats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <RouteGuard>
      <AnalyticsContent />
    </RouteGuard>
  );
}

