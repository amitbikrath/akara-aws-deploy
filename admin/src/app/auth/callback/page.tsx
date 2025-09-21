'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const params = useSearchParams();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    const code = params.get('code');
    if (code) {
      setStatus('success');
      const timer = setTimeout(() => {
        window.location.href = '/upload';
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setStatus('error');
    }
  }, [params]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      {status === 'pending' && <p>Processing authentication...</p>}
      {status === 'success' && <p>Authentication successful! Redirecting...</p>}
      {status === 'error' && (
        <div>
          <p>Authentication failed. Please try again.</p>
          <a href="/auth/login" className="text-green-400 underline mt-4 block">
            Back to Login
          </a>
        </div>
      )}
    </div>
  );
}