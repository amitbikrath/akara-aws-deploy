import Link from 'next/link'
import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="glass border-t border-white/10 mt-20">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Logo className="h-8 w-8" />
              <span className="text-xl font-bold text-white">Akara Studio</span>
            </div>
            <p className="text-white/70 max-w-md">
              Creating divine artistry for digital spaces. Premium wallpapers and spiritual music 
              crafted with love and devotion.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Browse</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/wallpapers" className="text-white/70 hover:text-white transition-colors">
                  Wallpapers
                </Link>
              </li>
              <li>
                <Link href="/music" className="text-white/70 hover:text-white transition-colors">
                  Music
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/license" className="text-white/70 hover:text-white transition-colors">
                  License
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-white/70 hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-white/60 text-sm">
            © {new Date().getFullYear()} Akara Studio. All rights reserved.
          </p>
          <p className="text-white/60 text-sm mt-2 sm:mt-0">
            Made with ❤️ for the divine
          </p>
        </div>
      </div>
    </footer>
  )
}
