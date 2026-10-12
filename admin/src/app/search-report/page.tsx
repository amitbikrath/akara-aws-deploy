'use client';

import { useEffect, useState } from 'react';
import RouteGuard from '@/components/RouteGuard';
import { apiRequest } from '@/lib/api';

interface Row { q: string; searches: number; visits: number; zero: number; opens: number; downloads: number; items: [string, number][] }
interface Report { totalSearches: number; days: number; top: Row[]; zeroResults: Row[]; noClicks: Row[] }

function Table({ title, note, rows }: { title: string; note: string; rows: Row[] }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{note}</p>
      {rows.length === 0 ? <p className="text-sm text-gray-400">Nothing yet.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-2">Search</th><th>Times</th><th>Visitors</th><th>Opened</th><th>Downloaded</th><th>Most opened</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.q} className="border-b last:border-0 align-top">
                <td className="py-2 pr-3 font-medium text-gray-900">
                  <a className="underline decoration-gray-300" href={`https://www.akara.studio/darshan?q=${encodeURIComponent(r.q)}`} target="_blank" rel="noreferrer">{r.q}</a>
                </td>
                <td>{r.searches}</td><td>{r.visits}</td><td>{r.opens}</td><td>{r.downloads}</td>
                <td className="text-xs text-gray-500 font-mono">{r.items.map(([id, n]) => `${id.slice(0, 8)}×${n}`).join('  ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SearchReport() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setData(null); setError(null);
    apiRequest(`/api/darshan/search-report?days=${days}`)
      .then(async (r) => { const d = await r.json(); if (r.status === 403) throw new Error('Your login is not in the admin group yet. Sign out and sign in again.'); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`); setData(d); })
      .catch((e) => setError(e.message));
  }, [days]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Search</h2>
          <p className="text-gray-600 mt-1">What visitors search for on Darśana, and what they find. Zero-result searches are a list of art to make or tag next.</p>
        </div>
        <select value={days} onChange={(e) => setDays(parseInt(e.target.value, 10))} className="px-3 py-2 border border-gray-300 rounded text-sm">
          {[7, 30, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">{error}</div>}
      {!data && !error && <p className="text-gray-500">Loading…</p>}
      {data && (<>
        <p className="text-sm text-gray-600">{data.totalSearches} searches in the last {data.days} days.</p>
        <Table title="Searches with no good result" note="Nobody found a close match. Make art for these, or tag existing art with the right story." rows={data.zeroResults} />
        <Table title="Searches nobody clicked" note="Results appeared, but no one opened any — the results may be off." rows={data.noClicks} />
        <Table title="Top searches" note="Most searched, with what people opened." rows={data.top} />
      </>)}
    </div>
  );
}

export default function SearchReportPage() {
  return <RouteGuard><SearchReport /></RouteGuard>;
}
