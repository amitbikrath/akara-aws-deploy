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
}): Promise<{ ok: boolean; items: any[]; lastEvaluatedKey?: string; count: number; error?: string }> {
  const queryParams = new URLSearchParams();
  if (params?.type) queryParams.append('type', params.type);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.lastKey) queryParams.append('lastKey', params.lastKey);

  const response = await apiRequest(`/api/catalog?${queryParams.toString()}`);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  
  return data;
}

export async function postCatalog(item: {
  type: string;
  title: string;
  fileKey: string;
  thumbKey?: string;
  caption?: string;
  shloka?: string;
  meaning?: string;
  ratio?: string;
  palette?: string;
  style?: string;
}): Promise<{ ok: boolean; item?: any; message?: string; error?: string }> {
  const response = await apiRequest('/api/catalog', {
    method: 'POST',
    body: JSON.stringify(item),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  
  return data;
}

