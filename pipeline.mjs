import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { generateStory, generateAudio } from './lib/xai.mjs';
import { renderClip } from './lib/render.mjs';
import { uploadAndShare, driveConfigured } from './lib/drive.mjs';
import { postReel, metaConfigured } from './lib/meta.mjs';
import { postVideo, tiktokConfigured } from './lib/tiktok.mjs';
import { pickVibe, pickVoice } from './vibes.mjs';

/**
 * The hands-off pipeline: invent a vibe + voice, ask Grok for the full story
 * package (title, subtitle, body, social caption), narrate it, render a
 * vertical clip (book cover → page turn → narrated page → branded CTA),
 * capture a cover-still thumbnail, upload the video to Drive (publicly
 * readable), then post to Instagram Reels and TikTok via their native APIs
 * using the Drive URL.
 *
 * Designed to run 5x/day via .github/workflows/clips.yml — one clip per run,
 * posted immediately. A failed clip is logged and skipped; one platform
 * failing doesn't take down the other.
 */

const COUNT = Math.max(1, Number(process.env.CLIP_COUNT ?? 1));

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
  const label = `velvet-${stamp}-${i}`;
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

  if (!driveConfigured()) {
    console.log(`[${i}] Drive not configured — can't host the video, skipping social posts`);
    return;
  }

  const drive = await uploadAndShare(videoPath, 'video/mp4');
  console.log(`[${i}] uploaded to Drive: ${drive.name}`);

  // Post to each platform independently — one failing doesn't kill the other.
  if (metaConfigured()) {
    try {
      const mediaId = await postReel({ videoUrl: drive.downloadUrl, caption: story.caption });
      console.log(`[${i}] posted to Instagram Reels (media id: ${mediaId})`);
    } catch (e) {
      console.error(`[${i}] Instagram post failed: ${e?.message ?? e}`);
    }
  } else {
    console.log(`[${i}] Meta not configured — skipping Instagram`);
  }

  if (tiktokConfigured()) {
    try {
      const publishId = await postVideo({ videoUrl: drive.downloadUrl, caption: story.caption });
      console.log(`[${i}] posted to TikTok (publish id: ${publishId})`);
    } catch (e) {
      console.error(`[${i}] TikTok post failed: ${e?.message ?? e}`);
    }
  } else {
    console.log(`[${i}] TikTok not configured — skipping TikTok`);
  }
}

async function main() {
  console.log(`Velvet clip pipeline — generating ${COUNT} clip(s)`);
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
