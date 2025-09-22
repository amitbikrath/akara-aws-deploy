'use client';
import React from 'react';

const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN!;
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!;
const redirect = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI!; // e.g. https://admin.akara.studio/auth/callback

export default function LoginPage() {
  const go = () => {
    const url = new URL(`https://${domain}/login`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirect);
    window.location.href = url.toString();
  };

  return (
    <div style={{maxWidth:720, margin:'80px auto'}}>
      <h1>Login</h1>
      <p>This will open Cognito Hosted UI.</p>
      <button onClick={go} style={{padding:'10px 16px', borderRadius:8}}>Continue</button>
    </div>
  );
}