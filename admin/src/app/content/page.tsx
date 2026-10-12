'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import RouteGuard from '@/components/RouteGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { apiRequest, getCatalog, manageCatalog, postCatalog } from '@/lib/api';
import { cdnUrl } from '@/lib/cdn';
import { cn } from '@/lib/utils';

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
    img.src = src;
  });

const getCroppedBlob = async (src: string, area: Area, quality = 0.92): Promise<Blob> => {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(area.width);
  canvas.height = Math.floor(area.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        blob ? resolve(blob) : reject(new Error('Canvas export failed'));
      },
      'image/jpeg',
      quality
    );
  });
};

const ASPECT_OPTIONS = [
  { id: '1', label: '1:1 (Our Story)' },
  { id: '4-3', label: '4:3' },
  { id: '16-9', label: '16:9' },
  { id: 'free', label: 'Free' },
];

const aspectForId = (id: string) =>
  id === '1' ? 1 : id === '4-3' ? 4 / 3 : id === '16-9' ? 16 / 9 : undefined;

const CropCard = ({
  onCroppedFile,
  appliedFile,
  onClearFile,
  className,
}: {
  onCroppedFile: (file: File) => void;
  appliedFile: File | null;
  onClearFile: () => void;
  className?: string;
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [aspectId, setAspectId] = useState('1');
  const [processing, setProcessing] = useState(false);

  const aspect = aspectForId(aspectId);

  useEffect(() => {
    if (!appliedFile) {
      setImageSrc((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [appliedFile]);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPx: Area) => {
    setCroppedAreaPixels(croppedAreaPx);
  }, []);

  const applyCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      const file = new File([blob], `our-story-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCroppedFile(file);
      setImageSrc(null);
      setCroppedAreaPixels(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className={cn('w-full max-w-xl border-border/80 bg-card/90 text-card-foreground shadow-sm', className)}>
      <CardHeader className="space-y-1 p-4 pb-2">
        <CardTitle className="text-lg">About photo</CardTitle>
        <CardDescription>
          Choose an image, adjust the crop (default 1:1 matches the site), then apply. Focal point below still
          applies to the cropped result.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4 pt-0">
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.addEventListener('load', () => {
              setImageSrc(reader.result as string);
              setCroppedAreaPixels(null);
              setCrop({ x: 0, y: 0 });
              setZoom(1);
            });
            reader.readAsDataURL(file);
          }}
          aria-label="Choose image to crop"
        />
        {appliedFile ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Ready to upload:</span>
            <span className="font-medium text-foreground">{appliedFile.name}</span>
            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onClearFile}>
              Remove
            </Button>
          </div>
        ) : null}
        {imageSrc ? (
          <>
            <div className="relative h-[min(360px,55vh)] w-full overflow-hidden rounded-xl bg-muted">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-sm text-muted-foreground">Zoom</span>
                <Slider
                  value={[zoom]}
                  onValueChange={(value) => setZoom(value[0] ?? 1)}
                  min={1}
                  max={3}
                  step={0.01}
                  className="flex-1"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="w-28 shrink-0 text-sm text-muted-foreground">Aspect</span>
                <Select value={aspectId} onValueChange={setAspectId}>
                  <SelectTrigger className="w-full sm:w-[200px]" aria-label="Crop aspect ratio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" onClick={applyCrop} disabled={!croppedAreaPixels || processing}>
                {processing ? 'Processing…' : 'Use cropped image'}
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};

const clampPct = (value: any, fallback: number) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
};

const FocusPicker = ({
  previewUrl,
  focusX,
  focusY,
  onFocusChange,
}: {
  previewUrl: string;
  focusX: number;
  focusY: number;
  onFocusChange: (pos: { x: number; y: number }) => void;
}) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ px: number; py: number; fx: number; fy: number } | null>(null);

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600">
        Drag inside the square to set focal point on the cropped photo (object-position). Saves with the story.
      </p>
      <div
        ref={frameRef}
        role="application"
        aria-label="Reposition story image within frame"
        tabIndex={0}
        onPointerDown={(e) => {
          dragRef.current = { px: e.clientX, py: e.clientY, fx: focusX, fy: focusY };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
        }}
        onPointerMove={(e) => {
          if (!dragRef.current || !frameRef.current) return;
          const rect = frameRef.current.getBoundingClientRect();
          const dx = e.clientX - dragRef.current.px;
          const dy = e.clientY - dragRef.current.py;
          const width = Math.max(1, rect.width);
          const height = Math.max(1, rect.height);
          onFocusChange({
            x: Math.round(Math.min(100, Math.max(0, dragRef.current.fx - (dx / width) * 100))),
            y: Math.round(Math.min(100, Math.max(0, dragRef.current.fy - (dy / height) * 100))),
          });
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative mx-auto aspect-square w-full max-w-sm cursor-grab touch-none overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 active:cursor-grabbing"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover"
          style={{ objectPosition: `${focusX}% ${focusY}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">
        Focal point: {focusX}% horizontal, {focusY}% vertical
      </p>
    </div>
  );
};

function ContentPageContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [story, setStory] = useState('');
  const [storyItem, setStoryItem] = useState<{ id: string; version: string } | null>(null);
  const [storyImageKey, setStoryImageKey] = useState('');
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [focusX, setFocusX] = useState(50);
  const [focusY, setFocusY] = useState(50);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [instagram, setInstagram] = useState('');
  const [contactItem, setContactItem] = useState<{ id: string; version: string } | null>(null);

  const applyCroppedFile = useCallback((file: File | null) => {
    setCroppedFile(file);
    setPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    if (file) {
      setFocusX(50);
      setFocusY(50);
    }
  }, []);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const items = (await getCatalog({ type: 'site', limit: 50, includeArchived: true })).items || [];
      const storyEntry = items.find((item: any) => item.title === 'our_story');
      setStoryItem(storyEntry ? { id: storyEntry.id, version: storyEntry.version || '1' } : null);
      setStoryImageKey(storyEntry?.storyImageKey || '');
      setFocusX(clampPct(storyEntry?.storyImageFocusX, 50));
      setFocusY(clampPct(storyEntry?.storyImageFocusY, 50));
      setStory(
        storyEntry?.body ||
          storyEntry?.caption ||
          'Akara is a devotional digital sanctuary where sacred art and sound come together. We craft wallpapers, music, and immersive experiences rooted in bhakti, beauty, and calm.'
      );
      const contactEntry = items.find((item: any) => item.title === 'contact_info');
      setContactItem(contactEntry ? { id: contactEntry.id, version: contactEntry.version || '1' } : null);
      setEmail(contactEntry?.contactEmail || 'hello@akara.studio');
      setPhone(contactEntry?.contactPhone || '');
      setAddress(contactEntry?.contactAddress || '');
      setInstagram(contactEntry?.contactInstagram || '');
    } catch (err: any) {
      setMessage(err?.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }

  async function saveStory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      let imageKey = storyImageKey;
      if (croppedFile) {
        const fileExt = croppedFile.name.includes('.')
          ? croppedFile.name.split('.').pop()?.toLowerCase()
          : '';
        const contentType = croppedFile.type || 'application/octet-stream';
        const res = await apiRequest('/api/upload-url', {
          method: 'POST',
          body: JSON.stringify({
            contentType,
            fileExt: fileExt || 'jpg',
            type: 'site',
            filename: croppedFile.name,
          }),
        });
        const data = await res.json();
        const uploadUrl = data?.uploadUrl || data?.url;
        if (!res.ok || !uploadUrl || !data?.key) {
          throw new Error(data?.error || 'Failed to create image upload URL');
        }
        const putRes = await fetch(String(uploadUrl), {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: croppedFile,
        });
        if (!putRes.ok) throw new Error(`Failed uploading image (${putRes.status})`);
        imageKey = String(data.key);
      }
      const result = storyItem
        ? await manageCatalog({
            action: 'update',
            type: 'site',
            id: storyItem.id,
            version: storyItem.version,
            body: story,
            caption: story,
            title: 'our_story',
            storyImageKey: imageKey,
            storyImageFocusX: focusX,
            storyImageFocusY: focusY,
          })
        : await postCatalog({
            type: 'site',
            title: 'our_story',
            body: story,
            caption: story,
            storyImageKey: imageKey,
            storyImageFocusX: focusX,
            storyImageFocusY: focusY,
          } as any);
      if (!result.ok) throw new Error(result.error || 'Failed to save story');
      setMessage('Our Story saved');
      applyCroppedFile(null);
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save story');
    } finally {
      setSaving(false);
    }
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const result = contactItem
        ? await manageCatalog({
            action: 'update',
            type: 'site',
            id: contactItem.id,
            version: contactItem.version,
            title: 'contact_info',
            contactEmail: email,
            contactPhone: phone,
            contactAddress: address,
            contactInstagram: instagram,
          })
        : await postCatalog({
            type: 'site',
            title: 'contact_info',
            contactEmail: email,
            contactPhone: phone,
            contactAddress: address,
            contactInstagram: instagram,
          } as any);
      if (!result.ok) throw new Error(result.error || 'Failed to save contact info');
      setMessage('Contact info saved');
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save contact info');
    } finally {
      setSaving(false);
    }
  }

  useEffect(
    () => () => {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    },
    [previewObjectUrl]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewUrl = previewObjectUrl || (storyImageKey ? cdnUrl(storyImageKey) : '/branding/akara-banner.png');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Site Content</h2>
        <p className="mt-1 text-gray-600">Manage Our Story and contact details shown on the website.</p>
      </div>

      {message ? <div className="glass-panel p-3 text-sm text-indigo-800">{message}</div> : null}

      {loading ? (
        <div className="text-sm text-gray-500">Loading content…</div>
      ) : (
        <>
          <form onSubmit={saveStory} className="glass-panel space-y-3 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Our Story</h3>
            <div className="space-y-2">
              <CropCard
                appliedFile={croppedFile}
                onCroppedFile={applyCroppedFile}
                onClearFile={() => applyCroppedFile(null)}
              />
              {!croppedFile && storyImageKey ? (
                <p className="text-xs text-gray-600">Current image key: {storyImageKey}</p>
              ) : null}
            </div>
            <FocusPicker
              previewUrl={previewUrl}
              focusX={focusX}
              focusY={focusY}
              onFocusChange={({ x, y }) => {
                setFocusX(x);
                setFocusY(y);
              }}
            />
            <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={7} className="glass-input" />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Our Story'}
            </button>
          </form>

          <form onSubmit={saveContact} className="glass-panel space-y-3 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="glass-input"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="glass-input"
            />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address"
              className="glass-input"
            />
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="Instagram URL"
              className="glass-input"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Contact Info'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ContentPage() {
  return (
    <RouteGuard>
      <ContentPageContent />
    </RouteGuard>
  );
}
