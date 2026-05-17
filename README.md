# velvetvice-video

The VelvetVice social-clip engine. Generates romance hook scripts, narrates
them, renders vertical MP4s in the app's reader style, and ships them to
Google Drive — fully automated on a daily schedule, or run manually.

## Automated pipeline (hands-off)

A GitHub Actions workflow (`.github/workflows/clips.yml`) runs every day. For
each clip it:

1. Picks a vibe and voice at random from `vibes.mjs`.
2. Writes a 40–60s social-safe hook with Grok.
3. Narrates it with xAI text-to-speech.
4. Renders the vertical video (`pipeline.mjs` → `lib/render.mjs`).
5. Uploads the MP4 to a Google Drive folder.

No machine of yours stays on. Clips just appear in Drive each morning, ready
to post from your phone.

### Setup

Add these as **repository secrets** (Settings → Secrets and variables →
Actions):

| Secret                   | What it is                                              |
| ------------------------ | ------------------------------------------------------- |
| `GROK_API_KEY`           | xAI key — same one the app's edge functions use         |
| `GOOGLE_SERVICE_ACCOUNT` | Full service-account JSON key, pasted as one value      |
| `DRIVE_FOLDER_ID`        | Id of the Drive folder (from its URL) for the clips     |

Google Drive setup (one-off):

1. In Google Cloud, create a service account and enable the Drive API.
2. Create a key for it (JSON) — that JSON is `GOOGLE_SERVICE_ACCOUNT`.
3. Create a folder in your Drive, share it with the service account's email
   (Editor). Its id from the URL is `DRIVE_FOLDER_ID`. Clips upload there and
   live in your Drive.

The schedule is `0 8 * * *` (08:00 UTC daily) and produces 5 clips. Change
the cron or count in the workflow. You can also trigger it any time from the
Actions tab ("Run workflow"). If Drive isn't configured, clips are still
saved as downloadable workflow artifacts.

### Run the pipeline locally

```bash
npm install
cp .env.example .env   # fill in the values
node --env-file=.env pipeline.mjs
```

## Manual single clip

For a one-off, hand-picked clip — pair this with the admin studio in
`velvetvice-web` (`/admin`):

1. Generate a hook + narration in the studio, download both.
2. Drop them in `input/` as `script.txt` and `audio.mp3`.
3. `npm run render` — the MP4 lands in `output/`.

## Previewing the design

```bash
npm run studio
```

Opens Remotion Studio to tweak `src/ClipVideo.tsx` (fonts, colours, scroll
pacing, end card) with live preview.

## Layout

| File                    | Role                                              |
| ----------------------- | ------------------------------------------------- |
| `src/ClipVideo.tsx`     | The composition — scrolling story text + end card |
| `src/Root.tsx`          | Registers the `Clip` composition                  |
| `lib/render.mjs`        | Shared render routine (bundle + render one clip)  |
| `lib/xai.mjs`           | Grok script + xAI narration                       |
| `lib/drive.mjs`         | Google Drive upload                               |
| `vibes.mjs`             | The content pool the pipeline draws from          |
| `pipeline.mjs`          | Automated batch: generate → render → upload       |
| `render.mjs`            | Manual single-clip render from `input/`           |

The first render on any machine downloads a headless Chromium automatically.
