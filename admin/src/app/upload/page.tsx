'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/auth';
import { apiRequest, postCatalog } from '@/lib/api';
import RouteGuard from '@/components/RouteGuard';

function UploadContent() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle'|'presigning'|'uploading'|'creating'|'done'|'error'>('idle');
  const [msg, setMsg] = useState<string>('');
  const [debug, setDebug] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: '',
    caption: '',
    shloka: '',
    meaning: '',
    style: '',
    ratio: '16:9',
    palette: '',
    hiddenFromPublic: false,
  });

  async function generateThumbnail(source: File, maxDim = 480): Promise<Blob> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image for thumbnail'));
      reader.readAsDataURL(source);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to decode image for thumbnail'));
      image.src = dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to create thumbnail canvas');
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.82);
    });
    if (!blob) throw new Error('Failed to generate thumbnail blob');
    return blob;
  }

  async function handleUpload() {
    try {
      if (!file) { setMsg('Pick a file first.'); return; }

      if (!formData.title.trim()) {
        setMsg('Please enter a title.');
        return;
      }

      if (!getAccessToken()) {
        setMsg('Please login first.');
        router.push('/login.html');
        return;
      }

      setStatus('presigning'); setMsg('Requesting upload URL …');

      // 1) POST presign request with content type + extension
      const dotIdx = file.name.lastIndexOf('.');
      const fileExt = dotIdx >= 0 ? file.name.slice(dotIdx + 1).toLowerCase() : '';
      const presignRes = await apiRequest('/api/upload-url', {
        method: 'POST',
        body: JSON.stringify({
          contentType: file.type || 'application/octet-stream',
          fileExt,
          type: 'wallpaper',
        }),
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
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!putRes.ok) {
        const bodyText = await putRes.text().catch(() => '');
        throw new Error(`S3 PUT failed ${putRes.status}: ${bodyText.slice(0,200)}`);
      }

      setDebug((d: any) => ({ ...d, putStatus: putRes.status, s3Key }));

      // 3) Generate + upload a thumbnail for images (non-fatal on failure)
      const isImage = file.type.startsWith('image/');
      const mediaType = isImage ? 'image' : file.type.startsWith('video/') ? 'video' : 'asset';
      let thumbKey = '';
      try {
        if (!isImage) throw new Error('Skipping thumbnail generation for non-image media');
        const thumbBlob = await generateThumbnail(file);
        const thumbPresignRes = await apiRequest('/api/upload-url', {
          method: 'POST',
          body: JSON.stringify({
            contentType: 'image/jpeg',
            fileExt: 'jpg',
            type: 'wallpaper',
          }),
        });
        const thumbText = await thumbPresignRes.text();
        let thumbData: any;
        try { thumbData = JSON.parse(thumbText); } catch { throw new Error(`Bad JSON from thumbnail presign: ${thumbText.slice(0,200)}`); }
        if (!thumbPresignRes.ok || !thumbData?.uploadUrl) throw new Error(`Thumbnail presign failed ${thumbPresignRes.status}: ${thumbData?.error || thumbText}`);
        thumbKey = String(thumbData.key || '');
        const thumbPutRes = await fetch(thumbData.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'image/jpeg',
          },
          body: thumbBlob,
        });
        if (!thumbPutRes.ok) {
          const bodyText = await thumbPutRes.text().catch(() => '');
          throw new Error(`Thumbnail S3 PUT failed ${thumbPutRes.status}: ${bodyText.slice(0,200)}`);
        }
        setDebug((d: any) => ({
          ...d,
          thumbPresignStatus: thumbPresignRes.status,
          thumbPutStatus: thumbPutRes.status,
          thumbKey,
        }));
      } catch (err: any) {
        setDebug((d: any) => ({ ...d, thumbWarning: err?.message || String(err) }));
      }

      // 4) Create catalog entry
      setStatus('creating'); setMsg('Creating catalog entry …');

      const catalogResult = await postCatalog({
        type: 'wallpaper',
        title: formData.title,
        fileKey: s3Key,
        thumbKey,
        mediaType,
        mimeType: file.type || 'application/octet-stream',
        caption: formData.caption,
        shloka: formData.shloka,
        meaning: formData.meaning,
        ratio: formData.ratio,
        palette: formData.palette,
        style: formData.style,
        hiddenFromPublic: formData.hiddenFromPublic,
      } as any);

      if (!catalogResult.ok) {
        throw new Error(catalogResult.error || 'Failed to create catalog entry');
      }

      setStatus('done');
      setMsg('✅ Uploaded and cataloged successfully!');
      setDebug((d: any) => ({ ...d, catalogResult }));

      // Redirect to wallpapers list after a short delay
      setTimeout(() => {
        if (catalogResult.item?.id) {
          router.push(`/wallpapers/edit?id=${catalogResult.item.id}`);
        } else {
          router.push('/wallpapers');
        }
      }, 2000);

    } catch (err: any) {
      setStatus('error');
      setMsg(`Upload Failed: ${err?.message || String(err)}`);
      setDebug((d: any) => ({ ...d, errorStack: err?.stack || String(err) }));
    }
  }

  return (
    <div className="mx-auto max-w-3xl py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Upload Wallpaper</h1>

      <div className="space-y-6">
        {/* File Upload */}
        <div className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">File</h2>
          <div>
            <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
              Choose Media File
            </label>
            <input
              id="file"
              type="file"
              accept="image/*,video/*,.gif"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="glass-input"
            />
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
        </div>

        {/* Metadata Form */}
        <div className="glass-panel p-6">
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
                className="glass-input"
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
                  className="glass-input"
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
                  className="glass-input"
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
                className="glass-input"
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
                className="glass-input"
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
                className="glass-input"
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
                className="glass-input"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id="hide-from-public"
                type="checkbox"
                checked={formData.hiddenFromPublic}
                onChange={(e) => setFormData({ ...formData, hiddenFromPublic: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="hide-from-public" className="text-sm text-gray-700 select-none">
                Hide from public site (admin-only)
              </label>
            </div>
          </div>
        </div>

        {/* Upload Button */}
        <div>
          <button
            onClick={handleUpload}
            disabled={status === 'presigning' || status === 'uploading' || status === 'creating' || !file || !formData.title.trim()}
            className="glass-chip w-full px-4 py-3 text-center font-medium text-black disabled:opacity-50 disabled:cursor-not-allowed"
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
