'use client';

import { useState, useEffect } from 'react';
import RouteGuard from '@/components/RouteGuard';
import { getTwitterConfig, saveTwitterConfig, refreshTwitter } from '@/lib/api';

const MODEL_NOTES: Record<string, string> = {
  'claude-sonnet-4-6': 'Sonnet 4.6 — fast, cheap, plenty good for short prose. Default.',
  'claude-opus-4-7': 'Opus 4.7 — most capable. ~5x the cost per run.',
  'claude-haiku-4-5': 'Haiku 4.5 — cheapest and fastest. Drier prose.',
};

function TwitterPageContent() {
  const [config, setConfig] = useState<any>(null);
  const [loadError, setLoadError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [saved, setSaved] = useState({
    prompt: '',
    model: 'claude-sonnet-4-6',
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [refreshMessage, setRefreshMessage] = useState('');

  useEffect(() => {
    let active = true;
    getTwitterConfig()
      .then((data) => {
        if (active) {
          setConfig(data);
          setPrompt(data.prompt);
          setModel(data.model);
          setSaved({ prompt: data.prompt, model: data.model });
        }
      })
      .catch((err) => {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load config.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const dirty = prompt !== saved.prompt || model !== saved.model;

  async function handleSave() {
    setSaveState('saving');
    setSaveMessage('');
    try {
      const payload: Record<string, any> = {};
      if (prompt !== saved.prompt) payload.prompt = prompt;
      if (model !== saved.model) payload.model = model;
      await saveTwitterConfig(payload);
      setSaved({ prompt, model });
      setSaveState('saved');
      setSaveMessage('Saved. Next refresh will use the new prompt.');
    } catch (err) {
      setSaveState('error');
      setSaveMessage(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  async function handleRefresh() {
    setRefreshState('loading');
    setRefreshMessage('');
    try {
      const res = await refreshTwitter();
      setRefreshState('ok');
      setRefreshMessage(
        `Fetched ${res.fetched} (${res.originalPosts} original, ${res.articlesGenerated ?? 0} articles generated via ${res.model ?? 'unknown model'}).`
      );
    } catch (err) {
      setRefreshState('error');
      setRefreshMessage(err instanceof Error ? err.message : 'Refresh failed.');
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Twitter Sync</h2>
        <p className="text-gray-600 mt-1">
          Pull new posts from <strong>@Akara__1</strong>, generate newspaper-style articles via
          Claude, and publish to akara.studio.
        </p>
      </div>

      <div className="glass-panel p-6 flex flex-col gap-3">
        <h3 className="text-lg font-medium text-gray-900">Refresh now</h3>
        <p className="text-gray-600 text-sm">
          Triggers an immediate poll. Daily auto-run is at 08:00 UTC (13:30 IST).
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshState === 'loading'}
          className="self-start px-4 py-2 rounded-md bg-gray-900 text-white text-sm disabled:opacity-50 hover:bg-gray-800 transition"
        >
          {refreshState === 'loading' ? 'Refreshing…' : 'Refresh now'}
        </button>
        {refreshMessage && (
          <p className={`text-sm ${refreshState === 'error' ? 'text-red-600' : 'text-gray-700'}`}>
            {refreshMessage}
          </p>
        )}
      </div>

      <div className="glass-panel p-6 flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Article generator</h3>
          <p className="text-gray-600 text-sm">
            The system prompt and model used to turn each tweet into a newspaper article. Changes
            apply on the next refresh.
          </p>
        </div>
        {loadError && <p className="text-sm text-red-600">{loadError}</p>}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-800">Model</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={!config}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            {(config?.allowedModels ?? ['claude-sonnet-4-6']).map((m: string) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">{MODEL_NOTES[model] || ''}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-800">System prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={!config}
            rows={20}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm font-mono bg-white"
          />
          <span className="text-xs text-gray-500">{prompt.length} / 8000 characters</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!config || !dirty || saveState === 'saving'}
            className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm disabled:opacity-40 hover:bg-gray-800 transition"
          >
            {saveState === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
          {saveMessage && (
            <span className={`text-sm ${saveState === 'error' ? 'text-red-600' : 'text-gray-700'}`}>
              {saveMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TwitterPage() {
  return (
    <RouteGuard>
      <TwitterPageContent />
    </RouteGuard>
  );
}
