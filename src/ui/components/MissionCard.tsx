import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { addDays } from '@/game/calendar';
import { ATTRIBUTE_COLORS } from '@/game/constants';
import { todayLocalISODate } from '@/lib/clock';
import type { Mission } from '@/storage/repositories/missionRepo';

export interface MissionCardProps {
  mission: Mission;
  onTap?: () => void;
}

/**
 * Format the expiry line for an active mission.
 *
 * Daily: expires at end of `generatedFor` day.
 * Weekly: `generatedFor` is the Monday; the week ends Sunday (Monday + 6 days).
 *
 * We intentionally derive from `generatedFor`, not the deprecated `mission.expiresAt`.
 */
function formatExpiry(mission: Mission, today: string): string {
  if (mission.type === 'daily') {
    if (mission.generatedFor === today) return 'expires today';
    if (mission.generatedFor < today) return 'expired';
    return 'upcoming';
  }
  // weekly
  const sunday = addDays(mission.generatedFor, 6);
  if (sunday === today) return 'expires today';
  if (sunday < today) return 'expired';
  return 'expires Sunday';
}

/**
 * Format `completedAt` (ISO timestamp) as a short, cheap relative-or-absolute
 * string. No date-fns (not in the locked tech stack).
 *
 * - < 1 minute  → "just now"
 * - < 60 mins   → "N min ago"
 * - < 24 hours  → "N hr ago"
 * - < 7 days    → "N day ago"
 * - else        → "May 8" (month + day, current locale month abbreviation)
 */
function formatCompletedAt(completedAt: string, now: Date = new Date()): string {
  const completed = new Date(completedAt);
  const diffMs = now.getTime() - completed.getTime();
  if (Number.isNaN(diffMs)) return '';

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? '' : 's'} ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[completed.getMonth()]} ${completed.getDate()}`;
}

/**
 * Presentational mission card. Pure — no hooks beyond `useMemo` for derived
 * strings; no I/O; no Zustand. Wrapped in `Pressable` if `onTap` is provided,
 * otherwise a plain `View`.
 */
export function MissionCard({ mission, onTap }: MissionCardProps) {
  const isCompleted = mission.status === 'completed';
  const attributeColor = ATTRIBUTE_COLORS[mission.attribute];

  const expiryLine = useMemo(() => formatExpiry(mission, todayLocalISODate()), [mission]);

  const completedLine = useMemo(() => {
    if (!isCompleted || !mission.completedAt) return null;
    return formatCompletedAt(mission.completedAt);
  }, [isCompleted, mission.completedAt]);

  const Container = onTap ? Pressable : View;
  const containerProps = onTap ? { onPress: onTap } : {};

  return (
    <Container
      testID={`mission-card-${mission.id}`}
      className="rounded-lg border border-border bg-surface p-3"
      style={{ opacity: isCompleted ? 0.6 : 1 }}
      {...containerProps}
    >
      <View className="flex-row items-start gap-3">
        {/* Completion dot */}
        <View
          testID={`mission-card-dot-${mission.id}`}
          className="mt-1 h-3 w-3 rounded-full"
          style={
            isCompleted
              ? { backgroundColor: attributeColor }
              : { borderWidth: 1.5, borderColor: attributeColor }
          }
        />

        {/* Body */}
        <View className="flex-1">
          <Text className="font-manrope-medium text-text" style={{ fontSize: 14 }}>
            {mission.description}
          </Text>

          <View className="mt-1 flex-row items-center gap-2">
            <Text className="font-manrope-semibold" style={{ fontSize: 12, color: attributeColor }}>
              {mission.attribute}
            </Text>

            {!isCompleted && (
              <Text className="font-manrope text-text-mute" style={{ fontSize: 12 }}>
                {`· ${expiryLine}`}
              </Text>
            )}
          </View>

          {isCompleted && (
            <View className="mt-1 flex-row items-center gap-2">
              {completedLine ? (
                <Text className="font-manrope text-text-mute" style={{ fontSize: 12 }}>
                  {`Completed ${completedLine}`}
                </Text>
              ) : null}
              <Text
                className="font-manrope-semibold"
                style={{ fontSize: 12, color: attributeColor }}
              >
                {`+${mission.bonusXp} XP bonus`}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Container>
  );
}
