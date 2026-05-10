import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { Text } from 'react-native';

const mockRemove = jest.fn();
const mockAddEventListener = jest.spyOn(AppState, 'addEventListener').mockReturnValue({
  remove: mockRemove,
} as unknown as ReturnType<typeof AppState.addEventListener>);

const mockRunProbe = jest.fn(async () => {});
jest.mock('@/state/aiAvailabilityStore', () => ({
  useAIAvailabilityStore: {
    getState: () => ({ runProbe: mockRunProbe }),
  },
}));

import { useAIAvailabilityProbe } from '@/state/hooks/useAIAvailabilityProbe';

function Probe() {
  useAIAvailabilityProbe();
  return <Text testID="probe-host">ok</Text>;
}

describe('useAIAvailabilityProbe', () => {
  beforeEach(() => {
    mockAddEventListener.mockClear();
    mockRemove.mockClear();
    mockRunProbe.mockClear();
    mockAddEventListener.mockReturnValue({
      remove: mockRemove,
    } as unknown as ReturnType<typeof AppState.addEventListener>);
  });

  it('runs the probe on mount', async () => {
    render(<Probe />);
    // runProbe is fired inside an effect — let microtasks flush.
    await act(async () => {});
    expect(mockRunProbe).toHaveBeenCalledTimes(1);
  });

  it('subscribes to AppState change events', () => {
    render(<Probe />);
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    expect(mockAddEventListener.mock.calls[0]?.[0]).toBe('change');
    expect(typeof mockAddEventListener.mock.calls[0]?.[1]).toBe('function');
  });

  it('re-runs the probe when AppState transitions to "active"', async () => {
    render(<Probe />);
    await act(async () => {});
    mockRunProbe.mockClear();

    const handler = mockAddEventListener.mock.calls[0]?.[1] as (s: string) => void;
    await act(async () => {
      handler('active');
    });
    expect(mockRunProbe).toHaveBeenCalledTimes(1);

    await act(async () => {
      handler('background');
    });
    expect(mockRunProbe).toHaveBeenCalledTimes(1); // still 1, no extra call

    await act(async () => {
      handler('inactive');
    });
    expect(mockRunProbe).toHaveBeenCalledTimes(1); // still 1
  });

  it('removes the listener on unmount', () => {
    const view = render(<Probe />);
    view.unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
