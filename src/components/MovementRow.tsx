import { Pressable, View } from 'react-native';
import type { MovementView } from '../lib/describe';
import { colors, soft } from '../theme';
import { CardIcon, DownIcon, SwapIcon, UpIcon } from './icons';
import { Txt } from './Txt';

const TONES = {
  in: { bg: soft.income, fg: colors.income, amount: colors.income },
  out: { bg: soft.expense, fg: colors.expense, amount: colors.expense },
  pay: { bg: soft.accent, fg: colors.accent, amount: colors.textMuted },
} as const;

export function MovementRow({ view, onPress, last }: { view: MovementView; onPress?: () => void; last?: boolean }) {
  const t = TONES[view.tone];
  const Icon = { up: UpIcon, down: DownIcon, swap: SwapIcon, card: CardIcon }[view.icon];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${view.title}, ${view.amount}, ${view.subtitle}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={t.fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="semibold" numberOfLines={2}>
          {view.title}
        </Txt>
        {view.subtitle ? (
          <Txt size={13} color={colors.textMuted} numberOfLines={2}>
            {view.subtitle}
          </Txt>
        ) : null}
      </View>
      <Txt weight="bold" tabular color={t.amount}>
        {view.amount}
      </Txt>
    </Pressable>
  );
}

/** Contenedor de una lista de movimientos */
export function MovementList({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingVertical: 4, paddingHorizontal: 14 }}>
      {children}
    </View>
  );
}
