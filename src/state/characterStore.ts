import { create } from 'zustand';
import * as characterRepo from '@/storage/repositories/characterRepo';
import type { Character, AttributeState, Streak } from '@/storage/repositories/characterRepo';
import { getDb } from '@/storage/db';

export interface CharacterStoreState {
  character: Character | null;
  attributeStates: AttributeState[];
  streak: Streak;
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  createCharacter: (name: string, avatarId: string) => Promise<void>;
}

export const useCharacterStore = create<CharacterStoreState>((set, get) => ({
  character: null,
  attributeStates: [],
  streak: { currentLength: 0, longestLength: 0 },
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true });
    try {
      const db = await getDb();
      const [character, attributeStates, streak] = await Promise.all([
        characterRepo.getCharacter(db),
        characterRepo.getAttributeStates(db),
        characterRepo.getStreak(db),
      ]);
      set({ character, attributeStates, streak, loading: false, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  createCharacter: async (name, avatarId) => {
    const db = await getDb();
    await characterRepo.createCharacter(db, name, avatarId);
    await get().hydrate();
  },
}));
