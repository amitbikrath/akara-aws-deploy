'use client';

import { useEffect, useState } from 'react';
import { saveTokens } from '@/lib/auth';

export const revalidate = false;

export default function Callback() {
  const [msg, setMsg] = useState('Completing sign-in...');

  useEffect(() => {
    try {
      const hash = window.location.hash.replace(/^#/, '');
      const params = new URLSearchParams(hash);
      const idToken = params.get('id_token') || undefined;
      const accessToken = params.get('access_token') || undefined;
      const expiresIn = Number(params.get('expires_in') || '3600');

      if (!idToken && !accessToken) {
        setMsg('No tokens found in callback. Did you enable implicit flow?');
        return;
      }

      const expiresAt = Math.floor(Date.now()/1000) + (isFinite(expiresIn) ? expiresIn : 3600);
      saveTokens({ idToken, accessToken, expiresAt });
      setMsg('Signed in. Redirecting...');
      setTimeout(() => { window.location.href = '/'; }, 600);
    } catch (e) {
      setMsg('Failed to process callback.');
    }
  }, []);

  return (
    <div style={{padding:'2rem'}}>
      <h1>Auth Callback</h1>
      <p>{msg}</p>
    </div>
  );
}