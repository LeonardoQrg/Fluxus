// Registrar (o editar, con ?id=) un ingreso.
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { balancesWithout, useFinance } from '../../lib/finance';
import { formatMoney, parseAmount, toInputText } from '../../lib/money';

const NEW_ACCOUNT = '__nueva';

export default function Ingreso() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { profile } = useAuth();
  const f = useFinance();
  const toast = useToast();
  const c = profile!.currency;
  const old = (id && f.movements.find((m) => m.id === id && m.type === 'ingreso')) || null;
  const balances = useMemo(() => balancesWithout(f.accounts, old), [f.accounts, old]);

  const [amount, setAmount] = useState(old ? toInputText(old.amount, c) : '');
  const [account, setAccount] = useState(old?.account_id ?? '');
  const [newAccount, setNewAccount] = useState('');
  const [date, setDate] = useState(old?.date ?? today());
  const [description, setDescription] = useState(old?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const v = parseAmount(amount, c);
  const amountOk = v !== null && !Number.isNaN(v) && v > 0;
  const accountOk = !!account && (account !== NEW_ACCOUNT || !!newAccount.trim());
  const ready = amountOk && accountOk && !!date;

  async function submit() {
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      let accId = account;
      let accName = f.accountById(account)?.name ?? '';
      if (account === NEW_ACCOUNT) {
        if (f.money.some((a) => a.name.toLowerCase() === newAccount.trim().toLowerCase()) || f.owe.some((a) => a.name.toLowerCase() === newAccount.trim().toLowerCase())) {
          setError('Ya tenés una cuenta con ese nombre. Elegila de la lista.');
          setBusy(false);
          return;
        }
        accId = await call<string>('create_account', { p_name: newAccount, p_kind: 'dinero', p_amount: 0 });
        accName = newAccount.trim();
      }
      if (old) {
        await call('update_movement', { p_id: old.id, p_date: date, p_amount: v, p_description: description, p_account_id: accId });
      } else {
        await call('register_movement', { p_type: 'ingreso', p_date: date, p_amount: v, p_description: description, p_account_id: accId });
      }
      await f.refresh();
      toast(old ? 'Cambios guardados' : `Ingreso de ${formatMoney(v!, c)} registrado en ${accName}`);
      router.back();
    } catch (e) {
      await f.refresh();
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen back title={old ? 'Editar ingreso' : 'Registrar ingreso'}>
      {old ? <Muted size={14}>Al guardar, los saldos de las cuentas se corrigen solos.</Muted> : null}
      <AmountField currency={c} value={amount} onChangeText={setAmount} big autoFocus={!old} />
      <Select
        label="Cuenta donde entra el dinero"
        value={account}
        onChange={setAccount}
        placeholder="Elegí una cuenta"
        options={[
          ...f.money.map((a) => ({ value: a.id, label: a.name, detail: formatMoney(balances.get(a.id) ?? 0, c) })),
          { value: NEW_ACCOUNT, label: '+ Crear cuenta', accent: true },
        ]}
      />
      {account === NEW_ACCOUNT ? (
        <Field label="Nombre de la cuenta nueva" value={newAccount} onChangeText={setNewAccount} placeholder="Ej.: Caja de ahorro, Ualá" autoFocus maxLength={60} />
      ) : null}
      <DateField value={date} onChange={setDate} />
      <Field label="Descripción (opcional)" value={description} onChangeText={setDescription} placeholder="Ej.: Sueldo de octubre" maxLength={200} />
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button title={old ? 'Guardar cambios' : 'Registrar ingreso'} onPress={submit} disabled={!ready} loading={busy} />
    </Screen>
  );
}
