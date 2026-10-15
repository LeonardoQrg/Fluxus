import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { soft } from '../theme';

export type DonutSlice = { key: string; value: number; color: string; label: string };

const R = 66;
const STROKE = 26;
const C = 2 * Math.PI * R;

/** Dona de gastos: tocar un color lo destaca. El texto del centro va en `children`. */
export function Donut({
  slices,
  selected,
  onSelect,
  size = 240,
  children,
}: {
  slices: DonutSlice[];
  selected: number | null;
  onSelect: (i: number | null) => void;
  size?: number;
  children?: React.ReactNode;
}) {
  const total = slices.reduce((t, s) => t + s.value, 0);
  const gap = slices.length > 1 ? 2.5 : 0; // separación entre colores
  // Dónde empieza cada color sobre el círculo
  const lengths = slices.map((s) => (s.value / total) * C);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((t, l) => t + l, 0));

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }} accessibilityRole="image" accessibilityLabel={slices.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}>
      <Svg width={size} height={size} viewBox="0 0 180 180">
        <Circle r={R} cx={90} cy={90} fill="none" stroke={soft.surface2} strokeWidth={STROKE} />
        {slices.map((s, i) => {
          const dash = Math.max(lengths[i] - gap, 1);
          return (
            <Circle
              key={s.key}
              r={R}
              cx={90}
              cy={90}
              fill="none"
              stroke={s.color}
              strokeWidth={selected === i ? STROKE + 6 : STROKE}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-starts[i]}
              opacity={selected !== null && selected !== i ? 0.3 : 1}
              transform="rotate(-90 90 90)"
              onPress={() => onSelect(selected === i ? null : i)}
            />
          );
        })}
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: size * 0.17 }}>
        {children}
      </View>
    </View>
  );
}
