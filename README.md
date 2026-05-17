# velvetvice-video

Remotion render pipeline for VelvetVice social clips. Turns a hook script +
narration audio into a vertical MP4 — the story text scrolling in the app's
reader style while the voice plays, finishing on an end card.

## Setup

```bash
npm install
```

The first render downloads a headless Chromium (~once, automatic).

## Making a clip

1. In the VelvetVice admin studio (`velvetvice-web` → `/admin`), generate a
   hook and its narration. Download both.
2. Drop them into `input/`:
   - `input/script.txt` — the hook text
   - `input/audio.mp3` — the narration (`.m4a` / `.wav` / `.aac` also work)
3. Render:
   ```bash
   npm run render
   ```
4. The finished MP4 lands in `output/`.

Render duration, scroll distance, and total length are all derived from the
audio automatically — no manual timing.

## Output to your phone

Point the **Google Drive desktop app** at the `output/` folder (add it as a
synced folder). Every rendered clip then appears in Drive, ready to grab and
post from your phone. No API keys, no upload code.

## Previewing the design

```bash
npm run studio
```

Opens Remotion Studio to tweak the composition (`src/ClipVideo.tsx`) — fonts,
colours, scroll pacing, end card — with live preview.

## How it works

- `src/ClipVideo.tsx` — the composition. The text column measures its own
  rendered height and scrolls so the final line always lands cleanly,
  whatever the script length.
- `src/Root.tsx` — registers the `Clip` composition; total duration is the
  narration length plus a fixed end-card tail.
- `render.mjs` — reads `input/`, measures the audio, renders to `output/`.

## Later: full automation

This renders locally and free. If the clip channel proves out, the same
composition can move to Remotion Lambda for scheduled, hands-off rendering —
only `render.mjs` changes.
