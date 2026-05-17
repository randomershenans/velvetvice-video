import { Composition } from 'remotion';
import { ClipVideo, type ClipProps } from './ClipVideo';

export const FPS = 30;
export const END_CARD_FRAMES = 108; // 3.6s

/**
 * One composition, "Clip". Total duration is derived from the narration
 * length passed in by render.mjs, plus a fixed end-card tail.
 */
export const Root: React.FC = () => {
  return (
    <Composition
      id="Clip"
      component={ClipVideo}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={1500}
      defaultProps={
        {
          script:
            'They meet again in the rain, six years late. I trudge along the coastal path, and there he is, emerging from the mist like a memory I tried to bind shut. He has not forgotten either. I can see it in the way he stops.',
          audioFile: 'audio.mp3',
          narrationFrames: 1500,
        } satisfies ClipProps
      }
      calculateMetadata={({ props }) => ({
        durationInFrames: (props as ClipProps).narrationFrames + END_CARD_FRAMES,
      })}
    />
  );
};
