'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// For static export, revalidate must be a number or false.
// Using false disables ISR and is valid for export.
export const revalidate = false;

export default function AuthCallbackPage() {
  const sp = useSearchParams();
  const [status, setStatus] = useState<'pending'|'success'|'error'>('pending');

  useEffect(() => {
    try {
      const code = sp.get('code');
      if (code) {
        // simulate success and redirect
        setStatus('success');
        setTimeout(() => {
          window.location.href = '/upload';
        }, 800);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }, [sp]);

  return (
    <div style={{minHeight:'60vh',display:'grid',placeItems:'center',color:'#fff'}}>
      {status === 'pending' && <div>Completing sign-in…</div>}
      {status === 'success' && <div>Signed in! Redirecting…</div>}
      {status === 'error' && (
        <div>
          Sign-in failed. <a href="/login" style={{textDecoration:'underline'}}>Try again</a>
        </div>
      )}
    </div>
  );
}