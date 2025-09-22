'use client';

import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="flex gap-6 items-center text-sm">
      <Link href="/" className="hover:underline">Home</Link>
      <Link href="/wallpapers" className="hover:underline">Wallpapers</Link>
      <Link href="/music" className="hover:underline">Music</Link>
    </nav>
  );
}
