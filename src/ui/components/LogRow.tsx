import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ATTRIBUTE_COLORS, type Attribute } from '@/game/constants';
import type { LogEntry } from '@/storage/repositories/logRepo';

export interface LogRowProps {
  entry: LogEntry;
  expanded?: boolean;
  onTap?: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format an ISO timestamp as a short, human-readable "May 8, 7:00 AM" string.
 * Plain string templates only — date-fns is intentionally not in the locked
 * tech stack.
 */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const month = MONTHS[d.getMonth()];
  const day = d.getDate();

  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutesPadded = minutes < 10 ? `0${minutes}` : String(minutes);

  return `${month} ${day}, ${hours12}:${minutesPadded} ${period}`;
}

/**
 * Presentational row for a single log entry on the History screen. Pure — no
 * I/O, no Zustand. When `expanded` is true, also renders the full log text and
 * a per-attribute XP breakdown sourced from `entry.attributeXp` (sparse map;
 * only non-zero entries appear).
 */
export function LogRow({ entry, expanded = false, onTap }: LogRowProps) {
  const attributeColor = ATTRIBUTE_COLORS[entry.primaryAttribute];
  const dateLine = useMemo(() => formatDateTime(entry.createdAt), [entry.createdAt]);

  const breakdown = useMemo(() => {
    if (!expanded) return [];
    return Object.entries(entry.attributeXp)
      .filter(([, xp]) => typeof xp === 'number' && xp > 0)
      .map(([attribute, xp]) => ({ attribute: attribute as Attribute, xp: xp as number }));
  }, [expanded, entry.attributeXp]);

  const Container = onTap ? Pressable : View;
  const containerProps = onTap ? { onPress: onTap } : {};

  return (
    <Container
      testID={`log-row-${entry.id}`}
      className="rounded-lg border border-border bg-surface p-3"
      {...containerProps}
    >
      <Text className="font-manrope text-text-mute" style={{ fontSize: 12 }}>
        {dateLine}
      </Text>

      <Text className="mt-1 font-manrope-medium text-text" style={{ fontSize: 14 }}>
        {entry.aiSummary}
      </Text>

      <View className="mt-2 flex-row items-center gap-2">
        <Text className="font-manrope-semibold" style={{ fontSize: 12, color: attributeColor }}>
          {entry.primaryAttribute}
        </Text>
        <Text className="font-manrope text-text-mute" style={{ fontSize: 12 }}>
          {`· ${entry.totalXp} XP`}
        </Text>
      </View>

      {expanded ? (
        <View className="mt-3 gap-2 border-t border-border pt-3">
          <Text className="font-manrope text-text" style={{ fontSize: 13, lineHeight: 18 }}>
            {entry.text}
          </Text>

          {breakdown.length > 0 ? (
            <View className="mt-1 gap-1">
              {breakdown.map(({ attribute, xp }) => (
                <View
                  key={attribute}
                  testID={`log-row-${entry.id}-breakdown-${attribute}`}
                  className="flex-row items-center justify-between"
                >
                  <Text
                    className="font-manrope-semibold"
                    style={{ fontSize: 12, color: ATTRIBUTE_COLORS[attribute] }}
                  >
                    {attribute}
                  </Text>
                  <Text className="font-manrope text-text-mute" style={{ fontSize: 12 }}>
                    {`+${xp} XP`}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Container>
  );
}
