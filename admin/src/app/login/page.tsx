'use client';

import { useEffect, useState } from 'react';

export default function LoginPage() {
  const [userPoolId, setUserPoolId] = useState('');
  const [clientId, setClientId] = useState('');
  const [region, setRegion] = useState('');

  useEffect(() => {
    setUserPoolId(process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '');
    setClientId(process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '');
    setRegion(process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1');
  }, []);

  const handleHostedUILogin = () => {
    if (!userPoolId || !clientId || !region) {
      alert('Cognito configuration missing. Please check environment variables.');
      return;
    }

    const domain = `https://${userPoolId}.auth.${region}.amazoncognito.com`;
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
    
    const hostedUIUrl = `${domain}/login?client_id=${clientId}&response_type=code&scope=email+openid+profile&redirect_uri=${redirectUri}`;
    
    window.location.href = hostedUIUrl;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Akara Studio Admin
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to manage content
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm space-y-4">
            <button
              onClick={handleHostedUILogin}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Sign in with Cognito
            </button>
          </div>
          
          <div className="text-center">
            <div className="text-sm text-gray-500">
              <p>Environment: {process.env.NEXT_PUBLIC_ENVIRONMENT}</p>
              <p>Region: {region}</p>
              {userPoolId && <p>Pool: {userPoolId}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
