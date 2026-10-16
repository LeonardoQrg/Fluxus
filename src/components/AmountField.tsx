import { forwardRef } from 'react';
import type { TextInput, TextInputProps } from 'react-native';
import { amountDisplay, amountFromDigits, amountPlaceholder, CURRENCIES, type CurrencyCode } from '../lib/money';
import { Field } from './Field';

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  currency: CurrencyCode;
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  big?: boolean;
  /** Texto gris debajo del campo (por defecto: "Se va a guardar $ …") */
  hint?: string;
  /** Mensaje de color debajo del campo (reemplaza al texto gris) */
  message?: { text: string; ok: boolean } | null;
};

/**
 * Campo de monto estilo caja: símbolo de la moneda delante y las cifras entran por la derecha
 * (4, 1, 1, 9 → 41,19), sin tener que escribir la coma ni el punto.
 */
export const AmountField = forwardRef<TextInput, Props>(function AmountField(
  { currency, value, onChangeText, label = 'Monto', big, hint, ...rest },
  ref,
) {
  return (
    <Field
      ref={ref}
      label={label}
      prefix={CURRENCIES[currency].symbol}
      big={big}
      value={amountDisplay(value, currency)}
      onChangeText={(t) => onChangeText(amountFromDigits(t, value, currency))}
      keyboardType="number-pad"
      inputMode="numeric"
      placeholder={amountPlaceholder(currency)}
      autoComplete="off"
      hint={hint ?? ' '}
      {...rest}
    />
  );
});
