import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import WallpapersGallery from '@/components/WallpapersGallery'

export const metadata = {
  title: 'Premium Wallpapers',
  description: 'Discover our collection of premium spiritual wallpapers featuring divine art and sacred imagery.',
}

export default function WallpapersPage() {
  return (
    <main className="min-h-screen">
      <Navigation />
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Premium <span className="text-gradient">Wallpapers</span>
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Transform your digital spaces with divine artistry. High-resolution wallpapers 
              featuring sacred imagery and spiritual themes.
            </p>
          </div>
          <WallpapersGallery />
        </div>
      </div>
      <Footer />
    </main>
  )
}
