import { getAccessToken } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  return fetch(url, {
    ...options,
    headers,
  });
}

export async function getCatalog(params?: {
  type?: string;
  limit?: number;
  lastKey?: string;
  includeArchived?: boolean;
  includeHidden?: boolean;
}): Promise<{ ok: boolean; items: any[]; lastEvaluatedKey?: string; count: number; error?: string }> {
  const queryParams = new URLSearchParams();
  if (params?.type) queryParams.append('type', params.type);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.lastKey) queryParams.append('lastKey', params.lastKey);
  if (typeof params?.includeArchived === 'boolean') queryParams.append('includeArchived', String(params.includeArchived));
  if (typeof params?.includeHidden === 'boolean') queryParams.append('includeHidden', String(params.includeHidden));

  const response = await apiRequest(`/api/catalog?${queryParams.toString()}`);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  
  return data;
}

export interface OrganizeSuggestion {
  title: string;
  caption: string;
  deities: string[];
  moodTag: string;
  tags: string[];
  style: string;
  orientation: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  hadImage: boolean;
  form?: string;
  couple?: string;
  bhava?: string;
  hints?: string[];
  tweetUrl?: string;
  precomputed?: boolean;
}

export interface OrganizeCard {
  id: string;
  version: string;
  title: string;
  caption?: string;
  shloka?: string;
  meaning?: string;
  style?: string;
  ratio?: string;
  fileKey: string;
  deities: string[];
  form?: string;
  couple?: string;
  bhava?: string;
  moodTag: string;
  tags: string[];
  freePreview: boolean;
  createdAt?: string;
  previewUrl: string;
  suggestion: OrganizeSuggestion | null;
}

export async function getOrganizeQueue(limit = 8, deity = ''): Promise<{
  ok: boolean; cards: OrganizeCard[]; pendingTotal: number; fewShotCount: number; error?: string;
}> {
  const qs = `limit=${limit}${deity ? `&deity=${encodeURIComponent(deity)}` : ''}`;
  const response = await apiRequest(`/api/catalog/organize?${qs}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function postOrganizeDecision(decision: {
  id: string;
  version?: string;
  action: 'apply' | 'skip';
  fields?: Partial<Pick<OrganizeSuggestion, 'title' | 'caption' | 'deities' | 'moodTag' | 'tags' | 'style' | 'orientation' | 'form' | 'couple' | 'bhava'>> & { heroFor?: string[] };
  suggested?: OrganizeSuggestion | null;
}): Promise<{ ok: boolean; action: string; id: string; error?: string }> {
  const response = await apiRequest('/api/catalog/organize', {
    method: 'POST',
    body: JSON.stringify(decision),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function postCatalog(item: {
  type: string;
  title: string;
  fileKey?: string;
  thumbKey?: string;
  caption?: string;
  shloka?: string;
  meaning?: string;
  ratio?: string;
  palette?: string;
  style?: string;
  body?: string;
  lyrics?: string;
  albumArtKey?: string;
  mediaType?: string;
  mimeType?: string;
  hiddenFromPublic?: boolean;
}): Promise<{ ok: boolean; item?: any; id?: string; version?: string; message?: string; error?: string }> {
  const response = await apiRequest('/api/catalog', {
    method: 'POST',
    body: JSON.stringify(item),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return { ok: true, ...data };
}

export async function manageCatalog(payload: {
  action: string;
  type: string;
  id: string;
  version?: string;
  fields?: Record<string, any>;
  [key: string]: any;
}): Promise<{ ok: boolean; item?: any; message?: string; error?: string }> {
  const response = await apiRequest('/api/catalog/manage', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return { ok: true, ...data };
}

export async function refreshTwitter(): Promise<any> {
  const response = await apiRequest('/api/twitter/refresh', { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function getTwitterConfig(): Promise<any> {
  const response = await apiRequest('/api/twitter/config');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function saveTwitterConfig(config: Record<string, any>): Promise<any> {
  const response = await apiRequest('/api/twitter/config', {
    method: 'POST',
    body: JSON.stringify(config),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

