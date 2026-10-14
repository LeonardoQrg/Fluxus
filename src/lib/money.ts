// Montos y monedas.
//
// En la base de datos los montos se guardan como enteros en la unidad mínima de la moneda
// (centavos; en CLP y COP, unidades) para evitar errores de redondeo. Acá están las
// funciones para pasar de ese entero a texto ("$ 1.234,56") y del texto que escribe la
// persona a ese entero.

export type CurrencyCode = 'ARS' | 'USD' | 'CLP' | 'UYU' | 'MXN' | 'COP' | 'PEN' | 'EUR';

type CurrencyInfo = {
  name: string;
  locale: string;
  /** Cantidad de decimales que usa la moneda */
  decimals: number;
  /** Separador decimal al escribir y mostrar montos */
  decimalSeparator: ',' | '.';
};

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  ARS: { name: 'Peso argentino', locale: 'es-AR', decimals: 2, decimalSeparator: ',' },
  USD: { name: 'Dólar estadounidense', locale: 'en-US', decimals: 2, decimalSeparator: '.' },
  CLP: { name: 'Peso chileno', locale: 'es-CL', decimals: 0, decimalSeparator: ',' },
  UYU: { name: 'Peso uruguayo', locale: 'es-UY', decimals: 2, decimalSeparator: ',' },
  MXN: { name: 'Peso mexicano', locale: 'es-MX', decimals: 2, decimalSeparator: '.' },
  COP: { name: 'Peso colombiano', locale: 'es-CO', decimals: 0, decimalSeparator: ',' },
  PEN: { name: 'Sol peruano', locale: 'es-PE', decimals: 2, decimalSeparator: '.' },
  EUR: { name: 'Euro', locale: 'es-ES', decimals: 2, decimalSeparator: ',' },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

const formatters = new Map<CurrencyCode, Intl.NumberFormat>();

function formatter(currency: CurrencyCode) {
  let f = formatters.get(currency);
  if (!f) {
    const { locale, decimals } = CURRENCIES[currency];
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formatters.set(currency, f);
  }
  return f;
}

/** Entero en unidad mínima → número con decimales (123456 en ARS → 1234.56) */
export function fromMinor(minor: number, currency: CurrencyCode): number {
  return minor / 10 ** CURRENCIES[currency].decimals;
}

/** Entero en unidad mínima → texto para mostrar (123456 en ARS → "$ 1.234,56") */
export function formatMoney(minor: number, currency: CurrencyCode): string {
  return formatter(currency).format(fromMinor(minor, currency));
}

/**
 * Texto que escribe la persona → entero en unidad mínima.
 * Devuelve null si el campo está vacío y NaN si no es un número válido.
 *
 * Acepta el separador decimal de la moneda y también el otro si va seguido de 1 o 2
 * cifras al final, porque muchos teclados de Android solo muestran el punto:
 * en ARS, "1500.5" se lee como 1.500,50 y "1.500" como mil quinientos.
 */
export function parseAmount(text: string, currency: CurrencyCode): number | null {
  const t = text.trim();
  if (!t) return null;

  const { decimals, decimalSeparator } = CURRENCIES[currency];
  let sep: string = decimalSeparator;
  if (!t.includes(decimalSeparator)) {
    const other = decimalSeparator === ',' ? '.' : ',';
    const parts = t.split(other);
    if (parts.length === 2 && /^\d{1,2}$/.test(parts[1])) sep = other;
  }

  let clean = '';
  for (const ch of t) {
    if (ch >= '0' && ch <= '9') clean += ch;
    else if (ch === sep) clean += '.';
    else if (ch === ' ' || ch === '.' || ch === ',' || ch === '$') continue; // separadores de miles y símbolo
    else return NaN;
  }
  if (!clean || clean === '.' || clean.split('.').length > 2) return NaN;

  const value = Number(clean);
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * 10 ** decimals);
}

/** Entero en unidad mínima → texto para precargar un campo al editar (123456 en ARS → "1234,56") */
export function toInputText(minor: number, currency: CurrencyCode): string {
  const { decimals, decimalSeparator } = CURRENCIES[currency];
  const text = fromMinor(minor, currency).toFixed(decimals);
  return decimals > 0 ? text.replace('.', decimalSeparator) : text;
}
