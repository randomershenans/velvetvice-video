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

export const COVER_FRAMES = 75; // 2.5s — cover holds before the page turn
export const TURN_FRAMES = 24; // 0.8s — cover rotates upward, revealing the page
export const CTA_OVERLAP = 18; // CTA fades up during the last 18 frames of narration
export const CTA_TAIL = 90; // 3.0s of CTA after narration ends
export const THUMBNAIL_FRAME = 30; // frame used for the cover-still thumbnail

export type ClipProps = {
  title: string;
  subtitle: string;
  body: string;
  audioFile: string;
  narrationFrames: number;
};

const GOLD = '#d4af7a';
const GOLD_DIM = 'rgba(212,175,122,0.55)';
const PARCHMENT = '#efe7d4';

/**
 * A vertical (1080x1920) social clip:
 *   1. Book cover scene — the AI-named title + subtitle, gold-on-velvet.
 *   2. Page-turn animation — the cover hinges upward and away.
 *   3. Book page — the narration plays while the story text scrolls.
 *   4. CTA — branded fade with the download line.
 *
 * The page and CTA both consume their own sub-time, so the composition's
 * total duration is computed by Root.tsx from narrationFrames + the fixed
 * cover, turn, and CTA tails.
 */
export const ClipVideo: React.FC<ClipProps> = ({ title, subtitle, body, audioFile, narrationFrames }) => {
  const pageStart = COVER_FRAMES + TURN_FRAMES;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0c0a10' }}>
      <BackgroundGradient />

      {/* Book cover (with turn animation in its tail) */}
      <Sequence from={0} durationInFrames={pageStart}>
        <BookCover title={title} subtitle={subtitle} />
      </Sequence>

      {/* Book page — narration audio + scrolling text */}
      <Sequence from={pageStart} durationInFrames={narrationFrames}>
        <BookPage body={body} narrationFrames={narrationFrames} />
        <Audio src={staticFile(audioFile)} />
      </Sequence>

      {/* CTA fade — starts overlapping the last frames of narration */}
      <Sequence from={pageStart + narrationFrames - CTA_OVERLAP} durationInFrames={CTA_TAIL + CTA_OVERLAP}>
        <CTAFade />
      </Sequence>
    </AbsoluteFill>
  );
};

const BackgroundGradient: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(900px circle at 50% 10%, rgba(96,42,82,0.55), transparent 62%), ' +
        'radial-gradient(700px circle at 50% 104%, rgba(150,95,55,0.18), transparent 60%), ' +
        'linear-gradient(180deg, #1b0f20, #0c0a10 72%)',
    }}
  />
);

const BookCover: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();

  // Entry: rise + fade up over the first ~0.5s.
  const entry = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const lift = interpolate(frame, [0, 18], [40, 0], { extrapolateRight: 'clamp' });

  // Turn: cover hinges upward from the top edge in the final TURN_FRAMES.
  const turnStart = COVER_FRAMES;
  const rotateX = interpolate(frame, [turnStart, turnStart + TURN_FRAMES], [0, -118], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Cover fades as it rotates past ~80deg so the back-side never flashes.
  const turnFade = interpolate(frame, [turnStart + TURN_FRAMES * 0.7, turnStart + TURN_FRAMES], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ perspective: 1800, justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          width: 760,
          height: 1100,
          background:
            'linear-gradient(155deg, #1c1018 0%, #110a14 38%, #1c1018 75%, #261521 100%)',
          border: '1px solid rgba(212,175,122,0.32)',
          boxShadow:
            '0 50px 110px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(212,175,122,0.08), inset 0 0 80px rgba(0,0,0,0.45)',
          borderRadius: 8,
          padding: '90px 88px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 30,
          transformStyle: 'preserve-3d',
          transformOrigin: 'top center',
          transform: `translateY(${lift}px) rotateX(${rotateX}deg)`,
          opacity: entry * turnFade,
          backfaceVisibility: 'hidden',
        }}
      >
        <div
          style={{
            fontFamily: inter,
            fontWeight: 700,
            letterSpacing: 8,
            fontSize: 19,
            color: GOLD_DIM,
          }}
        >
          VELVET
        </div>
        <div style={{ width: 90, height: 1, background: 'rgba(212,175,122,0.4)' }} />

        <div
          style={{
            fontFamily: playfair,
            fontStyle: 'italic',
            fontSize: 78,
            color: GOLD,
            textAlign: 'center',
            lineHeight: 1.12,
            letterSpacing: 0.5,
          }}
        >
          {title || 'Velvet'}
        </div>

        {subtitle ? (
          <div
            style={{
              fontFamily: inter,
              fontSize: 26,
              color: 'rgba(239,231,212,0.72)',
              textAlign: 'center',
              maxWidth: 560,
              lineHeight: 1.45,
              letterSpacing: 0.8,
            }}
          >
            {subtitle}
          </div>
        ) : null}

        <div style={{ height: 8 }} />
        <div style={{ color: 'rgba(212,175,122,0.5)', fontSize: 24 }}>✦</div>
      </div>
    </AbsoluteFill>
  );
};

const BookPage: React.FC<{ body: string; narrationFrames: number }> = ({ body, narrationFrames }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const textRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState(0);
  const [handle] = useState(() => delayRender('measuring story text'));

  useEffect(() => {
    if (textRef.current) {
      setContentH(textRef.current.getBoundingClientRect().height);
    }
    continueRender(handle);
  }, [handle]);

  // Text scrolls upward over the narration, settling its last line around 60% screen height.
  const startY = height * 0.32;
  const endY = height * 0.6 - contentH;
  const translateY = interpolate(frame, [0, narrationFrames], [startY, Math.min(startY, endY)], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(
    frame,
    [narrationFrames - 22, narrationFrames + 8],
    [1, 0.12],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const clean = body.trim();
  const dropCap = clean.charAt(0);
  const rest = clean.slice(1);

  const COLUMN_MARGIN = 96;
  const TEXT_SIZE = 60;
  const LINE_HEIGHT = 1.52;

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <div
        style={{
          position: 'absolute',
          top: 78,
          width: '100%',
          textAlign: 'center',
          fontFamily: inter,
          fontWeight: 700,
          letterSpacing: 9,
          fontSize: 26,
          color: 'rgba(212,175,122,0.55)',
        }}
      >
        VELVET
      </div>

      <div
        style={{
          position: 'absolute',
          left: COLUMN_MARGIN,
          right: COLUMN_MARGIN,
          top: 0,
          transform: `translateY(${translateY}px)`,
        }}
      >
        <div
          ref={textRef}
          style={{
            fontFamily: playfair,
            fontSize: TEXT_SIZE,
            lineHeight: LINE_HEIGHT,
            color: PARCHMENT,
            letterSpacing: 0.2,
          }}
        >
          <span
            style={{
              fontFamily: playfair,
              fontSize: TEXT_SIZE * 2.6,
              lineHeight: 0.78,
              color: GOLD,
              float: 'left',
              marginRight: 16,
              marginTop: 14,
            }}
          >
            {dropCap}
          </span>
          {rest}
        </div>
      </div>

      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 220,
            background: 'linear-gradient(180deg,#0c0a10,transparent)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 260,
            background: 'linear-gradient(0deg,#0c0a10,transparent)',
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CTAFade: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 28], [0, 1], { extrapolateRight: 'clamp' });
  const rise = interpolate(frame, [0, 34], [22, 0], { extrapolateRight: 'clamp' });

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
          fontSize: 64,
          color: GOLD,
          textAlign: 'center',
          padding: '0 110px',
          lineHeight: 1.25,
        }}
      >
        Steer the story
        <br />
        whichever way you want.
      </div>
      <div style={{ color: 'rgba(212,175,122,0.5)', fontSize: 28, margin: '38px 0' }}>✦</div>
      <div
        style={{
          fontFamily: inter,
          fontWeight: 700,
          letterSpacing: 11,
          fontSize: 40,
          color: PARCHMENT,
        }}
      >
        VELVET
      </div>
      <div
        style={{
          fontFamily: inter,
          fontSize: 22,
          color: 'rgba(239,231,212,0.6)',
          marginTop: 22,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
        }}
      >
        Download today
      </div>
    </AbsoluteFill>
  );
};
