const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://fhsd-proxy.ewanrross.workers.dev';

let lastETag = null;

/**
 * Fetch live 2026 results from the Cloudflare Worker proxy.
 * Returns:
 *   { unchanged: true }   — 304, data hasn't changed
 *   null                  — results not available yet (503 or error body)
 *   { ...yearData }       — new data
 * Throws on unexpected errors.
 */
export async function fetchLiveResults() {
  const headers = {};
  if (lastETag) headers['If-None-Match'] = lastETag;

  const resp = await fetch(PROXY_URL, { headers });

  if (resp.status === 304) return { unchanged: true };
  if (resp.status === 503) return null;
  if (!resp.ok) throw new Error(`Proxy returned ${resp.status}`);

  const data = await resp.json();
  if (data.error) return null;

  lastETag = data.dataHash || resp.headers.get('ETag');

  return {
    ...data,
    parsedAt: data.parsedAt || new Date().toISOString(),
  };
}
