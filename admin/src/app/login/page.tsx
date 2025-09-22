'use client';

import React from 'react';

const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN; // e.g. https://your-prefix.auth.us-east-1.amazoncognito.com
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
const redirectUri = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI || (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '');
const scope = 'openid+email+profile';
const responseType = 'code';

export default function LoginPage() {
  const hasHostedUI = !!(cognitoDomain && clientId && redirectUri);

  const go = () => {
    if (!hasHostedUI) return;
    const url = `${cognitoDomain}/oauth2/authorize?response_type=${responseType}&client_id=${encodeURIComponent(clientId!)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
    window.location.href = url;
  };

  return (
    <div style={{padding: 24}}>
      <h2>Login</h2>
      {hasHostedUI ? (
        <>
          <p>Continue to Cognito Hosted UI</p>
          <button onClick={go}>Continue</button>
        </>
      ) : (
        <>
          <p>This is a placeholder. Hosted UI env vars not set yet.</p>
          <ul>
            <li>NEXT_PUBLIC_COGNITO_DOMAIN</li>
            <li>NEXT_PUBLIC_COGNITO_CLIENT_ID</li>
            <li>NEXT_PUBLIC_COGNITO_REDIRECT_URI</li>
          </ul>
        </>
      )}
    </div>
  );
}