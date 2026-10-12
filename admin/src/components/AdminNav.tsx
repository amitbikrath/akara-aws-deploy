'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isLoggedIn, clearTokens, getCognitoLogoutUrl } from '@/lib/auth';

export default function AdminNav() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  const handleLogout = () => {
    clearTokens();
    const logoutUrl = getCognitoLogoutUrl();
    window.location.href = logoutUrl;
  };

  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      {loggedIn ? (
        <>
          <Link href="/" className="glass-chip hover:bg-white/70">Dashboard</Link>
          <Link href="/wallpapers" className="glass-chip hover:bg-white/70">Wallpapers</Link>
          <Link href="/music" className="glass-chip hover:bg-white/70">Music</Link>
          <Link href="/content" className="glass-chip hover:bg-white/70">Site Content</Link>
          <Link href="/wall-display" className="glass-chip hover:bg-white/70">Wall display</Link>
          <Link href="/upload" className="glass-chip hover:bg-white/70">Upload</Link>
          <Link href="/organize" className="glass-chip hover:bg-white/70">Organize</Link>
          <Link href="/find" className="glass-chip hover:bg-white/70">Find downloader</Link>
          <Link href="/search-report" className="glass-chip hover:bg-white/70">Search</Link>
          <Link href="/analytics" className="glass-chip hover:bg-white/70">Analytics</Link>
          <div className="flex items-center gap-3">
            <span className="text-gray-600 text-xs">Logged in</span>
            <button
              onClick={handleLogout}
              className="glass-chip text-xs hover:bg-white/70"
            >
              Logout
            </button>
          </div>
        </>
      ) : (
        <>
          <Link href="/login.html" className="hover:underline">Login</Link>
        </>
      )}
    </nav>
  );
}
