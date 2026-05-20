const TIKTOK_BASE = 'https://open.tiktokapis.com/v2';

function creds() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const refreshToken = process.env.TIKTOK_REFRESH_TOKEN;
  if (!clientKey || !clientSecret || !refreshToken) {
    throw new Error('TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN must all be set');
  }
  return { clientKey, clientSecret, refreshToken };
}

export function tiktokConfigured() {
  return Boolean(
    process.env.TIKTOK_CLIENT_KEY &&
      process.env.TIKTOK_CLIENT_SECRET &&
      process.env.TIKTOK_REFRESH_TOKEN,
  );
}

/**
 * Exchange the long-lived refresh token for a fresh access token. TikTok
 * access tokens last ~24h; the refresh token rotates roughly yearly. We
 * exchange on every workflow run rather than tracking state.
 */
async function getAccessToken() {
  const { clientKey, clientSecret, refreshToken } = creds();
  const res = await fetch(`${TIKTOK_BASE}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`TikTok token refresh failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`TikTok refresh returned no access_token: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json.access_token;
}

/**
 * Post a video to TikTok via the Content Posting API using PULL_FROM_URL.
 * Requires the host of `videoUrl` to be a verified domain in your TikTok
 * developer app (Sandbox-mode apps can post to the developer's own account
 * with relaxed verification).
 *
 * Returns the publish_id — TikTok processes asynchronously after this call.
 */
export async function postVideo({ videoUrl, caption }) {
  const accessToken = await getAccessToken();

  const res = await fetch(`${TIKTOK_BASE}/post/publish/video/init/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: caption.slice(0, 2200), // TT max
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`TikTok publish init failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  const publishId = json?.data?.publish_id;
  if (!publishId) {
    throw new Error(`TikTok publish init returned no publish_id: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return publishId;
}
