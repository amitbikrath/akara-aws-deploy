export const revalidate = false; // valid for static export; server-only

import CallbackClient from './CallbackClient';

export default function Page() {
  // Server component wrapper — no 'use client' here
  return <CallbackClient />;
}