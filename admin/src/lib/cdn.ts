// Builds a browser-loadable URL for a catalog fileKey/thumbKey. Assets are
// served from the assets CDN under /content/<key>; falls back to a relative
// path when no CDN base is configured.
export const cdnUrl = (key: string): string => {
  const clean = key.replace(/^\//, '');
  const path = `/content/${clean}`;
  let base = String(
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ASSETS_CDN_URL) ||
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_CDN_URL) ||
    ''
  ).trim().replace(/\/+$/, '');
  if (base.endsWith('/content')) {
    base = base.slice(0, -'/content'.length).replace(/\/+$/, '');
  }
  return base && base !== 'same-origin' ? `${base}${path}` : path;
};
