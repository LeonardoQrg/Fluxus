import { Pressable, View } from 'react-native';
import { colors, soft } from '../theme';
import { Txt } from './Txt';

/** Opciones en forma de pastillas: se elige una */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={{
              borderWidth: 1.5,
              borderColor: on ? colors.accent : colors.border,
              backgroundColor: on ? soft.accent : colors.surface,
              borderRadius: 999,
              paddingVertical: 9,
              paddingHorizontal: 14,
              minHeight: 40,
              justifyContent: 'center',
            }}
          >
            <Txt weight="semibold" size={14} color={on ? colors.accent : colors.text}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
