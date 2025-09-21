'use client';

import { useEffect, useState } from 'react';

interface MusicItem {
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

export default function MusicGallery() {
  const [music, setMusic] = useState<MusicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const fetchMusic = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!apiUrl) {
          throw new Error('API URL not configured');
        }

        const response = await fetch(`${apiUrl}/api/catalog?type=music`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch music: ${response.statusText}`);
        }

        const data = await response.json();
        setMusic(data.items || []);
      } catch (err) {
        console.error('Error fetching music:', err);
        setError(err instanceof Error ? err.message : 'Failed to load music');
      } finally {
        setLoading(false);
      }
    };

    fetchMusic();
  }, []);

  const handlePlay = (trackId: string) => {
    if (currentTrack === trackId && isPlaying) {
      setIsPlaying(false);
    } else {
      setCurrentTrack(trackId);
      setIsPlaying(true);
    }
  };

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
      {/* Music Grid */}
      {music.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-white/60 text-lg mb-4">
            No music tracks available yet.
          </div>
          <p className="text-white/40 text-sm">
            Upload some music in the admin panel to see them here!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {music.map(track => (
            <div
              key={track.id}
              className="card-glass group overflow-hidden"
            >
              {/* Vinyl Player Visual */}
              <div className="relative aspect-square mb-4 overflow-hidden rounded-xl bg-gradient-to-br from-gray-800 to-gray-900">
                <div className={`absolute inset-4 rounded-full bg-gradient-to-br from-gray-700 to-black border-4 border-gray-600 ${
                  currentTrack === track.id && isPlaying ? 'animate-spin' : ''
                }`}>
                  <div className="absolute inset-1/3 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500">
                    <div className="absolute inset-1/3 rounded-full bg-black"></div>
                  </div>
                </div>
                
                {/* Play Button */}
                <button
                  onClick={() => handlePlay(track.id)}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                    {currentTrack === track.id && isPlaying ? (
                      <svg className="w-8 h-8 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>

                {/* Hidden Audio Element */}
                <audio
                  key={track.id}
                  autoPlay={currentTrack === track.id && isPlaying}
                  onEnded={() => setIsPlaying(false)}
                  onError={() => {
                    console.error('Audio failed to load:', track.fileKey);
                    setIsPlaying(false);
                  }}
                >
                  <source src={`/content/${track.fileKey}`} type="audio/mpeg" />
                  <source src={`/content/${track.fileKey}`} type="audio/wav" />
                </audio>
              </div>

              {/* Content */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-white font-semibold text-lg line-clamp-1">
                    {track.title}
                  </h3>
                  {track.caption && (
                    <p className="text-white/70 text-sm line-clamp-2">
                      {track.caption}
                    </p>
                  )}
                </div>

                {/* Shloka */}
                {track.shloka && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-md">
                    <p className="text-orange-300 text-sm italic">{track.shloka}</p>
                    {track.meaning && (
                      <p className="text-orange-200 text-xs mt-1">{track.meaning}</p>
                    )}
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {track.style && (
                    <span className="text-xs bg-white/10 text-white/80 px-2 py-1 rounded-full">
                      {track.style}
                    </span>
                  )}
                  <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
                    Audio
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}