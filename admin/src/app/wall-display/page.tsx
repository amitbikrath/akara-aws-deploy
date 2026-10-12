'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import RouteGuard from '@/components/RouteGuard';
import { getCatalog, postCatalog, manageCatalog } from '@/lib/api';

const SETTINGS_TITLE = 'wall_display_settings';

const extractIdentity = (item: any): { id: string; version: string } | null => {
  const id =
    item.id ??
    (typeof item.pk === 'string' && item.pk.includes('#') ? item.pk.split('#')[1] : undefined);
  const version =
    item.version ?? (typeof item.sk === 'string' ? item.sk.replace(/^v#/, '') : undefined);
  return id && version != null && String(version).trim() !== ''
    ? { id, version: String(version) }
    : null;
};

const pickNewestSettingsRow = (items: any[]) => {
  const rows = items.filter((item) => item.title === SETTINGS_TITLE && item.archived !== true);
  if (rows.length === 0) return undefined;
  if (rows.length === 1) return rows[0];
  return rows.reduce((best, row) =>
    String(row.createdAt ?? '') >= String(best.createdAt ?? '') ? row : best
  );
};

type TileMode = 'tint' | 'grayscale' | 'color';

type WallDisplaySettings = {
  tileMode: TileMode;
  brightnessPercent: number;
  saturationPercent: number;
  cornerRadiusPx: number;
  frameBackground: string;
  gridWash: string;
  gridColumnsDesktop: number | null;
  gridColumnsMobile: number | null;
  gridTargetRowsDesktop: number | null;
  gridTargetRowsMobile: number | null;
  selectionCornerRadiusPx: number | null;
  tileGapPxDesktop: number | null;
  tileGapPxMobile: number | null;
};

const DEFAULT_SETTINGS: WallDisplaySettings = {
  tileMode: 'tint',
  brightnessPercent: 92,
  saturationPercent: 72,
  cornerRadiusPx: 20,
  frameBackground: '#060d18',
  gridWash: 'rgba(3, 3, 3, 0.35)',
  gridColumnsDesktop: null,
  gridColumnsMobile: null,
  gridTargetRowsDesktop: null,
  gridTargetRowsMobile: null,
  selectionCornerRadiusPx: null,
  tileGapPxDesktop: null,
  tileGapPxMobile: null,
};

const parseBodyObject = (body: any): Record<string, any> | null => {
  if (body == null || body === '') return null;
  if (typeof body === 'object' && !Array.isArray(body)) return body;
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (err) {
      // ignore malformed JSON
    }
  }
  return null;
};

const normalizeTileMode = (value: any): TileMode | null => {
  if (typeof value !== 'string') return null;
  const lowered = value.trim().toLowerCase();
  const normalized =
    ({
      colour: 'color',
      gray: 'grayscale',
      grey: 'grayscale',
      greyscale: 'grayscale',
      gray_scale: 'grayscale',
      bw: 'grayscale',
      mono: 'grayscale',
      black_and_white: 'grayscale',
    } as Record<string, string>)[lowered] ?? lowered;
  return normalized === 'grayscale' || normalized === 'color' || normalized === 'tint'
    ? (normalized as TileMode)
    : null;
};

const parseSettings = (body: any): WallDisplaySettings => {
  const settings: WallDisplaySettings = { ...DEFAULT_SETTINGS };
  const obj = parseBodyObject(body);
  if (!obj) return settings;
  try {
    const tileMode = normalizeTileMode(obj.tileMode);
    if (tileMode) settings.tileMode = tileMode;
    const brightness = Number(obj.brightnessPercent);
    if (Number.isFinite(brightness)) settings.brightnessPercent = Math.min(160, Math.max(40, brightness));
    const saturation = Number(obj.saturationPercent);
    if (Number.isFinite(saturation)) settings.saturationPercent = Math.min(160, Math.max(0, saturation));
    const radius = Number(obj.cornerRadiusPx);
    if (Number.isFinite(radius)) settings.cornerRadiusPx = Math.min(40, Math.max(0, radius));
    if (typeof obj.frameBackground === 'string' && obj.frameBackground.trim()) {
      settings.frameBackground = obj.frameBackground.trim();
    }
    if (typeof obj.gridWash === 'string' && obj.gridWash.trim()) {
      settings.gridWash = obj.gridWash.trim();
    }
    const columnsDesktop = Number(obj.gridColumnsDesktop);
    if (Number.isFinite(columnsDesktop) && columnsDesktop >= 2) {
      settings.gridColumnsDesktop = Math.min(32, Math.round(columnsDesktop));
    } else {
      settings.gridColumnsDesktop = null;
    }
    const columnsMobile = Number(obj.gridColumnsMobile);
    if (Number.isFinite(columnsMobile) && columnsMobile >= 2) {
      settings.gridColumnsMobile = Math.min(32, Math.round(columnsMobile));
    } else {
      settings.gridColumnsMobile = null;
    }
    const rowsDesktop = Number(obj.gridTargetRowsDesktop);
    if (Number.isFinite(rowsDesktop) && rowsDesktop >= 2) {
      settings.gridTargetRowsDesktop = Math.min(24, Math.round(rowsDesktop));
    } else {
      settings.gridTargetRowsDesktop = null;
    }
    const rowsMobile = Number(obj.gridTargetRowsMobile);
    if (Number.isFinite(rowsMobile) && rowsMobile >= 2) {
      settings.gridTargetRowsMobile = Math.min(24, Math.round(rowsMobile));
    } else {
      settings.gridTargetRowsMobile = null;
    }
    const selectionRadius = Number(obj.selectionCornerRadiusPx);
    if (Number.isFinite(selectionRadius) && selectionRadius >= 0) {
      settings.selectionCornerRadiusPx = Math.min(48, Math.round(selectionRadius));
    } else {
      settings.selectionCornerRadiusPx = null;
    }
    const gapDesktop = Number(obj.tileGapPxDesktop);
    if (Number.isFinite(gapDesktop) && gapDesktop >= 2) {
      settings.tileGapPxDesktop = Math.min(48, Math.round(gapDesktop));
    } else {
      settings.tileGapPxDesktop = null;
    }
    const gapMobile = Number(obj.tileGapPxMobile);
    if (Number.isFinite(gapMobile) && gapMobile >= 2) {
      settings.tileGapPxMobile = Math.min(48, Math.round(gapMobile));
    } else {
      settings.tileGapPxMobile = null;
    }
  } catch (err) {
    // fall back to whatever parsed so far
  }
  return settings;
};

function WallDisplayPageContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [identity, setIdentity] = useState<{ id: string; version: string } | null>(null);
  const [settings, setSettings] = useState<WallDisplaySettings>(DEFAULT_SETTINGS);
  const [statusNote, setStatusNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await getCatalog({ type: 'site', limit: 200 });
      if (!data.ok) throw new Error(data.error || 'Failed to load');
      const row = pickNewestSettingsRow(data.items || []);
      const rowIdentity = row ? extractIdentity(row) : null;
      if (row?.body != null && row.body !== '' && rowIdentity) {
        const parsed = parseSettings(row.body);
        setSettings(parsed);
        setIdentity(rowIdentity);
        setStatusNote(
          `Loaded newest settings row (${rowIdentity.id.slice(0, 8)}… · ${row.createdAt ?? 'no date'} · tile mode: ${parsed.tileMode}).`
        );
      } else {
        setSettings(DEFAULT_SETTINGS);
        setIdentity(null);
        setStatusNote(
          'No wall_display_settings row in the first 200 site items — defaults shown; Save creates a new row.'
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Load failed');
      setStatusNote('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const body = JSON.stringify({
        tileMode: settings.tileMode,
        brightnessPercent: settings.brightnessPercent,
        saturationPercent: settings.saturationPercent,
        cornerRadiusPx: settings.cornerRadiusPx,
        frameBackground: settings.frameBackground,
        gridWash: settings.gridWash,
        gridColumnsDesktop: settings.gridColumnsDesktop,
        gridColumnsMobile: settings.gridColumnsMobile,
        gridTargetRowsDesktop: settings.gridTargetRowsDesktop,
        gridTargetRowsMobile: settings.gridTargetRowsMobile,
        selectionCornerRadiusPx: settings.selectionCornerRadiusPx,
        tileGapPxDesktop: settings.tileGapPxDesktop,
        tileGapPxMobile: settings.tileGapPxMobile,
      });
      const result: any = identity
        ? await manageCatalog({
            action: 'update',
            type: 'site',
            id: identity.id,
            version: identity.version,
            title: SETTINGS_TITLE,
            body,
            caption: 'Wallpaper wall chrome (JSON)',
          })
        : await postCatalog({
            type: 'site',
            title: SETTINGS_TITLE,
            body,
            caption: 'Wallpaper wall chrome (JSON)',
          } as any);
      if (!result.ok) throw new Error(result.error || 'Save failed');
      if (!identity && result.id) {
        setIdentity({ id: result.id, version: String(result.version ?? '1') });
      }
      setSettings(parseSettings(body));
      setMessage('Saved. Public site picks this up on next load.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-600">Loading…</p>;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Wallpaper wall</h1>
        <p className="mt-2 text-sm text-gray-600">
          Controls the public gallery: tile treatment, colors, grid layout (optional fixed columns
          or target rows per breakpoint), zoomed-tile corner radius, and inner wash. Stored as a
          site catalog row (<code className="rounded bg-gray-100 px-1 text-xs">{SETTINGS_TITLE}</code>).
          If you ever had duplicates, the editor always loads the <strong>newest</strong> row by
          date.
        </p>
        {statusNote ? (
          <p className="mt-2 text-xs text-gray-500" role="status">
            {statusNote}
          </p>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <label className="block text-sm font-medium text-gray-800">
          Tile mode
          <select
            value={settings.tileMode}
            onChange={(e) =>
              setSettings((s) => ({ ...s, tileMode: e.target.value as TileMode }))
            }
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="tint">Tint (warm hero-like idle, full color on hover)</option>
            <option value="grayscale">Black &amp; white idle</option>
            <option value="color">Full color idle</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-gray-800">
          Brightness ({settings.brightnessPercent}%)
          <input
            type="range"
            min={40}
            max={160}
            value={settings.brightnessPercent}
            onChange={(e) =>
              setSettings((s) => ({ ...s, brightnessPercent: Number(e.target.value) }))
            }
            className="mt-2 w-full"
          />
        </label>

        <label className="block text-sm font-medium text-gray-800">
          Saturation ({settings.saturationPercent}%)
          <input
            type="range"
            min={0}
            max={160}
            value={settings.saturationPercent}
            onChange={(e) =>
              setSettings((s) => ({ ...s, saturationPercent: Number(e.target.value) }))
            }
            className="mt-2 w-full"
          />
          <p className="mt-1 text-xs text-gray-500">
            At 0% the wall looks monochrome even in &quot;Full color&quot;; use ~70%+ for vivid
            tiles or pick Tint / B&amp;W idle for intentional muted looks.
          </p>
        </label>

        <label className="block text-sm font-medium text-gray-800">
          Corner radius ({settings.cornerRadiusPx}px)
          <input
            type="range"
            min={0}
            max={40}
            value={settings.cornerRadiusPx}
            onChange={(e) =>
              setSettings((s) => ({ ...s, cornerRadiusPx: Number(e.target.value) }))
            }
            className="mt-2 w-full"
          />
        </label>

        <label className="block text-sm font-medium text-gray-800">
          Frame background (CSS color — legacy; public site uses frosted glass for the section
          shell)
          <input
            type="text"
            value={settings.frameBackground}
            onChange={(e) => setSettings((s) => ({ ...s, frameBackground: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
            placeholder="#060d18"
          />
        </label>

        <label className="block text-sm font-medium text-gray-800">
          Grid wash (inset shadow, e.g. rgba)
          <input
            type="text"
            value={settings.gridWash}
            onChange={(e) => setSettings((s) => ({ ...s, gridWash: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
            placeholder="rgba(3, 3, 3, 0.35)"
          />
        </label>

        <fieldset className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
          <legend className="px-1 text-sm font-semibold text-gray-900">Grid layout</legend>
          <p className="text-xs text-gray-600">
            Leave columns empty to auto-compute from <strong>target rows</strong> and catalog size.
            If you set columns, rows follow from item count. Desktop = 1024px and wider;
            mobile/compact = below 1024px.
          </p>
          <label className="block text-sm font-medium text-gray-800">
            Columns (desktop), 2–32 — empty = auto
            <input
              type="number"
              min={2}
              max={32}
              value={settings.gridColumnsDesktop ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setSettings((s) => ({ ...s, gridColumnsDesktop: null }));
                } else {
                  setSettings((s) => ({
                    ...s,
                    gridColumnsDesktop: Math.min(32, Math.max(2, parseInt(raw, 10) || 2)),
                  }));
                }
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Auto"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Columns (mobile / compact), 2–32 — empty = auto
            <input
              type="number"
              min={2}
              max={32}
              value={settings.gridColumnsMobile ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setSettings((s) => ({ ...s, gridColumnsMobile: null }));
                } else {
                  setSettings((s) => ({
                    ...s,
                    gridColumnsMobile: Math.min(32, Math.max(2, parseInt(raw, 10) || 2)),
                  }));
                }
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Auto"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Target rows (desktop) when columns auto — 2–24, empty = 6
            <input
              type="number"
              min={2}
              max={24}
              value={settings.gridTargetRowsDesktop ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setSettings((s) => ({ ...s, gridTargetRowsDesktop: null }));
                } else {
                  setSettings((s) => ({
                    ...s,
                    gridTargetRowsDesktop: Math.min(24, Math.max(2, parseInt(raw, 10) || 2)),
                  }));
                }
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="6"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Target rows (compact) when columns auto — 2–24, empty = 8
            <input
              type="number"
              min={2}
              max={24}
              value={settings.gridTargetRowsMobile ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setSettings((s) => ({ ...s, gridTargetRowsMobile: null }));
                } else {
                  setSettings((s) => ({
                    ...s,
                    gridTargetRowsMobile: Math.min(24, Math.max(2, parseInt(raw, 10) || 2)),
                  }));
                }
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="8"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Tile gap (desktop, px) — 2–48, empty = 12
            <input
              type="number"
              min={2}
              max={48}
              value={settings.tileGapPxDesktop ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setSettings((s) => ({ ...s, tileGapPxDesktop: null }));
                } else {
                  setSettings((s) => ({
                    ...s,
                    tileGapPxDesktop: Math.min(48, Math.max(2, parseInt(raw, 10) || 2)),
                  }));
                }
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="12"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Tile gap (mobile / compact, px) — 2–48, empty = 10
            <input
              type="number"
              min={2}
              max={48}
              value={settings.tileGapPxMobile ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setSettings((s) => ({ ...s, tileGapPxMobile: null }));
                } else {
                  setSettings((s) => ({
                    ...s,
                    tileGapPxMobile: Math.min(48, Math.max(2, parseInt(raw, 10) || 2)),
                  }));
                }
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="10"
            />
          </label>
        </fieldset>

        <label className="block text-sm font-medium text-gray-800">
          Zoomed tile corner radius (px) — empty = derive from frame radius
          <input
            type="number"
            min={0}
            max={48}
            value={settings.selectionCornerRadiusPx ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                setSettings((s) => ({ ...s, selectionCornerRadiusPx: null }));
              } else {
                setSettings((s) => ({
                  ...s,
                  selectionCornerRadiusPx: Math.min(48, Math.max(0, parseInt(raw, 10) || 0)),
                }));
              }
            }}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Auto"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void load()}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-50"
          >
            Reload from server
          </button>
        </div>

        {message ? <p className="text-sm text-gray-700">{message}</p> : null}
      </form>
    </div>
  );
}

export default function WallDisplayPage() {
  return (
    <RouteGuard>
      <WallDisplayPageContent />
    </RouteGuard>
  );
}
