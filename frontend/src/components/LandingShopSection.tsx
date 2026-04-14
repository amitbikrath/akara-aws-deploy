'use client'

import WallpapersGallery from './WallpapersGallery'

export default function LandingShopSection() {
  return (
    <section id="shop" className="relative scroll-mt-24 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Shop wallpapers</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-white/70 sm:text-lg">
            Swipe through featured pieces or use the on-card arrows to move the row.
          </p>
        </div>

        <WallpapersGallery layout="carousel" catalogLimit={12} showStyleFilters={false} />
      </div>
    </section>
  )
}
