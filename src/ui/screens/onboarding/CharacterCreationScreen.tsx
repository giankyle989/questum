import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ATTRIBUTE_COLORS } from '@/game/constants';
import { useCharacterStore } from '@/state/characterStore';

interface AvatarChoice {
  id: string;
  letter: string;
  color: string;
}

/**
 * Six preset avatars — Phase 3 ships placeholder colored circles with letters.
 * Real avatar art is a Phase 4+ swap; the IDs (`avatar_1`..`avatar_6`) stay
 * stable so persisted character rows still resolve.
 */
const AVATARS: readonly AvatarChoice[] = [
  { id: 'avatar_1', letter: 'A', color: ATTRIBUTE_COLORS.STR },
  { id: 'avatar_2', letter: 'B', color: ATTRIBUTE_COLORS.DEX },
  { id: 'avatar_3', letter: 'C', color: ATTRIBUTE_COLORS.CON },
  { id: 'avatar_4', letter: 'D', color: ATTRIBUTE_COLORS.INT },
  { id: 'avatar_5', letter: 'E', color: ATTRIBUTE_COLORS.WIS },
  { id: 'avatar_6', letter: 'F', color: ATTRIBUTE_COLORS.CHA },
];

/**
 * Onboarding step 3 — character name + avatar. Submits via the character
 * store, then advances to the first-log walkthrough. This screen is
 * required (no skip path); the "Create Character" button stays disabled
 * until a non-whitespace name is typed.
 */
export default function CharacterCreationScreen() {
  const router = useRouter();
  const createCharacter = useCharacterStore((s) => s.createCharacter);

  const [name, setName] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState('avatar_1');
  const [submitting, setSubmitting] = useState(false);

  const trimmed = name.trim();
  const disabled = trimmed.length === 0 || submitting;

  const handleCreate = async () => {
    if (disabled) return;
    setSubmitting(true);
    try {
      await createCharacter(trimmed, selectedAvatarId);
      router.push('/onboarding/first-log');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View testID="character-creation-screen" className="flex-1 bg-bg px-6 pt-16">
      <View className="flex-1">
        <Text className="font-manrope-bold text-text" style={{ fontSize: 28, lineHeight: 34 }}>
          Create your character
        </Text>

        <TextInput
          testID="character-name-input"
          accessibilityLabel="Character name"
          placeholder="Character name"
          placeholderTextColor="#7a7d8a"
          value={name}
          onChangeText={setName}
          editable={!submitting}
          className="mt-8 rounded-2xl bg-surface-2 p-4 font-manrope text-text"
          style={{ fontSize: 17 }}
          maxLength={32}
        />

        <Text
          className="mt-8 font-manrope-semibold text-text-mute"
          style={{ fontSize: 13, letterSpacing: 0.5 }}
        >
          PICK AN AVATAR
        </Text>

        <View className="mt-4 flex-row flex-wrap gap-4">
          {AVATARS.map((avatar) => {
            const isSelected = avatar.id === selectedAvatarId;
            return (
              <TouchableOpacity
                key={avatar.id}
                testID={`avatar-option-${avatar.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Select avatar ${avatar.letter}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedAvatarId(avatar.id)}
                className="h-16 w-16 items-center justify-center rounded-full"
                style={{
                  backgroundColor: avatar.color,
                  borderWidth: isSelected ? 3 : 0,
                  borderColor: '#E8C547',
                }}
              >
                <Text className="font-manrope-bold text-bg" style={{ fontSize: 22 }}>
                  {avatar.letter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View className="mb-12">
        <TouchableOpacity
          testID="character-create-button"
          accessibilityRole="button"
          accessibilityLabel="Create Character"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => {
            void handleCreate();
          }}
          className="rounded-2xl py-4"
          style={{ backgroundColor: disabled ? '#2A2F36' : '#E8C547' }}
        >
          <Text
            className="text-center font-manrope-bold"
            style={{ fontSize: 16, color: disabled ? '#7D8590' : '#0E1116' }}
          >
            Create Character
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
