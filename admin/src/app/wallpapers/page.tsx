'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RouteGuard from '@/components/RouteGuard';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cdnUrl } from '@/lib/cdn';
import { getCatalog, manageCatalog } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

function WallpaperViewer({
  items,
  startIndex,
  open,
  onClose,
  resolveUrl,
}: {
  items: any[];
  startIndex: number;
  open: boolean;
  onClose: () => void;
  resolveUrl?: (key: string) => string;
}) {
  const resolve = resolveUrl ?? cdnUrl;
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(startIndex);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (open) setIndex(Math.max(0, Math.min(startIndex, items.length - 1)));
  }, [open, startIndex, items.length]);

  const count = items.length;
  const current = count > 0 ? items[Math.max(0, Math.min(index, count - 1))] : null;

  const goNext = useCallback(() => {
    if (count <= 1) return;
    setDirection(1);
    setIndex((i) => (i + 1) % count);
  }, [count]);

  const goPrev = useCallback(() => {
    if (count <= 1) return;
    setDirection(-1);
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, goNext, goPrev]);

  // Preload neighbours so swipes feel instant.
  useEffect(() => {
    if (!open || count === 0) return;
    [items[(index + 1) % count], items[(index - 1 + count) % count]].forEach((it) => {
      if (it && it.mediaType !== 'video') {
        new Image().src = resolve(it.fileKey);
      }
    });
  }, [open, index, items, count, resolve]);

  const handleDragEnd = useCallback(
    (_e: any, info: any) => {
      const { offset, velocity } = info;
      const dy = offset.y;
      const dx = offset.x;
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy < -80 || velocity.y < -500) return goNext();
        if (dy > 80 || velocity.y > 500) return goPrev();
      } else {
        if (dx < -80 || velocity.x < -500) return goNext();
        if (dx > 80 || velocity.x > 500) return goPrev();
      }
    },
    [goNext, goPrev]
  );

  const variants = useMemo(
    () => ({
      enter: (dir: number) => ({
        y: dir === 1 ? '100%' : '-100%',
        scale: 0.9,
        opacity: 0,
        zIndex: 2,
      }),
      center: {
        y: '0%',
        scale: 1,
        opacity: 1,
        zIndex: 2,
      },
      exit: (dir: number) => ({
        y: dir === 1 ? '-8%' : '8%',
        scale: 0.92,
        opacity: 0,
        zIndex: 1,
      }),
    }),
    []
  );

  if (!open || !current) return null;

  const src = resolve(current.fileKey);
  const isVideo = current.mediaType === 'video';
  const bgSrc = current.thumbKey ? resolve(current.thumbKey) : src;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={current.title || 'Wallpaper viewer'}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`bg-${current.id}`}
          src={bgSrc}
          alt=""
          className="h-full w-full object-cover scale-110 blur-2xl opacity-50"
          draggable={false}
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence custom={direction} initial={false} mode="sync">
          <motion.div
            key={current.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={
              reducedMotion
                ? { duration: 0.18, ease: 'easeOut' }
                : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
            }
            drag="y"
            dragElastic={0.2}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 flex items-center justify-center will-change-transform"
            style={{ touchAction: 'none' }}
          >
            {isVideo ? (
              <video
                src={src}
                className="max-h-full max-w-full object-contain"
                autoPlay
                loop
                muted
                playsInline
                controls
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={current.title || ''}
                className="max-h-full max-w-full object-contain select-none"
                draggable={false}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[10] flex items-start justify-between gap-3 p-4 sm:p-6">
        <div className="pointer-events-auto max-w-[70%]">
          {current.title ? (
            <h2 className="text-base font-semibold text-white drop-shadow-md sm:text-lg">
              {current.title}
            </h2>
          ) : null}
          {count > 1 ? (
            <p className="mt-0.5 text-xs text-white/70">
              {index + 1} / {count}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 active:scale-95"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous"
            className="absolute left-3 top-1/2 z-[10] hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/10 p-3 text-white backdrop-blur transition hover:bg-white/20 active:scale-95 sm:inline-flex"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next"
            className="absolute right-3 top-1/2 z-[10] hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/10 p-3 text-white backdrop-blur transition hover:bg-white/20 active:scale-95 sm:inline-flex"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      ) : null}

      {count > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[10] flex justify-center sm:hidden">
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80 backdrop-blur">
            Swipe up / down to navigate
          </span>
        </div>
      ) : null}
    </div>
  );
}

function WallpapersList() {
  const router = useRouter();
  const [wallpapers, setWallpapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStyle, setFilterStyle] = useState('');
  const [filterRatio, setFilterRatio] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    loadWallpapers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWallpapers = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!getAccessToken()) {
        router.push('/login.html');
        return;
      }

      const data = await getCatalog({
        type: 'wallpaper',
        limit: 100,
        includeArchived: true,
        includeHidden: true,
      });

      if (data.ok) {
        setWallpapers(data.items || []);
      } else {
        setError(data.error || 'Failed to load wallpapers');
      }
    } catch (err: any) {
      console.error('Error loading wallpapers:', err);
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login.html');
        return;
      }
      setError(err.message || 'Failed to load wallpapers');
    } finally {
      setLoading(false);
    }
  };

  const filteredWallpapers = wallpapers.filter(wp => {
    const matchesSearch = !searchTerm ||
      wp.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wp.caption?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStyle = !filterStyle || wp.style === filterStyle;
    const matchesRatio = !filterRatio || wp.ratio === filterRatio;
    return matchesSearch && matchesStyle && matchesRatio;
  });

  const styles = Array.from(new Set(wallpapers.map(wp => wp.style).filter(Boolean))).sort();
  const ratios = Array.from(new Set(wallpapers.map(wp => wp.ratio).filter(Boolean))).sort();

  const handleArchiveToggle = async (item: any) => {
    const action = item.archived ? 'unarchive' : 'archive';
    const label = item.archived ? 'unarchive' : 'archive';
    if (!window.confirm(`Are you sure you want to ${label} "${item.title || item.id}"?`)) return;
    try {
      setBusyId(item.id);
      await manageCatalog({ action, type: 'wallpaper', id: item.id, version: item.version || '1' });
      await loadWallpapers();
    } catch (err: any) {
      setError(err.message || `Failed to ${label} item`);
    } finally {
      setBusyId(null);
    }
  };

  const handleHiddenToggle = async (item: any) => {
    const next = !item.hiddenFromPublic;
    try {
      setBusyId(item.id);
      await manageCatalog({
        action: 'update',
        type: 'wallpaper',
        id: item.id,
        version: item.version || '1',
        hiddenFromPublic: next,
      });
      await loadWallpapers();
    } catch (err: any) {
      setError(err.message || 'Failed to update visibility');
    } finally {
      setBusyId(null);
    }
  };

  const handleFreePreviewToggle = async (item: any) => {
    const next = !item.freePreview;
    try {
      setBusyId(item.id);
      await manageCatalog({
        action: 'update',
        type: 'wallpaper',
        id: item.id,
        version: item.version || '1',
        freePreview: next,
        fileKey: item.fileKey,
      });
      await loadWallpapers();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle free preview');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: any) => {
    if (!window.confirm(`Delete "${item.title || item.id}" permanently? This cannot be undone.`)) return;
    try {
      setBusyId(item.id);
      await manageCatalog({ action: 'delete', type: 'wallpaper', id: item.id, version: item.version || '1' });
      await loadWallpapers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading wallpapers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
        <button
          onClick={loadWallpapers}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Wallpapers</h2>
          <p className="text-gray-600 mt-1">
            Manage your wallpaper collection ({filteredWallpapers.length} items)
          </p>
        </div>
        <Link
          href="/upload"
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
        >
          Upload New
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-panel space-y-4 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or caption..."
              className="glass-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Style
            </label>
            <select
              value={filterStyle}
              onChange={(e) => setFilterStyle(e.target.value)}
              className="glass-input"
            >
              <option value="">All Styles</option>
              {styles.map(style => (
                <option key={style} value={style}>{style}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aspect Ratio
            </label>
            <select
              value={filterRatio}
              onChange={(e) => setFilterRatio(e.target.value)}
              className="glass-input"
            >
              <option value="">All Ratios</option>
              {ratios.map(ratio => (
                <option key={ratio} value={ratio}>{ratio}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <WallpaperViewer
        items={filteredWallpapers}
        startIndex={viewerIndex ?? 0}
        open={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
      />

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-black/10">
            <thead className="bg-white/35">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thumbnail
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Style
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ratio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/30 divide-y divide-black/10">
              {filteredWallpapers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No wallpapers found. <Link href="/upload" className="text-indigo-600 hover:underline">Upload one?</Link>
                  </td>
                </tr>
              ) : (
                filteredWallpapers.map((wp) => (
                  <tr key={wp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {wp.thumbKey || wp.fileKey ? (
                        <div className="w-16 h-16 bg-gray-200 rounded overflow-hidden">
                          {wp.mediaType === 'video' ? (
                            <video
                              src={`/content/${String(wp.fileKey).replace(/^\/+/, '')}`}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={
                                wp.thumbKey
                                  ? wp.thumbKey.startsWith('http')
                                    ? wp.thumbKey
                                    : `/content/${wp.thumbKey.replace(/^\/+/, '')}`
                                  : `/content/${String(wp.fileKey).replace(/^\/+/, '')}`
                              }
                              alt={wp.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">
                          No thumb
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{wp.title || 'Untitled'}</div>
                      {wp.caption && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">{wp.caption}</div>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {wp.archived && (
                          <span className="inline-flex text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            Archived
                          </span>
                        )}
                        {wp.hiddenFromPublic && (
                          <span className="inline-flex text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                            Hidden
                          </span>
                        )}
                        {wp.freePreview && (
                          <span className="inline-flex text-xs px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold">
                            FREE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {wp.style || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {wp.ratio || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {wp.createdAt ? new Date(wp.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                      <button
                        onClick={() => {
                          const idx = filteredWallpapers.findIndex((it) => it.id === wp.id);
                          if (idx >= 0) setViewerIndex(idx);
                        }}
                        className="text-emerald-600 hover:text-emerald-800 hover:underline"
                      >
                        Preview
                      </button>
                      <Link
                        href={`/wallpapers/edit?id=${wp.id}`}
                        className="text-indigo-600 hover:text-indigo-900 hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleHiddenToggle(wp)}
                        disabled={busyId === wp.id}
                        className="text-slate-600 hover:text-slate-800 hover:underline disabled:opacity-50"
                      >
                        {wp.hiddenFromPublic ? 'Show' : 'Hide'}
                      </button>
                      <button
                        onClick={() => handleFreePreviewToggle(wp)}
                        disabled={busyId === wp.id}
                        title={wp.freePreview ? 'Lock — preview becomes watermarked 1200px' : 'Make free — preview becomes full-res unwatermarked'}
                        className={`hover:underline disabled:opacity-50 ${wp.freePreview ? 'text-amber-700 hover:text-amber-900 font-semibold' : 'text-emerald-700 hover:text-emerald-900'}`}
                      >
                        {wp.freePreview ? 'Lock preview' : 'Make free'}
                      </button>
                      <button
                        onClick={() => handleArchiveToggle(wp)}
                        disabled={busyId === wp.id}
                        className="text-amber-600 hover:text-amber-800 hover:underline disabled:opacity-50"
                      >
                        {wp.archived ? 'Unarchive' : 'Archive'}
                      </button>
                      <button
                        onClick={() => handleDelete(wp)}
                        disabled={busyId === wp.id}
                        className="text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function WallpapersPage() {
  return (
    <RouteGuard>
      <WallpapersList />
    </RouteGuard>
  );
}
