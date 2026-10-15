import { describe, expect, it } from 'vitest';
import type { Movement } from './data';
import { averageWithSpending, donutSlices, monthTotals, percent, spendingByCategory } from './report';

const mov = (type: Movement['type'], amount: number, date: string, category_id: string | null = null): Movement => ({
  id: Math.random().toString(),
  type,
  amount,
  delta: null,
  date,
  description: '',
  category_id,
  account_id: null,
  from_account_id: null,
  to_account_id: null,
  created_at: '',
  parts: [],
});

describe('informe', () => {
  const list = [
    mov('gasto', 2500000, '2026-10-02', 'ocio'),
    mov('gasto', 1000, '2026-10-05', 'salud'),
    mov('gasto', 999, '2026-09-30', 'salud'),
    mov('ingreso', 5000, '2026-10-01'),
    mov('pago', 1500000, '2026-10-10'),
    mov('transfer', 700, '2026-10-10'),
  ];

  it('solo suma ingresos y gastos del mes (los pagos no cuentan otra vez)', () => {
    expect(monthTotals(list, '2026-10')).toEqual({ income: 5000, expense: 2501000 });
    expect(spendingByCategory(list, '2026-10')).toEqual(
      new Map([
        ['ocio', 2500000],
        ['salud', 1000],
      ]),
    );
  });

  it('la dona muestra 5 categorías y agrupa el resto en "Otras categorías"', () => {
    const by = new Map(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k, i) => [k, 100 - i]));
    const s = donutSlices(by);
    expect(s.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'otras']);
    expect(s[5].value).toBe(94 + 95);
  });

  it('porcentajes y promedio', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
    expect(averageWithSpending([0, 100, 0, 300, 0, 0])).toBe(200);
    expect(averageWithSpending([0, 0])).toBe(0);
  });
});
