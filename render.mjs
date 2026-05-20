import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { renderClip } from './lib/render.mjs';

/**
 * Manual single-clip render. Two ways to supply the story:
 *
 *  1. input/story.json — { "title": "...", "subtitle": "...", "body": "..." }
 *  2. input/script.txt — body only; the cover falls back to the wordmark.
 *
 * The narration audio is any input/*.mp3|m4a|wav|aac. Writes an MP4 plus a
 * cover-frame PNG thumbnail to output/. For the automated batch pipeline see
 * pipeline.mjs.
 */
async function main() {
  const root = process.cwd();
  const inputDir = path.join(root, 'input');

  let title = 'Velvet Vice';
  let subtitle = '';
  let body = '';

  const storyJsonPath = path.join(inputDir, 'story.json');
  const scriptPath = path.join(inputDir, 'script.txt');

  if (existsSync(storyJsonPath)) {
    const data = JSON.parse(readFileSync(storyJsonPath, 'utf8'));
    title = String(data.title ?? title);
    subtitle = String(data.subtitle ?? '');
    body = String(data.body ?? '').trim();
  } else if (existsSync(scriptPath)) {
    body = readFileSync(scriptPath, 'utf8').trim();
  } else {
    throw new Error('Add input/story.json (structured) or input/script.txt (body only)');
  }
  if (!body) throw new Error('Story body is empty');

  const audioFile = readdirSync(inputDir).find((f) => /\.(mp3|m4a|wav|aac)$/i.test(f));
  if (!audioFile) throw new Error('Add the narration audio (e.g. audio.mp3) to input/');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  console.log('Rendering…');
  const { videoPath, thumbnailPath, seconds } = await renderClip({
    title,
    subtitle,
    body,
    audioPath: path.join(inputDir, audioFile),
    outDir: path.join(root, 'output'),
    label: `velvetvice-${stamp}`,
    onProgress: (p) => process.stdout.write(`\r  ${Math.round(p * 100)}%`),
  });

  console.log(`\nDone (${seconds.toFixed(1)}s)`);
  console.log(`  video:     ${videoPath}`);
  console.log(`  thumbnail: ${thumbnailPath}`);
}

main().catch((err) => {
  console.error('\nRender failed:', err.message ?? err);
  process.exit(1);
});
