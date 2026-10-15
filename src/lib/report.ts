// Cálculos del Informe. Solo cuentan ingresos y gastos: los pagos de tarjetas y deudas,
// las transferencias y lo anotado por pagar no se suman, para no contar dos veces.
// Un gasto con tarjeta cuenta en el mes de la compra.
import type { Movement } from './data';

/** Gasto por categoría en un mes ("AAAA-MM") */
export function spendingByCategory(movements: Movement[], ym: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of movements) {
    if (m.type !== 'gasto' || !m.date.startsWith(ym) || !m.category_id) continue;
    out.set(m.category_id, (out.get(m.category_id) ?? 0) + m.amount);
  }
  return out;
}

export function monthTotals(movements: Movement[], ym: string) {
  let income = 0;
  let expense = 0;
  for (const m of movements) {
    if (!m.date.startsWith(ym)) continue;
    if (m.type === 'ingreso') income += m.amount;
    if (m.type === 'gasto') expense += m.amount;
  }
  return { income, expense };
}

export type Slice = { id: string; value: number; other?: boolean };

/** Las 5 categorías con más gasto y el resto juntas en "Otras categorías" */
export function donutSlices(byCategory: Map<string, number>): Slice[] {
  const ranked = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const slices: Slice[] = ranked.slice(0, 5).map(([id, value]) => ({ id, value }));
  const rest = ranked.slice(5).reduce((t, [, v]) => t + v, 0);
  if (rest > 0) slices.push({ id: 'otras', value: rest, other: true });
  return slices;
}

/** Porcentaje redondeado (0 si el total es 0) */
export const percent = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

/** Promedio de los meses que tuvieron gasto */
export function averageWithSpending(values: number[]): number {
  const used = values.filter((v) => v > 0);
  return used.length ? Math.round(used.reduce((t, v) => t + v, 0) / used.length) : 0;
}
