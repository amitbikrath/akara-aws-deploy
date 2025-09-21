// NOTE: This is a SERVER component (no 'use client' here)
export const dynamic = 'force-dynamic';
export const revalidate = false;

import CallbackClient from './CallbackClient';

export default function AuthCallbackPage() {
  // Render the client logic inside a server wrapper
  return <CallbackClient />;
}