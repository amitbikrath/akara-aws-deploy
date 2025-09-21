'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function CallbackClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'pending'|'success'|'error'>('pending');
  const [message, setMessage] = useState<string>('Processing sign-in…');

  useEffect(() => {
    try {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setMessage(`OAuth error: ${error}`);
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('Missing authorization code.');
        return;
      }

      // TODO: exchange `code` with Cognito (or your API) if needed
      setStatus('success');
      setMessage('Signed in! You can close this tab.');
    } catch (e: any) {
      setStatus('error');
      setMessage(e?.message || 'Unexpected error.');
    }
  }, [searchParams]);

  return (
    <div style={{minHeight: '60vh', display:'grid', placeItems:'center'}}>
      <div style={{textAlign:'center'}}>
        <h1 style={{marginBottom: 8}}>Auth Callback</h1>
        <p style={{opacity: 0.8}}>{message}</p>
        {status === 'error' && (
          <button onClick={() => location.assign('/login')} style={{marginTop: 16}}>
            Back to login
          </button>
        )}
      </div>
    </div>
  );
}
