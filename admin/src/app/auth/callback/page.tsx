'use client';
import { useEffect, useState } from 'react';

export const revalidate = false;

export default function Callback() {
  const [status, setStatus] = useState<'pending'|'ok'|'error'>('pending');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (!code) { setStatus('error'); return; }
      setStatus('ok');
      const t = setTimeout(() => { window.location.href = '/upload'; }, 800);
      return () => clearTimeout(t);
    } catch {
      setStatus('error');
    }
  }, []);

  return (
    <div style={{maxWidth:720, margin:'80px auto'}}>
      <h1>Auth Callback</h1>
      <p>{status === 'pending' && 'Verifying...'}
         {status === 'ok' && 'Success! Redirecting to upload...'}
         {status === 'error' && 'No code found. Go back to Login.'}</p>
    </div>
  );
}