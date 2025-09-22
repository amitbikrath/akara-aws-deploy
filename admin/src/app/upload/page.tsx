'use client';

import React, { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''; // should be the API Gateway base URL (invoke_url)

async function getPresignUrl(filename: string, contentType: string) {
  const url = `${API_BASE}/api/upload-url?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}`;
  const r = await fetch(url, { method: 'GET' }); // NO BODY ON GET
  if (!r.ok) throw new Error(`presign failed: ${r.status}`);
  return r.json() as Promise<{ ok: boolean; uploadUrl: string; key: string; bucket: string; contentType: string }>;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!file) { setError('Please choose a file'); return; }
    if (!API_BASE) { setError('Missing NEXT_PUBLIC_API_BASE'); return; }

    try {
      setBusy(true);

      // 1) get presigned PUT url
      const presign = await getPresignUrl(file.name, file.type || 'application/octet-stream');
      if (!presign.ok || !presign.uploadUrl) throw new Error('Invalid presign response');

      // 2) PUT the file directly to S3
      const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file
      });
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);

      // 3) Optionally POST metadata to /api/catalog (keep this as a TODO if Lambda is still stubbed)
      // await fetch(`${API_BASE}/api/catalog`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ key: presign.key, ...yourOtherFields }) });

      setSuccess(`Uploaded to s3://${presign.bucket}/${presign.key}`);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Upload Content</h1>
      
      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
            Choose File
          </label>
          <input
            id="file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            required
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={busy}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Uploading...' : 'Upload Content'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">Upload Failed: {error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}
      </form>
    </div>
  );
}