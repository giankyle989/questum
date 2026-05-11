import { dailyMorningCopy, inactivityNudgeCopy, parseHHMM } from '@/notifications/notificationCopy';

describe('notificationCopy', () => {
  describe('dailyMorningCopy', () => {
    it('returns the daily-morning title and body', () => {
      expect(dailyMorningCopy()).toEqual({
        title: 'Time to log your day',
        body: 'What did you do? A quick log keeps your character growing.',
      });
    });
  });

  describe('inactivityNudgeCopy', () => {
    it('returns the inactivity-nudge title and body', () => {
      expect(inactivityNudgeCopy()).toEqual({
        title: 'Your character is waiting',
        body: "It's been a few days. Got something to log?",
      });
    });
  });

  describe('parseHHMM', () => {
    it('parses standard times', () => {
      expect(parseHHMM('07:30')).toEqual({ hour: 7, minute: 30 });
    });

    it('parses midnight', () => {
      expect(parseHHMM('00:00')).toEqual({ hour: 0, minute: 0 });
    });

    it('parses end of day', () => {
      expect(parseHHMM('23:59')).toEqual({ hour: 23, minute: 59 });
    });

    it('throws on malformed input', () => {
      expect(() => parseHHMM('not-a-time')).toThrow();
      expect(() => parseHHMM('25:00')).toThrow();
      expect(() => parseHHMM('07:60')).toThrow();
      expect(() => parseHHMM('7:30')).toThrow(); // requires zero-padding
      expect(() => parseHHMM('')).toThrow();
    });
  });
});
