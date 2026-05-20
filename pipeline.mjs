import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { generateStory, generateAudio } from './lib/xai.mjs';
import { renderClip } from './lib/render.mjs';
import { uploadFile, driveConfigured } from './lib/drive.mjs';
import { postReel, metaConfigured } from './lib/meta.mjs';
import { postVideo, tiktokConfigured } from './lib/tiktok.mjs';
import { pickVibe, pickVoice } from './vibes.mjs';

/**
 * The hands-off pipeline: invent a vibe + voice, ask Grok for the full story
 * package (title, subtitle, body, social caption), narrate it, render a
 * vertical clip (book cover → page turn → narrated page → branded CTA),
 * capture a cover-still thumbnail, upload everything to Drive, then post to
 * Instagram Reels and TikTok if their creds are set.
 *
 * Drive-only mode: if META and TIKTOK aren't configured, clips still upload
 * to Drive (private). Open Drive on your phone, scrub through, manually post.
 * Useful for hand-curated review while the API access is being set up.
 *
 * Designed to run 5x/day via .github/workflows/clips.yml — one clip per run.
 * A failed clip is logged and skipped; one platform failing doesn't take
 * down the other.
 */

const COUNT = Math.max(1, Number(process.env.CLIP_COUNT ?? 1));

async function makeClip(i) {
  const { vibe, heat } = pickVibe();
  const voice = pickVoice();
  console.log(`\n[${i}/${COUNT}] ${heat} · ${voice.id} (${voice.gender}) · ${vibe}`);

  const story = await generateStory({ vibe, heat, narrator: voice.gender });
  console.log(`[${i}] "${story.title}" — ${story.body.split(/\s+/).length} words`);

  const audio = await generateAudio(story.body, voice.id);

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

  // Caption sidecar — designed for fast mobile read: caption at the top so
  // you can copy and paste straight into IG / TikTok without scrolling.
  const txtPath = videoPath.replace(/\.mp4$/, '.txt');
  writeFileSync(
    txtPath,
    [
      '=== CAPTION (copy this) ===',
      '',
      story.caption,
      '',
      '=== TITLE ===',
      story.title,
      story.subtitle,
      '',
      '=== STORY BODY (narration) ===',
      story.body,
      '',
      '=== METADATA ===',
      `Vibe:   ${vibe}`,
      `Heat:   ${heat}`,
      `Voice:  ${voice}`,
      `Length: ${seconds.toFixed(1)}s`,
      '',
    ].join('\n'),
  );

  if (!driveConfigured()) {
    console.log(`[${i}] Drive not configured — files left in output/`);
    return;
  }

  // Video needs to be publicly readable if a platform will fetch by URL.
  // Otherwise keep everything private — you'll be the one opening it from
  // the Drive app on your phone.
  const needsPublicVideo = metaConfigured() || tiktokConfigured();
  const video = await uploadFile(videoPath, 'video/mp4', { share: needsPublicVideo });
  await uploadFile(thumbnailPath, 'image/png');
  await uploadFile(txtPath, 'text/plain');
  console.log(`[${i}] uploaded to Drive: ${video.name} (+ thumbnail + caption)`);

  if (!needsPublicVideo) {
    console.log(`[${i}] no social destinations configured — clip in Drive for manual posting`);
    return;
  }

  if (metaConfigured()) {
    try {
      const mediaId = await postReel({ videoUrl: video.downloadUrl, caption: story.caption });
      console.log(`[${i}] posted to Instagram Reels (media id: ${mediaId})`);
    } catch (e) {
      console.error(`[${i}] Instagram post failed: ${e?.message ?? e}`);
    }
  }

  if (tiktokConfigured()) {
    try {
      const publishId = await postVideo({ videoUrl: video.downloadUrl, caption: story.caption });
      console.log(`[${i}] posted to TikTok (publish id: ${publishId})`);
    } catch (e) {
      console.error(`[${i}] TikTok post failed: ${e?.message ?? e}`);
    }
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
