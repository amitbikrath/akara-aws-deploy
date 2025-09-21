'use client';

// NOTE: Do NOT export `dynamic = 'force-dynamic'` in a static-export project.
// `revalidate` MUST be a number or false for static export.
// Keeping it explicit here for clarity; you can also remove it entirely.
export const revalidate = false;

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const search = useSearchParams();
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [message, setMessage] = useState<string>('Processing sign-in…');

  useEffect(() => {
    // Minimal client-only handling of the OAuth redirect
    const code = search.get('code');
    const error = search.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Sign-in failed: ${error}`);
      return;
    }

    if (code) {
      // In a static-export app, do client-side token exchange via your API if needed.
      // For now, just mark success and optionally redirect to /upload or home.
      setStatus('ok');
      setMessage('Signed in! Redirecting…');

      // Example redirect after 800ms:
      const t = setTimeout(() => {
        window.location.href = '/upload';
      }, 800);
      return () => clearTimeout(t);
    }

    setStatus('error');
    setMessage('Missing authorization code.');
  }, [search]);

  return (
    <main style={{minHeight: '60vh', display: 'grid', placeItems: 'center'}}>
      <div style={{textAlign: 'center'}}>
        <h1 style={{marginBottom: 12}}>
          {status === 'pending' ? 'Authenticating…' : status === 'ok' ? 'Success' : 'Error'}
        </h1>
        <p>{message}</p>
      </div>
    </main>
  );
}