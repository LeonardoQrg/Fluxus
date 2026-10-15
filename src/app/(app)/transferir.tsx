// Transferir dinero entre dos cuentas propias. No cambia el total ni cuenta como ingreso o gasto.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AmountField } from '../../components/AmountField';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { Field } from '../../components/Field';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { Select } from '../../components/Select';
import { useToast } from '../../components/Toast';
import { Muted } from '../../components/Txt';
import { useAuth } from '../../lib/auth';
import { call, errorMessage } from '../../lib/data';
import { today } from '../../lib/dates';
import { useFinance } from '../../lib/finance';
import { formatMoney, parseAmount } from '../../lib/money';

export default function Transferir() {
  const params = useLocalSearchParams<{ from?: string }>();
  const { profile } = useAuth();
  const f = useFinance();
  const toast = useToast();
  const c = profile!.currency;

  const [from, setFrom] = useState(params.from ?? '');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const source = f.accountById(from);
  const target = f.accountById(to);
  const v = parseAmount(amount, c);
  const amountOk = v !== null && !Number.isNaN(v) && v > 0;

  let warning = '';
  if (source && target && source.id === target.id) warning = 'Elegí dos cuentas distintas.';
  else if (source && amountOk && v! > source.amount) warning = `En ${source.name} tenés ${formatMoney(source.amount, c)}. Ninguna cuenta puede quedar en negativo.`;
  const ready = amountOk && !!source && !!target && !warning && !!date;

  const options = f.money.map((a) => ({ value: a.id, label: a.name, detail: formatMoney(a.amount, c) }));

  async function submit() {
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      await call('register_movement', {
        p_type: 'transfer',
        p_date: date,
        p_amount: v,
        p_description: description,
        p_from_account_id: from,
        p_to_account_id: to,
      });
      await f.refresh();
      toast(`${formatMoney(v!, c)} transferidos a ${target!.name}`);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen back title="Transferir entre cuentas">
      <Muted>Mover dinero entre tus cuentas no cambia tu total ni cuenta como ingreso o gasto.</Muted>
      <Select label="Desde" value={from} onChange={setFrom} options={options} placeholder="Elegí una cuenta" />
      <Select label="Hacia" value={to} onChange={setTo} options={options} placeholder="Elegí una cuenta" />
      <AmountField currency={c} value={amount} onChangeText={setAmount} big />
      <DateField value={date} onChange={setDate} />
      <Field label="Descripción (opcional)" value={description} onChangeText={setDescription} placeholder="Ej.: Retiro del cajero" maxLength={200} />
      {warning ? <Notice kind="error">{warning}</Notice> : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button title="Transferir" onPress={submit} disabled={!ready} loading={busy} />
    </Screen>
  );
}
