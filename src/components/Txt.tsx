import { Text, type TextProps } from 'react-native';
import { colors, fonts, type FontWeight } from '../theme';

type Props = TextProps & {
  weight?: FontWeight;
  size?: number;
  color?: string;
  /** Cifras tabulares: los números se alinean en columnas */
  tabular?: boolean;
  center?: boolean;
};

/** Texto con la tipografía de Fluxus */
export function Txt({ weight = 'regular', size = 16, color = colors.text, tabular, center, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: fonts[weight],
          fontSize: size,
          lineHeight: Math.round(size * 1.4),
          color,
          fontVariant: tabular ? ['tabular-nums'] : undefined,
          textAlign: center ? 'center' : undefined,
        },
        style,
      ]}
    />
  );
}

export function Title({ children, size = 28 }: { children: React.ReactNode; size?: number }) {
  return (
    <Txt weight="bold" size={size} style={{ lineHeight: Math.round(size * 1.15), letterSpacing: -0.3 }} accessibilityRole="header">
      {children}
    </Txt>
  );
}

export function Muted({ children, size = 15 }: { children: React.ReactNode; size?: number }) {
  return (
    <Txt size={size} color={colors.textMuted}>
      {children}
    </Txt>
  );
}
