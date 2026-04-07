/**
 * Message Validation
 * Only blocks if the player says the exact keyword itself.
 * Players should be free to give hints — just not say the word directly.
 */

function validateMessage(text, crewWord, imposterWord) {
  const trimmed = text.trim();

  if (!trimmed || trimmed.length < 2) {
    return { valid: false, reason: 'Message is too short.' };
  }
  if (trimmed.length > 200) {
    return { valid: false, reason: 'Message is too long (max 200 chars).' };
  }

  // Only block the exact keyword (whole-word match, case-insensitive)
  for (const word of [crewWord, imposterWord]) {
    if (!word) continue;
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(trimmed)) {
      return {
        valid: false,
        reason: `❌ Don't say the actual word "${word}" — give a hint instead!`,
      };
    }
  }

  return { valid: true };
}

module.exports = { validateMessage };
