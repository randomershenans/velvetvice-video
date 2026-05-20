/**
 * Expressive narration markup for xAI grok-tts (api.x.ai/v1/tts).
 *
 * xAI parses inline speech tags. We use the documented ones:
 *   <whisper>...</whisper>   intimate, low-volume delivery
 *   <soft>...</soft>          gentle, hushed delivery
 *   [pause]                   short beat
 *   [long-pause]              longer beat
 *   [breath]                  audible breath
 *
 * Any tag the model doesn't recognise is harmless — worst case it's ignored.
 */

const VERB_TO_TAG = [
  // Whisper-class — low-volume, intimate dialogue
  {
    pattern: /\b(whispered|murmured|breathed|hissed under (?:his|her|their) breath|mouthed)\b/i,
    tag: 'whisper',
  },
  // Soft / breathy delivery — applied to the dialogue itself in addition
  // to the whole-narration <soft> wrap below
  {
    pattern:
      /\b(moaned|gasped|panted|sighed|exhaled|shuddered|trembled|trailed off|said quietly|said softly)\b/i,
    tag: 'soft',
  },
];

function applyVerbTags(text) {
  // Match a quoted line followed within ~80 chars by an emotive verb.
  return text.replace(/"([^"]+?)"([^"]{0,80})/g, (whole, dialogue, after) => {
    for (const { pattern, tag } of VERB_TO_TAG) {
      if (pattern.test(after)) {
        return `<${tag}>"${dialogue}"</${tag}>${after}`;
      }
    }
    return whole;
  });
}

function applyPauses(text) {
  return (
    text
      // Trailing thoughts: long pause.
      .replace(/\.{3,}/g, ' [long-pause] ')
      // Mid-word em-dash: short beat (caught breath).
      .replace(/(\w)—(\w)/g, '$1 [pause] $2')
      // Sentence breaks: short beat for deliberate pacing.
      .replace(/([.!?])\s+(?=[A-Z"])/g, '$1 [pause] ')
  );
}

function applySighs(text) {
  // Audible breath after a sigh verb that precedes a quote.
  return text.replace(
    /(sighed|exhaled slowly|let out a (?:long )?breath)([^.]*?)"([^"]+)"/gi,
    (_w, verb, mid, quote) => `${verb}${mid}[breath] "${quote}"`,
  );
}

/**
 * Turn the narration body into TTS-ready text:
 *   1. Expressive verb tags around dialogue (whisper / soft).
 *   2. Pauses on ellipses, em-dashes, and sentence boundaries.
 *   3. Audible breath after sigh verbs.
 *   4. Wrap the whole hook in <soft> so the voice stays hushed throughout —
 *      the felt, intimate register we want for romance social clips.
 */
export function expressifyForTTS(text) {
  const inner = applyPauses(applySighs(applyVerbTags(text)));
  return `<soft>${inner}</soft>`;
}
