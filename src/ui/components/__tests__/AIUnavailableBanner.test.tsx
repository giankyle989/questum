import { fireEvent, render } from '@testing-library/react-native';

const mockOpenSettings = jest.fn(async () => {});

jest.mock('expo-linking', () => ({
  openSettings: () => mockOpenSettings(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

interface MockAvailabilityState {
  available: boolean;
  displayName: string;
}

let mockState: MockAvailabilityState = { available: true, displayName: 'Mock (development)' };

jest.mock('@/state/aiAvailabilityStore', () => {
  const useAIAvailabilityStore = jest.fn((selector: (s: unknown) => unknown) =>
    selector(mockState),
  );
  return { useAIAvailabilityStore };
});

import { AIUnavailableBanner } from '@/ui/components/AIUnavailableBanner';

describe('AIUnavailableBanner', () => {
  beforeEach(() => {
    mockOpenSettings.mockClear();
    mockState = { available: true, displayName: 'Mock (development)' };
  });

  it('renders nothing when AI is available', () => {
    const { queryByTestId } = render(<AIUnavailableBanner />);
    expect(queryByTestId('ai-unavailable-banner')).toBeNull();
  });

  it('renders title, body, and Open Settings affordance when unavailable', () => {
    mockState = { available: false, displayName: 'Mock (development)' };
    const { getByTestId } = render(<AIUnavailableBanner />);
    expect(getByTestId('ai-unavailable-banner')).toBeTruthy();
    expect(getByTestId('ai-unavailable-banner-title').props.children).toBe(
      'On-device AI is currently unavailable',
    );
    expect(getByTestId('ai-unavailable-banner-body').props.children).toBe(
      'Enable Apple Intelligence in Settings to log activities.',
    );
    expect(getByTestId('ai-unavailable-banner-open-settings')).toBeTruthy();
  });

  it('calls Linking.openSettings when the Open Settings affordance is tapped', () => {
    mockState = { available: false, displayName: 'Mock (development)' };
    const { getByTestId } = render(<AIUnavailableBanner />);
    fireEvent.press(getByTestId('ai-unavailable-banner-open-settings'));
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
  });
});
