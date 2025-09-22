'use client';

import { useEffect, useState } from 'react';

interface CatalogItem {
  id: string;
  type: string;
  title: string;
  caption: string;
  shloka: string;
  meaning: string;
  fileKey: string;
  thumbKey?: string;
  ratio: string;
  palette: string;
  style: string;
  createdAt: string;
}

export default function MusicPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMusic = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
        const response = await fetch(`${apiBase}/api/catalog?type=music&limit=20`);
        const data = await response.json();
        
        if (data.ok) {
          setItems(data.items || []);
        } else {
          setError(data.error || 'Failed to load music');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load music');
      } finally {
        setLoading(false);
      }
    };

    fetchMusic();
  }, []);

  const togglePlay = (id: string) => {
    setPlayingId(playingId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Music</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200"></div>
                <div className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Music</h1>
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Music</h1>
        
        {items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No music available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-square bg-gradient-to-br from-purple-400 to-pink-400 relative flex items-center justify-center">
                  {item.thumbKey ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_ASSETS_CDN_URL}/${item.thumbKey}`}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-white text-6xl">🎵</div>
                  )}
                  <button
                    onClick={() => togglePlay(item.id)}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-50 transition-all"
                  >
                    {playingId === item.id ? (
                      <div className="text-white text-4xl">⏸️</div>
                    ) : (
                      <div className="text-white text-4xl">▶️</div>
                    )}
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                  {item.caption && (
                    <p className="text-sm text-gray-600 mb-2">{item.caption}</p>
                  )}
                  {item.shloka && (
                    <div className="text-sm text-gray-700 mb-2">
                      <p className="font-medium">Shloka:</p>
                      <p className="italic">{item.shloka}</p>
                    </div>
                  )}
                  {item.meaning && (
                    <div className="text-sm text-gray-700 mb-2">
                      <p className="font-medium">Meaning:</p>
                      <p>{item.meaning}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {item.palette && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {item.palette}
                      </span>
                    )}
                    {item.style && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        {item.style}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Audio element for playing */}
                {playingId === item.id && (
                  <audio
                    src={`${process.env.NEXT_PUBLIC_ASSETS_CDN_URL}/${item.fileKey}`}
                    autoPlay
                    controls
                    className="w-full"
                    onEnded={() => setPlayingId(null)}
                    onError={() => {
                      console.error('Audio playback failed for:', item.title);
                      setPlayingId(null);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}