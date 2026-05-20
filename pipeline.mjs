import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { generateStory, generateAudio } from './lib/xai.mjs';
import { renderClip } from './lib/render.mjs';
import { uploadToDrive, driveConfigured } from './lib/drive.mjs';
import { postToMake, makeConfigured } from './lib/make.mjs';
import { pickVibe, pickVoice } from './vibes.mjs';

/**
 * The hands-off pipeline: invent a vibe + voice, ask Grok for the full
 * story package (title, subtitle, body, social caption), narrate it, render
 * a vertical clip (book cover → page turn → narrated page → branded CTA),
 * capture a still of the cover as the thumbnail, upload both to Drive, then
 * POST a payload to the Make.com webhook that posts to Instagram + TikTok.
 *
 * Designed to run on a schedule (.github/workflows/clips.yml). A failed clip
 * is logged and skipped so the rest of the batch still ships.
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

  let videoDrive = null;
  let thumbDrive = null;
  if (driveConfigured()) {
    videoDrive = await uploadToDrive(videoPath, 'video/mp4');
    thumbDrive = await uploadToDrive(thumbnailPath, 'image/png');
    console.log(`[${i}] uploaded to Drive: ${videoDrive.name}`);
  } else {
    console.log(`[${i}] Drive not configured — files left in output/`);
  }

  if (makeConfigured()) {
    await postToMake({
      title: story.title,
      subtitle: story.subtitle,
      caption: story.caption,
      vibe,
      heat,
      voice,
      videoFileId: videoDrive?.id ?? null,
      videoFileName: videoDrive?.name ?? path.basename(videoPath),
      videoWebLink: videoDrive?.webViewLink ?? null,
      thumbnailFileId: thumbDrive?.id ?? null,
      thumbnailFileName: thumbDrive?.name ?? path.basename(thumbnailPath),
      thumbnailWebLink: thumbDrive?.webViewLink ?? null,
      createdAt: new Date().toISOString(),
    });
    console.log(`[${i}] posted to Make.com webhook`);
  } else {
    console.log(`[${i}] MAKE_WEBHOOK_URL not set — skipping social post`);
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
