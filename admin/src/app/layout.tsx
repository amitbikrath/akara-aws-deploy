import React from 'react';
import './globals.css';
import type { Metadata } from 'next';
import AdminNav from '@/components/AdminNav';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Akara Studio Admin',
  description: 'Admin interface',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="px-3 pb-6 pt-3 md:px-6 md:pt-5">
        <Providers>
          <header className="glass-panel sticky top-3 z-50 w-full">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
              <div className="text-sm font-semibold tracking-[0.16em] text-slate-800 uppercase">
                Akara Studio Admin
              </div>
              <AdminNav />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-1 py-6 md:px-2">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
