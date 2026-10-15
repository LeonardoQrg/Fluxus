// Registrar un pago: baja el dinero y baja lo que se debe. No cuenta como gasto otra vez.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AmountField } from '../../../components/AmountField';
import { Button, LinkButton } from '../../../components/Button';
import { DateField } from '../../../components/DateField';
import { Notice } from '../../../components/Notice';
import { Screen } from '../../../components/Screen';
import { Select } from '../../../components/Select';
import { useToast } from '../../../components/Toast';
import { Muted } from '../../../components/Txt';
import { useAuth } from '../../../lib/auth';
import { call, errorMessage } from '../../../lib/data';
import { today } from '../../../lib/dates';
import { useFinance } from '../../../lib/finance';
import { formatMoney, parseAmount, toInputText } from '../../../lib/money';

export default function Pago() {
  const params = useLocalSearchParams<{ to?: string }>();
  const { profile } = useAuth();
  const f = useFinance();
  const toast = useToast();
  const c = profile!.currency;
  const pending = f.owe.filter((a) => a.amount > 0);

  const [to, setTo] = useState(params.to && pending.some((a) => a.id === params.to) ? params.to : '');
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState('');
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const target = f.accountById(to);
  const source = f.accountById(from);
  const v = parseAmount(amount, c);
  const amountOk = v !== null && !Number.isNaN(v) && v > 0;

  let warning = '';
  if (target && amountOk && v! > target.amount) warning = `Es más de lo que debés en ${target.name} (${formatMoney(target.amount, c)}).`;
  else if (source && amountOk && v! > source.amount)
    warning = `En ${source.name} tenés ${formatMoney(source.amount, c)}. Elegí otra cuenta o pagá menos: ninguna cuenta puede quedar en negativo.`;

  const ready = amountOk && !!target && !!source && !warning && !!date;

  async function submit() {
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      await call('register_movement', { p_type: 'pago', p_date: date, p_amount: v, p_from_account_id: from, p_to_account_id: to });
      await f.refresh();
      toast(`Pago de ${formatMoney(v!, c)} registrado`);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen back title="Registrar un pago">
      <Muted>Por ejemplo, el resumen de la tarjeta o una cuota. Baja tu dinero y baja lo que tenés por pagar. No se cuenta como gasto otra vez.</Muted>
      <Select
        label="¿Qué pagás?"
        value={to}
        onChange={setTo}
        placeholder="Elegí"
        options={pending.map((a) => ({ value: a.id, label: a.name, detail: `debés ${formatMoney(a.amount, c)}` }))}
      />
      <AmountField currency={c} value={amount} onChangeText={setAmount} big />
      {target ? <LinkButton title={`Pagar el total: ${formatMoney(target.amount, c)}`} onPress={() => setAmount(toInputText(target.amount, c))} /> : null}
      <Select
        label="Pagado desde"
        value={from}
        onChange={setFrom}
        placeholder="Elegí una cuenta"
        options={f.money.map((a) => ({ value: a.id, label: a.name, detail: formatMoney(a.amount, c) }))}
      />
      <DateField value={date} onChange={setDate} />
      {warning ? <Notice kind="error">{warning}</Notice> : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button title="Registrar pago" onPress={submit} disabled={!ready} loading={busy} />
    </Screen>
  );
}
