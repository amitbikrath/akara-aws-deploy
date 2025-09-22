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
  return !!(t?.idToken && (t.expiresAt || 0) > Date.now()/1000);
}
