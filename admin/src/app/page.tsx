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
        <Link href="/wallpapers" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Wallpapers</h3>
          <p className="text-gray-600">Manage wallpaper collections</p>
        </Link>
        
        <div className="bg-white rounded-lg shadow p-6 opacity-60">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Music</h3>
          <p className="text-gray-600">Manage music tracks and albums</p>
          <p className="text-xs text-gray-500 mt-2">Coming soon</p>
        </div>
        
        <Link href="/analytics" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics</h3>
          <p className="text-gray-600">View platform statistics</p>
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

