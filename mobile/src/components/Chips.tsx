import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radius } from '@/lib/theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  scrollable?: boolean;
};

export function Chips<T extends string>({ options, value, onChange, scrollable }: Props<T>) {
  const chips = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        key={option.value}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onChange(option.value)}
        style={[styles.chip, selected && styles.selected]}
      >
        <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
      </Pressable>
    );
  });
  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {chips}
      </ScrollView>
    );
  }
  return <ScrollView horizontal scrollEnabled={false} contentContainerStyle={[styles.row, styles.wrap]}>{chips}</ScrollView>;
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  wrap: { flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { color: colors.text, fontWeight: '500' },
  selectedLabel: { color: '#fff' },
});
