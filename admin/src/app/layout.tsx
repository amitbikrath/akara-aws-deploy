import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Akara Studio Admin',
  description: 'Admin interface for Akara Studio',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <div className="min-h-screen">
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <h1 className="text-xl font-semibold text-gray-900">
                  Akara Studio Admin
                </h1>
                <nav className="flex space-x-4">
                  <a href="/" className="text-gray-600 hover:text-gray-900">Dashboard</a>
                  <a href="/upload" className="text-gray-600 hover:text-gray-900">Upload</a>
                  <a href="/login" className="text-gray-600 hover:text-gray-900">Login</a>
                </nav>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
