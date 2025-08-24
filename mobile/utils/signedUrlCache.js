// Simple in-memory signed URL cache with TTL and optional transforms
const cache = new Map(); // key: `${bucket}:${path}:${transformKey}` -> { url, exp }

export async function getSignedUrl(supabase, bucket, path, ttlSeconds = 1800, options = undefined) {
  if (!path) return null;
  // Include transform in key to avoid mixing different sizes
  const transformKey = options?.transform ? JSON.stringify(options.transform) : '';
  const key = `${bucket}:${path}:${transformKey}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.exp > now && hit.url) return hit.url;
  try {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds, options);
    const url = data?.signedUrl || null;
    if (url) cache.set(key, { url, exp: now + (ttlSeconds - 60) * 1000 });
    return url;
  } catch {
    return null;
  }
}

export function clearSignedUrlCache() { cache.clear(); }


