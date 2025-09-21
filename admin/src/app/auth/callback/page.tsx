'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// Next.js static export: revalidate must be a number or false
export const revalidate = false;

export default function AuthCallbackPage() {
  const params = useSearchParams();
  const [status, setStatus] = useState<'pending'|'success'|'error'>('pending');

  useEffect(() => {
    const code = params.get('code');
    if (code) {
      setStatus('success');
      // Client-side redirect after brief confirmation
      const t = setTimeout(() => {
        window.location.href = '/upload';
      }, 800);
      return () => clearTimeout(t);
    } else {
      setStatus('error');
    }
  }, [params]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'black',
      color: 'white',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu'
    }}>
      {status === 'pending' && <p>Processing authentication…</p>}
      {status === 'success' && <p>Authentication successful! Redirecting…</p>}
      {status === 'error' && (
        <div style={{textAlign: 'center'}}>
          <p>No auth code found in callback.</p>
          <a href="/login" style={{textDecoration: 'underline', color: '#9AE6B4'}}>Go to Login</a>
        </div>
      )}
    </div>
  );
}