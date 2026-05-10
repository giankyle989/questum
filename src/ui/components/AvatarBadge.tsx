import { Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { ATTRIBUTE_COLORS } from '@/game/constants';

interface AvatarPreset {
  letter: string;
  color: string;
}

/**
 * Single source of truth for the six placeholder avatars used in onboarding
 * and on the Character Sheet. Letter + color, keyed by the same `avatar_N`
 * IDs persisted to `character.avatar_id`. Phase 4+ swaps the placeholder
 * letters for actual artwork; the IDs stay stable.
 */
const AVATAR_PRESETS: Record<string, AvatarPreset> = {
  avatar_1: { letter: 'A', color: ATTRIBUTE_COLORS.STR },
  avatar_2: { letter: 'B', color: ATTRIBUTE_COLORS.DEX },
  avatar_3: { letter: 'C', color: ATTRIBUTE_COLORS.CON },
  avatar_4: { letter: 'D', color: ATTRIBUTE_COLORS.INT },
  avatar_5: { letter: 'E', color: ATTRIBUTE_COLORS.WIS },
  avatar_6: { letter: 'F', color: ATTRIBUTE_COLORS.CHA },
};

const FALLBACK: AvatarPreset = { letter: '?', color: '#3D434C' };

export const AVATAR_IDS: ReadonlyArray<string> = Object.keys(AVATAR_PRESETS);

export function getAvatarPreset(avatarId: string | null | undefined): AvatarPreset {
  if (avatarId && avatarId in AVATAR_PRESETS) return AVATAR_PRESETS[avatarId]!;
  return FALLBACK;
}

interface AvatarBadgeProps {
  avatarId: string | null | undefined;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Renders the colored circle + letter for a given avatar ID. */
export function AvatarBadge({ avatarId, size = 56, style }: AvatarBadgeProps) {
  const preset = getAvatarPreset(avatarId);
  return (
    <View
      testID={`avatar-badge-${avatarId ?? 'none'}`}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: preset.color,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text className="font-manrope-bold text-bg" style={{ fontSize: Math.round(size * 0.4) }}>
        {preset.letter}
      </Text>
    </View>
  );
}
