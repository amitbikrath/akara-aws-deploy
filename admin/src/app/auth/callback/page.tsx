'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// Must be a non-negative number or false
export const revalidate = 0;
// This page should never be statically generated
export const dynamic = 'force-dynamic';

export default function AuthCallbackPage() {
  const params = useSearchParams();
  const [status, setStatus] = useState<'pending'|'success'|'error'>('pending');

  useEffect(() => {
    // TODO: exchange code/state with Cognito if needed
    // For now, mark success if 'code' exists
    const code = params.get('code');
    setStatus(code ? 'success' : 'error');
  }, [params]);

  if (status === 'pending') {
    return <div style={{padding: 24}}>Finishing sign-in…</div>;
  }
  if (status === 'error') {
    return <div style={{padding: 24, color: 'crimson'}}>Sign-in failed. Missing code parameter.</div>;
  }
  return <div style={{padding: 24}}>Signed in! You can close this tab.</div>;
}
