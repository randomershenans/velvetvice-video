const XAI_BASE = 'https://api.x.ai/v1';

function key() {
  const k = process.env.GROK_API_KEY;
  if (!k) throw new Error('GROK_API_KEY is not set');
  return k;
}

const STORY_SYSTEM = `You are a scriptwriter for Velvet — an AI-driven interactive romance fiction app — producing complete social-clip packages for TikTok and Instagram Reels. Each output is a self-contained "book": title, subtitle, the hook the narrator reads aloud, and the social caption.

Rules:
- "title": 2 to 5 words. The story's book-cover title. Evocative, sensual, literary — like a real romance novel on the shelf. Examples: "The Lighthouse Keeper", "Borrowed Heat", "The Vow at Midnight". Title case. No subtitle inside the title.
- "subtitle": one short tagline, 4 to 10 words. Sits under the title on the book cover. Adds intrigue without spoiling.
- "body": the spoken hook, 110 to 160 words, 40 to 60 seconds read aloud. First person, present tense. Open mid-moment with tension already in the air. Build through charged detail and what is barely held back. End on a hard cliffhanger — a final line that makes the listener need to know what happens next. Tone: sensual, intimate, literary. The heat comes from tension, proximity, restraint, a held breath, a sentence that stops just short. Social-media safe: suggestive, never explicit. No graphic sexual description, no profanity, no anatomical detail. Aim for the most charged paragraph of a bestselling romance novel, not erotica.
- "caption": a TikTok and Instagram caption, 80 to 140 characters, attention-grabbing first line then 5 to 8 booktok hashtags chosen from: #booktok #romancereading #romance #spicybooks #romanceauthor #romancenovels #booktokromance #romancebooktok #fictionbooks #cliffhanger. Should feel like a real creator's post — curious, breathless, a touch tongue-in-cheek.

Vary the protagonist naturally across batches — sometimes a woman's point of view, sometimes a man's. Let the scene's logic decide.

Return ONLY a single JSON object with exactly these four string keys: title, subtitle, body, caption. No commentary, no code fences, no surrounding prose.`;

export async function generateStory({ vibe, heat }) {
  const res = await fetch(`${XAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grok-3-fast',
      temperature: 0.92,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: STORY_SYSTEM },
        { role: 'user', content: `Vibe / trope / setting: ${vibe}\nHeat level: ${heat}\n\nWrite the package.` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`xAI story failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error('xAI returned an empty response');

  const parsed = parseStoryJson(content);
  return {
    title: clean(parsed.title, 80),
    subtitle: clean(parsed.subtitle, 140),
    body: clean(parsed.body, 1800),
    caption: clean(parsed.caption, 280),
  };
}

// Tolerate code fences or stray text outside the JSON — find the outermost braces.
function parseStoryJson(s) {
  const trimmed = String(s).trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Could not find JSON in xAI response');
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch (e) {
    throw new Error(`Failed to parse story JSON: ${e?.message ?? e}`);
  }
}

function clean(v, max) {
  return String(v ?? '').trim().slice(0, max);
}

// xAI's native TTS endpoint (api.x.ai/v1/tts). The OpenAI-shape
// /v1/audio/speech endpoint returns 403 "team not authorized" on this
// account — use the native /v1/tts which the iOS app already uses
// successfully for Siren-tier narration.
const KNOWN_VOICES = new Set(['eve', 'ara', 'rex', 'sal', 'leo']);
const DEFAULT_VOICE = 'eve';

// xAI caps a single /v1/tts request at 15k characters.
const MAX_TTS_CHARS = 15000;

/** Returns the narration audio as a Buffer (mp3). */
export async function generateAudio(text, voice) {
  const voice_id = KNOWN_VOICES.has(voice) ? voice : DEFAULT_VOICE;
  const res = await fetch(`${XAI_BASE}/tts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text.slice(0, MAX_TTS_CHARS),
      voice_id,
      language: 'en',
    }),
  });
  if (!res.ok) throw new Error(`xAI audio failed (${res.status}): ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}
