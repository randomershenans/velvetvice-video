import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { renderClip } from './lib/render.mjs';

/**
 * Manual single-clip render. Reads input/script.txt + input/audio.* and
 * writes the MP4 to output/. For the automated batch pipeline see
 * pipeline.mjs.
 */
async function main() {
  const root = process.cwd();
  const inputDir = path.join(root, 'input');

  const scriptPath = path.join(inputDir, 'script.txt');
  if (!existsSync(scriptPath)) throw new Error('Add your hook text to input/script.txt');
  const script = readFileSync(scriptPath, 'utf8').trim();
  if (!script) throw new Error('input/script.txt is empty');

  const audioFile = readdirSync(inputDir).find((f) => /\.(mp3|m4a|wav|aac)$/i.test(f));
  if (!audioFile) throw new Error('Add the narration audio (e.g. audio.mp3) to input/');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  console.log('Rendering…');
  const { outPath, seconds } = await renderClip({
    script,
    audioPath: path.join(inputDir, audioFile),
    outDir: path.join(root, 'output'),
    label: `velvetvice-${stamp}`,
    onProgress: (p) => process.stdout.write(`\r  ${Math.round(p * 100)}%`),
  });

  console.log(`\nDone (${seconds.toFixed(1)}s) → ${outPath}`);
}

main().catch((err) => {
  console.error('\nRender failed:', err.message ?? err);
  process.exit(1);
});
