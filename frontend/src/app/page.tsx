import Hero from '@/components/Hero'
import LandingMusicSection from '@/components/LandingMusicSection'
import LandingShopSection from '@/components/LandingShopSection'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/80 to-slate-950">
      <Navigation />
      <Hero />
      <LandingShopSection />
      <LandingMusicSection />
      <Footer />
    </main>
  )
}
