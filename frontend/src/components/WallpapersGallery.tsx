'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface WallpaperItem {
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

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      {dir === 'left' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      )}
    </svg>
  )
}

type LayoutMode = 'grid' | 'carousel'

interface WallpapersGalleryProps {
  layout?: LayoutMode
  /** Max items from API (omit for full catalog) */
  catalogLimit?: number
  showStyleFilters?: boolean
}

export default function WallpapersGallery({
  layout = 'grid',
  catalogLimit,
  showStyleFilters = true,
}: WallpapersGalleryProps) {
  const [wallpapers, setWallpapers] = useState<WallpaperItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState('all')
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  useEffect(() => {
    const fetchWallpapers = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL
        if (!apiUrl) {
          throw new Error('API URL not configured')
        }

        const limitParam = typeof catalogLimit === 'number' ? `&limit=${catalogLimit}` : ''
        const response = await fetch(`${apiUrl}/api/catalog?type=wallpaper${limitParam}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch wallpapers: ${response.statusText}`)
        }

        const data = await response.json()
        setWallpapers(data.items || [])
      } catch (err) {
        console.error('Error fetching wallpapers:', err)
        setError(err instanceof Error ? err.message : 'Failed to load wallpapers')
      } finally {
        setLoading(false)
      }
    }

    fetchWallpapers()
  }, [catalogLimit])

  const filteredWallpapers = wallpapers.filter(wallpaper => {
    if (selectedStyle !== 'all' && wallpaper.style !== selectedStyle) return false
    return true
  })

  const styles = ['all', ...Array.from(new Set(wallpapers.map(w => w.style).filter(Boolean)))]

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const max = scrollWidth - clientWidth
    setCanPrev(scrollLeft > 2)
    setCanNext(scrollLeft < max - 2)
  }, [])

  useEffect(() => {
    if (layout !== 'carousel') return
    const el = scrollerRef.current
    if (!el) return
    updateArrows()
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    el.addEventListener('scroll', updateArrows, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', updateArrows)
    }
  }, [layout, updateArrows, filteredWallpapers.length])

  const scrollCarousel = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    const step = Math.max(el.clientWidth * 0.55, 240)
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }, [])

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

  const showFilters = showStyleFilters && styles.length > 1 && layout === 'grid'

  const cardImage = (wallpaper: WallpaperItem, aspectClass: string) => (
    <div className={`relative mb-4 overflow-hidden rounded-xl ${aspectClass}`}>
      <img
        src={`/content/${wallpaper.fileKey}`}
        alt={wallpaper.title}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        onError={e => {
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          target.nextElementSibling?.classList.remove('hidden')
        }}
      />
      <div className="absolute inset-0 hidden items-center justify-center bg-gray-800/50">
        <p className="text-sm text-white/70">Image loading...</p>
      </div>
    </div>
  )

  const cardBody = (wallpaper: WallpaperItem) => (
    <div className="space-y-3">
      <div>
        <h3 className="line-clamp-1 text-lg font-semibold text-white">{wallpaper.title}</h3>
        {wallpaper.caption && (
          <p className="line-clamp-2 text-sm text-white/70">{wallpaper.caption}</p>
        )}
      </div>

      {wallpaper.shloka && (
        <div className="rounded-md border border-orange-500/20 bg-orange-500/10 p-3">
          <p className="text-sm italic text-orange-300">{wallpaper.shloka}</p>
          {wallpaper.meaning && <p className="mt-1 text-xs text-orange-200">{wallpaper.meaning}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {wallpaper.style && (
          <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/80">{wallpaper.style}</span>
        )}
        <span className="rounded-full bg-blue-500/20 px-2 py-1 text-xs text-blue-300">{wallpaper.ratio}</span>
      </div>
    </div>
  )

  return (
    <div>
      {showFilters && (
        <div className="mb-8">
          <div className="flex flex-wrap justify-center gap-2">
            <span className="font-medium text-white/80">Style:</span>
            {styles.map(style => (
              <button
                key={style}
                onClick={() => setSelectedStyle(style)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
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

      {wallpapers.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-lg text-white/60">No wallpapers available yet.</div>
          <p className="text-sm text-white/40">Upload some content in the admin panel to see them here!</p>
        </div>
      ) : layout === 'carousel' ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => scrollCarousel(-1)}
            disabled={!canPrev}
            aria-label="Previous wallpapers"
            className="absolute left-1 top-[min(38%,11rem)] z-20 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-20 sm:left-2 sm:h-16 sm:w-16"
          >
            <ChevronIcon dir="left" />
          </button>
          <button
            type="button"
            onClick={() => scrollCarousel(1)}
            disabled={!canNext}
            aria-label="Next wallpapers"
            className="absolute right-1 top-[min(38%,11rem)] z-20 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-20 sm:right-2 sm:h-16 sm:w-16"
          >
            <ChevronIcon dir="right" />
          </button>

          <div
            ref={scrollerRef}
            className="scrollbar-none flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3 pl-2 pr-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-6 sm:pl-4 sm:pr-4 [&::-webkit-scrollbar]:hidden"
          >
            {filteredWallpapers.map(wallpaper => (
              <article
                key={wallpaper.id}
                className="card-glass group w-[min(100%,22rem)] shrink-0 snap-center overflow-hidden sm:w-[min(100%,26rem)] lg:w-[min(100%,30rem)]"
              >
                {cardImage(wallpaper, 'aspect-video')}
                {cardBody(wallpaper)}
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredWallpapers.map(wallpaper => (
            <div key={wallpaper.id} className="card-glass group cursor-pointer overflow-hidden">
              {cardImage(wallpaper, 'aspect-[4/5]')}
              {cardBody(wallpaper)}
            </div>
          ))}
        </div>
      )}

      {filteredWallpapers.length === 0 && wallpapers.length > 0 && (
        <div className="py-12 text-center">
          <div className="text-lg text-white/60">No wallpapers found matching your filters.</div>
          <button onClick={() => setSelectedStyle('all')} className="btn-glass mt-4">
            Clear Filters
          </button>
        </div>
      )}
    </div>
  )
}
