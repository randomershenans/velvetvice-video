import { useEffect, useRef, useState } from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  delayRender,
  continueRender,
} from 'remotion';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

const { fontFamily: playfair } = loadPlayfair();
const { fontFamily: inter } = loadInter();

export type ClipProps = {
  script: string;
  audioFile: string;
  narrationFrames: number;
};

const COLUMN_MARGIN = 96;
const TEXT_SIZE = 60;
const LINE_HEIGHT = 1.52;

/**
 * A vertical social clip: the story text scrolls past the screen in the
 * VelvetVice reader style while the narration plays, then settles into an
 * end card. The text column measures its own rendered height so the scroll
 * always lands the final line comfortably in view, whatever the script length.
 */
export const ClipVideo: React.FC<ClipProps> = ({ script, audioFile, narrationFrames }) => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();

  const textRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState(0);
  const [handle] = useState(() => delayRender('measuring story text'));

  useEffect(() => {
    if (textRef.current) {
      setContentH(textRef.current.getBoundingClientRect().height);
    }
    continueRender(handle);
  }, [handle]);

  // Scroll: start with the text top a little below the wordmark; finish with
  // its last line resting around 60% screen height.
  const startY = height * 0.34;
  const endY = height * 0.6 - contentH;
  const translateY = interpolate(frame, [0, narrationFrames], [startY, Math.min(startY, endY)], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Dim the story as the end card fades up.
  const textOpacity = interpolate(
    frame,
    [narrationFrames - 26, narrationFrames + 14],
    [1, 0.1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const clean = script.trim();
  const dropCap = clean.charAt(0);
  const body = clean.slice(1);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0c0a10' }}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(900px circle at 50% 10%, rgba(96,42,82,0.55), transparent 62%), ' +
            'radial-gradient(700px circle at 50% 104%, rgba(150,95,55,0.18), transparent 60%), ' +
            'linear-gradient(180deg, #1b0f20, #0c0a10 72%)',
        }}
      />

      {/* Wordmark */}
      <div
        style={{
          position: 'absolute',
          top: 78,
          width,
          textAlign: 'center',
          fontFamily: inter,
          fontWeight: 700,
          letterSpacing: 9,
          fontSize: 27,
          color: 'rgba(212,175,122,0.62)',
        }}
      >
        VELVET VICE
      </div>

      {/* Scrolling story text */}
      <div
        style={{
          position: 'absolute',
          left: COLUMN_MARGIN,
          right: COLUMN_MARGIN,
          top: 0,
          transform: `translateY(${translateY}px)`,
          opacity: textOpacity,
        }}
      >
        <div
          ref={textRef}
          style={{
            fontFamily: playfair,
            fontSize: TEXT_SIZE,
            lineHeight: LINE_HEIGHT,
            color: '#efe7d4',
            letterSpacing: 0.2,
          }}
        >
          <span
            style={{
              fontFamily: playfair,
              fontSize: TEXT_SIZE * 2.6,
              lineHeight: 0.78,
              color: '#d4af7a',
              float: 'left',
              marginRight: 16,
              marginTop: 14,
            }}
          >
            {dropCap}
          </span>
          {body}
        </div>
      </div>

      {/* Edge fades so text enters and leaves softly */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 220, background: 'linear-gradient(180deg,#0c0a10,transparent)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 260, background: 'linear-gradient(0deg,#0c0a10,transparent)' }} />
      </AbsoluteFill>

      <Audio src={staticFile(audioFile)} />

      <Sequence from={Math.max(0, narrationFrames - 18)}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: 'clamp' });
  const rise = interpolate(frame, [0, 30], [18, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
        transform: `translateY(${rise}px)`,
      }}
    >
      <div
        style={{
          fontFamily: playfair,
          fontStyle: 'italic',
          fontSize: 72,
          color: '#d4af7a',
          textAlign: 'center',
          padding: '0 120px',
          lineHeight: 1.2,
        }}
      >
        The story continues.
      </div>
      <div style={{ color: 'rgba(212,175,122,0.5)', fontSize: 30, margin: '40px 0' }}>✦</div>
      <div
        style={{
          fontFamily: inter,
          fontWeight: 700,
          letterSpacing: 11,
          fontSize: 38,
          color: '#efe7d4',
        }}
      >
        VELVET VICE
      </div>
      <div
        style={{
          fontFamily: inter,
          fontSize: 23,
          color: 'rgba(239,231,212,0.55)',
          marginTop: 18,
          letterSpacing: 1.5,
        }}
      >
        Read it on the App Store
      </div>
    </AbsoluteFill>
  );
};
