'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import RouteGuard from '@/components/RouteGuard';
import { getAccessToken } from '@/lib/auth';
import { apiRequest, postCatalog } from '@/lib/api';

function MusicUploadPageContent() {
  const router = useRouter();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'presigning' | 'uploading' | 'creating' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string>('');
  const [debug, setDebug] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    lyrics: '',
  });

  async function uploadToS3(params: { file: File; type: string }): Promise<{ key: string }> {
    const dotIndex = params.file.name.lastIndexOf('.');
    const fileExt = dotIndex >= 0 ? params.file.name.slice(dotIndex + 1).toLowerCase() : '';
    const contentType = params.file.type || 'application/octet-stream';

    const presignRes = await apiRequest('/api/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        contentType,
        fileExt,
        type: params.type,
        filename: params.file.name,
      }),
    });
    const text = await presignRes.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Bad JSON from presign: ${text.slice(0, 200)}`);
    }
    if (!presignRes.ok) throw new Error(`Presign failed ${presignRes.status}: ${data?.error || text}`);

    const uploadUrl = data.uploadUrl || data.url;
    const key = data.key;
    if (!uploadUrl || !key) throw new Error('Presign response missing uploadUrl/key');

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: params.file,
    });
    if (!putRes.ok) {
      const bodyText = await putRes.text().catch(() => '');
      throw new Error(`S3 PUT failed ${putRes.status}: ${bodyText.slice(0, 200)}`);
    }

    return { key: String(key) };
  }

  async function handleUpload() {
    try {
      if (!audioFile) {
        setMsg('Pick an audio file first.');
        return;
      }
      if (!coverFile) {
        setMsg('Pick cover art first.');
        return;
      }
      if (!formData.title.trim()) {
        setMsg('Please enter a title.');
        return;
      }
      if (!getAccessToken()) {
        setMsg('Please login first.');
        router.push('/login.html');
        return;
      }

      setStatus('presigning');
      setMsg('Requesting upload URLs …');
      setStatus('uploading');
      setMsg('Uploading files to S3 …');

      const [audioUpload, coverUpload] = await Promise.all([
        uploadToS3({ file: audioFile, type: 'music' }),
        uploadToS3({ file: coverFile, type: 'music' }),
      ]);

      setDebug((d: any) => ({ ...d, audioKey: audioUpload.key, coverKey: coverUpload.key }));

      setStatus('creating');
      setMsg('Creating catalog entry …');

      const catalogResult = await postCatalog({
        type: 'music',
        title: formData.title,
        fileKey: audioUpload.key,
        thumbKey: coverUpload.key,
        caption: formData.lyrics,
        lyrics: formData.lyrics,
        albumArtKey: coverUpload.key,
      } as any);

      if (!catalogResult.ok) {
        throw new Error(catalogResult.error || 'Failed to create catalog entry');
      }

      setStatus('done');
      setMsg('✅ Uploaded music successfully!');
      setDebug((d: any) => ({ ...d, catalogResult }));

      setTimeout(() => router.push('/music'), 1200);
    } catch (err: any) {
      setStatus('error');
      setMsg(`Upload Failed: ${err?.message || String(err)}`);
      setDebug((d: any) => ({ ...d, errorStack: err?.stack || String(err) }));
    }
  }

  return (
    <div className="mx-auto max-w-3xl py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Upload Music</h1>

      <div className="space-y-6">
        <div className="glass-panel space-y-5 p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="glass-input"
              placeholder="Track title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lyrics</label>
            <textarea
              value={formData.lyrics}
              onChange={(e) => setFormData({ ...formData, lyrics: e.target.value })}
              rows={6}
              className="glass-input"
              placeholder="Paste lyrics here"
            />
          </div>
        </div>

        <div className="glass-panel space-y-5 p-6">
          <div>
            <label htmlFor="audio" className="block text-sm font-medium text-gray-700 mb-2">
              Audio file *
            </label>
            <input
              id="audio"
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
              className="glass-input"
            />
            {audioFile ? (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="cover" className="block text-sm font-medium text-gray-700 mb-2">
              Album art *
            </label>
            <input
              id="cover"
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
              className="glass-input"
            />
            {coverFile ? (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {coverFile.name} ({(coverFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <button
            onClick={handleUpload}
            disabled={
              status === 'presigning' ||
              status === 'uploading' ||
              status === 'creating' ||
              !audioFile ||
              !coverFile ||
              !formData.title.trim()
            }
            className="glass-chip w-full px-4 py-3 text-center font-medium text-black disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'presigning'
              ? 'Requesting URLs...'
              : status === 'uploading'
              ? 'Uploading to S3...'
              : status === 'creating'
              ? 'Creating catalog entry...'
              : status === 'done'
              ? '✅ Complete!'
              : 'Upload & Create Entry'}
          </button>
        </div>

        {msg ? (
          <div
            className={`p-4 rounded-md ${
              status === 'done'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : status === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}
          >
            {msg}
          </div>
        ) : null}

        {debug ? (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">Debug Info</summary>
            <pre className="mt-2 p-3 rounded bg-black/80 text-white text-xs overflow-auto">
              {JSON.stringify(debug, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}

export default function MusicUploadPage() {
  return (
    <RouteGuard>
      <MusicUploadPageContent />
    </RouteGuard>
  );
}
