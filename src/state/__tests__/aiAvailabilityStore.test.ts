import { __resetFactoryForTests } from '@/ai/aiServiceFactory';
import { useSettingsStore } from '@/state/settingsStore';

import { useAIAvailabilityStore } from '@/state/aiAvailabilityStore';

describe('aiAvailabilityStore', () => {
  beforeEach(() => {
    __resetFactoryForTests();
    useSettingsStore.setState({ devForceAIUnavailable: false });
    useAIAvailabilityStore.setState({
      available: true,
      displayName: 'On-device AI',
      lastProbedAt: null,
      probing: false,
    });
  });

  it('initializes with optimistic available=true and a placeholder displayName', () => {
    const state = useAIAvailabilityStore.getState();
    expect(state.available).toBe(true);
    expect(state.displayName).toBe('On-device AI');
    expect(state.lastProbedAt).toBeNull();
    expect(state.probing).toBe(false);
  });

  it('runProbe writes the factory result and timestamps lastProbedAt', async () => {
    const before = Date.now();
    await useAIAvailabilityStore.getState().runProbe();
    const after = Date.now();
    const state = useAIAvailabilityStore.getState();
    expect(state.available).toBe(true);
    expect(state.displayName).toBe('Mock (development)');
    expect(state.probing).toBe(false);
    expect(state.lastProbedAt).not.toBeNull();
    expect(state.lastProbedAt!).toBeGreaterThanOrEqual(before);
    expect(state.lastProbedAt!).toBeLessThanOrEqual(after);
  });

  it('runProbe surfaces unavailability when the dev override is on', async () => {
    useSettingsStore.setState({ devForceAIUnavailable: true });
    await useAIAvailabilityStore.getState().runProbe();
    expect(useAIAvailabilityStore.getState().available).toBe(false);
  });

  it('setAvailability writes fields without calling the factory', () => {
    useAIAvailabilityStore.getState().setAvailability({
      available: false,
      displayName: 'X',
    });
    const state = useAIAvailabilityStore.getState();
    expect(state.available).toBe(false);
    expect(state.displayName).toBe('X');
    expect(state.lastProbedAt).not.toBeNull();
  });
});
