import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors, soft } from '../theme';
import { ChevronDownIcon } from './icons';
import { Sheet } from './Sheet';
import { Txt } from './Txt';

export type Option = { value: string; label: string; detail?: string; group?: string; accent?: boolean };

/** Campo para elegir una opción de una lista (se abre un panel desde abajo) */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Elegí una opción',
  compact,
}: {
  label?: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const groups = [...new Set(options.map((o) => o.group ?? ''))];

  return (
    <View style={{ gap: 6, flex: compact ? 1 : undefined, minWidth: 0 }}>
      {label ? (
        <Txt weight="semibold" size={14}>
          {label}
        </Txt>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${selected?.label ?? placeholder}` : (selected?.label ?? placeholder)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: 12,
          minHeight: compact ? 48 : 54,
          paddingHorizontal: compact ? 10 : 14,
        }}
      >
        <Txt numberOfLines={1} style={{ flex: 1 }} color={selected ? colors.text : colors.onDisabled} size={compact ? 15 : 16}>
          {selected ? (selected.detail && !compact ? `${selected.label} · ${selected.detail}` : selected.label) : placeholder}
        </Txt>
        <ChevronDownIcon />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? placeholder}>
        {groups.map((g) => (
          <View key={g} style={{ gap: 8 }}>
            {g ? (
              <Txt weight="bold" size={12} color={colors.textMuted} style={{ letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>
                {g}
              </Txt>
            ) : null}
            {options
              .filter((o) => (o.group ?? '') === g)
              .map((o) => {
                const on = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 52,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: on ? colors.accent : colors.border,
                      backgroundColor: on ? soft.accent : colors.background,
                    }}
                  >
                    <Txt style={{ flex: 1 }} weight={o.accent ? 'semibold' : 'regular'} color={o.accent ? colors.accent : colors.text}>
                      {o.label}
                    </Txt>
                    {o.detail ? (
                      <Txt size={14} color={colors.textMuted} tabular>
                        {o.detail}
                      </Txt>
                    ) : null}
                  </Pressable>
                );
              })}
          </View>
        ))}
      </Sheet>
    </View>
  );
}
