// Ponerme al día: después de un tiempo sin anotar, se corrige de una vez cuánto hay hoy en cada
// cuenta y cuánto se debe. Fluxus registra la diferencia como ajustes y el historial se conserva.
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AmountField } from '../../components/AmountField';
import { Button, LinkButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { SectionTitle } from '../../components/SectionTitle';
import { useToast } from '../../components/Toast';
import { Muted, Txt } from '../../components/Txt';
import { useAuth } from '../../lib/auth';
import { call, errorMessage, type Account } from '../../lib/data';
import { today } from '../../lib/dates';
import { useFinance } from '../../lib/finance';
import { formatMoney, parseAmount, toInputText } from '../../lib/money';
import { colors } from '../../theme';

export default function PonermeAlDia() {
  const { profile } = useAuth();
  const f = useFinance();
  const toast = useToast();
  const c = profile!.currency;
  const accounts = [...f.money, ...f.owe];

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(accounts.map((a) => [a.id, toInputText(a.amount, c)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = (a: Account) => parseAmount(values[a.id] ?? '', c);
  const invalid = accounts.some((a) => {
    const v = parsed(a);
    return v === null || Number.isNaN(v);
  });
  const changed = accounts.filter((a) => {
    const v = parsed(a);
    return v !== null && !Number.isNaN(v) && v !== a.amount;
  });

  // Resumen de lo que se va a registrar
  let spent = 0;
  let received = 0;
  for (const a of changed.filter((x) => x.kind === 'dinero')) {
    const diff = parsed(a)! - a.amount;
    if (diff < 0) spent += -diff;
    else received += diff;
  }
  const oweChanges = changed.filter((x) => x.kind === 'pagar').length;

  async function submit() {
    if (invalid || !changed.length) return;
    setError(null);
    setBusy(true);
    try {
      await call('catch_up', {
        p_items: changed.map((a) => ({ account_id: a.id, amount: parsed(a) })),
        p_date: today(),
      });
      await f.refresh();
      toast(`Listo, te pusiste al día. Se ajustaron ${changed.length} ${changed.length === 1 ? 'cuenta' : 'cuentas'}.`);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const field = (a: Account) => {
    const v = parsed(a);
    const bad = v === null || Number.isNaN(v);
    const diff = bad ? 0 : v - a.amount;
    let message: { text: string; ok: boolean } | null = null;
    if (bad) message = { text: 'Escribí un monto (0 si no hay nada).', ok: false };
    else if (diff !== 0 && a.kind === 'dinero')
      message = diff < 0
        ? { text: `Bajó ${formatMoney(-diff, c)}: queda como gasto sin detallar.`, ok: false }
        : { text: `Subió ${formatMoney(diff, c)}: queda como ingreso.`, ok: true };
    else if (diff !== 0) message = { text: `${diff > 0 ? 'Sube' : 'Baja'} ${formatMoney(Math.abs(diff), c)} lo que debés.`, ok: diff < 0 };
    return (
      <AmountField
        key={a.id}
        currency={c}
        label={a.name}
        value={values[a.id] ?? ''}
        onChangeText={(t) => setValues((x) => ({ ...x, [a.id]: t }))}
        hint={`Fluxus tiene anotado ${formatMoney(a.amount, c)}`}
        message={message}
      />
    );
  };

  return (
    <Screen back title="Ponerme al día">
      <Muted>
        Si pasó un tiempo sin anotar, no hace falta acordarte de todo. Escribí cuánto hay hoy en cada cuenta y cuánto debés: Fluxus registra la diferencia y tu historial se conserva.
      </Muted>

      {f.money.length ? (
        <View style={{ gap: 16 }}>
          <SectionTitle>Tu dinero</SectionTitle>
          {f.money.map(field)}
        </View>
      ) : null}
      {f.owe.length ? (
        <View style={{ gap: 16 }}>
          <SectionTitle>Por pagar</SectionTitle>
          {f.owe.map(field)}
        </View>
      ) : null}

      {changed.length ? (
        <Card style={{ gap: 6 }}>
          <Txt weight="bold">Se va a registrar</Txt>
          {spent > 0 ? <Txt color={colors.expense}>{`Gastos sin detallar: ${formatMoney(spent, c)}`}</Txt> : null}
          {received > 0 ? <Txt color={colors.income}>{`Ingresos: ${formatMoney(received, c)}`}</Txt> : null}
          {oweChanges ? <Txt>{`${oweChanges} ${oweChanges === 1 ? 'monto por pagar' : 'montos por pagar'} actualizado${oweChanges === 1 ? '' : 's'}`}</Txt> : null}
          {spent > 0 ? (
            <Muted size={13}>
              Los gastos van a la categoría &quot;Sin detallar&quot;. Si recordás en qué se usaron, después podés cambiarles la categoría desde Movimientos.
            </Muted>
          ) : null}
        </Card>
      ) : null}

      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button title="Actualizar todo" onPress={submit} disabled={invalid || !changed.length} loading={busy} />

      <View style={{ gap: 4 }}>
        <LinkButton title="¿Falta alguna cuenta? Agregala" onPress={() => router.push('/cuenta/nueva')} />
        <LinkButton title="¿Algo nuevo por pagar? Anotalo" onPress={() => router.push('/por-pagar/anotar')} />
      </View>
    </Screen>
  );
}
