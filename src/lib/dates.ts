// Fechas en español, sin depender de los datos de idioma del celular.
// Las fechas se manejan como texto "AAAA-MM-DD" (igual que en la base de datos).

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → "AAAA-MM-DD" con la fecha local del celular */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const today = (now = new Date()) => toISODate(now);

export function addDays(s: string, n: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** "AAAA-MM" del mes actual menos `back` meses */
export function monthKey(back = 0, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** "octubre" */
export function monthName(ym: string): string {
  return MONTHS[Number(ym.slice(5, 7)) - 1];
}

/** "Octubre 2026" */
export function monthTitle(ym: string): string {
  const n = monthName(ym);
  return `${n[0].toUpperCase()}${n.slice(1)} ${ym.slice(0, 4)}`;
}

/** "martes 14 de octubre" (con el año si no es el actual) */
export function longDate(s: string, now = new Date()): string {
  const d = parseISODate(s);
  const base = `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} de ${d.getFullYear()}`;
}

/** "Hoy", "Ayer" o "14 oct" (con el año si no es el actual) */
export function shortDate(s: string, now = new Date()): string {
  const t = today(now);
  if (s === t) return 'Hoy';
  if (s === addDays(t, -1)) return 'Ayer';
  const d = parseISODate(s);
  const base = `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** Encabezado de un día en la lista: "Hoy · martes 14 de octubre" */
export function dayHeader(s: string, now = new Date()): string {
  const t = today(now);
  const label = longDate(s, now);
  if (s === t) return `Hoy · ${label}`;
  if (s === addDays(t, -1)) return `Ayer · ${label}`;
  return label[0].toUpperCase() + label.slice(1);
}

/** Saludo con la fecha de hoy: "Martes 14 de octubre" */
export function todayTitle(now = new Date()): string {
  const l = longDate(today(now), now);
  return l[0].toUpperCase() + l.slice(1);
}

/** "Este mes (octubre)", "Mes pasado (septiembre)" o "Agosto 2026" */
export function monthLabel(ym: string, now = new Date()): string {
  if (ym === monthKey(0, now)) return `Este mes (${monthName(ym)})`;
  if (ym === monthKey(1, now)) return `Mes pasado (${monthName(ym)})`;
  return monthTitle(ym);
}

/** Fecha y hora de registro: "15 oct 2026, 14:05" */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
