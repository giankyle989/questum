const mockScheduleDailyMorning = jest.fn().mockResolvedValue(undefined);
const mockCancelDailyMorning = jest.fn().mockResolvedValue(undefined);
const mockScheduleInactivityNudge = jest.fn().mockResolvedValue(undefined);
const mockCancelInactivityNudge = jest.fn().mockResolvedValue(undefined);

jest.mock('@/notifications/notifications', () => ({
  scheduleDailyMorning: (...args: unknown[]) => mockScheduleDailyMorning(...args),
  cancelDailyMorning: (...args: unknown[]) => mockCancelDailyMorning(...args),
  scheduleInactivityNudge: (...args: unknown[]) => mockScheduleInactivityNudge(...args),
  cancelInactivityNudge: (...args: unknown[]) => mockCancelInactivityNudge(...args),
}));

import { reconcileNotifications } from '@/notifications/reconcileNotifications';

const FIXED_NOW = new Date('2026-05-11T12:00:00').getTime();

describe('reconcileNotifications', () => {
  let dateNowSpy: jest.SpyInstance;

  beforeEach(() => {
    mockScheduleDailyMorning.mockClear();
    mockCancelDailyMorning.mockClear();
    mockScheduleInactivityNudge.mockClear();
    mockCancelInactivityNudge.mockClear();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('cancels everything when permission is not granted', async () => {
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: true,
      morningTime: '08:00',
      lastLogDay: '2026-05-09',
      permissionGranted: false,
    });
    expect(mockCancelDailyMorning).toHaveBeenCalledTimes(1);
    expect(mockCancelInactivityNudge).toHaveBeenCalledTimes(1);
    expect(mockScheduleDailyMorning).not.toHaveBeenCalled();
    expect(mockScheduleInactivityNudge).not.toHaveBeenCalled();
  });

  it('cancels everything when master toggle is off', async () => {
    await reconcileNotifications({
      notificationsEnabled: false,
      inactivityNudgeEnabled: true,
      morningTime: '08:00',
      lastLogDay: '2026-05-09',
      permissionGranted: true,
    });
    expect(mockCancelDailyMorning).toHaveBeenCalledTimes(1);
    expect(mockCancelInactivityNudge).toHaveBeenCalledTimes(1);
    expect(mockScheduleDailyMorning).not.toHaveBeenCalled();
    expect(mockScheduleInactivityNudge).not.toHaveBeenCalled();
  });

  it('schedules daily-morning only when nudge is off', async () => {
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: false,
      morningTime: '07:30',
      lastLogDay: '2026-05-09',
      permissionGranted: true,
    });
    expect(mockCancelDailyMorning).toHaveBeenCalledTimes(1);
    expect(mockScheduleDailyMorning).toHaveBeenCalledWith('07:30');
    expect(mockCancelInactivityNudge).toHaveBeenCalledTimes(1);
    expect(mockScheduleInactivityNudge).not.toHaveBeenCalled();
  });

  it('schedules both when nudge is on and lastLogDay is set', async () => {
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: true,
      morningTime: '08:00',
      lastLogDay: '2026-05-10',
      permissionGranted: true,
    });
    expect(mockScheduleDailyMorning).toHaveBeenCalledWith('08:00');
    expect(mockScheduleInactivityNudge).toHaveBeenCalledTimes(1);
    const target: Date = mockScheduleInactivityNudge.mock.calls[0]![0];
    expect(target).toBeInstanceOf(Date);
    expect(target.getFullYear()).toBe(2026);
    expect(target.getMonth()).toBe(4); // May (0-indexed)
    expect(target.getDate()).toBe(13); // 2026-05-10 + 3
    expect(target.getHours()).toBe(8);
    expect(target.getMinutes()).toBe(0);
  });

  it('schedules daily-morning but skips nudge when lastLogDay is null', async () => {
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: true,
      morningTime: '08:00',
      lastLogDay: null,
      permissionGranted: true,
    });
    expect(mockScheduleDailyMorning).toHaveBeenCalledWith('08:00');
    expect(mockCancelInactivityNudge).toHaveBeenCalledTimes(1);
    expect(mockScheduleInactivityNudge).not.toHaveBeenCalled();
  });

  it('skips inactivity nudge when computed target is in the past', async () => {
    // FIXED_NOW is 2026-05-11. lastLogDay 2026-05-01 + 3 days = 2026-05-04 → past.
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: true,
      morningTime: '08:00',
      lastLogDay: '2026-05-01',
      permissionGranted: true,
    });
    expect(mockScheduleDailyMorning).toHaveBeenCalledWith('08:00');
    expect(mockCancelInactivityNudge).toHaveBeenCalledTimes(1);
    expect(mockScheduleInactivityNudge).not.toHaveBeenCalled();
  });

  it('idempotency: calling twice with same inputs schedules twice (cancel + reschedule)', async () => {
    const input = {
      notificationsEnabled: true,
      inactivityNudgeEnabled: true,
      morningTime: '08:00',
      lastLogDay: '2026-05-10',
      permissionGranted: true,
    };
    await reconcileNotifications(input);
    await reconcileNotifications(input);
    expect(mockCancelDailyMorning).toHaveBeenCalledTimes(2);
    expect(mockScheduleDailyMorning).toHaveBeenCalledTimes(2);
    expect(mockCancelInactivityNudge).toHaveBeenCalledTimes(2);
    expect(mockScheduleInactivityNudge).toHaveBeenCalledTimes(2);
  });

  it('time change reschedules daily-morning with the new time', async () => {
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: false,
      morningTime: '08:00',
      lastLogDay: null,
      permissionGranted: true,
    });
    await reconcileNotifications({
      notificationsEnabled: true,
      inactivityNudgeEnabled: false,
      morningTime: '09:15',
      lastLogDay: null,
      permissionGranted: true,
    });
    expect(mockScheduleDailyMorning).toHaveBeenCalledTimes(2);
    expect(mockScheduleDailyMorning.mock.calls[0]![0]).toBe('08:00');
    expect(mockScheduleDailyMorning.mock.calls[1]![0]).toBe('09:15');
  });
});
