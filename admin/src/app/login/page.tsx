'use client';
import React from 'react';

const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
const redirectUri = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI || 'https://admin.akara.studio/auth/callback';

export default function LoginPage() {
  const hostedUiUrl = domain && clientId
    ? `https://${domain}/login?client_id=${encodeURIComponent(clientId)}&response_type=token&scope=openid+email+profile&redirect_uri=${encodeURIComponent(redirectUri)}`
    : null;

  const onClick = () => {
    if (!hostedUiUrl) return;
    window.location.href = hostedUiUrl;
  };

  return (
    <div className="max-w-3xl mx-auto py-16">
      <h1 className="text-2xl font-semibold mb-4">Login</h1>
      <p className="text-gray-500 mb-6">
        {hostedUiUrl
          ? 'Continue to Cognito Hosted UI to sign in.'
          : 'This is a placeholder. Hosted UI is not configured yet.'}
      </p>
      <button
        onClick={onClick}
        disabled={!hostedUiUrl}
        className={`px-4 py-2 rounded ${hostedUiUrl ? 'bg-black text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
      >
        Continue
      </button>
    </div>
  );
}