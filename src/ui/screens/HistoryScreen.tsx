import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ATTRIBUTES, type Attribute } from '@/game/constants';
import { useLogsStore } from '@/state/logsStore';
import { LogRow } from '@/ui/components/LogRow';

type FilterValue = Attribute | 'all';

const FILTER_PILLS: ReadonlyArray<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'All' },
  ...ATTRIBUTES.map((attr) => ({ value: attr, label: attr })),
];

/**
 * History tab — chronological list of all logs with attribute filter pills.
 * Reads `logs` from `logsStore` (already sorted DESC by createdAt via the
 * repository's hydrate query). All filter and expand state is local; the store
 * stays the source of truth for the entry list.
 */
export default function HistoryScreen() {
  const logs = useLogsStore((s) => s.logs);

  const [activeFilter, setActiveFilter] = useState<FilterValue>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return logs;
    return logs.filter((l) => l.primaryAttribute === activeFilter);
  }, [logs, activeFilter]);

  return (
    <View testID="history-screen" className="flex-1 bg-bg">
      <View className="px-4 pt-12">
        <Text className="font-manrope-bold text-text" style={{ fontSize: 22 }}>
          History
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
        >
          {FILTER_PILLS.map(({ value, label }) => {
            const isActive = value === activeFilter;
            return (
              <Pressable
                key={value}
                testID={`filter-pill-${value}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                onPress={() => setActiveFilter(value)}
                className={
                  isActive
                    ? 'rounded-full border border-accent bg-accent px-3 py-1.5'
                    : 'rounded-full border border-border bg-surface-2 px-3 py-1.5'
                }
              >
                <Text
                  className={isActive ? 'font-manrope-semibold' : 'font-manrope text-text-mute'}
                  style={{ fontSize: 13, color: isActive ? '#0E1116' : undefined }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerClassName="px-4 pb-12">
        <View className="gap-3">
          {filtered.length === 0 ? (
            <Text className="font-manrope text-text-mute" style={{ fontSize: 14 }}>
              No logs yet
            </Text>
          ) : (
            filtered.map((entry) => (
              <LogRow
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onTap={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
