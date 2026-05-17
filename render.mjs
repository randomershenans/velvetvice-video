import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia } from '@remotion/renderer';
import { parseFile } from 'music-metadata';
import {
  readFileSync,
  readdirSync,
  copyFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import path from 'node:path';

const FPS = 30;

async function main() {
  const root = process.cwd();
  const inputDir = path.join(root, 'input');
  const publicDir = path.join(root, 'public');
  const outputDir = path.join(root, 'output');

  // ── Script ────────────────────────────────────────────
  const scriptPath = path.join(inputDir, 'script.txt');
  if (!existsSync(scriptPath)) {
    throw new Error('Add your hook text to input/script.txt');
  }
  const script = readFileSync(scriptPath, 'utf8').trim();
  if (!script) throw new Error('input/script.txt is empty');

  // ── Audio ─────────────────────────────────────────────
  const audioFile = readdirSync(inputDir).find((f) => /\.(mp3|m4a|wav|aac)$/i.test(f));
  if (!audioFile) {
    throw new Error('Add the narration audio (e.g. audio.mp3) to input/');
  }
  const audioSrc = path.join(inputDir, audioFile);

  const meta = await parseFile(audioSrc);
  const seconds = meta.format.duration ?? 0;
  if (!seconds) throw new Error('Could not read the audio duration');
  const narrationFrames = Math.ceil(seconds * FPS);

  // Remotion serves audio from public/ via staticFile().
  if (!existsSync(publicDir)) mkdirSync(publicDir);
  const publicAudioName = `audio${path.extname(audioFile)}`;
  copyFileSync(audioSrc, path.join(publicDir, publicAudioName));

  const inputProps = { script, audioFile: publicAudioName, narrationFrames };
  const words = script.split(/\s+/).length;
  console.log(`Narration ${seconds.toFixed(1)}s · ${words} words · ${narrationFrames} frames`);

  // ── Render ────────────────────────────────────────────
  console.log('Bundling…');
  const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts') });

  console.log('Preparing composition…');
  const composition = await selectComposition({ serveUrl, id: 'Clip', inputProps });

  if (!existsSync(outputDir)) mkdirSync(outputDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(outputDir, `velvetvice-${stamp}.mp4`);

  console.log('Rendering…');
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outPath,
    inputProps,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r  ${Math.round(progress * 100)}%`);
    },
  });

  console.log(`\nDone → ${outPath}`);
}

main().catch((err) => {
  console.error('\nRender failed:', err.message ?? err);
  process.exit(1);
});
