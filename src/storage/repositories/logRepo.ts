import type { Attribute } from '@/game/constants';

export interface LogEntry {
  id: number;
  text: string;
  createdAt: string;
  day: string;
  aiSummary: string;
  primaryAttribute: Attribute;
  totalXp: number;
  confidence: number;
  improvement: boolean;
  aiSource: 'apple' | 'gemini' | 'mock';
  attributeXp: Partial<Record<Attribute, number>>;
}

export interface LogInsert {
  text: string;
  createdAt: string;
  day: string;
  aiSummary: string;
  primaryAttribute: Attribute;
  totalXp: number;
  confidence: number;
  improvement: boolean;
  aiSource: 'apple' | 'gemini' | 'mock';
  attributeXp: Partial<Record<Attribute, number>>;
}

const NOT_IMPL = (name: string): never => {
  throw new Error(`logRepo.${name} not implemented in Phase 1`);
};

export async function insertLog(_input: LogInsert): Promise<LogEntry> {
  return NOT_IMPL('insertLog');
}

export async function getRecentLogs(_limit: number, _offset: number): Promise<LogEntry[]> {
  return NOT_IMPL('getRecentLogs');
}

export async function getLogsByAttribute(
  _attribute: Attribute,
  _limit: number,
  _offset: number,
): Promise<LogEntry[]> {
  return NOT_IMPL('getLogsByAttribute');
}

export async function getLastLogDay(): Promise<string | null> {
  return NOT_IMPL('getLastLogDay');
}

export async function getDailyXpEarned(_day: string): Promise<Partial<Record<Attribute, number>>> {
  return NOT_IMPL('getDailyXpEarned');
}

export async function incrementDailyXpEarned(
  _day: string,
  _gains: Partial<Record<Attribute, number>>,
): Promise<void> {
  NOT_IMPL('incrementDailyXpEarned');
}

export async function pruneDailyXpOlderThanDays(_days: number): Promise<void> {
  NOT_IMPL('pruneDailyXpOlderThanDays');
}
