// Detalle de una cuenta: saldo, acciones (cambiar nombre, ajustar, transferir, pagar, eliminar)
// y sus movimientos del más reciente al más antiguo.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AmountField } from '../../../components/AmountField';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { categoryReady, CategoryField, NEW_CATEGORY } from '../../../components/CategoryField';
import { Field } from '../../../components/Field';
import { MovementList, MovementRow } from '../../../components/MovementRow';
import { Notice } from '../../../components/Notice';
import { Screen } from '../../../components/Screen';
import { SectionTitle } from '../../../components/SectionTitle';
import { Select } from '../../../components/Select';
import { useToast } from '../../../components/Toast';
import { Muted, Title, Txt } from '../../../components/Txt';
import { useAuth } from '../../../lib/auth';
import { call, createCategory, errorMessage, OWE_TYPES, type Account } from '../../../lib/data';
import { today } from '../../../lib/dates';
import { describeForAccount } from '../../../lib/describe';
import { movementAccountIds, useFinance } from '../../../lib/finance';
import { useArmed } from '../../../lib/useArmed';
import { formatMoney, parseAmount, toInputText, type CurrencyCode } from '../../../lib/money';
import { colors, soft } from '../../../theme';

type Panel = null | 'nombre' | 'ajuste' | 'eliminar';

export default function CuentaDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const f = useFinance();
  const c = profile!.currency;
  const [panel, setPanel] = useState<Panel>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const a = f.accountById(id);

  if (!a || a.deleted_at) {
    return (
      <Screen back>
        <Muted>Esta cuenta ya no existe.</Muted>
      </Screen>
    );
  }

  const money = a.kind === 'dinero';
  const list = f.movements.filter((m) => movementAccountIds(m).includes(a.id));
  const open = (p: Panel) => {
    setFlash(null);
    setPanel(p);
  };

  return (
    <Screen back={panel ? () => setPanel(null) : true}>
      <View style={{ gap: 4 }}>
        <SectionTitle color={colors.accent}>{money ? 'Cuenta de dinero' : OWE_TYPES[a.owe_type ?? 'otro']}</SectionTitle>
        <Title>{a.name}</Title>
        <Txt weight="bold" size={34} tabular style={{ marginTop: 6, lineHeight: 40 }}>
          {formatMoney(a.amount, c)}
        </Txt>
        <Muted size={14}>{money ? 'Saldo actual' : 'Lo que debés hoy'}</Muted>
      </View>

      {flash ? <Notice kind="info">{flash}</Notice> : null}

      {panel === 'nombre' ? <RenamePanel account={a} onDone={() => setPanel(null)} /> : null}
      {panel === 'ajuste' ? (
        <AdjustPanel
          account={a}
          currency={c}
          onCancel={() => setPanel(null)}
          onDone={(amount) => {
            setPanel(null);
            setFlash(`Se ha actualizado el monto total de ${a.name}. El monto actual es ${formatMoney(amount, c)}.`);
          }}
        />
      ) : null}
      {panel === 'eliminar' ? <DeletePanel account={a} currency={c} onCancel={() => setPanel(null)} /> : null}

      {!panel ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
          <Action title="Cambiar nombre" onPress={() => open('nombre')} />
          <Action title={money ? 'Ajustar saldo' : 'Actualizar monto'} onPress={() => open('ajuste')} />
          {money && f.money.length > 1 ? (
            <Action title="Transferir" onPress={() => router.push({ pathname: '/transferir', params: { from: a.id } })} />
          ) : null}
          {!money && a.amount > 0 ? (
            <Action title="Registrar un pago" onPress={() => router.push({ pathname: '/por-pagar/pago', params: { to: a.id } })} />
          ) : null}
          <Action title="Eliminar" danger onPress={() => open('eliminar')} />
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <SectionTitle>Movimientos</SectionTitle>
        {list.length ? (
          <MovementList>
            {list.map((m, i) => (
              <MovementRow
                key={m.id}
                view={describeForAccount(m, a, f, c)}
                last={i === list.length - 1}
                onPress={() => router.push({ pathname: '/movimiento/[id]', params: { id: m.id } })}
              />
            ))}
          </MovementList>
        ) : (
          <Card style={{ borderStyle: 'dashed', backgroundColor: soft.surface2, padding: 14 }}>
            <Muted size={14}>Esta cuenta todavía no tiene movimientos.</Muted>
          </Card>
        )}
      </View>
    </Screen>
  );
}

function Action({ title, onPress, danger }: { title: string; onPress: () => void; danger?: boolean }) {
  return (
    <View style={{ width: '48.5%' }}>
      <Button title={title} variant="secondary" small onPress={onPress} textColor={danger ? colors.expense : undefined} />
    </View>
  );
}

function RenamePanel({ account, onDone }: { account: Account; onDone: () => void }) {
  const f = useFinance();
  const toast = useToast();
  const [name, setName] = useState(account.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return setError('Poné un nombre a la cuenta.');
    setBusy(true);
    try {
      await call('rename_account', { p_id: account.id, p_name: name });
      await f.refresh();
      toast('Nombre actualizado');
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 16 }}>
      <Field label="Nombre de la cuenta" value={name} onChangeText={setName} autoFocus maxLength={60} onSubmitEditing={save} />
      {error ? <Notice kind="error">{error}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button title="Cancelar" variant="secondary" style={{ flex: 1 }} onPress={onDone} />
        <Button title="Guardar" style={{ flex: 1 }} onPress={save} loading={busy} />
      </View>
    </Card>
  );
}

function AdjustPanel({
  account,
  currency: c,
  onCancel,
  onDone,
}: {
  account: Account;
  currency: CurrencyCode;
  onCancel: () => void;
  onDone: (amount: number) => void;
}) {
  const f = useFinance();
  const money = account.kind === 'dinero';
  const [amount, setAmount] = useState(toInputText(account.amount, c));
  const [category, setCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const v = parseAmount(amount, c);
  const valid = v !== null && !Number.isNaN(v);
  const diff = valid ? v - account.amount : 0;
  const needsCategory = money && diff < 0;
  const ready = diff !== 0 && (!needsCategory || categoryReady(category, newCategory));

  async function save() {
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      const cat = needsCategory ? (category === NEW_CATEGORY ? (await createCategory(newCategory, f.categories)).id : category) : null;
      await call('adjust_account', { p_id: account.id, p_new_amount: v, p_category_id: cat, p_description: description, p_date: today() });
      await f.refresh();
      onDone(v!);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 16 }}>
      <Txt>{money ? `¿Cuánto hay hoy en ${account.name}?` : `¿Cuánto debés hoy en ${account.name}?`}</Txt>
      <AmountField currency={c} value={amount} onChangeText={setAmount} label={money ? 'Monto actual correcto' : 'Lo que debés hoy'} big autoFocus />
      {valid && diff === 0 ? <Muted size={14}>Es el mismo monto que ya tenés registrado.</Muted> : null}
      {money && diff < 0 ? (
        <Notice kind="warn">{`Bajó ${formatMoney(-diff, c)}. Para que todo cuadre, se registra como un gasto. Contanos en qué se usó.`}</Notice>
      ) : null}
      {money && diff > 0 ? <Notice kind="info">{`Subió ${formatMoney(diff, c)}. Se registra como un ingreso.`}</Notice> : null}
      {!money && diff !== 0 ? (
        <Notice kind="brand">{`${diff > 0 ? 'Sube' : 'Baja'} ${formatMoney(Math.abs(diff), c)} lo que tenés por pagar.`}</Notice>
      ) : null}
      {needsCategory ? (
        <CategoryField label="¿En qué se usó?" categories={f.categories} value={category} onChange={setCategory} newName={newCategory} onNewName={setNewCategory} />
      ) : null}
      {diff !== 0 ? (
        <Field
          label="Descripción (opcional)"
          value={description}
          onChangeText={setDescription}
          placeholder={money ? (diff < 0 ? 'Ej.: Verdulería, propina' : 'Ej.: Me devolvieron un préstamo') : 'Ej.: Intereses, nuevo resumen'}
          maxLength={200}
        />
      ) : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button title="Cancelar" variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
        <Button title="Actualizar" style={{ flex: 1 }} onPress={save} disabled={!ready} loading={busy} />
      </View>
    </Card>
  );
}

const NEW_ACCOUNT = '__nueva';

function DeletePanel({ account, currency: c, onCancel }: { account: Account; currency: CurrencyCode; onCancel: () => void }) {
  const f = useFinance();
  const toast = useToast();
  const money = account.kind === 'dinero';
  const others = f.money.filter((x) => x.id !== account.id);
  const armed = useArmed();
  const [dest, setDest] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove(args: Record<string, unknown>, message: string) {
    setError(null);
    setBusy(true);
    try {
      await call('delete_account', { p_id: account.id, p_date: today(), ...args });
      await f.refresh();
      toast(message);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (money && !others.length) {
    return (
      <Card style={{ gap: 16 }}>
        <Notice kind="error">Necesitás al menos una cuenta de dinero para registrar gastos e ingresos. Creá otra antes de eliminar esta.</Notice>
        <Button title="Entendido" variant="secondary" onPress={onCancel} />
      </Card>
    );
  }

  if (account.amount === 0) {
    return (
      <Card style={{ gap: 16 }}>
        <Txt>{`¿Eliminar ${account.name}? Sus movimientos quedan en el historial.`}</Txt>
        {error ? <Notice kind="error">{error}</Notice> : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button title="Cancelar" variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
          <Button title="Eliminar" variant="danger" style={{ flex: 1 }} disabled={!armed} loading={busy} onPress={() => remove({}, `Cuenta ${account.name} eliminada`)} />
        </View>
      </Card>
    );
  }

  if (!money) {
    return (
      <Card style={{ gap: 16 }}>
        <Txt>{`Todavía debés ${formatMoney(account.amount, c)} en ${account.name}. Registrá el pago antes de eliminarla, o actualizá el monto si ya no debés nada.`}</Txt>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button title="Cancelar" variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
          <Button
            title="Registrar un pago"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/por-pagar/pago', params: { to: account.id } })}
          />
        </View>
      </Card>
    );
  }

  const destName = dest === NEW_ACCOUNT ? newName.trim() : (f.accountById(dest)?.name ?? '');
  const ready = !!dest && (dest !== NEW_ACCOUNT || !!newName.trim());

  return (
    <View style={{ backgroundColor: colors.warningBackground, borderRadius: 12, padding: 14, gap: 14 }} accessibilityRole="alert">
      <Txt color={colors.warning}>
        {`La cuenta ${account.name} que desea eliminar tiene ${formatMoney(account.amount, c)}. Es necesario mover ese dinero a otra cuenta antes de eliminarla.`}
      </Txt>
      <Select
        label="Mover el dinero a"
        value={dest}
        onChange={setDest}
        placeholder="Elegí una cuenta"
        options={[
          ...others.map((x) => ({ value: x.id, label: x.name, detail: formatMoney(x.amount, c) })),
          { value: NEW_ACCOUNT, label: '+ Crear cuenta nueva', accent: true },
        ]}
      />
      {dest === NEW_ACCOUNT ? <Field label="Nombre de la cuenta nueva" value={newName} onChangeText={setNewName} autoFocus maxLength={60} /> : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button title="Cancelar" variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
        <Button
          title="Mover y eliminar"
          variant="danger"
          style={{ flex: 1 }}
          disabled={!ready || !armed}
          loading={busy}
          onPress={() =>
            remove(
              dest === NEW_ACCOUNT ? { p_new_account_name: newName } : { p_dest_account_id: dest },
              `${formatMoney(account.amount, c)} movidos a ${destName}. Cuenta ${account.name} eliminada`,
            )
          }
        />
      </View>
    </View>
  );
}
