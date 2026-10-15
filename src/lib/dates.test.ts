import { describe, expect, it } from 'vitest';
import { addDays, dayHeader, longDate, monthKey, monthTitle, shiftMonth, shortDate, today, todayTitle } from './dates';

const now = new Date(2026, 9, 14, 22, 30); // miércoles 14 de octubre de 2026, 22:30 (hora local)

describe('fechas', () => {
  it('hoy usa la fecha local, no la de Greenwich', () => {
    expect(today(now)).toBe('2026-10-14');
  });

  it('textos en español', () => {
    expect(longDate('2026-10-14', now)).toBe('miércoles 14 de octubre');
    expect(longDate('2025-12-31', now)).toBe('miércoles 31 de diciembre de 2025');
    expect(todayTitle(now)).toBe('Miércoles 14 de octubre');
    expect(dayHeader('2026-10-14', now)).toBe('Hoy · miércoles 14 de octubre');
    expect(dayHeader('2026-10-13', now)).toBe('Ayer · martes 13 de octubre');
    expect(dayHeader('2026-10-01', now)).toBe('Jueves 1 de octubre');
    expect(shortDate('2026-10-14', now)).toBe('Hoy');
    expect(shortDate('2026-10-02', now)).toBe('2 oct');
  });

  it('meses', () => {
    expect(monthKey(0, now)).toBe('2026-10');
    expect(monthKey(10, now)).toBe('2025-12');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthTitle('2026-03')).toBe('Marzo 2026');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
