import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { generateScript, generateAudio } from './lib/xai.mjs';
import { renderClip } from './lib/render.mjs';
import { uploadToDrive, driveConfigured } from './lib/drive.mjs';
import { pickVibe, pickVoice } from './vibes.mjs';

/**
 * The hands-off pipeline: for each clip, invent a vibe, write a hook with
 * Grok, narrate it with xAI, render the video, and upload it to Drive.
 * Designed to run on a schedule (see .github/workflows/clips.yml) — one
 * failed clip is logged and skipped so the rest of the batch still ships.
 */

const COUNT = Math.max(1, Number(process.env.CLIP_COUNT ?? 3));

async function makeClip(i) {
  const { vibe, heat } = pickVibe();
  const voice = pickVoice();
  console.log(`\n[${i}/${COUNT}] ${heat} · ${voice} · ${vibe}`);

  const script = await generateScript({ vibe, heat });
  console.log(`[${i}] script: ${script.split(/\s+/).length} words`);

  const audio = await generateAudio(script, voice);

  const root = process.cwd();
  const tmpDir = path.join(root, 'tmp');
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const label = `velvetvice-${stamp}-${i}`;
  const audioPath = path.join(tmpDir, `${label}.mp3`);
  writeFileSync(audioPath, audio);

  const { outPath } = await renderClip({
    script,
    audioPath,
    outDir: path.join(root, 'output'),
    label,
    onProgress: (p) => process.stdout.write(`\r[${i}] rendering ${Math.round(p * 100)}%`),
  });
  console.log(`\n[${i}] rendered ${path.basename(outPath)}`);

  // Save the script alongside for caption/reference use.
  writeFileSync(outPath.replace(/\.mp4$/, '.txt'), script);

  if (driveConfigured()) {
    const up = await uploadToDrive(outPath);
    console.log(`[${i}] uploaded to Drive: ${up.name}`);
  } else {
    console.log(`[${i}] Drive not configured — clip left in output/`);
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
