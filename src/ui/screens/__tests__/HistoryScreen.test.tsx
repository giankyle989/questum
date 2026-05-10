import { fireEvent, render } from '@testing-library/react-native';

import type { Attribute } from '@/game/constants';
import type { LogEntry } from '@/storage/repositories/logRepo';

interface MockLogsState {
  logs: LogEntry[];
}

function makeLog(overrides: Partial<LogEntry> & Pick<LogEntry, 'id'>): LogEntry {
  const attribute: Attribute = overrides.primaryAttribute ?? 'CON';
  return {
    id: overrides.id,
    text: overrides.text ?? 'Default log text',
    createdAt: overrides.createdAt ?? '2026-05-08T07:00:00.000Z',
    day: overrides.day ?? '2026-05-08',
    aiSummary: overrides.aiSummary ?? 'Default summary',
    primaryAttribute: attribute,
    totalXp: overrides.totalXp ?? 30,
    confidence: overrides.confidence ?? 0.9,
    improvement: overrides.improvement ?? false,
    aiSource: overrides.aiSource ?? 'mock',
    attributeXp: overrides.attributeXp ?? { [attribute]: overrides.totalXp ?? 30 },
  };
}

const defaultLogs: LogEntry[] = [
  makeLog({
    id: 1,
    text: 'Ran 5km this morning before work',
    aiSummary: 'Morning run',
    primaryAttribute: 'STR',
    totalXp: 40,
    attributeXp: { STR: 30, CON: 10 },
  }),
  makeLog({
    id: 2,
    text: 'Drank 2L of water and ate a salad',
    aiSummary: 'Hydration + healthy lunch',
    primaryAttribute: 'CON',
    totalXp: 25,
    attributeXp: { CON: 25 },
  }),
  makeLog({
    id: 3,
    text: 'Slept 8 hours, woke up rested',
    aiSummary: 'Full night of sleep',
    primaryAttribute: 'CON',
    totalXp: 20,
    attributeXp: { CON: 20 },
  }),
];

let mockLogsState: MockLogsState = { logs: [...defaultLogs] };

jest.mock('@/state/logsStore', () => ({
  useLogsStore: jest.fn((selector: (s: unknown) => unknown) => selector(mockLogsState)),
}));

import HistoryScreen from '@/ui/screens/HistoryScreen';

describe('HistoryScreen', () => {
  beforeEach(() => {
    mockLogsState = { logs: defaultLogs.map((l) => ({ ...l })) };
  });

  it('renders all 3 log rows', () => {
    const { getByTestId } = render(<HistoryScreen />);
    expect(getByTestId('log-row-1')).toBeTruthy();
    expect(getByTestId('log-row-2')).toBeTruthy();
    expect(getByTestId('log-row-3')).toBeTruthy();
  });

  it('renders 7 filter pills (All + 6 attributes)', () => {
    const { getByTestId } = render(<HistoryScreen />);
    expect(getByTestId('filter-pill-all')).toBeTruthy();
    expect(getByTestId('filter-pill-STR')).toBeTruthy();
    expect(getByTestId('filter-pill-DEX')).toBeTruthy();
    expect(getByTestId('filter-pill-CON')).toBeTruthy();
    expect(getByTestId('filter-pill-INT')).toBeTruthy();
    expect(getByTestId('filter-pill-WIS')).toBeTruthy();
    expect(getByTestId('filter-pill-CHA')).toBeTruthy();
  });

  it('pressing the CON pill hides the STR log and keeps the 2 CON logs', () => {
    const { getByTestId, queryByTestId } = render(<HistoryScreen />);
    fireEvent.press(getByTestId('filter-pill-CON'));
    expect(queryByTestId('log-row-1')).toBeNull();
    expect(getByTestId('log-row-2')).toBeTruthy();
    expect(getByTestId('log-row-3')).toBeTruthy();
  });

  it('pressing the All pill after a filter shows all 3 logs again', () => {
    const { getByTestId, queryByTestId } = render(<HistoryScreen />);
    fireEvent.press(getByTestId('filter-pill-CON'));
    expect(queryByTestId('log-row-1')).toBeNull();
    fireEvent.press(getByTestId('filter-pill-all'));
    expect(getByTestId('log-row-1')).toBeTruthy();
    expect(getByTestId('log-row-2')).toBeTruthy();
    expect(getByTestId('log-row-3')).toBeTruthy();
  });

  it('pressing a log row reveals the expanded full text', () => {
    const { getByTestId, queryByText, getByText } = render(<HistoryScreen />);
    expect(queryByText('Ran 5km this morning before work')).toBeNull();
    fireEvent.press(getByTestId('log-row-1'));
    expect(getByText('Ran 5km this morning before work')).toBeTruthy();
  });

  it('pressing the same expanded row again hides the expanded content', () => {
    const { getByTestId, queryByText, getByText } = render(<HistoryScreen />);
    fireEvent.press(getByTestId('log-row-1'));
    expect(getByText('Ran 5km this morning before work')).toBeTruthy();
    fireEvent.press(getByTestId('log-row-1'));
    expect(queryByText('Ran 5km this morning before work')).toBeNull();
  });
});
