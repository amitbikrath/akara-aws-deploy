'use client'

import { useState } from 'react'
import VinylPlayer from './VinylPlayer'

// This would normally fetch from the catalog API
const sampleTracks = [
  {
    id: 'aaya-aaya-hanuman',
    title: 'Aaya Aaya Hanuman',
    artists: ['Akara Studio'],
    genre: 'devotional',
    language: 'hindi',
    duration: 245,
    mood: ['devotional', 'energetic'],
    cover: {
      thumbnail: 'https://via.placeholder.com/200x200/FFD700/000000?text=Hanuman'
    },
    audio: {
      preview: {
        url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3', // Sample URL
        duration: 30
      }
    },
    tags: ['hanuman', 'devotional', 'hindi', 'bhajan'],
    rating: { average: 4.9, count: 203 },
    playCount: 1247
  },
  {
    id: 'o-palanhare',
    title: 'O Palanhare',
    artists: ['Akara Studio'],
    genre: 'devotional',
    language: 'hindi',
    duration: 198,
    mood: ['peaceful', 'contemplative'],
    isPremium: true,
    cover: {
      thumbnail: 'https://via.placeholder.com/200x200/6A4C93/000000?text=Divine'
    },
    audio: {
      preview: {
        url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3', // Sample URL
        duration: 30
      }
    },
    tags: ['devotional', 'hindi', 'peaceful', 'bhajan'],
    rating: { average: 4.8, count: 167 },
    playCount: 892
  }
]

export default function MusicGallery() {
  const [currentTrack, setCurrentTrack] = useState<typeof sampleTracks[0] | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState('all')

  const filteredTracks = sampleTracks.filter(track => 
    selectedGenre === 'all' || track.genre === selectedGenre
  )

  const genres = ['all', 'devotional', 'mantra', 'bhajan']

  const handlePlayTrack = (track: typeof sampleTracks[0]) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying)
    } else {
      setCurrentTrack(track)
      setIsPlaying(true)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 justify-center">
          <span className="text-white/80 font-medium">Genre:</span>
          {genres.map(genre => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedGenre === genre
                  ? 'bg-primary-500 text-white'
                  : 'glass text-white hover:bg-white/20'
              }`}
            >
              {genre.charAt(0).toUpperCase() + genre.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Current Playing Track with Vinyl Player */}
      {currentTrack && (
        <div className="mb-12">
          <VinylPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            onPlayPause={() => setIsPlaying(!isPlaying)}
          />
        </div>
      )}

      {/* Tracks List */}
      <div className="space-y-4">
        {filteredTracks.map(track => (
          <div
            key={track.id}
            className="card-glass flex items-center gap-4 hover:bg-white/15 transition-all cursor-pointer"
            onClick={() => handlePlayTrack(track)}
          >
            {/* Album Art */}
            <div className="relative flex-shrink-0">
              <img
                src={track.cover.thumbnail}
                alt={`${track.title} cover`}
                className="w-16 h-16 rounded-lg object-cover"
              />
              {track.isPremium && (
                <div className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs px-1 py-0.5 rounded-full">
                  Premium
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 hover:opacity-100 transition-opacity">
                {currentTrack?.id === track.id && isPlaying ? (
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>

            {/* Track Info */}
            <div className="flex-grow min-w-0">
              <h3 className="text-white font-semibold text-lg truncate">
                {track.title}
              </h3>
              <p className="text-white/70 text-sm">
                {track.artists.join(', ')}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {track.mood.slice(0, 2).map(mood => (
                  <span
                    key={mood}
                    className="text-xs bg-white/10 text-white/80 px-2 py-0.5 rounded-full"
                  >
                    {mood}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-col items-end text-sm text-white/70 space-y-1">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>{track.rating.average}</span>
              </div>
              <div className="text-white/60">
                {formatDuration(track.duration)}
              </div>
              <div className="text-white/50 text-xs">
                {track.playCount.toLocaleString()} plays
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTracks.length === 0 && (
        <div className="text-center py-12">
          <div className="text-white/60 text-lg">
            No tracks found matching your filters.
          </div>
          <button
            onClick={() => setSelectedGenre('all')}
            className="btn-glass mt-4"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  )
}
