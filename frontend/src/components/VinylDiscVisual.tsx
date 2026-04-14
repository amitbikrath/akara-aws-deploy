'use client'

interface VinylDiscVisualProps {
  isPlaying: boolean
  /** Optional cover image for the center label */
  coverSrc?: string | null
  alt?: string
  /** Tailwind size classes for the disc (width/height) */
  sizeClass?: string
  className?: string
}

/**
 * Static “studio” vinyl look: groove rings and label, no animated background waves.
 */
export default function VinylDiscVisual({
  isPlaying,
  coverSrc,
  alt = '',
  sizeClass = 'w-[min(100%,15rem)] h-[min(100%,15rem)] sm:w-56 sm:h-56',
  className = '',
}: VinylDiscVisualProps) {
  return (
    <div
      className={`relative shrink-0 rounded-full bg-gradient-to-br from-gray-900 to-black border-[3px] border-gray-600/90 shadow-[0_12px_40px_rgba(0,0,0,0.55)] ${isPlaying ? 'animate-spin-slow' : ''} ${sizeClass} ${className}`}
      style={{
        backgroundImage:
          'conic-gradient(from 0deg, #141414 0deg, #252525 40deg, #141414 80deg, #252525 120deg, #141414 160deg, #252525 200deg, #141414 240deg, #252525 280deg, #141414 320deg, #1a1a1a 360deg)',
      }}
    >
      <div className="pointer-events-none absolute inset-[9%] rounded-full border border-gray-500/25" />
      <div className="pointer-events-none absolute inset-[16%] rounded-full border border-gray-500/20" />
      <div className="pointer-events-none absolute inset-[23%] rounded-full border border-gray-500/15" />
      <div className="pointer-events-none absolute inset-[30%] rounded-full border border-gray-500/10" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-[32%] w-[32%] items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-700 p-0.5 shadow-inner ring-1 ring-black/40">
          {coverSrc ? (
            <img src={coverSrc} alt={alt} className="h-full w-full rounded-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-amber-700/90 to-orange-900 text-[clamp(0.65rem,3.5vw,0.85rem)] font-semibold uppercase tracking-wide text-white/90">
              Akara
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
