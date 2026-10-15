import { forwardRef, useState } from 'react';
import { Platform, Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts } from '../theme';
import { EyeIcon } from './icons';
import { Txt } from './Txt';

type Props = TextInputProps & {
  label: string;
  /** Texto gris debajo del campo */
  hint?: string;
  /** Mensaje de color debajo del campo */
  message?: { text: string; ok: boolean } | null;
  /** Agrega el botón para mostrar u ocultar la contraseña */
  password?: boolean;
  big?: boolean;
  prefix?: string;
};

export const Field = forwardRef<TextInput, Props>(function Field(
  { label, hint, message, password, big, prefix, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Txt weight="semibold" size={14}>
        {label}
      </Txt>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: focused ? colors.accent : colors.border,
          borderRadius: 12,
          minHeight: big ? 64 : 54,
          paddingHorizontal: 14,
          gap: 8,
        }}
      >
        {prefix ? (
          <Txt weight="semibold" size={big ? 20 : 16} color={colors.textMuted}>
            {prefix}
          </Txt>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.onDisabled}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          secureTextEntry={password && !visible}
          accessibilityLabel={label}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              minWidth: 0,
              color: colors.text,
              fontFamily: big ? fonts.bold : fonts.regular,
              fontSize: big ? 26 : 16,
              paddingVertical: 12,
              fontVariant: big ? ['tabular-nums'] : undefined,
            },
            Platform.OS === 'web' ? { outlineWidth: 0 } : null,
            style,
          ]}
        />
        {password ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={8}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 }}
          >
            <EyeIcon off={visible} />
          </Pressable>
        ) : null}
      </View>
      {message ? (
        <Txt weight="semibold" size={14} color={message.ok ? colors.income : colors.expense} accessibilityLiveRegion="polite">
          {message.text}
        </Txt>
      ) : hint ? (
        <Txt size={13} color={colors.textMuted}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
});
