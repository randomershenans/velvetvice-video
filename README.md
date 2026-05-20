# velvetvice-video

VelvetVice's social-clip engine. Five times a day, end to end:

1. Pick a vibe + heat + voice at random (`vibes.mjs`).
2. Ask Grok for the full **story package** — title, subtitle, body, social caption.
3. Narrate the body with xAI text-to-speech.
4. Render a 1080×1920 vertical clip — **book cover → page turn → narrated story page → branded CTA**.
5. Capture a still of the cover frame as the thumbnail.
6. Upload the MP4 + PNG to a Google Drive folder.
7. POST the metadata to a Make.com webhook, which posts to Instagram Reels and TikTok.

Nothing of yours stays on. Clips appear in your Drive each morning and feeds itself to your socials throughout the day.

## How a clip is structured

```
[ 0 – 2.5s ]  Book cover    — gold title + tagline on a velvet card
[ 2.5 – 3.3s ] Page turn     — the cover hinges up and away
[ 3.3 – ~50s ] Narrated page  — TTS plays, story text scrolls, cliffhanger
[ last 3s    ] CTA           — "Steer the story whichever way you want.
                                VELVET VICE — download today"
```

All visuals stay on-brand with the iOS app's dark/gold reader aesthetic.

## Pipeline output

Each successful clip produces:

- `output/velvetvice-{stamp}-{i}.mp4` — the vertical video
- `output/velvetvice-{stamp}-{i}.png` — cover-frame thumbnail
- `output/velvetvice-{stamp}-{i}.txt` — full story package (title, body, caption)

If `GOOGLE_SERVICE_ACCOUNT` + `DRIVE_FOLDER_ID` are set, the MP4 and PNG also upload to Drive.

If `MAKE_WEBHOOK_URL` is set, a JSON payload posts to that webhook for downstream social posting:

```jsonc
{
  "title": "The Lighthouse Keeper",
  "subtitle": "Six years late, the mist remembered everything.",
  "caption": "Six years. One coastal path. He stops...\n\n#booktok #romance...",
  "vibe": "second chance romance, he comes back to the small coastal town",
  "heat": "Warm",
  "voice": "aurora",
  "videoFileId": "1AbC...",
  "videoFileName": "velvetvice-2026-05-20T08-00-00-1.mp4",
  "videoWebLink": "https://drive.google.com/file/d/1AbC.../view",
  "thumbnailFileId": "1XyZ...",
  "thumbnailFileName": "velvetvice-2026-05-20T08-00-00-1.png",
  "thumbnailWebLink": "https://drive.google.com/file/d/1XyZ.../view",
  "createdAt": "2026-05-20T08:00:14.222Z"
}
```

## Setup

### 1. Repository secrets (Settings → Secrets and variables → Actions)

| Secret                   | What it is                                                |
| ------------------------ | --------------------------------------------------------- |
| `GROK_API_KEY`           | xAI key — same one the app's edge functions use           |
| `GOOGLE_SERVICE_ACCOUNT` | Full service-account JSON key, pasted as one value        |
| `DRIVE_FOLDER_ID`        | Id of the Drive folder (from its URL) for the clips       |
| `MAKE_WEBHOOK_URL`       | Make.com Custom-Webhook URL for the IG + TikTok scenario  |

### 2. Google Drive (one-off)

1. In Google Cloud, create a service account and enable the Drive API.
2. Create a JSON key for it — that JSON is `GOOGLE_SERVICE_ACCOUNT`.
3. Create a folder in your Drive, share it with the service account's email (Editor). The id from the URL is `DRIVE_FOLDER_ID`.

### 3. Make.com scenario (one-off)

The Make.com scenario is the bridge from the pipeline to Instagram + TikTok. Build it once and never touch it again.

1. Create a new scenario.
2. **Webhooks → Custom webhook**. Copy the URL → that's `MAKE_WEBHOOK_URL`.
3. **Google Drive → Download a file** — feed it `{{1.videoFileId}}` from the webhook.
4. **Instagram for Business → Create a Reel** — video from step 3, caption `{{1.caption}}`, thumbnail (optional) by downloading `{{1.thumbnailFileId}}` via another Drive step.
5. **TikTok for Business → Upload a Video** — same video + caption.
6. Activate.

Make.com's connectors handle the IG/TikTok OAuth, so no Meta-app review required.

### 4. Schedule

The workflow `.github/workflows/clips.yml` fires at **08:00, 12:00, 16:00, 20:00, and 23:00 UTC** every day, generating one clip per run. Change the cron entries or the `CLIP_COUNT` env var (per run) to taste. You can also dispatch a run any time from the Actions tab.

## Run locally

```bash
npm install
cp .env.example .env   # fill in the values
node --env-file=.env pipeline.mjs
```

Without `MAKE_WEBHOOK_URL`, the pipeline still generates, renders, and (optionally) uploads to Drive — it just skips the social post.

## Manual single clip

Useful for one-off, hand-picked posts — pair with the admin studio in `velvetvice-web` (`/admin`) to draft a hook and narration.

```bash
# Either drop a full package
echo '{ "title": "Borrowed Heat", "subtitle": "One contract. One bed.", "body": "..." }' > input/story.json

# …or just the body
echo "She steps onto the porch and the air bends..." > input/script.txt

# Plus the narration audio
cp ~/audio.mp3 input/

npm run render
# → output/velvetvice-{stamp}.mp4 + .png
```

## Tweaking the design

```bash
npm run studio
```

Opens Remotion Studio to live-edit `src/ClipVideo.tsx` (cover layout, turn timing, page typography, CTA copy).

## Layout

| File                                | Role                                                       |
| ----------------------------------- | ---------------------------------------------------------- |
| `src/ClipVideo.tsx`                 | The composition — cover, turn, page, CTA                   |
| `src/Root.tsx`                      | Registers the `Clip` composition + total duration          |
| `lib/render.mjs`                    | Bundle + render video + render cover-still thumbnail       |
| `lib/xai.mjs`                       | Grok story package + xAI narration                         |
| `lib/drive.mjs`                     | Google Drive upload (video + thumbnail)                    |
| `lib/make.mjs`                      | POST to the Make.com webhook                               |
| `vibes.mjs`                         | Content pool: vibes (with heat) and voices                 |
| `pipeline.mjs`                      | The full automated chain (per clip: generate → post)       |
| `render.mjs`                        | Manual single-clip render from `input/`                    |
| `.github/workflows/clips.yml`       | The 5x/day schedule                                        |

The first render on any machine downloads a headless Chromium automatically.
