/**
 * POST a finished clip's metadata to a Make.com webhook. The Make.com
 * scenario is the user-built bridge: a Webhook trigger → Google Drive fetch
 * (by videoFileId / thumbnailFileId) → Instagram Reels + TikTok post.
 *
 * Without MAKE_WEBHOOK_URL set, posting is skipped — useful for local dev.
 */

export function makeConfigured() {
  return Boolean(process.env.MAKE_WEBHOOK_URL);
}

export async function postToMake(payload) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) throw new Error('MAKE_WEBHOOK_URL is not set');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Make.com webhook failed (${res.status}): ${text.slice(0, 200)}`);
  }
}
