'use client'

import Link from 'next/link'
import MusicGallery from './MusicGallery'

export default function LandingMusicSection() {
  return (
    <section id="music" className="relative scroll-mt-24 py-16 sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-purple-950/20 to-transparent" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Music</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-white/70 sm:mx-0 sm:text-lg">
              Full-size vinyl with a calm studio backdrop—no animated wave layer behind the disc.
            </p>
          </div>
          <Link href="/music" className="btn-glass shrink-0 px-6 py-3 text-sm sm:text-base">
            Open music library
          </Link>
        </div>

        <MusicGallery catalogLimit={6} />
      </div>
    </section>
  )
}
