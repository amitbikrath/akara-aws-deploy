'use client';

import Link from 'next/link';
import RouteGuard from '@/components/RouteGuard';

function DashboardContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">
          Welcome to the Akara Studio admin interface
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/wallpapers" className="glass-panel p-6 transition hover:-translate-y-0.5">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Wallpapers</h3>
          <p className="text-gray-600">Manage wallpaper collections</p>
        </Link>

        <Link href="/music" className="glass-panel p-6 transition hover:-translate-y-0.5">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Music</h3>
          <p className="text-gray-600">Manage music tracks and albums</p>
        </Link>

        <Link href="/content" className="glass-panel p-6 transition hover:-translate-y-0.5">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Site Content</h3>
          <p className="text-gray-600">Edit Our Story and contact details</p>
        </Link>

        <Link href="/analytics" className="glass-panel p-6 transition hover:-translate-y-0.5">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics</h3>
          <p className="text-gray-600">View platform statistics</p>
        </Link>

        <Link href="/twitter" className="glass-panel p-6 transition hover:-translate-y-0.5">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Twitter Sync</h3>
          <p className="text-gray-600">Refresh now and edit the article generator prompt</p>
        </Link>
      </div>
    </div>
  );
}

export default function AdminHome() {
  return (
    <RouteGuard>
      <DashboardContent />
    </RouteGuard>
  );
}
