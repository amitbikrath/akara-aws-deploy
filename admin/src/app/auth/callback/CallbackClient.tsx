'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function CallbackClient() {
  const params = useSearchParams();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    const code = params.get('code');
    if (code) {
      setStatus('success');
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
      fontFamily:
        "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,Apple Color Emoji,Segoe UI Emoji"
    }}>
      {status === 'pending' && <p>Processing authentication…</p>}
      {status === 'success' && <p>Authentication successful! Redirecting…</p>}
      {status === 'error' && (
        <div style={{ textAlign: 'center' }}>
          <p>No auth code found in callback.</p>
          <a href="/login" style={{ color: '#22c55e' }}>Back to login</a>
        </div>
      )}
    </div>
  );
}
