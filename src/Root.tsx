import { Composition } from 'remotion';
import {
  ClipVideo,
  type ClipProps,
  COVER_FRAMES,
  TURN_FRAMES,
  CTA_TAIL,
} from './ClipVideo';

export const FPS = 30;

/**
 * One composition, "Clip". Total duration is computed from the narration
 * length plus the fixed cover/turn/CTA tails (see ClipVideo.tsx).
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
          title: 'The Lighthouse Keeper',
          subtitle: 'Six years late, the mist remembered everything.',
          body:
            'They meet again in the rain, six years late. I trudge along the coastal path, and there he is, emerging from the mist like a memory I tried to bind shut. He has not forgotten either. I can see it in the way he stops.',
          audioFile: 'audio.mp3',
          narrationFrames: 1500,
        } satisfies ClipProps
      }
      calculateMetadata={({ props }) => ({
        durationInFrames:
          COVER_FRAMES + TURN_FRAMES + (props as ClipProps).narrationFrames + CTA_TAIL,
      })}
    />
  );
};
