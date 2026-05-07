import type { Attribute } from '@/game/constants';

export interface Character {
  id: 1;
  name: string;
  avatarId: string;
  createdAt: string;
}

export interface AttributeState {
  attribute: Attribute;
  level: number;
  inProgressXp: number;
}

export interface Streak {
  currentLength: number;
  longestLength: number;
}

const NOT_IMPL = (name: string): never => {
  throw new Error(`characterRepo.${name} not implemented in Phase 1`);
};

export async function getCharacter(): Promise<Character | null> {
  return NOT_IMPL('getCharacter');
}

export async function createCharacter(_name: string, _avatarId: string): Promise<Character> {
  return NOT_IMPL('createCharacter');
}

export async function getAttributeStates(): Promise<AttributeState[]> {
  return NOT_IMPL('getAttributeStates');
}

export async function updateAttributeStates(_states: AttributeState[]): Promise<void> {
  NOT_IMPL('updateAttributeStates');
}

export async function getStreak(): Promise<Streak> {
  return NOT_IMPL('getStreak');
}

export async function updateStreak(_streak: Streak): Promise<void> {
  NOT_IMPL('updateStreak');
}
