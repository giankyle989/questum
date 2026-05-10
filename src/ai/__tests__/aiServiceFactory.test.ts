import { MockAIService } from '@/ai/MockAIService';
import { useSettingsStore } from '@/state/settingsStore';

import { __resetFactoryForTests, getAIService, probeAIAvailability } from '@/ai/aiServiceFactory';

describe('aiServiceFactory', () => {
  beforeEach(() => {
    __resetFactoryForTests();
    // Reset the dev override on each test. Reach into the store directly so we
    // don't hit SQLite (no `getDb` in this jest.config.js node env).
    useSettingsStore.setState({ devForceAIUnavailable: false });
  });

  describe('getAIService', () => {
    it('returns a MockAIService instance', () => {
      const service = getAIService();
      expect(service).toBeInstanceOf(MockAIService);
    });

    it('returns the same instance on repeated calls (cache)', () => {
      const a = getAIService();
      const b = getAIService();
      expect(a).toBe(b);
    });

    it('rebuilds after __resetFactoryForTests', () => {
      const a = getAIService();
      __resetFactoryForTests();
      const b = getAIService();
      expect(a).not.toBe(b);
      expect(b).toBeInstanceOf(MockAIService);
    });
  });

  describe('probeAIAvailability', () => {
    it('returns available=true and Mock displayName when override is off', async () => {
      const result = await probeAIAvailability();
      expect(result).toEqual({ available: true, displayName: 'Mock (development)' });
    });

    it('returns available=false when __DEV__ and devForceAIUnavailable are both true', async () => {
      // jest sets __DEV__ to true by default; verify guard
      expect(__DEV__).toBe(true);
      useSettingsStore.setState({ devForceAIUnavailable: true });
      const result = await probeAIAvailability();
      expect(result.available).toBe(false);
      expect(result.displayName).toBe('Mock (development)');
    });

    it('treats a thrown isAvailable() as unavailable', async () => {
      const service = getAIService();
      const spy = jest
        .spyOn(service, 'isAvailable')
        .mockRejectedValueOnce(new Error('OS API missing'));
      const result = await probeAIAvailability();
      expect(result.available).toBe(false);
      expect(result.displayName).toBe('Mock (development)');
      spy.mockRestore();
    });
  });
});
