'use client';

import { useEffect, useState } from 'react';

interface WallpaperItem {
  id: string;
  title: string;
  caption: string;
  shloka: string;
  meaning: string;
  fileKey: string;
  thumbKey?: string;
  ratio: string;
  palette: string[];
  style: string;
  createdAt: string;
}

export default function WallpapersGallery() {
  const [wallpapers, setWallpapers] = useState<WallpaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState('all');

  useEffect(() => {
    const fetchWallpapers = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!apiUrl) {
          throw new Error('API URL not configured');
        }

        const response = await fetch(`${apiUrl}/api/catalog?type=wallpaper`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch wallpapers: ${response.statusText}`);
        }

        const data = await response.json();
        setWallpapers(data.items || []);
      } catch (err) {
        console.error('Error fetching wallpapers:', err);
        setError(err instanceof Error ? err.message : 'Failed to load wallpapers');
      } finally {
        setLoading(false);
      }
    };

    fetchWallpapers();
  }, []);

  const filteredWallpapers = wallpapers.filter(wallpaper => {
    if (selectedStyle !== 'all' && wallpaper.style !== selectedStyle) return false;
    return true;
  });

  const styles = ['all', ...Array.from(new Set(wallpapers.map(w => w.style).filter(Boolean)))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md mx-auto">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-glass"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      {styles.length > 1 && (
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            <span className="text-white/80 font-medium">Style:</span>
            {styles.map(style => (
              <button
                key={style}
                onClick={() => setSelectedStyle(style)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedStyle === style
                    ? 'bg-primary-500 text-white'
                    : 'glass text-white hover:bg-white/20'
                }`}
              >
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gallery Grid */}
      {wallpapers.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-white/60 text-lg mb-4">
            No wallpapers available yet.
          </div>
          <p className="text-white/40 text-sm">
            Upload some content in the admin panel to see them here!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredWallpapers.map(wallpaper => (
            <div
              key={wallpaper.id}
              className="card-glass group cursor-pointer overflow-hidden"
            >
              {/* Image */}
              <div className="relative aspect-[4/5] mb-4 overflow-hidden rounded-xl">
                <img
                  src={`/content/${wallpaper.fileKey}`}
                  alt={wallpaper.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-800/50">
                  <p className="text-white/70 text-sm">Image loading...</p>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-white font-semibold text-lg line-clamp-1">
                    {wallpaper.title}
                  </h3>
                  {wallpaper.caption && (
                    <p className="text-white/70 text-sm line-clamp-2">
                      {wallpaper.caption}
                    </p>
                  )}
                </div>

                {/* Shloka */}
                {wallpaper.shloka && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-md">
                    <p className="text-orange-300 text-sm italic">{wallpaper.shloka}</p>
                    {wallpaper.meaning && (
                      <p className="text-orange-200 text-xs mt-1">{wallpaper.meaning}</p>
                    )}
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {wallpaper.style && (
                    <span className="text-xs bg-white/10 text-white/80 px-2 py-1 rounded-full">
                      {wallpaper.style}
                    </span>
                  )}
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                    {wallpaper.ratio}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredWallpapers.length === 0 && wallpapers.length > 0 && (
        <div className="text-center py-12">
          <div className="text-white/60 text-lg">
            No wallpapers found matching your filters.
          </div>
          <button
            onClick={() => setSelectedStyle('all')}
            className="btn-glass mt-4"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}