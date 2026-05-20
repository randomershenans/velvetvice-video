import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia, renderStill } from '@remotion/renderer';
import { parseFile } from 'music-metadata';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const FPS = 30;
// Frame used for the cover-still thumbnail — well into the cover scene,
// before the page-turn animation begins (see ClipVideo.tsx).
const THUMBNAIL_FRAME = 30;

/**
 * Render a single clip plus its cover-frame thumbnail.
 *
 * The composition reads its narration via staticFile(), which resolves
 * against public/ — and bundle() snapshots public/ — so the audio is copied
 * in before bundling. The video render and the thumbnail still share the
 * same bundle to avoid bundling twice.
 */
export async function renderClip({
  title,
  subtitle,
  body,
  audioPath,
  outDir,
  label,
  onProgress,
}) {
  const root = process.cwd();

  const publicDir = path.join(root, 'public');
  if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
  const publicAudioName = `audio${path.extname(audioPath)}`;
  copyFileSync(audioPath, path.join(publicDir, publicAudioName));

  const meta = await parseFile(audioPath);
  const seconds = meta.format.duration ?? 0;
  if (!seconds) throw new Error('Could not read the audio duration');
  const narrationFrames = Math.ceil(seconds * FPS);

  const inputProps = { title, subtitle, body, audioFile: publicAudioName, narrationFrames };

  const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts') });
  const composition = await selectComposition({ serveUrl, id: 'Clip', inputProps });

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const videoPath = path.join(outDir, `${label}.mp4`);
  const thumbnailPath = path.join(outDir, `${label}.png`);

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: videoPath,
    inputProps,
    onProgress: onProgress ? ({ progress }) => onProgress(progress) : undefined,
  });

  await renderStill({
    composition,
    serveUrl,
    output: thumbnailPath,
    frame: THUMBNAIL_FRAME,
    inputProps,
  });

  return { videoPath, thumbnailPath, seconds, narrationFrames };
}
