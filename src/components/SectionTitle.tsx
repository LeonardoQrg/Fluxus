import { colors } from '../theme';
import { Txt } from './Txt';

export function SectionTitle({ children, color = colors.textMuted }: { children: string; color?: string }) {
  return (
    <Txt weight="bold" size={12} color={color} style={{ letterSpacing: 1, textTransform: 'uppercase' }} accessibilityRole="header">
      {children}
    </Txt>
  );
}
