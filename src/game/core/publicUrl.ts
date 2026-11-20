/**
 * Join Vite's `base` with a path that lives in `public/`.
 *
 * Manifest entries and source constants stay root-shaped (`/assets/...`) so
 * disk checks can map them onto `public/`. Fetch, `<img>`, and loaders must
 * go through this helper: a root-absolute URL ignores the GitHub Pages
 * subpath and 404s at `https://jardelkuhnen.github.io/assets/...`.
 */
export function joinPublicUrl(base: string, assetPath: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const trimmed = assetPath.replace(/^\/+/, '');
  return `${normalizedBase}${trimmed}`;
}

/** Public URL for the base baked into this build (`/` locally, `/kart3d/` on Pages). */
export function publicUrl(assetPath: string): string {
  const base = import.meta.env?.BASE_URL || '/';
  return joinPublicUrl(base, assetPath);
}
