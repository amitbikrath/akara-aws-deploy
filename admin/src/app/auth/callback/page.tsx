'use client';

import { useEffect, useState } from 'react';
import { saveTokens } from '@/lib/auth';
import { PKCE_VERIFIER_KEY } from '@/lib/pkce';

export default function Callback() {
  const [msg, setMsg] = useState('Completing sign-in...');

  useEffect(() => {
    (async function () {
      try {
        const hostedUIBase = process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_BASE;
        const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
        const code = new URLSearchParams(window.location.search).get('code');

        if (code && hostedUIBase && clientId) {
          const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
          if (!verifier) {
            setMsg('Missing PKCE verifier. Open Login from this site and try again.');
            return;
          }
          sessionStorage.removeItem(PKCE_VERIFIER_KEY);

          const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            code,
            redirect_uri: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI || 'https://admin.akara.studio/auth/callback.html',
            code_verifier: verifier,
          });
          const res = await fetch(`${hostedUIBase}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
          });
          const data: any = await res.json().catch(() => ({}));
          if (!res.ok) {
            setMsg(data.error_description || data.error || `Token exchange failed (${res.status})`);
            return;
          }

          const accessToken = data.access_token;
          const idToken = data.id_token;
          const expiresIn = Number(data.expires_in || 3600);
          const expiresAt = Math.floor(Date.now() / 1000) + (isFinite(expiresIn) ? expiresIn : 3600);
          saveTokens({ idToken, accessToken, expiresAt });
          window.history.replaceState({}, document.title, window.location.pathname);
          setMsg('Signed in. Redirecting...');
          setTimeout(() => { window.location.href = '/'; }, 600);
          return;
        }

        const hash = window.location.hash.replace(/^#/, '');
        const params = new URLSearchParams(hash);
        const idToken = params.get('id_token') || undefined;
        const accessToken = params.get('access_token') || undefined;
        const expiresIn = Number(params.get('expires_in') || '3600');

        if (idToken || accessToken) {
          const expiresAt = Math.floor(Date.now() / 1000) + (isFinite(expiresIn) ? expiresIn : 3600);
          saveTokens({ idToken, accessToken, expiresAt });
          setMsg('Signed in. Redirecting...');
          setTimeout(() => { window.location.href = '/'; }, 600);
          return;
        }

        setMsg('No authorization code or tokens in callback. Use Login to start again.');
      } catch (e) {
        setMsg('Failed to process callback.');
      }
    })();
  }, []);

  return (
    <div style={{padding:'2rem'}}>
      <h1>Auth Callback</h1>
      <p>{msg}</p>
    </div>
  );
}
