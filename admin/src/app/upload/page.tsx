'use client';
import React, { useState } from 'react';
import { loadTokens } from '@/src/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle'|'presigning'|'uploading'|'done'|'error'>('idle');
  const [msg, setMsg] = useState<string>('');
  const [debug, setDebug] = useState<any>(null);

  async function handleUpload() {
    try {
      if (!file) { setMsg('Pick a file first.'); return; }
      
      const t = loadTokens();
      const idToken = t?.idToken;
      
      if (!idToken) {
        setMsg('Please login first.');
        return;
      }
      
      setStatus('presigning'); setMsg('Requesting upload URL …');

      // 1) GET presigned URL — NO body for GET
      const qs = new URLSearchParams({ filename: file.name, contentType: file.type || 'application/octet-stream' });
      const presignRes = await fetch(`${API_BASE}/api/upload-url?${qs.toString()}`, { 
        method: 'GET',
        headers: idToken ? { 'Authorization': `Bearer ${idToken}` } : {},
      });
      const text = await presignRes.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`Bad JSON from presign: ${text.slice(0,200)}`); }

      if (!presignRes.ok) throw new Error(`Presign failed ${presignRes.status}: ${data?.message || text}`);
      if (!data?.url) throw new Error('Presign response missing url');

      setDebug({ presignStatus: presignRes.status, presignBody: data });

      // 2) PUT file to S3 with EXACT Content-Type used in the signature
      setStatus('uploading'); setMsg('Uploading to S3 …');
      const putRes = await fetch(data.url, {
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

      setStatus('done');
      setMsg(`✅ Uploaded to s3://${data.bucket}/content/${data.key}`);
      setDebug((d:any) => ({ ...d, putStatus: putRes.status }));
    } catch (err: any) {
      setStatus('error');
      setMsg(`Upload Failed: ${err?.message || String(err)}`);
      setDebug((d:any) => ({ ...d, errorStack: err?.stack || String(err) }));
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Upload Content</h1>
      
      <div className="space-y-6">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
            Choose File
          </label>
          <input
            id="file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div>
          <button
            onClick={handleUpload}
            disabled={status === 'presigning' || status === 'uploading'}
            className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'presigning' ? 'Requesting URL...' : 
             status === 'uploading' ? 'Uploading...' : 'Upload Content'}
          </button>
        </div>

        {msg && (
          <div className={`p-4 rounded-md ${
            status === 'done' ? 'bg-green-50 border border-green-200 text-green-800' :
            status === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
            'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            {msg}
          </div>
        )}

        {/* Tiny collapsible debug to avoid DevTools if you don't want them */}
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