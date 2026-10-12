'use client';

import React from 'react';
import { generatePkce, PKCE_VERIFIER_KEY } from '@/lib/pkce';

const hostedUIBase = process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_BASE;
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

export default function LoginPage() {
  const ready = Boolean(hostedUIBase && clientId);

  async function startLogin() {
    if (!hostedUIBase || !clientId) return;
    const { verifier, challenge } = await generatePkce();
    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI || 'https://admin.akara.studio/auth/callback.html',
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });
    window.location.href = `${hostedUIBase}/oauth2/authorize?${params.toString()}`;
  }

  return (
    <div style={{padding:'2rem'}}>
      <h1>Login</h1>
      <p>{ready ? 'Sign in with Cognito Hosted UI (PKCE)' : 'Cognito not configured yet.'}</p>
      <button
        disabled={!ready}
        onClick={() => { startLogin(); }}
        style={{padding:'10px 16px', background:'#000', color:'#fff', borderRadius:6}}
      >
        Continue
      </button>
    </div>
  );
}
