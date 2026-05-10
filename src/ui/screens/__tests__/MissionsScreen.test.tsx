import { render } from '@testing-library/react-native';

import type { Mission } from '@/storage/repositories/missionRepo';

interface MockMissionsState {
  active: Mission[];
  recentlyCompleted: Mission[];
  loading: boolean;
}

function makeMission(overrides: Partial<Mission> & Pick<Mission, 'id'>): Mission {
  return {
    id: overrides.id,
    templateId: overrides.templateId ?? 'tpl-default',
    description: overrides.description ?? 'Default description',
    attribute: overrides.attribute ?? 'CON',
    type: overrides.type ?? 'daily',
    bonusXp: overrides.bonusXp ?? 25,
    progress: overrides.progress ?? 0,
    target: overrides.target ?? 1,
    status: overrides.status ?? 'active',
    generatedAt: overrides.generatedAt ?? '2026-05-08T08:00:00.000Z',
    generatedFor: overrides.generatedFor ?? '2026-05-08',
    expiresAt: overrides.expiresAt ?? '',
    completedAt: overrides.completedAt ?? null,
  };
}

const defaultState: MockMissionsState = {
  active: [
    makeMission({
      id: 'daily-con',
      templateId: 'tpl-con-1',
      description: 'Drink 2L of water',
      attribute: 'CON',
      type: 'daily',
    }),
    makeMission({
      id: 'daily-int',
      templateId: 'tpl-int-1',
      description: 'Read for 20 minutes',
      attribute: 'INT',
      type: 'daily',
    }),
    makeMission({
      id: 'daily-cha',
      templateId: 'tpl-cha-1',
      description: 'Reach out to a friend',
      attribute: 'CHA',
      type: 'daily',
    }),
    makeMission({
      id: 'weekly-str',
      templateId: 'tpl-str-w',
      description: 'Complete 3 strength workouts this week',
      attribute: 'STR',
      type: 'weekly',
      bonusXp: 100,
      generatedFor: '2026-05-04',
    }),
  ],
  recentlyCompleted: [
    makeMission({
      id: 'completed-dex',
      templateId: 'tpl-dex-1',
      description: 'Take a 30 minute walk',
      attribute: 'DEX',
      type: 'daily',
      status: 'completed',
      completedAt: '2026-05-07T18:30:00.000Z',
      generatedFor: '2026-05-07',
    }),
    makeMission({
      id: 'completed-wis',
      templateId: 'tpl-wis-1',
      description: 'Meditate for 10 minutes',
      attribute: 'WIS',
      type: 'daily',
      status: 'completed',
      completedAt: '2026-05-06T07:15:00.000Z',
      generatedFor: '2026-05-06',
    }),
  ],
  loading: false,
};

let mockMissionsState: MockMissionsState = { ...defaultState };

jest.mock('@/state/missionsStore', () => ({
  useMissionsStore: jest.fn((selector: (s: unknown) => unknown) => selector(mockMissionsState)),
}));

import MissionsScreen from '@/ui/screens/MissionsScreen';

describe('MissionsScreen', () => {
  beforeEach(() => {
    mockMissionsState = {
      active: defaultState.active.map((m) => ({ ...m })),
      recentlyCompleted: defaultState.recentlyCompleted.map((m) => ({ ...m })),
      loading: defaultState.loading,
    };
  });

  it('renders the "Active" section header', () => {
    const { getByText } = render(<MissionsScreen />);
    expect(getByText('Active')).toBeTruthy();
  });

  it('renders all 4 active missions (3 daily + 1 weekly)', () => {
    const { getByTestId } = render(<MissionsScreen />);
    expect(getByTestId('mission-card-daily-con')).toBeTruthy();
    expect(getByTestId('mission-card-daily-int')).toBeTruthy();
    expect(getByTestId('mission-card-daily-cha')).toBeTruthy();
    expect(getByTestId('mission-card-weekly-str')).toBeTruthy();
  });

  it('renders the "Completed" section header', () => {
    const { getByText } = render(<MissionsScreen />);
    expect(getByText('Completed')).toBeTruthy();
  });

  it('renders 2 completed mission entries', () => {
    const { getByTestId } = render(<MissionsScreen />);
    expect(getByTestId('mission-card-completed-dex')).toBeTruthy();
    expect(getByTestId('mission-card-completed-wis')).toBeTruthy();
  });

  it('shows each active mission description text', () => {
    const { getByText } = render(<MissionsScreen />);
    expect(getByText('Drink 2L of water')).toBeTruthy();
    expect(getByText('Read for 20 minutes')).toBeTruthy();
    expect(getByText('Reach out to a friend')).toBeTruthy();
    expect(getByText('Complete 3 strength workouts this week')).toBeTruthy();
  });
});
