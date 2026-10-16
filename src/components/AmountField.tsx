import { forwardRef } from 'react';
import type { TextInput, TextInputProps } from 'react-native';
import { amountHint, amountPlaceholder, CURRENCIES, type CurrencyCode } from '../lib/money';
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

/** Campo de monto: símbolo de la moneda delante y "Se va a guardar $ …" debajo */
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
      value={value}
      onChangeText={onChangeText}
      keyboardType="decimal-pad"
      inputMode="decimal"
      placeholder={amountPlaceholder(currency)}
      autoComplete="off"
      hint={hint ?? (amountHint(value, currency) || ' ')}
      {...rest}
    />
  );
});
