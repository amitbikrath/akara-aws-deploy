import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import MusicGallery from '@/components/MusicGallery'

export const metadata = {
  title: 'Spiritual Music',
  description: 'Listen to our collection of devotional music, bhajans, and spiritual tracks designed to elevate your practice.',
}

export default function MusicPage() {
  return (
    <main className="min-h-screen">
      <Navigation />
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Spiritual <span className="text-gradient">Music</span>
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Immerse yourself in divine melodies. Our collection of devotional music 
              and bhajans will elevate your spiritual practice.
            </p>
          </div>
          <MusicGallery />
        </div>
      </div>
      <Footer />
    </main>
  )
}
