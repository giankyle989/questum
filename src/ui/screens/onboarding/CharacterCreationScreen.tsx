import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useCharacterStore } from '@/state/characterStore';
import { AVATAR_IDS, AvatarBadge, getAvatarPreset } from '@/ui/components/AvatarBadge';

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
          {AVATAR_IDS.map((avatarId) => {
            const isSelected = avatarId === selectedAvatarId;
            const preset = getAvatarPreset(avatarId);
            return (
              <TouchableOpacity
                key={avatarId}
                testID={`avatar-option-${avatarId}`}
                accessibilityRole="button"
                accessibilityLabel={`Select avatar ${preset.letter}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedAvatarId(avatarId)}
                style={{
                  borderRadius: 32,
                  borderWidth: isSelected ? 3 : 0,
                  borderColor: '#E8C547',
                }}
              >
                <AvatarBadge avatarId={avatarId} size={64} />
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
