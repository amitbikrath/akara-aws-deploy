import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'Akara Studio - Premium Wallpapers & Music',
    template: '%s | Akara Studio'
  },
  description: 'Discover premium wallpapers and spiritual music crafted with love. Experience divine artistry for your digital spaces.',
  keywords: ['wallpapers', 'music', 'spiritual', 'premium', 'digital art', 'desktop backgrounds'],
  authors: [{ name: 'Akara Studio' }],
  creator: 'Akara Studio',
  publisher: 'Akara Studio',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://akara.studio'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'Akara Studio - Premium Wallpapers & Music',
    description: 'Discover premium wallpapers and spiritual music crafted with love.',
    siteName: 'Akara Studio',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Akara Studio - Premium Digital Art',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Akara Studio - Premium Wallpapers & Music',
    description: 'Discover premium wallpapers and spiritual music crafted with love.',
    images: ['/images/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
          {children}
        </div>
      </body>
    </html>
  )
}
