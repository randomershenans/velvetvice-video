const XAI_BASE = 'https://api.x.ai/v1';

function key() {
  const k = process.env.GROK_API_KEY;
  if (!k) throw new Error('GROK_API_KEY is not set');
  return k;
}

const SCRIPT_SYSTEM = `You are a scriptwriter for VelvetVice, a romance fiction app. You write short audio hooks for TikTok and Instagram Reels — the kind that stop a scroll.

Each hook is 110 to 160 words, roughly 40 to 60 seconds read aloud. Structure: open mid-moment with tension already in the air, build through charged detail and what is barely held back, and end on a hard cliffhanger — a final line that makes the listener need to know what happens next.

Tone: sensual, intimate, literary. The heat comes from tension, proximity, restraint, a held breath, a sentence that stops just short. This must be social-media safe: suggestive, never explicit. No graphic sexual description, no profanity, no anatomical detail. Aim for the most charged paragraph of a bestselling romance novel, not erotica.

Write in first person, present tense. Return only the hook text — no title, no narrator notes, no quotation marks around the whole thing.`;

export async function generateScript({ vibe, heat }) {
  const res = await fetch(`${XAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grok-3-fast',
      temperature: 0.92,
      max_tokens: 360,
      messages: [
        { role: 'system', content: SCRIPT_SYSTEM },
        { role: 'user', content: `Vibe / trope / setting: ${vibe}\nHeat level: ${heat}\n\nWrite the hook.` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`xAI script failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('xAI returned an empty script');
  return String(text).trim();
}

const KNOWN_VOICES = new Set(['aurora', 'lyra', 'iris', 'vale', 'rhett', 'noir']);

/** Returns the narration audio as a Buffer (mp3). */
export async function generateAudio(text, voice) {
  const safeVoice = KNOWN_VOICES.has(voice) ? voice : 'aurora';
  const res = await fetch(`${XAI_BASE}/audio/speech`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grok-tts',
      input: text.slice(0, 2400),
      voice: safeVoice,
      response_format: 'mp3',
    }),
  });
  if (!res.ok) throw new Error(`xAI audio failed (${res.status}): ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}
