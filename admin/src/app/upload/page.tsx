'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/auth';
import { apiRequest, postCatalog } from '@/lib/api';
import RouteGuard from '@/components/RouteGuard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

function UploadContent() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle'|'presigning'|'uploading'|'creating'|'done'|'error'>('idle');
  const [msg, setMsg] = useState<string>('');
  const [debug, setDebug] = useState<any>(null);
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    caption: '',
    shloka: '',
    meaning: '',
    style: '',
    ratio: '16:9',
    palette: '',
  });

  async function handleUpload() {
    try {
      if (!file) { setMsg('Pick a file first.'); return; }
      
      if (!formData.title.trim()) {
        setMsg('Please enter a title.');
        return;
      }

      const accessToken = getAccessToken();
      
      if (!accessToken) {
        setMsg('Please login first.');
        router.push('/login');
        return;
      }
      
      setStatus('presigning'); setMsg('Requesting upload URL …');

      // 1) GET presigned URL — NO body for GET
      const qs = new URLSearchParams({ filename: file.name, contentType: file.type || 'application/octet-stream' });
      const presignRes = await apiRequest(`/api/upload-url?${qs.toString()}`, { 
        method: 'GET',
      });
      const text = await presignRes.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`Bad JSON from presign: ${text.slice(0,200)}`); }

      if (!presignRes.ok) throw new Error(`Presign failed ${presignRes.status}: ${data?.error || data?.message || text}`);
      if (!data?.uploadUrl && !data?.url) throw new Error('Presign response missing uploadUrl');
      const uploadUrl = data.uploadUrl || data.url;
      const s3Key = data.key;

      setDebug({ presignStatus: presignRes.status, presignBody: data });

      // 2) PUT file to S3 with EXACT Content-Type used in the signature
      setStatus('uploading'); setMsg('Uploading to S3 …');
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          // This MUST match the contentType used in the presign
          'Content-Type': file.type || 'application/octet-stream',
          // DO NOT add Authorization here; presign already authorizes the exact request
        },
        body: file
      });

      if (!putRes.ok) {
        const bodyText = await putRes.text().catch(() => '');
        throw new Error(`S3 PUT failed ${putRes.status}: ${bodyText.slice(0,200)}`);
      }

      setUploadedKey(s3Key);
      setDebug((d:any) => ({ ...d, putStatus: putRes.status, s3Key }));

      // 3) Create catalog entry
      setStatus('creating'); setMsg('Creating catalog entry …');
      
      const catalogResult = await postCatalog({
        type: 'wallpaper',
        title: formData.title,
        fileKey: s3Key,
        caption: formData.caption,
        shloka: formData.shloka,
        meaning: formData.meaning,
        ratio: formData.ratio,
        palette: formData.palette,
        style: formData.style,
      });

      if (!catalogResult.ok) {
        throw new Error(catalogResult.error || 'Failed to create catalog entry');
      }

      setStatus('done');
      setMsg(`✅ Uploaded and cataloged successfully!`);
      setDebug((d:any) => ({ ...d, catalogResult }));

      // Redirect to wallpapers list after a short delay
      setTimeout(() => {
        if (catalogResult.item?.id) {
          router.push(`/wallpapers/${catalogResult.item.id}`);
        } else {
          router.push('/wallpapers');
        }
      }, 2000);

    } catch (err: any) {
      setStatus('error');
      setMsg(`Upload Failed: ${err?.message || String(err)}`);
      setDebug((d:any) => ({ ...d, errorStack: err?.stack || String(err) }));
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Upload Wallpaper</h1>
      
      <div className="space-y-6">
        {/* File Upload */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">File</h2>
          <div>
            <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
              Choose Image File
            </label>
            <input
              id="file"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
        </div>

        {/* Metadata Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="e.g., Lord Shiva in Meditation"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Style
                </label>
                <input
                  type="text"
                  value={formData.style}
                  onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                  placeholder="e.g., Sacred Art"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aspect Ratio
                </label>
                <input
                  type="text"
                  value={formData.ratio}
                  onChange={(e) => setFormData({ ...formData, ratio: e.target.value })}
                  placeholder="e.g., 16:9"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Caption
              </label>
              <textarea
                value={formData.caption}
                onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                rows={2}
                placeholder="Brief description"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shloka
              </label>
              <textarea
                value={formData.shloka}
                onChange={(e) => setFormData({ ...formData, shloka: e.target.value })}
                rows={2}
                placeholder="Sanskrit verse"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meaning
              </label>
              <textarea
                value={formData.meaning}
                onChange={(e) => setFormData({ ...formData, meaning: e.target.value })}
                rows={2}
                placeholder="Translation or meaning"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Palette
              </label>
              <input
                type="text"
                value={formData.palette}
                onChange={(e) => setFormData({ ...formData, palette: e.target.value })}
                placeholder="e.g., warm, cool, vibrant"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Upload Button */}
        <div>
          <button
            onClick={handleUpload}
            disabled={status === 'presigning' || status === 'uploading' || status === 'creating' || !file || !formData.title.trim()}
            className="w-full px-4 py-3 rounded bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors font-medium"
          >
            {status === 'presigning' ? 'Requesting URL...' : 
             status === 'uploading' ? 'Uploading to S3...' :
             status === 'creating' ? 'Creating catalog entry...' :
             status === 'done' ? '✅ Complete!' :
             'Upload & Create Entry'}
          </button>
        </div>

        {/* Status Messages */}
        {msg && (
          <div className={`p-4 rounded-md ${
            status === 'done' ? 'bg-green-50 border border-green-200 text-green-800' :
            status === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
            'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            {msg}
          </div>
        )}

        {/* Debug Info */}
        {debug && (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
              Debug Info
            </summary>
            <pre className="mt-2 p-3 rounded bg-black/80 text-white text-xs overflow-auto">
{JSON.stringify(debug, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <RouteGuard>
      <UploadContent />
    </RouteGuard>
  );
}