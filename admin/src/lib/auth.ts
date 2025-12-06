export type Tokens = {
  idToken?: string;
  accessToken?: string;
  expiresAt?: number;
};

const KEY = "akara_auth_tokens";

export function saveTokens(t: Tokens) {
  localStorage.setItem(KEY, JSON.stringify(t));
}

export function loadTokens(): Tokens | null {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

export function clearTokens() {
  localStorage.removeItem(KEY);
}

export function isLoggedIn(): boolean {
  const t = loadTokens();
  return !!(t?.accessToken && (t.expiresAt || 0) > Date.now()/1000);
}

export function getAccessToken(): string | null {
  const t = loadTokens();
  if (!t?.accessToken || (t.expiresAt || 0) <= Date.now()/1000) {
    return null;
  }
  return t.accessToken;
}

export function getIdToken(): string | null {
  const t = loadTokens();
  if (!t?.idToken || (t.expiresAt || 0) <= Date.now()/1000) {
    return null;
  }
  return t.idToken;
}

export function getCognitoLogoutUrl(): string {
  const hostedUIBase = process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_BASE || '';
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
  const redirect = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI || 'https://admin.akara.studio';
  
  if (!hostedUIBase || !clientId) {
    return '/login';
  }
  
  return `${hostedUIBase}/logout?client_id=${encodeURIComponent(clientId)}&logout_uri=${encodeURIComponent(redirect)}`;
}



