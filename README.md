# velvetvice-video

VelvetVice's social-clip engine. Once a day, end to end:

1. Pick a vibe + heat + voice at random (`vibes.mjs`).
2. Ask Grok for the full **story package** — title, subtitle, body, social caption.
3. Narrate the body with xAI text-to-speech.
4. Render a 1080×1920 vertical clip — **book cover → page turn → narrated story page → branded CTA**.
5. Capture a still of the cover frame as the thumbnail.
6. (Optional) archive both to Google Drive.
7. Upload the MP4 to Ayrshare and schedule a post on Instagram + TikTok at a staggered time.

Five clips per day, posts spread across ~13 hours. Nothing of yours stays on.

## How a clip is structured

```
[ 0 – 2.5s ]   Book cover    — gold title + tagline on a velvet card
[ 2.5 – 3.3s ] Page turn     — the cover hinges up and away
[ 3.3 – ~50s ] Narrated page — TTS plays, story text scrolls, cliffhanger
[ last 3s    ] CTA           — "Steer the story whichever way you want.
                                VELVET VICE — Download today"
```

All visuals stay on-brand with the iOS app's dark/gold reader aesthetic.

## Pipeline output

Each successful clip produces:

- `output/velvetvice-{stamp}-{i}.mp4` — the vertical video
- `output/velvetvice-{stamp}-{i}.png` — cover-frame thumbnail
- `output/velvetvice-{stamp}-{i}.txt` — full story package (title, body, caption)

If `AYRSHARE_API_KEY` is set, the MP4 also uploads to Ayrshare and a post is scheduled on Instagram + TikTok with the booktok caption.

If `GOOGLE_SERVICE_ACCOUNT` + `DRIVE_FOLDER_ID` are set, video + thumbnail are also archived to Drive (non-fatal — failures don't break the pipeline).

## Setup

### 1. Ayrshare (one-off)

1. Sign up at https://app.ayrshare.com.
2. Link your Instagram and TikTok accounts in the dashboard (one OAuth click each).
3. Copy your API Key — that's `AYRSHARE_API_KEY`.

That's the entire UI portion. Everything else is code.

### 2. Repository secrets (Settings → Secrets and variables → Actions)

| Secret                   | Required | What it is                                           |
| ------------------------ | -------- | ---------------------------------------------------- |
| `GROK_API_KEY`           | ✓        | xAI key — same one the app's edge functions use      |
| `AYRSHARE_API_KEY`       | ✓        | Ayrshare API key                                     |
| `GOOGLE_SERVICE_ACCOUNT` | optional | Drive backup — full service-account JSON, one line   |
| `DRIVE_FOLDER_ID`        | optional | Drive folder id for the archive                      |

### 3. Schedule

`.github/workflows/clips.yml` fires once a day at **07:00 UTC**, generates 5 clips, and schedules them on Ayrshare at +1h, +4h, +7h, +10h, +13h — i.e. roughly 08, 11, 14, 17, 20 UTC. Tune cadence with `POST_START_HOURS` and `POST_INTERVAL_HOURS` (set as env in the workflow if you want non-defaults).

Trigger a run any time from the Actions tab ("Run workflow").

## Run locally

```bash
npm install
cp .env.example .env   # fill in the values
node --env-file=.env pipeline.mjs
```

Without `AYRSHARE_API_KEY`, the pipeline still generates and renders — it just skips the upload + schedule step. Useful for previewing the visual output.

## Manual single clip

For a one-off, hand-picked post — pair with the admin studio in `velvetvice-web` (`/admin`) to draft a hook and narration.

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
| `lib/ayrshare.mjs`                  | Upload media to Ayrshare + schedule IG/TT posts            |
| `lib/drive.mjs`                     | Optional Drive archive (video + thumbnail)                 |
| `vibes.mjs`                         | Content pool: vibes (with heat) and voices                 |
| `pipeline.mjs`                      | The full automated chain (per clip: generate → schedule)   |
| `render.mjs`                        | Manual single-clip render from `input/`                    |
| `.github/workflows/clips.yml`       | The 1x/day schedule (5 clips, staggered)                   |

The first render on any machine downloads a headless Chromium automatically.
