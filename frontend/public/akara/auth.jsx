// auth.jsx — Cognito Hosted UI sign-in for the public mini-site.
//
// Config is read from window.__AKARA_AUTH (injected by the layout/HTML):
//   { hostedUI, clientId, redirectUri, logoutUri, scope }
//
// Sign-in flow:
//   1. signIn() generates a PKCE verifier+challenge, stores verifier in
//      sessionStorage, redirects the browser to /oauth2/authorize.
//   2. Cognito sends the user back to redirectUri with ?code=...
//   3. /auth/callback.html exchanges the code for tokens, writes them to
//      localStorage under "akara.auth.tokens", and redirects to "/".
//   4. useAuth() reads tokens, decodes the id_token claims, returns user state.
//
// Tokens live in localStorage so they survive tab close (better UX for the
// "members can see full-res images" use case in Phase 3).

const { useState: aaS, useEffect: aaE, useCallback: aaC } = React;

const AK_TOKENS_KEY      = "akara.auth.tokens";
const AK_VERIFIER_KEY    = "akara.auth.pkce_verifier";
const AK_RETURN_TO_KEY   = "akara.auth.return_to";
const AK_LAST_GRANT_KEY  = "akara.auth.last_grant_at";  // ms timestamp
const AK_GRANT_REFRESH_S = 45 * 60;                      // refresh signed cookies after 45 min

function _akAuthCfg(){
  const c = (typeof window !== "undefined" && window.__AKARA_AUTH) || {};
  return {
    hostedUI:    c.hostedUI    || "",
    clientId:    c.clientId    || "",
    redirectUri: c.redirectUri || (typeof window !== "undefined" ? `${window.location.origin}/auth/callback.html` : ""),
    logoutUri:   c.logoutUri   || (typeof window !== "undefined" ? `${window.location.origin}/` : ""),
    scope:       c.scope       || "openid email profile",
  };
}

// ───────── PKCE helpers ─────────
function _akB64Url(buf){
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function _akSha256(str){
  const data = new TextEncoder().encode(str);
  return await crypto.subtle.digest("SHA-256", data);
}
function _akRandomVerifier(len = 64){
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return _akB64Url(arr);
}
async function _akChallenge(verifier){
  return _akB64Url(await _akSha256(verifier));
}

// ───────── token storage ─────────
function _akReadTokens(){
  try {
    const raw = localStorage.getItem(AK_TOKENS_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw);
    if (!t || !t.expiresAt) return null;
    if (Math.floor(Date.now() / 1000) >= t.expiresAt - 30) return null; // 30s skew
    return t;
  } catch { return null; }
}
function _akWriteTokens(t){
  try { localStorage.setItem(AK_TOKENS_KEY, JSON.stringify(t)); } catch {}
  try { window.dispatchEvent(new Event("akara:auth")); } catch {}
}
function _akClearTokens(){
  try { localStorage.removeItem(AK_TOKENS_KEY); } catch {}
  try { window.dispatchEvent(new Event("akara:auth")); } catch {}
}
function _akDecodeJwt(jwt){
  if (!jwt) return null;
  try {
    const part = jwt.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    return JSON.parse(atob(padded));
  } catch { return null; }
}

// Public API: imperative
async function akSignIn(opts){
  const cfg = _akAuthCfg();
  if (!cfg.hostedUI || !cfg.clientId) {
    console.warn("[akara/auth] missing config — set window.__AKARA_AUTH");
    return;
  }
  const verifier = _akRandomVerifier(64);
  const challenge = await _akChallenge(verifier);
  try {
    sessionStorage.setItem(AK_VERIFIER_KEY, verifier);
    sessionStorage.setItem(AK_RETURN_TO_KEY, window.location.pathname + window.location.search + window.location.hash);
  } catch {}

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    scope: cfg.scope,
    redirect_uri: cfg.redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  // Optional: jump straight into Google instead of the chooser
  if (opts && opts.identityProvider) {
    params.set("identity_provider", opts.identityProvider);
  }
  // Optional: open the sign-up tab directly
  const path = (opts && opts.signup) ? "/signup" : "/oauth2/authorize";
  window.location.assign(`${cfg.hostedUI}${path}?${params.toString()}`);
}

// Inline email + password sign-in via Cognito InitiateAuth (USER_PASSWORD_AUTH).
// Requires the app client to have ALLOW_USER_PASSWORD_AUTH enabled.
// Region is parsed from the hostedUI domain so we don't need a new env var.
async function akSignInWithPassword(username, password){
  const cfg = _akAuthCfg();
  if (!cfg.hostedUI || !cfg.clientId) throw new Error("auth not configured");
  const m = /\.auth\.([a-z0-9-]+)\.amazoncognito\.com/i.exec(cfg.hostedUI);
  const region = m ? m[1] : "us-east-1";
  const res = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: cfg.clientId,
      AuthParameters: { USERNAME: String(username || "").trim(), PASSWORD: password },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = (json.__type || "").split("#").pop() || "";
    const msg = json.message || code || `sign-in failed (${res.status})`;
    const err = new Error(msg); err.code = code; throw err;
  }
  if (json.ChallengeName) {
    const err = new Error(`Additional verification required (${json.ChallengeName}).`);
    err.code = json.ChallengeName; throw err;
  }
  const r = json.AuthenticationResult || {};
  if (!r.IdToken) throw new Error("sign-in returned no tokens");
  const expiresIn = Number(r.ExpiresIn || 3600);
  const expiresAt = Math.floor(Date.now() / 1000) + (isFinite(expiresIn) ? expiresIn : 3600);
  _akWriteTokens({ idToken: r.IdToken, accessToken: r.AccessToken, expiresAt });
  try { await akGrantImageAccess(); } catch {}
  return akCurrentUser();
}

async function akSignOut(){
  // Best-effort: drop the CloudFront signed cookies before clearing tokens.
  // If this fails (network blip etc.) cookies expire on their own in <=1h.
  try { await akRevokeImageAccess(); } catch {}
  _akClearTokens();
  try { localStorage.removeItem(AK_LAST_GRANT_KEY); } catch {}
  const cfg = _akAuthCfg();
  if (cfg.hostedUI && cfg.clientId) {
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      logout_uri: cfg.logoutUri,
    });
    window.location.assign(`${cfg.hostedUI}/logout?${params.toString()}`);
    return;
  }
  window.location.assign("/");
}

// ───────── Phase 3: CloudFront signed-cookie grant ─────────
// Members POST here right after sign-in (and again every ~45 min while the
// page is open). The server returns Set-Cookie headers scoped to
// /content/originals on the same registrable domain, after which the
// browser sends them automatically on every full-resolution image request.
function _akApiBase(){
  // Same-origin "" in production (CloudFront proxies /api/* → API Gateway).
  // Falls back to whatever window.__AKARA_API_BASE was injected (used in dev).
  return (typeof window !== "undefined" && window.__AKARA_API_BASE) || "";
}

async function akGrantImageAccess(){
  const t = _akReadTokens();
  if (!t || !t.idToken) return { ok: false, reason: "not-signed-in" };
  const url = `${_akApiBase()}/api/grant-image-access`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",                      // CRITICAL: store the Set-Cookie response
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${t.idToken}`,
    },
    body: "{}",
  });
  if (!res.ok) {
    console.warn("[akara/auth] grant-image-access failed:", res.status);
    return { ok: false, status: res.status };
  }
  try { localStorage.setItem(AK_LAST_GRANT_KEY, String(Date.now())); } catch {}
  return await res.json().catch(() => ({ ok: true }));
}

async function akRevokeImageAccess(){
  const t = _akReadTokens();
  const headers = { "Content-Type": "application/json" };
  if (t && t.idToken) headers.Authorization = `Bearer ${t.idToken}`;
  const url = `${_akApiBase()}/api/grant-image-access`;
  return fetch(url, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ action: "revoke" }),
  });
}

// Called on app boot. If we're signed in but the cookies are missing or
// stale, request a fresh grant in the background. Doesn't block render.
function akEnsureImageAccess(){
  const u = akCurrentUser();
  if (!u) return;
  let last = 0;
  try { last = parseInt(localStorage.getItem(AK_LAST_GRANT_KEY) || "0", 10) || 0; } catch {}
  const ageS = (Date.now() - last) / 1000;
  if (ageS < AK_GRANT_REFRESH_S) return;
  akGrantImageAccess().catch(() => {});
}

function akCurrentUser(){
  const t = _akReadTokens();
  if (!t || !t.idToken) return null;
  const claims = _akDecodeJwt(t.idToken);
  if (!claims) return null;
  return {
    sub: claims.sub,
    email: claims.email,
    name: claims.name || claims.given_name || claims.email,
    picture: claims.picture || null,
    idToken: t.idToken,
    accessToken: t.accessToken,
    expiresAt: t.expiresAt,
  };
}

// React hook for components
function useAuth(){
  const [user, setUser] = aaS(() => akCurrentUser());
  aaE(() => {
    const onStorage = (e) => {
      if (e.key === AK_TOKENS_KEY) setUser(akCurrentUser());
    };
    const onFocus = () => setUser(akCurrentUser());
    const onLocal = () => setUser(akCurrentUser());
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener("akara:auth", onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("akara:auth", onLocal);
    };
  }, []);
  const signIn  = aaC((opts) => akSignIn(opts), []);
  const signOut = aaC(() => akSignOut(), []);
  return { user, signedIn: !!user, signIn, signOut };
}

// Used by /auth/callback.html
async function akExchangeCodeForTokens(code){
  const cfg = _akAuthCfg();
  const verifier = sessionStorage.getItem(AK_VERIFIER_KEY);
  if (!verifier) throw new Error("missing PKCE verifier — sign in again");
  sessionStorage.removeItem(AK_VERIFIER_KEY);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    code,
    redirect_uri: cfg.redirectUri,
    code_verifier: verifier,
  });
  const res = await fetch(`${cfg.hostedUI}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.error || `token exchange failed (${res.status})`);
  const expiresIn = Number(json.expires_in || 3600);
  const expiresAt = Math.floor(Date.now() / 1000) + (isFinite(expiresIn) ? expiresIn : 3600);
  _akWriteTokens({ idToken: json.id_token, accessToken: json.access_token, expiresAt });
  let returnTo = "/";
  try {
    returnTo = sessionStorage.getItem(AK_RETURN_TO_KEY) || "/";
    sessionStorage.removeItem(AK_RETURN_TO_KEY);
  } catch {}
  return returnTo;
}

if (typeof window !== "undefined") {
  Object.assign(window, {
    akSignIn, akSignInWithPassword, akSignOut, akCurrentUser, useAuth, akExchangeCodeForTokens,
    akGrantImageAccess, akRevokeImageAccess, akEnsureImageAccess,
  });
  // Refresh CloudFront signed cookies on boot if the user is already signed in.
  try { akEnsureImageAccess(); } catch {}
}
