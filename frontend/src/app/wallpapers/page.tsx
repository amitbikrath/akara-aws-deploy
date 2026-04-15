import WallpapersGallery from '@/components/WallpapersGallery'

export default function WallpapersPage() {
  return (
    <section className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Wallpapers
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Premium wallpapers featuring divine artistry, optimized for all your devices.
          </p>
        </div>
        <WallpapersGallery />
      </div>
    </section>
  )
}
