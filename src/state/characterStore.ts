import { create } from 'zustand';
import type { Character, AttributeState, Streak } from '@/storage/repositories/characterRepo';

export interface CharacterStoreState {
  character: Character | null;
  attributeStates: AttributeState[];
  streak: Streak;
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  createCharacter: (name: string, avatarId: string) => Promise<void>;
}

export const useCharacterStore = create<CharacterStoreState>((set) => ({
  character: null,
  attributeStates: [],
  streak: { currentLength: 0, longestLength: 0 },
  loading: false,
  error: null,

  hydrate: async () => {
    // Phase 2/3 will call characterRepo.getCharacter() etc. and populate state.
    set({ loading: false });
  },

  createCharacter: async () => {
    // Phase 3 will implement.
  },
}));
