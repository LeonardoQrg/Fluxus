import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';
import { colors } from '../theme';
import { Txt } from './Txt';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  small?: boolean;
  icon?: React.ReactNode;
  /** Color del texto (por ejemplo, rojo para "Eliminar") */
  textColor?: string;
};

export function Button({ title, variant = 'primary', loading, disabled, small, icon, textColor, style, ...rest }: Props) {
  const off = disabled || loading;
  const filled = variant === 'primary' || variant === 'danger';
  const bg = off && filled ? colors.disabled : variant === 'primary' ? colors.accent : variant === 'danger' ? colors.expense : variant === 'secondary' ? colors.surface : 'transparent';
  const fg = off && filled ? colors.onDisabled : filled ? colors.onAccent : variant === 'ghost' ? colors.accent : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      {...rest}
      style={(state) => [
        {
          minHeight: small ? 44 : 54,
          borderRadius: 12,
          paddingHorizontal: 18,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: state.pressed ? 0.85 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {loading ? <ActivityIndicator color={fg} /> : icon}
        <Txt weight="semibold" size={small ? 15 : 16} color={textColor ?? fg}>
          {title}
        </Txt>
      </View>
    </Pressable>
  );
}

/** Enlace de texto en turquesa */
export function LinkButton({ title, onPress, color = colors.accent }: { title: string; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={10} style={{ paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Txt weight="semibold" size={15} color={color}>
        {title}
      </Txt>
    </Pressable>
  );
}
