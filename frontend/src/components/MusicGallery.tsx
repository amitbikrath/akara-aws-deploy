'use client'

import { useEffect, useState } from 'react'
import VinylDiscVisual from './VinylDiscVisual'

interface MusicItem {
  id: string
  title: string
  caption: string
  shloka: string
  meaning: string
  fileKey: string
  thumbKey?: string
  ratio: string
  palette: string[]
  style: string
  createdAt: string
}

interface MusicGalleryProps {
  /** When set, fetches only this many tracks from the catalog API */
  catalogLimit?: number
}

export default function MusicGallery({ catalogLimit }: MusicGalleryProps) {
  const [music, setMusic] = useState<MusicItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTrack, setCurrentTrack] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const fetchMusic = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL
        if (!apiUrl) {
          throw new Error('API URL not configured')
        }

        const limitParam =
          typeof catalogLimit === 'number' && catalogLimit > 0 ? `&limit=${catalogLimit}` : ''
        const response = await fetch(`${apiUrl}/api/catalog?type=music${limitParam}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch music: ${response.statusText}`)
        }

        const data = await response.json()
        setMusic(data.items || [])
      } catch (err) {
        console.error('Error fetching music:', err)
        setError(err instanceof Error ? err.message : 'Failed to load music')
      } finally {
        setLoading(false)
      }
    }

    fetchMusic()
  }, [catalogLimit])

  const handlePlay = (trackId: string) => {
    if (currentTrack === trackId && isPlaying) {
      setIsPlaying(false)
    } else {
      setCurrentTrack(trackId)
      setIsPlaying(true)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-white/30"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto max-w-md rounded-lg border border-red-500/20 bg-red-500/10 p-6">
          <p className="mb-4 text-red-400">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-glass">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {music.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-lg text-white/60">No music tracks available yet.</div>
          <p className="text-sm text-white/40">Upload some music in the admin panel to see them here!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {music.map(track => {
            const coverSrc = track.thumbKey ? `/content/${track.thumbKey}` : null
            const playing = currentTrack === track.id && isPlaying
            return (
              <div key={track.id} className="card-glass group overflow-hidden">
                <div className="relative mb-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-zinc-950 via-neutral-900 to-black ring-1 ring-white/10 sm:aspect-[5/4]">
                  <div
                    className="pointer-events-none absolute inset-0 opacity-90"
                    style={{
                      background:
                        'radial-gradient(ellipse 85% 70% at 50% 45%, rgba(120, 80, 40, 0.12), transparent 55%), radial-gradient(circle at 50% 100%, rgba(0,0,0,0.55), transparent 45%)',
                    }}
                  />
                  <VinylDiscVisual
                    isPlaying={playing}
                    coverSrc={coverSrc}
                    alt={track.title}
                    sizeClass="w-[min(92%,14.5rem)] h-[min(92%,14.5rem)] sm:w-[min(92%,16rem)] sm:h-[min(92%,16rem)]"
                    className="relative z-[1]"
                  />

                  <button
                    onClick={() => handlePlay(track.id)}
                    className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/25 group-hover:opacity-100"
                    aria-label={playing ? 'Pause' : 'Play'}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90">
                      {playing ? (
                        <svg className="h-8 w-8 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg className="ml-1 h-8 w-8 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>

                  <audio
                    key={track.id}
                    autoPlay={playing}
                    onEnded={() => setIsPlaying(false)}
                    onError={() => {
                      console.error('Audio failed to load:', track.fileKey)
                      setIsPlaying(false)
                    }}
                  >
                    <source src={`/content/${track.fileKey}`} type="audio/mpeg" />
                    <source src={`/content/${track.fileKey}`} type="audio/wav" />
                  </audio>
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="line-clamp-1 text-lg font-semibold text-white">{track.title}</h3>
                    {track.caption && (
                      <p className="line-clamp-2 text-sm text-white/70">{track.caption}</p>
                    )}
                  </div>

                  {track.shloka && (
                    <div className="rounded-md border border-orange-500/20 bg-orange-500/10 p-3">
                      <p className="text-sm italic text-orange-300">{track.shloka}</p>
                      {track.meaning && <p className="mt-1 text-xs text-orange-200">{track.meaning}</p>}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {track.style && (
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/80">
                        {track.style}
                      </span>
                    )}
                    <span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs text-purple-300">
                      Audio
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
