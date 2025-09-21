'use client';

// These MUST be a non-negative number or false.
// We also force dynamic so Next.js never tries to prerender this page.
export const revalidate = false;
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const params = useSearchParams();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    const code = params.get('code');
    setStatus(code ? 'success' : 'error');
  }, [params]);

  if (status === 'pending') {
    return <div style={{ padding: 24 }}>Finishing sign-in…</div>;
  }
  if (status === 'error') {
    return (
      <div style={{ padding: 24, color: 'crimson' }}>
        Sign-in failed. Missing code parameter.
      </div>
    );
  }
  return <div style={{ padding: 24 }}>Signed in! You can close this tab.</div>;
}