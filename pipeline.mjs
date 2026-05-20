import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { generateStory, generateAudio } from './lib/xai.mjs';
import { renderClip } from './lib/render.mjs';
import { uploadToDrive, driveConfigured } from './lib/drive.mjs';
import { uploadMedia, schedulePost, ayrshareConfigured } from './lib/ayrshare.mjs';
import { pickVibe, pickVoice } from './vibes.mjs';

/**
 * The hands-off pipeline: per clip, invent a vibe + voice, ask Grok for the
 * full story package (title, subtitle, body, social caption), narrate it,
 * render a vertical clip (book cover → page turn → narrated page →
 * branded CTA), capture a cover-still thumbnail, archive to Drive
 * (optional), upload the video to Ayrshare's media bucket, and schedule a
 * post on Instagram + TikTok at a staggered time.
 *
 * Designed to run once a day via .github/workflows/clips.yml — five clips
 * per run, posts staggered through the day. A failed clip is logged and
 * skipped so the rest of the batch still ships.
 */

const COUNT = Math.max(1, Number(process.env.CLIP_COUNT ?? 5));
const POST_START_HOURS = Number(process.env.POST_START_HOURS ?? 1);
const POST_INTERVAL_HOURS = Number(process.env.POST_INTERVAL_HOURS ?? 3);

/** ISO timestamp for the i-th clip's post (1-indexed). Spaced from now. */
function scheduleTimeFor(i) {
  const offsetMs = (POST_START_HOURS + (i - 1) * POST_INTERVAL_HOURS) * 60 * 60 * 1000;
  return new Date(Date.now() + offsetMs).toISOString();
}

async function makeClip(i) {
  const { vibe, heat } = pickVibe();
  const voice = pickVoice();
  console.log(`\n[${i}/${COUNT}] ${heat} · ${voice} · ${vibe}`);

  const story = await generateStory({ vibe, heat });
  console.log(`[${i}] "${story.title}" — ${story.body.split(/\s+/).length} words`);

  const audio = await generateAudio(story.body, voice);

  const root = process.cwd();
  const tmpDir = path.join(root, 'tmp');
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const label = `velvetvice-${stamp}-${i}`;
  const audioPath = path.join(tmpDir, `${label}.mp3`);
  writeFileSync(audioPath, audio);

  const { videoPath, thumbnailPath, seconds } = await renderClip({
    title: story.title,
    subtitle: story.subtitle,
    body: story.body,
    audioPath,
    outDir: path.join(root, 'output'),
    label,
    onProgress: (p) => process.stdout.write(`\r[${i}] rendering ${Math.round(p * 100)}%`),
  });
  console.log(
    `\n[${i}] rendered ${path.basename(videoPath)} (${seconds.toFixed(1)}s) + ${path.basename(thumbnailPath)}`,
  );

  // Sidecar text with the full package — handy for manual posting and audit.
  writeFileSync(
    videoPath.replace(/\.mp4$/, '.txt'),
    `Title: ${story.title}\nSubtitle: ${story.subtitle}\nVibe: ${vibe}\nHeat: ${heat}\nVoice: ${voice}\n\n--- Body ---\n${story.body}\n\n--- Caption ---\n${story.caption}\n`,
  );

  // Optional Drive archive — non-fatal if it fails.
  if (driveConfigured()) {
    try {
      await uploadToDrive(videoPath, 'video/mp4');
      await uploadToDrive(thumbnailPath, 'image/png');
      console.log(`[${i}] archived to Drive`);
    } catch (e) {
      console.warn(`[${i}] Drive archive failed (non-fatal): ${e?.message ?? e}`);
    }
  }

  if (ayrshareConfigured()) {
    const mediaUrl = await uploadMedia(videoPath);
    const scheduleDate = scheduleTimeFor(i);
    await schedulePost({ caption: story.caption, videoUrl: mediaUrl, scheduleDate });
    console.log(`[${i}] scheduled on IG + TikTok for ${scheduleDate}`);
  } else {
    console.log(`[${i}] AYRSHARE_API_KEY not set — skipping social post`);
  }
}

async function main() {
  console.log(`VelvetVice clip pipeline — generating ${COUNT} clip(s)`);
  let ok = 0;
  for (let i = 1; i <= COUNT; i++) {
    try {
      await makeClip(i);
      ok += 1;
    } catch (e) {
      console.error(`[${i}] failed: ${e?.message ?? e}`);
    }
  }
  console.log(`\nFinished — ${ok}/${COUNT} clip(s) succeeded.`);
  if (ok === 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
