import React from 'react';
import './globals.css';
import type { Metadata } from 'next';
import AdminNav from '@/components/AdminNav';

export const metadata: Metadata = {
  title: 'Akara Studio Admin',
  description: 'Admin interface',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="w-full border-b">
          <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
            <div className="font-semibold">Akara Studio Admin</div>
            <AdminNav />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}