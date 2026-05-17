/**
 * The content pool the automated pipeline draws from. Each run picks vibes
 * and voices at random so the daily clips stay varied. Add, remove, or
 * re-weight freely — keep entries social-safe in spirit (the script prompt
 * enforces suggestive-not-explicit regardless).
 */

export const VIBES = [
  { vibe: 'enemies to lovers, rival auction houses, one bidding war too far', heat: 'Steamy' },
  { vibe: 'second chance romance, he comes back to the small coastal town', heat: 'Warm' },
  { vibe: 'forced proximity, snowed into a remote cabin, one fireplace', heat: 'Steamy' },
  { vibe: 'forbidden, she is the bodyguard, he is the one she must not want', heat: 'Steamy' },
  { vibe: 'slow burn, a quiet bookshop, the regular who never buys anything', heat: 'Sweet' },
  { vibe: 'fake dating, a wedding weekend, the lie that stops feeling like one', heat: 'Warm' },
  { vibe: 'boss and employee, the late night the office finally empties', heat: 'Steamy' },
  { vibe: 'friends to lovers, the night before one of them moves away', heat: 'Warm' },
  { vibe: 'age gap, the mentor she was warned about, a rooftop in summer', heat: 'Steamy' },
  { vibe: 'one bed, a storm, a country inn with no other rooms', heat: 'Warm' },
  { vibe: 'arranged marriage, strangers at the altar, a slow thaw', heat: 'Warm' },
  { vibe: 'rivals, two chefs, one kitchen, a competition that turns', heat: 'Steamy' },
  { vibe: 'reunion, ten years later, the lake house where it started', heat: 'Warm' },
  { vibe: 'protector, she pulled him from the wreck, now he will not leave', heat: 'Steamy' },
  { vibe: 'masquerade, a stranger in a borrowed mask, one dance', heat: 'Sweet' },
  { vibe: 'roommates, the unspoken rule, the night it finally breaks', heat: 'Steamy' },
];

export const VOICES = ['aurora', 'lyra', 'iris', 'vale', 'rhett', 'noir'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const pickVibe = () => pick(VIBES);
export const pickVoice = () => pick(VOICES);
