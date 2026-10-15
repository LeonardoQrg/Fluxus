import { describe, expect, it } from 'vitest';
import { formatMoney, parseAmount, toInputText } from './money';

// Intl usa espacios especiales (no separables) entre el símbolo y el número
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatMoney', () => {
  it('ARS con coma decimal', () => {
    expect(plain(formatMoney(123456, 'ARS'))).toBe('$ 1.234,56');
  });

  it('USD con punto decimal', () => {
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56');
  });

  it('CLP y COP sin decimales', () => {
    expect(formatMoney(1235, 'CLP')).toBe('$1.235');
    expect(plain(formatMoney(1235, 'COP'))).toBe('$ 1.235');
  });

  it('las 8 monedas', () => {
    expect(plain(formatMoney(123456, 'UYU'))).toBe('$ 1.234,56');
    expect(formatMoney(123456, 'MXN')).toBe('$1,234.56');
    expect(plain(formatMoney(123456, 'PEN'))).toBe('S/ 1,234.56');
    expect(plain(formatMoney(123456, 'EUR'))).toBe('1234,56 €');
  });
});

describe('parseAmount', () => {
  it('vacío es null; texto inválido es NaN', () => {
    expect(parseAmount('  ', 'ARS')).toBeNull();
    expect(parseAmount('abc', 'ARS')).toBeNaN();
    expect(parseAmount('1,2,3,4', 'USD')).toBe(123400); // comas como separador de miles
    expect(parseAmount('12,34,5', 'ARS')).toBeNaN();
  });

  it('ARS: coma decimal y punto de miles', () => {
    expect(parseAmount('1.234,56', 'ARS')).toBe(123456);
    expect(parseAmount('1500,5', 'ARS')).toBe(150050);
    expect(parseAmount('25000', 'ARS')).toBe(2500000);
  });

  it('ARS: acepta el punto como decimal si va seguido de 1 o 2 cifras al final', () => {
    expect(parseAmount('1500.5', 'ARS')).toBe(150050);
    expect(parseAmount('1500.55', 'ARS')).toBe(150055);
    expect(parseAmount('1.500', 'ARS')).toBe(150000);
    expect(parseAmount('1.500.000', 'ARS')).toBe(150000000);
  });

  it('USD: punto decimal y también coma con 1 o 2 cifras', () => {
    expect(parseAmount('1,234.56', 'USD')).toBe(123456);
    expect(parseAmount('12,5', 'USD')).toBe(1250);
    expect(parseAmount('1,500', 'USD')).toBe(150000);
  });

  it('CLP sin decimales', () => {
    expect(parseAmount('1.235', 'CLP')).toBe(1235);
    expect(parseAmount('25000', 'CLP')).toBe(25000);
    expect(parseAmount('0', 'CLP')).toBe(0);
  });

  it('0 es válido', () => {
    expect(parseAmount('0', 'ARS')).toBe(0);
  });
});

describe('toInputText', () => {
  it('precarga el campo con el separador de la moneda', () => {
    expect(toInputText(150050, 'ARS')).toBe('1500,50');
    expect(toInputText(150050, 'USD')).toBe('1500.50');
    expect(toInputText(1235, 'CLP')).toBe('1235');
  });

  it('ida y vuelta', () => {
    for (const minor of [0, 1, 99, 100, 123456, 2500000]) {
      expect(parseAmount(toInputText(minor, 'ARS'), 'ARS')).toBe(minor);
    }
  });
});

describe('ayudas de los campos de monto', () => {
  it('muestra cómo se va a guardar', async () => {
    const { amountHint, amountPlaceholder } = await import('./money');
    expect(amountHint('', 'ARS')).toBe('');
    expect(plain(amountHint('1500.5', 'ARS'))).toBe('Se va a guardar $ 1.500,50');
    expect(amountHint('12a', 'ARS')).toBe('Revisá el número: usá solo cifras');
    expect(amountPlaceholder('ARS')).toBe('0,00');
    expect(amountPlaceholder('CLP')).toBe('0');
  });
});
