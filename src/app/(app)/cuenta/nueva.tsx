// Nueva cuenta de dinero, con monto inicial opcional.
import { router } from 'expo-router';
import { useState } from 'react';
import { AmountField } from '../../../components/AmountField';
import { Button } from '../../../components/Button';
import { Field } from '../../../components/Field';
import { Notice } from '../../../components/Notice';
import { Screen } from '../../../components/Screen';
import { useToast } from '../../../components/Toast';
import { Muted } from '../../../components/Txt';
import { useAuth } from '../../../lib/auth';
import { call, errorMessage } from '../../../lib/data';
import { useFinance } from '../../../lib/finance';
import { parseAmount } from '../../../lib/money';

export default function NuevaCuenta() {
  const { profile } = useAuth();
  const f = useFinance();
  const toast = useToast();
  const c = profile!.currency;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const v = parseAmount(amount, c);
  const ready = !!name.trim() && (v === null || !Number.isNaN(v));

  async function submit() {
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      await call('create_account', { p_name: name, p_kind: 'dinero', p_amount: v ?? 0 });
      await f.refresh();
      toast(`Cuenta ${name.trim()} creada`);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen back title="Nueva cuenta">
      <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej.: Caja de ahorro, Billetera virtual" autoFocus maxLength={60} />
      <AmountField currency={c} value={amount} onChangeText={setAmount} label="Monto inicial (opcional)" />
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button title="Crear cuenta" onPress={submit} disabled={!ready} loading={busy} />
      <Muted size={14}>Para tarjetas de crédito, cuotas o préstamos, usá &quot;Por pagar&quot; en Inicio.</Muted>
    </Screen>
  );
}
