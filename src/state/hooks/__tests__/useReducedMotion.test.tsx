import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { Text } from 'react-native';

const mockRemove = jest.fn();

const mockIsReduceMotionEnabled = jest
  .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
  .mockResolvedValue(false);

const mockAddEventListener = jest
  .spyOn(AccessibilityInfo, 'addEventListener')
  .mockReturnValue({ remove: mockRemove } as unknown as ReturnType<
    typeof AccessibilityInfo.addEventListener
  >);

import { useReducedMotion } from '@/state/hooks/useReducedMotion';

function Probe({ onValue }: { onValue: (v: boolean) => void }) {
  const v = useReducedMotion();
  onValue(v);
  return <Text testID="probe">{String(v)}</Text>;
}

describe('useReducedMotion', () => {
  beforeEach(() => {
    mockIsReduceMotionEnabled.mockClear();
    mockIsReduceMotionEnabled.mockResolvedValue(false);
    mockAddEventListener.mockClear();
    mockAddEventListener.mockReturnValue({
      remove: mockRemove,
    } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);
    mockRemove.mockClear();
  });

  it('initializes with the resolved value of isReduceMotionEnabled', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(true);
    let last = false;
    render(
      <Probe
        onValue={(v) => {
          last = v;
        }}
      />,
    );
    await act(async () => {});
    expect(last).toBe(true);
  });

  it('subscribes to reduceMotionChanged on mount', () => {
    render(<Probe onValue={() => {}} />);
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    expect(mockAddEventListener.mock.calls[0]?.[0]).toBe('reduceMotionChanged');
    expect(typeof mockAddEventListener.mock.calls[0]?.[1]).toBe('function');
  });

  it('updates on reduceMotionChanged events', async () => {
    let last = false;
    render(
      <Probe
        onValue={(v) => {
          last = v;
        }}
      />,
    );
    await act(async () => {});
    const handler = mockAddEventListener.mock.calls[0]?.[1] as unknown as (v: boolean) => void;
    await act(async () => {
      handler(true);
    });
    expect(last).toBe(true);
  });

  it('removes the listener on unmount', () => {
    const view = render(<Probe onValue={() => {}} />);
    view.unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
