import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { Text } from 'react-native';

const mockReconcile = jest.fn().mockResolvedValue(undefined);
jest.mock('@/notifications/reconcileNotifications', () => ({
  reconcileNotifications: (...args: unknown[]) => mockReconcile(...args),
}));

const mockGetPermissionStatus = jest.fn().mockResolvedValue(true);
jest.mock('@/notifications/notifications', () => ({
  getPermissionStatus: () => mockGetPermissionStatus(),
}));

interface MockSettingsState {
  notificationsEnabled: boolean;
  inactivityNudgeEnabled: boolean;
  notificationMorningTime: string;
}

interface MockLogsState {
  lastSubmitResult: unknown;
}

let mockSettingsState: MockSettingsState = {
  notificationsEnabled: true,
  inactivityNudgeEnabled: false,
  notificationMorningTime: '08:00',
};
let mockLogsState: MockLogsState = { lastSubmitResult: null };

jest.mock('@/state/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: (s: unknown) => unknown) => selector(mockSettingsState)),
}));
jest.mock('@/state/logsStore', () => ({
  useLogsStore: jest.fn((selector: (s: unknown) => unknown) => selector(mockLogsState)),
}));

const mockGetLastLogDay = jest.fn().mockResolvedValue('2026-05-10');
jest.mock('@/storage/repositories/logRepo', () => ({
  getLastLogDay: (...args: unknown[]) => mockGetLastLogDay(...args),
}));
jest.mock('@/storage/db', () => ({
  getDb: () => Promise.resolve({}),
}));

const mockRemove = jest.fn();
const mockAddEventListener = jest
  .spyOn(AppState, 'addEventListener')
  .mockReturnValue({ remove: mockRemove } as unknown as ReturnType<
    typeof AppState.addEventListener
  >);

import { useNotificationSync } from '@/state/hooks/useNotificationSync';

function Probe() {
  useNotificationSync();
  return <Text testID="probe">ok</Text>;
}

describe('useNotificationSync', () => {
  beforeEach(() => {
    mockReconcile.mockClear();
    mockAddEventListener.mockClear();
    mockRemove.mockClear();
    mockGetPermissionStatus.mockClear();
    mockGetPermissionStatus.mockResolvedValue(true);
    mockGetLastLogDay.mockClear();
    mockGetLastLogDay.mockResolvedValue('2026-05-10');
    mockAddEventListener.mockReturnValue({
      remove: mockRemove,
    } as unknown as ReturnType<typeof AppState.addEventListener>);
    mockSettingsState = {
      notificationsEnabled: true,
      inactivityNudgeEnabled: false,
      notificationMorningTime: '08:00',
    };
    mockLogsState = { lastSubmitResult: null };
  });

  it('runs reconcileNotifications on mount with current state', async () => {
    render(<Probe />);
    await act(async () => {});
    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockReconcile.mock.calls[0]![0]).toMatchObject({
      notificationsEnabled: true,
      inactivityNudgeEnabled: false,
      morningTime: '08:00',
      lastLogDay: '2026-05-10',
      permissionGranted: true,
    });
  });

  it('subscribes to AppState change events', () => {
    render(<Probe />);
    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('re-runs reconcileNotifications on AppState "active"', async () => {
    render(<Probe />);
    await act(async () => {});
    mockReconcile.mockClear();
    const handler = mockAddEventListener.mock.calls[0]![1] as (s: string) => void;
    await act(async () => {
      handler('active');
    });
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('does NOT re-run on AppState "background"', async () => {
    render(<Probe />);
    await act(async () => {});
    mockReconcile.mockClear();
    const handler = mockAddEventListener.mock.calls[0]![1] as (s: string) => void;
    await act(async () => {
      handler('background');
    });
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('removes the AppState listener on unmount', () => {
    const view = render(<Probe />);
    view.unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
