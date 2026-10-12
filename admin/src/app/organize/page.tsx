'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import RouteGuard from '@/components/RouteGuard';
import { getOrganizeQueue, postOrganizeDecision, OrganizeCard } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

const MOODS = ['devotional', 'cosmic', 'serene', 'fierce', 'joyful', 'mystical', 'contemplative'];
const DEITY_CANON = ['Shiva', 'Krishna', 'Ganesha', 'Hanuman', 'Devi', 'Durga', 'Kali', 'Lakshmi', 'Saraswati', 'Vishnu', 'Rama', 'Narasimha', 'Murugan', 'Surya', 'Radha', 'Parvati', 'Sita'];
const COUPLES = ['radha-krishna', 'shiva-parvati', 'sita-rama', 'lakshmi-narayana'];
const BHAVAS: [string, string][] = [['saumya', 'Saumya · gentle'], ['ugra', 'Ugra · fierce'], ['shringara', 'Shringara · loving'], ['vira', 'Vira · heroic'], ['dhyana', 'Dhyana · meditative']];

interface EditableFields {
  title: string;
  caption: string;
  deities: string[];
  moodTag: string;
  tags: string[];
  style: string;
  orientation: string;
  form: string;
  couple: string;
  bhava: string;
  heroFor: string[];
}

function fieldsFromCard(card: OrganizeCard): EditableFields {
  const s = card.suggestion;
  return {
    title: s?.title || card.title || '',
    caption: s?.caption || card.caption || '',
    deities: s?.deities?.length ? s.deities : card.deities || [],
    moodTag: s?.moodTag || card.moodTag || '',
    tags: s?.tags?.length ? s.tags : card.tags || [],
    style: s?.style || card.style || '',
    orientation: s?.orientation || '',
    form: s?.form || card.form || '',
    couple: s?.couple ?? card.couple ?? '',
    bhava: s?.bhava || card.bhava || '',
    heroFor: [],
  };
}

function ConfidenceBadge({ level }: { level?: string }) {
  const colors: Record<string, string> = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-amber-100 text-amber-800',
    low: 'bg-red-100 text-red-800',
  };
  if (!level) return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">no suggestion</span>;
  return <span className={`px-2 py-0.5 rounded text-xs ${colors[level] || ''}`}>{level} confidence</span>;
}

function OrganizeQueue() {
  const router = useRouter();
  const [cards, setCards] = useState<OrganizeCard[]>([]);
  const [fields, setFields] = useState<Record<string, EditableFields>>({});
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [batchSize, setBatchSize] = useState(12);
  const [deityFilter, setDeityFilter] = useState('');
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});

  const loadBatch = async () => {
    if (!getAccessToken()) {
      router.push('/login');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await getOrganizeQueue(batchSize, deityFilter);
      setCards(data.cards);
      setPendingTotal(data.pendingTotal);
      const next: Record<string, EditableFields> = {};
      for (const card of data.cards) next[card.id] = fieldsFromCard(card);
      setFields(next);
    } catch (err: any) {
      if (err.message?.includes('401')) {
        router.push('/login');
        return;
      }
      setError(err.message || 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  };

  const update = (id: string, patch: Partial<EditableFields>) => {
    setFields((f) => ({ ...f, [id]: { ...f[id], ...patch } }));
  };

  const decide = async (card: OrganizeCard, action: 'apply' | 'skip') => {
    try {
      setSaving(card.id);
      setError(null);
      await postOrganizeDecision({
        id: card.id,
        version: card.version,
        action,
        fields: action === 'apply' ? (({ heroFor, ...rest }) => (heroFor.length ? { ...rest, heroFor } : rest))(fields[card.id]) : undefined,
        suggested: card.suggestion,
      });
      setCards((c) => c.filter((x) => x.id !== card.id));
      setPendingTotal((n) => Math.max(0, n - 1));
      if (action === 'apply') setDone((n) => n + 1);
    } catch (err: any) {
      setError(err.message || 'Failed to save decision');
    } finally {
      setSaving(null);
    }
  };

  const approveAllHigh = async () => {
    for (const card of cards.filter((c) => c.suggestion?.confidence === 'high')) {
      if (fields[card.id]?.title.trim()) await decide(card, 'apply');
    }
  };

  const toggleDeity = (id: string, deity: string) => {
    const current = fields[id]?.deities || [];
    update(id, {
      deities: current.includes(deity) ? current.filter((d) => d !== deity) : [...current, deity],
    });
  };

  const removeTag = (id: string, tag: string) => {
    update(id, { tags: (fields[id]?.tags || []).filter((t) => t !== tag) });
  };

  const addTag = (id: string) => {
    const draft = (tagDrafts[id] || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!draft) return;
    const current = fields[id]?.tags || [];
    if (!current.includes(draft)) update(id, { tags: [...current, draft] });
    setTagDrafts((d) => ({ ...d, [id]: '' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Organize</h2>
          <p className="text-gray-600 mt-1">
            Please check: works auto-approved with medium or low confidence, and new uploads where the AI and the iOS tag disagree. Approve or correct.
            {pendingTotal > 0 && ` ${pendingTotal} item${pendingTotal === 1 ? '' : 's'} in the queue.`}
            {done > 0 && ` ${done} organized this session.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={batchSize}
            onChange={(e) => setBatchSize(parseInt(e.target.value, 10))}
            className="px-3 py-2 border border-gray-300 rounded text-sm"
          >
            {[6, 12, 24].map((n) => <option key={n} value={n}>{n} at a time</option>)}
          </select>
          <select
            value={deityFilter}
            onChange={(e) => setDeityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded text-sm"
          >
            <option value="">All deities</option>
            {DEITY_CANON.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {cards.some((c) => c.suggestion?.confidence === 'high') && (
            <button
              onClick={approveAllHigh}
              disabled={saving !== null}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Approve all high-confidence
            </button>
          )}
          <button
            onClick={loadBatch}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : cards.length ? 'Reload batch' : 'Load batch'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Claude is looking at each image…</p>
          </div>
        </div>
      )}

      {!loading && cards.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {done > 0 || pendingTotal === 0
            ? 'Nothing waiting. Load a batch to check for newly uploaded images.'
            : 'Load a batch to start organizing.'}
        </div>
      )}

      {cards.map((card) => {
        const f = fields[card.id];
        if (!f) return null;
        return (
          <div key={card.id} className="bg-white rounded-lg shadow p-6 flex gap-6">
            <div className="w-44 flex-shrink-0">
              <img
                src={card.previewUrl}
                alt={card.title}
                className="w-44 rounded object-cover bg-gray-100"
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
              />
              <p className="text-xs text-gray-400 mt-2 break-all font-mono">{card.fileKey}</p>
              <p className="text-xs text-gray-400 mt-1">was: “{card.title || 'Untitled'}”</p>
            </div>

            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex items-center gap-2">
                <ConfidenceBadge level={card.suggestion?.confidence} />
                {card.suggestion?.reason && (
                  <span className="text-xs text-gray-500">{card.suggestion.reason}</span>
                )}
                {card.suggestion?.hints?.map((h) => (
                  <span key={h} className="px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700">{h.replace('_', ' ')}</span>
                ))}
                {card.suggestion?.tweetUrl && (
                  <a href={card.suggestion.tweetUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline">tweet</a>
                )}
                {card.suggestion && !card.suggestion.hadImage && (
                  <span className="text-xs text-amber-600">text-only (image unavailable)</span>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={f.title}
                  onChange={(e) => update(card.id, { title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Form</label>
                  <input
                    type="text"
                    value={f.form}
                    onChange={(e) => update(card.id, { form: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Couple</label>
                  <select
                    value={f.couple}
                    onChange={(e) => update(card.id, { couple: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="">—</option>
                    {COUPLES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bhava</label>
                  <select
                    value={f.bhava}
                    onChange={(e) => update(card.id, { bhava: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="">—</option>
                    {BHAVAS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
                <input
                  type="text"
                  value={f.caption}
                  onChange={(e) => update(card.id, { caption: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deities</label>
                <div className="flex flex-wrap gap-1.5">
                  {DEITY_CANON.map((deity) => (
                    <button
                      key={deity}
                      onClick={() => toggleDeity(card.id, deity)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        f.deities.includes(deity)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                      }`}
                    >
                      {deity}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mood</label>
                  <select
                    value={f.moodTag}
                    onChange={(e) => update(card.id, { moodTag: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="">—</option>
                    {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                  <input
                    type="text"
                    value={f.style}
                    onChange={(e) => update(card.id, { style: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orientation</label>
                  <select
                    value={f.orientation}
                    onChange={(e) => update(card.id, { orientation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="">—</option>
                    {['portrait', 'landscape', 'square'].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {(f.deities.length > 0 || f.couple) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Big image on Darśana page</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...f.deities.map((d) => d.toLowerCase()), ...(f.couple ? [f.couple] : [])].map((slug) => (
                      <button
                        key={slug}
                        onClick={() => update(card.id, { heroFor: f.heroFor.includes(slug) ? f.heroFor.filter((x) => x !== slug) : [...f.heroFor, slug] })}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          f.heroFor.includes(slug) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
                        }`}
                      >
                        /darshan/{slug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {f.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                      {tag}
                      <button onClick={() => removeTag(card.id, tag)} className="text-gray-400 hover:text-red-500">×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagDrafts[card.id] || ''}
                    onChange={(e) => setTagDrafts((d) => ({ ...d, [card.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') addTag(card.id); }}
                    placeholder="+ add tag"
                    className="px-2 py-1 border border-dashed border-gray-300 rounded-full text-xs w-24 focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => decide(card, 'apply')}
                  disabled={saving === card.id || !f.title.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {saving === card.id ? 'Saving…' : 'Approve & save'}
                </button>
                <button
                  onClick={() => decide(card, 'skip')}
                  disabled={saving === card.id}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Skip
                </button>
                <span className="text-xs text-gray-400 ml-auto">Your corrections teach the next batch</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrganizePage() {
  return (
    <RouteGuard>
      <OrganizeQueue />
    </RouteGuard>
  );
}
