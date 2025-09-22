'use client';

import Link from 'next/link';

export default function AdminNav() {
  return (
    <nav className="flex gap-6 items-center text-sm">
      <Link href="/" className="hover:underline">Dashboard</Link>
      <Link href="/upload" className="hover:underline">Upload</Link>
      <Link href="/login" className="hover:underline">Login</Link>
    </nav>
  );
}
