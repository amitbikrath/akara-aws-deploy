'use client';

import React from 'react';

export const revalidate = false;

const hostedUIBase = process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_BASE;
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
const redirect = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI || 'https://admin.akara.studio/auth/callback';

const hostedUI = hostedUIBase && clientId
  ? `${hostedUIBase}/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&response_type=token&scope=openid+email+profile&redirect_uri=${encodeURIComponent(redirect)}`
  : '';

export default function LoginPage() {
  const ready = Boolean(hostedUIBase && clientId);
  return (
    <div style={{padding:'2rem'}}>
      <h1>Login</h1>
      <p>{ready ? 'Sign in with Cognito Hosted UI' : 'Cognito not configured yet.'}</p>
      <button
        disabled={!ready}
        onClick={() => { if (hostedUI) window.location.href = hostedUI; }}
        style={{padding:'10px 16px', background:'#000', color:'#fff', borderRadius:6}}
      >
        Continue
      </button>
    </div>
  );
}