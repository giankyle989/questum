import type { AIService } from '@/ai/AIService';
import { MockAIService } from '@/ai/MockAIService';
import { useSettingsStore } from '@/state/settingsStore';

let cached: AIService | null = null;

/**
 * Returns the AI service for the current device. Phase 4: only `MockAIService`
 * exists. Phase 5 branches here on `Platform.OS` to return `AppleAIService`,
 * `GeminiNanoService`, or fall back to Mock — the cache layer is unchanged.
 */
export function getAIService(): AIService {
  if (cached) return cached;
  cached = new MockAIService();
  return cached;
}

export interface ProbeResult {
  available: boolean;
  displayName: string;
}

/**
 * Asks the active service "are you usable right now?" Honors a `__DEV__`-only
 * override from `settingsStore.devForceAIUnavailable` so the developer can
 * exercise the AI-unavailable banner without a real failure. Treats a thrown
 * `isAvailable()` as unavailable (Phase 5: Apple's API can throw if the OS
 * runtime isn't installed).
 */
export async function probeAIAvailability(): Promise<ProbeResult> {
  const service = getAIService();
  if (__DEV__ && useSettingsStore.getState().devForceAIUnavailable) {
    return { available: false, displayName: service.displayName };
  }
  try {
    const available = await service.isAvailable();
    return { available, displayName: service.displayName };
  } catch {
    return { available: false, displayName: service.displayName };
  }
}

/** Test-only: clears the cached service so each test gets a fresh instance. */
export function __resetFactoryForTests(): void {
  cached = null;
}
