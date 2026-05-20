import { openAsBlob } from 'node:fs';
import path from 'node:path';

const AYRSHARE_BASE = 'https://api.ayrshare.com/api';

function key() {
  const k = process.env.AYRSHARE_API_KEY;
  if (!k) throw new Error('AYRSHARE_API_KEY is not set');
  return k;
}

export function ayrshareConfigured() {
  return Boolean(process.env.AYRSHARE_API_KEY);
}

/**
 * Upload a local file to Ayrshare's media bucket. Returns a hosted URL that
 * the /api/post call can fetch from.
 */
export async function uploadMedia(filePath) {
  const blob = await openAsBlob(filePath);
  const form = new FormData();
  form.append('file', blob, path.basename(filePath));

  const res = await fetch(`${AYRSHARE_BASE}/media/uploadFile`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ayrshare media upload failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  const url = json?.url ?? json?.location;
  if (!url) {
    throw new Error(`Ayrshare media upload returned no URL: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return url;
}

/**
 * Schedule (or post immediately) to Instagram + TikTok.
 *   caption:      text + hashtags
 *   videoUrl:     hosted URL of the MP4 (from uploadMedia)
 *   scheduleDate: ISO timestamp — when to publish. Omit to post now.
 *
 * Returns Ayrshare's response — per-platform post IDs and status.
 */
export async function schedulePost({ caption, videoUrl, scheduleDate }) {
  const body = {
    post: caption,
    mediaUrls: [videoUrl],
    platforms: ['instagram', 'tiktok'],
  };
  if (scheduleDate) body.scheduleDate = scheduleDate;

  const res = await fetch(`${AYRSHARE_BASE}/post`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ayrshare post failed (${res.status}): ${text.slice(0, 400)}`);
  }
  return await res.json();
}
