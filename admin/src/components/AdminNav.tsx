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
    <nav className="flex gap-6 items-center text-sm">
      {loggedIn ? (
        <>
          <Link href="/" className="hover:underline">Dashboard</Link>
          <Link href="/wallpapers" className="hover:underline">Wallpapers</Link>
          <Link href="/upload" className="hover:underline">Upload</Link>
          <Link href="/analytics" className="hover:underline">Analytics</Link>
          <div className="flex items-center gap-3">
            <span className="text-gray-600 text-xs">Logged in</span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Logout
            </button>
          </div>
        </>
      ) : (
        <>
          <Link href="/login" className="hover:underline">Login</Link>
        </>
      )}
    </nav>
  );
}



