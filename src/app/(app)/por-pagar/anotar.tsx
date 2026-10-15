// Anotar algo por pagar: tarjeta de crédito, cuotas o préstamo, a una persona u otro.
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AmountField } from '../../../components/AmountField';
import { Button } from '../../../components/Button';
import { Chips } from '../../../components/Chips';
import { Field } from '../../../components/Field';
import { Notice } from '../../../components/Notice';
import { Screen } from '../../../components/Screen';
import { useToast } from '../../../components/Toast';
import { Muted, Txt } from '../../../components/Txt';
import { useAuth } from '../../../lib/auth';
import { call, errorMessage, OWE_TYPES, type OweType } from '../../../lib/data';
import { today } from '../../../lib/dates';
import { useFinance } from '../../../lib/finance';
import { parseAmount } from '../../../lib/money';

const PLACEHOLDERS: Record<OweType, string> = {
  tarjeta: 'Ej.: Tarjeta Visa',
  cuotas: 'Ej.: Cuotas heladera',
  persona: 'Ej.: Préstamo de mamá',
  otro: 'Ej.: Deuda con el club',
};

export default function Anotar() {
  const { profile } = useAuth();
  const f = useFinance();
  const toast = useToast();
  const c = profile!.currency;
  const [type, setType] = useState<OweType>('tarjeta');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const v = parseAmount(amount, c);
  const ready = !!name.trim() && v !== null && !Number.isNaN(v);

  async function submit() {
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      await call('create_account', { p_name: name, p_kind: 'pagar', p_owe_type: type, p_amount: v, p_date: today() });
      await f.refresh();
      toast(`${name.trim()} anotado`);
      router.back();
    } catch (e) {
      setError(errorMessage(e).replace('Ya tenés una cuenta con ese nombre.', 'Ya tenés algo anotado con ese nombre.'));
      setBusy(false);
    }
  }

  return (
    <Screen back title="Anotar por pagar">
      <Muted>Anotá lo que debés hoy. No cambia tu dinero disponible: te ayuda a ver cuánto te queda libre.</Muted>
      <View style={{ gap: 6 }}>
        <Txt weight="semibold" size={14}>
          Tipo
        </Txt>
        <Chips label="Tipo" value={type} onChange={setType} options={(Object.keys(OWE_TYPES) as OweType[]).map((k) => ({ value: k, label: OWE_TYPES[k] }))} />
      </View>
      <Field label="Nombre" value={name} onChangeText={setName} placeholder={PLACEHOLDERS[type]} maxLength={60} />
      <AmountField currency={c} value={amount} onChangeText={setAmount} label="Cuánto debés hoy" />
      {type === 'tarjeta' ? <Muted size={13}>Si la tarjeta no tiene saldo pendiente, poné 0. Igual la vas a poder usar para registrar gastos.</Muted> : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button title="Guardar" onPress={submit} disabled={!ready} loading={busy} />
    </Screen>
  );
}
