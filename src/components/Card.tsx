import { View, type ViewProps } from 'react-native';
import { colors, radius } from '../theme';

/** Tarjeta: fondo azul un poco más claro con borde suave */
export function Card({ style, highlight, ...rest }: ViewProps & { highlight?: boolean }) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: highlight ? colors.highlight : colors.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: highlight ? colors.highlightBorder : colors.border,
          padding: 20,
        },
        style,
      ]}
    />
  );
}

/** Fila nombre · monto dentro de una tarjeta */
export function Row({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      {children}
    </View>
  );
}
