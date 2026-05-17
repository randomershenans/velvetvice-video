import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia } from '@remotion/renderer';
import { parseFile } from 'music-metadata';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const FPS = 30;

/**
 * Render a single clip.
 *
 * The composition reads its narration via staticFile(), which resolves
 * against public/ — and bundle() snapshots public/ — so the audio is copied
 * in before bundling. Each call bundles fresh; bundling is cheap next to the
 * render itself and keeps batch renders correct.
 */
export async function renderClip({ script, audioPath, outDir, label, onProgress }) {
  const root = process.cwd();

  const publicDir = path.join(root, 'public');
  if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
  const publicAudioName = `audio${path.extname(audioPath)}`;
  copyFileSync(audioPath, path.join(publicDir, publicAudioName));

  const meta = await parseFile(audioPath);
  const seconds = meta.format.duration ?? 0;
  if (!seconds) throw new Error('Could not read the audio duration');
  const narrationFrames = Math.ceil(seconds * FPS);

  const inputProps = { script, audioFile: publicAudioName, narrationFrames };

  const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts') });
  const composition = await selectComposition({ serveUrl, id: 'Clip', inputProps });

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${label}.mp4`);

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outPath,
    inputProps,
    onProgress: onProgress
      ? ({ progress }) => onProgress(progress)
      : undefined,
  });

  return { outPath, seconds, narrationFrames };
}
