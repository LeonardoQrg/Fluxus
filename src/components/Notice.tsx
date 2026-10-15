import { View } from 'react-native';
import { colors, soft } from '../theme';
import { Txt } from './Txt';

const KINDS = {
  error: { bg: soft.expense, fg: colors.expense },
  info: { bg: soft.income, fg: colors.income },
  warn: { bg: colors.warningBackground, fg: colors.warning },
  brand: { bg: soft.accent, fg: colors.accent },
} as const;

/** Cuadro de aviso: error (rojo), info (verde), warn (amarillo) o brand (turquesa) */
export function Notice({ kind, children }: { kind: keyof typeof KINDS; children: React.ReactNode }) {
  const k = KINDS[kind];
  return (
    <View style={{ backgroundColor: k.bg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }} accessibilityLiveRegion="polite">
      <Txt weight="medium" size={14} color={k.fg}>
        {children}
      </Txt>
    </View>
  );
}
