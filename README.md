# velvetvice-video

Velvet's social-clip engine. Five times a day, end to end:

1. Pick a vibe + heat + voice at random (`vibes.mjs`).
2. Ask Grok for the full **story package** — title, subtitle, body, social caption.
3. Narrate the body with xAI text-to-speech (the `/v1/tts` endpoint).
4. Render a 1080×1920 vertical clip — **book cover → page turn → narrated story page → branded CTA**.
5. Capture a still of the cover frame as the thumbnail.
6. Upload the MP4 to Google Drive (publicly readable).
7. POST a Reel to Instagram via the Meta Graph API.
8. POST a TikTok via the Content Posting API.

No SaaS middleman. No monthly bills. Just your own Meta + TikTok developer apps + Drive.

## How a clip is structured

```
[ 0 – 2.5s ]   Book cover    — gold title + tagline on a velvet card
[ 2.5 – 3.3s ] Page turn     — the cover hinges up and away
[ 3.3 – ~50s ] Narrated page — TTS plays, story text scrolls, cliffhanger
[ last 3s    ] CTA           — "Steer the story whichever way you want.
                                VELVET — Download today"
```

## Setup (one-off)

### 1. Google Drive (video hosting)

1. Google Cloud Console → new project → enable **Drive API**.
2. **IAM & Admin → Service Accounts → Create** → finish, then create a JSON key. That JSON is `GOOGLE_SERVICE_ACCOUNT`.
3. Create a Drive folder, share with the service account's email (Editor). The folder id from its URL is `DRIVE_FOLDER_ID`.

### 2. Instagram (Meta Graph API)

Prereqs: your IG account must be **Business** or **Creator** and linked to a **Facebook Page**.

1. https://developers.facebook.com → **Create App** (Business) → name "Velvet". Add **Instagram Graph API**.
2. https://business.facebook.com/settings → **System Users → Add** → name "velvet-poster". Assign your FB Page + the app to it.
3. Generate a token: scopes `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`. Set expiration to **Never**. That's `META_ACCESS_TOKEN`.
4. Graph API Explorer → query `me/accounts?fields=instagram_business_account` → copy the `instagram_business_account.id`. That's `META_IG_BUSINESS_ID`.

### 3. TikTok (Content Posting API)

1. https://developers.tiktok.com → **Manage apps → Create new app** → name "Velvet". Add **Content Posting API** with scopes `video.publish`, `video.upload`.
2. Note the **Client Key** + **Client Secret** in app settings.
3. Run TikTok's OAuth flow against your own account to get a `refresh_token`. (You can do this manually via their authorization URL; the redirect will include the refresh token in the response.)
4. Three values: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN`.

### 4. Repository secrets

In GitHub → Settings → Secrets and variables → Actions:

| Secret                    | Source                                               |
| ------------------------- | ---------------------------------------------------- |
| `GROK_API_KEY`            | xAI                                                  |
| `GOOGLE_SERVICE_ACCOUNT`  | the Drive service-account JSON                       |
| `DRIVE_FOLDER_ID`         | the Drive folder id                                  |
| `META_ACCESS_TOKEN`       | System User token (never-expiring)                   |
| `META_IG_BUSINESS_ID`     | IG Business account id                               |
| `TIKTOK_CLIENT_KEY`       | TikTok app client key                                |
| `TIKTOK_CLIENT_SECRET`    | TikTok app client secret                             |
| `TIKTOK_REFRESH_TOKEN`    | TikTok refresh token                                 |

## Schedule

`.github/workflows/clips.yml` fires at **08, 12, 16, 20, 23 UTC** every day — one clip per run, posted immediately to both platforms. Five clips daily, spaced across prime social hours.

Trigger any time from the Actions tab ("Run workflow").

## Pipeline output

Each successful clip produces:

- `output/velvet-{stamp}-{i}.mp4` — the vertical video
- `output/velvet-{stamp}-{i}.png` — cover-frame thumbnail
- `output/velvet-{stamp}-{i}.txt` — full story package (title, body, caption)

The MP4 is also uploaded to Drive (publicly readable) — Meta and TikTok fetch it from there.

## Run locally

```bash
npm install
cp .env.example .env   # fill in the values
node --env-file=.env pipeline.mjs
```

Each missing config is non-fatal — the pipeline runs as far as it can with what's set. Useful for testing the visuals without touching social platforms (skip the Meta/TikTok secrets, leave Drive set).

## Manual single clip

Drop a body in `input/script.txt` (or full package in `input/story.json`) + narration audio in `input/`, then:

```bash
npm run render
# → output/velvet-{stamp}.mp4 + .png
```

## Tweaking the design

```bash
npm run studio
```

Opens Remotion Studio to live-edit `src/ClipVideo.tsx`.

## Layout

| File                                | Role                                                  |
| ----------------------------------- | ----------------------------------------------------- |
| `src/ClipVideo.tsx`                 | The composition — cover, turn, page, CTA              |
| `src/Root.tsx`                      | Registers the `Clip` composition                      |
| `lib/render.mjs`                    | Bundle + render video + still thumbnail               |
| `lib/xai.mjs`                       | Grok story package + xAI narration                    |
| `lib/drive.mjs`                     | Upload to Drive, set public, return direct-stream URL |
| `lib/meta.mjs`                      | Instagram Reels publishing via Graph API              |
| `lib/tiktok.mjs`                    | TikTok video publishing via Content Posting API       |
| `vibes.mjs`                         | Content pool: vibes (with heat) and voices            |
| `pipeline.mjs`                      | Per clip: generate → render → upload → post           |
| `render.mjs`                        | Manual single-clip render from `input/`               |
| `.github/workflows/clips.yml`       | The 5x/day schedule                                   |

The first render on any machine downloads a headless Chromium automatically.
