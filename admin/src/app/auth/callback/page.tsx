'use client';

import { useEffect, useState } from 'react';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    // Run entirely on the client; no Next helpers, no server APIs.
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
        setStatus('success');
        const t = setTimeout(() => {
          // Redirect to admin upload after successful auth
          window.location.href = '/upload';
        }, 800);
        return () => clearTimeout(t);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"'
    }}>
      {status === 'pending' && <p>Processing authentication…</p>}
      {status === 'success' && <p>Authentication successful! Redirecting…</p>}
      {status === 'error' && (
        <div style={{ textAlign: 'center' }}>
          <p>Authentication failed. Please try again.</p>
          <a href="/auth/login" style={{ color: '#22c55e', textDecoration: 'underline', display: 'inline-block', marginTop: 12 }}>
            Back to Login
          </a>
        </div>
      )}
    </div>
  );
}