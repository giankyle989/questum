/**
 * Pure copy strings + a small parser for the "HH:MM" time format used in the
 * settings store. Kept separate from `notifications.ts` so the strings can be
 * unit-tested without pulling in `expo-notifications` (which doesn't load in
 * the node-env jest runner).
 */

export const dailyMorningCopy = (): { title: string; body: string } => ({
  title: 'Time to log your day',
  body: 'What did you do? A quick log keeps your character growing.',
});

export const inactivityNudgeCopy = (): { title: string; body: string } => ({
  title: 'Your character is waiting',
  body: "It's been a few days. Got something to log?",
});

const HHMM_RE = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;

export function parseHHMM(s: string): { hour: number; minute: number } {
  const match = HHMM_RE.exec(s);
  if (!match) {
    throw new Error(`parseHHMM: invalid HH:MM string ${JSON.stringify(s)}`);
  }
  // Regex groups are guaranteed by the match above.
  return { hour: Number(match[1]), minute: Number(match[2]) };
}
