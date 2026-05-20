const META_BASE = 'https://graph.facebook.com/v21.0';

function creds() {
  const token = process.env.META_ACCESS_TOKEN;
  const igUserId = process.env.META_IG_BUSINESS_ID;
  if (!token) throw new Error('META_ACCESS_TOKEN is not set');
  if (!igUserId) throw new Error('META_IG_BUSINESS_ID is not set');
  return { token, igUserId };
}

export function metaConfigured() {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_IG_BUSINESS_ID);
}

/**
 * Post a video as an Instagram Reel. Returns the new media id.
 *
 * IG Reels API is a two-step flow:
 *  1. Create a media container (uploads the video; processes asynchronously).
 *  2. Wait for status = FINISHED.
 *  3. Publish the container.
 */
export async function postReel({ videoUrl, caption }) {
  const { token, igUserId } = creds();

  const createRes = await fetch(`${META_BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption,
      access_token: token,
    }),
  });
  if (!createRes.ok) {
    throw new Error(`IG media create failed (${createRes.status}): ${(await createRes.text()).slice(0, 300)}`);
  }
  const { id: containerId } = await createRes.json();
  if (!containerId) throw new Error('IG media create returned no container id');

  await waitForReady(containerId, token);

  const publishRes = await fetch(`${META_BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  });
  if (!publishRes.ok) {
    throw new Error(`IG publish failed (${publishRes.status}): ${(await publishRes.text()).slice(0, 300)}`);
  }
  const published = await publishRes.json();
  return published.id ?? containerId;
}

// Poll the media container until IG finishes processing. Reels usually take
// 20-90s. Times out at 6 minutes to keep the workflow from hanging if IG
// stalls.
async function waitForReady(containerId, token) {
  const deadline = Date.now() + 360_000;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${META_BASE}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
    );
    if (res.ok) {
      const json = await res.json();
      if (json.status_code === 'FINISHED') return;
      if (json.status_code === 'ERROR' || json.status_code === 'EXPIRED') {
        throw new Error(`IG media processing failed: ${json.status ?? json.status_code}`);
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('IG media processing timed out after 6 minutes');
}
