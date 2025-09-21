export const dynamic = 'force-dynamic';
export const revalidate = 0;

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Authentication failed: ${error}`);
      return;
    }

    if (code) {
      // TODO: Exchange code for tokens
      // For now, just redirect to upload page
      setStatus('success');
      setMessage('Authentication successful! Redirecting...');
      
      setTimeout(() => {
        window.location.href = '/upload';
      }, 2000);
    } else {
      setStatus('error');
      setMessage('No authorization code received');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center">
        {status === 'loading' && (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Processing authentication...</p>
          </div>
        )}
        
        {status === 'success' && (
          <div>
            <div className="text-green-600 text-4xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Success!</h2>
            <p className="text-gray-600">{message}</p>
          </div>
        )}
        
        {status === 'error' && (
          <div>
            <div className="text-red-600 text-4xl mb-4">✗</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <a 
              href="/login"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Try Again
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
