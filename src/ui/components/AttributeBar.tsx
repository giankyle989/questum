import { Text, View } from 'react-native';

import { ATTRIBUTE_COLORS, type Attribute } from '@/game/constants';

export interface AttributeBarProps {
  attribute: Attribute;
  level: number;
  inProgressXp: number;
  /** XP needed to reach the next level. Caller computes via `xpToReachLevel(level + 1)`. */
  xpThreshold: number;
  /**
   * When true, the bar fill renders at reduced opacity to indicate decay applied
   * earlier today. Phase 4 will replace this with a shimmer animation.
   */
  decayedToday?: boolean;
}

/**
 * Presentational attribute bar: row of `<abbr> ... Lv N` with a progress bar
 * underneath. Pure — no state, no I/O. All inputs via props.
 *
 * Tailwind classnames must be statically analyzable, so the per-attribute
 * fill color is applied via inline `style` (sourced from `ATTRIBUTE_COLORS`).
 */
export function AttributeBar({
  attribute,
  level,
  inProgressXp,
  xpThreshold,
  decayedToday = false,
}: AttributeBarProps) {
  const safeThreshold = xpThreshold > 0 ? xpThreshold : 1;
  const progress = Math.min(Math.max(inProgressXp, 0) / safeThreshold, 1);
  const widthPct = `${progress * 100}%` as const;
  const fillColor = ATTRIBUTE_COLORS[attribute];

  return (
    <View testID={`attribute-bar-${attribute}`} className="w-full">
      <View className="flex-row items-center justify-between">
        <Text className="font-manrope-semibold text-text" style={{ fontSize: 14 }}>
          {attribute}
        </Text>
        <Text className="font-manrope text-text-mute" style={{ fontSize: 12 }}>
          {`Lv ${level}`}
        </Text>
      </View>
      <View
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2"
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: safeThreshold,
          now: Math.min(inProgressXp, safeThreshold),
        }}
      >
        <View
          testID={`attribute-bar-fill-${attribute}`}
          className="h-full rounded-full"
          style={{
            backgroundColor: fillColor,
            width: widthPct,
            opacity: decayedToday ? 0.6 : 1,
          }}
        />
      </View>
    </View>
  );
}
