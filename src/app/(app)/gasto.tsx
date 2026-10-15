// Registrar (o editar, con ?id=) un gasto. Se puede pagar con una cuenta o dividir entre varias.
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AmountField } from '../../components/AmountField';
import { Button, LinkButton } from '../../components/Button';
import { categoryReady, CategoryField, NEW_CATEGORY } from '../../components/CategoryField';
import { DateField } from '../../components/DateField';
import { Field } from '../../components/Field';
import { SplitIcon } from '../../components/icons';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { Select, type Option } from '../../components/Select';
import { useToast } from '../../components/Toast';
import { Muted, Txt } from '../../components/Txt';
import { useAuth } from '../../lib/auth';
import { call, createCategory, errorMessage } from '../../lib/data';
import { today } from '../../lib/dates';
import { balancesWithout, useFinance } from '../../lib/finance';
import { CURRENCIES, formatMoney, parseAmount, toInputText } from '../../lib/money';
import { colors, fonts, soft } from '../../theme';

type SplitRow = { acc: string; amt: string };

export default function Gasto() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { profile } = useAuth();
  const f = useFinance();
  const toast = useToast();
  const c = profile!.currency;
  const old = (id && f.movements.find((m) => m.id === id && m.type === 'gasto')) || null;

  // Saldos como si el gasto original no existiera (al editar)
  const balances = useMemo(() => balancesWithout(f.accounts, old), [f.accounts, old]);
  const bal = (accId: string) => balances.get(accId) ?? 0;
  const isMoney = (accId: string) => f.accountById(accId)?.kind === 'dinero';

  const [amount, setAmount] = useState(old ? toInputText(old.amount, c) : '');
  const [category, setCategory] = useState(old?.category_id ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [date, setDate] = useState(old?.date ?? today());
  const [description, setDescription] = useState(old?.description ?? '');
  const [split, setSplit] = useState(!!old && old.parts.length > 1);
  const [single, setSingle] = useState(old && old.parts.length === 1 ? old.parts[0].account_id : '');
  const [rows, setRows] = useState<SplitRow[]>(
    old && old.parts.length > 1 ? old.parts.map((p) => ({ acc: p.account_id, amt: toInputText(p.amount, c) })) : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cards = f.owe.filter((a) => a.owe_type === 'tarjeta' || old?.parts.some((p) => p.account_id === a.id));
  const payOptions: Option[] = [
    ...f.money.map((a) => ({ value: a.id, label: a.name, detail: formatMoney(bal(a.id), c), group: 'Dinero' })),
    ...cards.map((a) => ({ value: a.id, label: a.name, detail: 'tarjeta', group: 'Tarjetas de crédito' })),
  ];

  const total = parseAmount(amount, c);
  const totalOk = total !== null && !Number.isNaN(total) && total > 0;
  const v = totalOk ? total : 0;

  // Con una sola cuenta: ¿alcanza el saldo?
  const short = !split && single && isMoney(single) && totalOk && v > bal(single) ? v - bal(single) : 0;

  // Pago dividido: revisar cada fila
  const rowAmounts = rows.map((r) => parseAmount(r.amt, c));
  const rowMessages = rows.map((r, i) => {
    const amt = rowAmounts[i];
    if (r.acc && rows.findIndex((x) => x.acc === r.acc) !== i) return 'Esta cuenta ya está en otra fila';
    if (r.amt && (amt === null || Number.isNaN(amt) || amt <= 0)) return 'Revisá el monto';
    if (r.acc && isMoney(r.acc) && amt !== null && !Number.isNaN(amt) && amt > bal(r.acc))
      return `En ${f.accountById(r.acc)?.name} tenés ${formatMoney(bal(r.acc), c)}`;
    return '';
  });
  const assigned = rowAmounts.reduce<number>((t, a) => t + (a !== null && !Number.isNaN(a) && a > 0 ? a : 0), 0);
  const rest = v - assigned;
  const rowsOk =
    rows.length >= 2 &&
    rows.every((r, i) => r.acc && !rowMessages[i] && rowAmounts[i] !== null && !Number.isNaN(rowAmounts[i]!) && rowAmounts[i]! > 0) &&
    rest === 0;

  const payOk = split ? rowsOk : !!single && !short;
  const ready = totalOk && categoryReady(category, newCategory) && !!date && payOk;

  function enterSplit() {
    if (single && isMoney(single) && v > bal(single)) {
      setRows([
        { acc: single, amt: toInputText(bal(single), c) },
        { acc: '', amt: toInputText(v - bal(single), c) },
      ]);
    } else {
      setRows([
        { acc: single, amt: '' },
        { acc: '', amt: '' },
      ]);
    }
    setSplit(true);
  }

  const updateRow = (i: number, change: Partial<SplitRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...change } : r)));

  async function submit() {
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      const cat = category === NEW_CATEGORY ? (await createCategory(newCategory, f.categories)).id : category;
      const parts = split ? rows.map((r, i) => ({ account_id: r.acc, amount: rowAmounts[i] })) : [{ account_id: single, amount: v }];
      if (old) {
        await call('update_movement', {
          p_id: old.id,
          p_date: date,
          p_amount: v,
          p_description: description,
          p_category_id: cat,
          p_parts: parts,
        });
      } else {
        await call('register_movement', {
          p_type: 'gasto',
          p_date: date,
          p_amount: v,
          p_description: description,
          p_category_id: cat,
          p_parts: parts,
        });
      }
      await f.refresh();
      toast(old ? 'Cambios guardados' : `Gasto de ${formatMoney(v, c)} registrado`);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen back title={old ? 'Editar gasto' : 'Registrar gasto'}>
      {old ? <Muted size={14}>Al guardar, los saldos de las cuentas se corrigen solos.</Muted> : null}

      <AmountField currency={c} value={amount} onChangeText={setAmount} label="Monto total" big autoFocus={!old} />
      <CategoryField categories={f.categories} value={category} onChange={setCategory} newName={newCategory} onNewName={setNewCategory} />
      <DateField value={date} onChange={setDate} />

      {/* Pagado con */}
      <View style={{ gap: 8 }}>
        {!split ? (
          <>
            <Select label="Pagado con" value={single} onChange={setSingle} options={payOptions} placeholder="Elegí una cuenta" />
            {short ? (
              <View style={{ backgroundColor: colors.warningBackground, borderRadius: 12, padding: 14, gap: 12 }} accessibilityRole="alert">
                <Txt size={15} color={colors.warning}>
                  {`En ${f.accountById(single)?.name} tenés ${formatMoney(bal(single), c)}. Faltan ${formatMoney(short, c)} para cubrir este gasto. Ninguna cuenta puede quedar en negativo.`}
                </Txt>
                <Button title="Dividir el pago con otra cuenta" small onPress={enterSplit} />
              </View>
            ) : null}
            <SplitLink title="Dividir el pago entre varias cuentas" onPress={enterSplit} />
            {!cards.length ? <Muted size={13}>¿Pagaste con tarjeta de crédito? Anotala primero en &quot;Por pagar&quot;.</Muted> : null}
          </>
        ) : (
          <>
            <Txt weight="semibold" size={14}>
              Pagado con
            </Txt>
            <View style={{ backgroundColor: soft.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 10 }}>
              <Muted size={14}>Elegí cada cuenta y cuánto pagaste con ella.</Muted>
              {rows.map((r, i) => (
                <View key={i} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Select compact value={r.acc} onChange={(acc) => updateRow(i, { acc })} options={payOptions} placeholder={`Cuenta ${i + 1}`} />
                    <View
                      style={{
                        flex: 0.8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: colors.surface,
                        borderWidth: 1.5,
                        borderColor: colors.border,
                        borderRadius: 12,
                        minHeight: 48,
                        paddingHorizontal: 10,
                      }}
                    >
                      <Txt weight="semibold" color={colors.textMuted}>
                        {CURRENCIES[c].symbol}
                      </Txt>
                      <TextInput
                        value={r.amt}
                        onChangeText={(amt) => updateRow(i, { amt })}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        placeholder="0"
                        placeholderTextColor={colors.onDisabled}
                        accessibilityLabel={`Monto con la cuenta ${i + 1}`}
                        style={{ flex: 1, minWidth: 0, color: colors.text, fontFamily: fonts.regular, fontSize: 16, textAlign: 'right', paddingVertical: 10 }}
                      />
                    </View>
                    {rows.length > 2 ? (
                      <Pressable
                        onPress={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                        accessibilityRole="button"
                        accessibilityLabel="Quitar esta cuenta"
                        style={{ width: 32, height: 44, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Txt size={24} color={colors.textMuted}>
                          ×
                        </Txt>
                      </Pressable>
                    ) : null}
                  </View>
                  {rowMessages[i] ? (
                    <Txt size={13} color={colors.expense}>
                      {rowMessages[i]}
                    </Txt>
                  ) : null}
                </View>
              ))}
              <SplitLink
                title="+ Agregar otra cuenta"
                noIcon
                onPress={() => setRows((rs) => [...rs, { acc: '', amt: rest > 0 ? toInputText(rest, c) : '' }])}
              />
              <SplitSummary total={v} assigned={assigned} currency={c} />
              <LinkButton
                title="Pagar con una sola cuenta"
                color={colors.textMuted}
                onPress={() => {
                  setSingle(rows[0]?.acc ?? '');
                  setRows([]);
                  setSplit(false);
                }}
              />
            </View>
          </>
        )}
      </View>

      <Field
        label="Descripción (opcional)"
        value={description}
        onChangeText={setDescription}
        placeholder="Ej.: Entradas del cine"
        maxLength={200}
      />

      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button title={old ? 'Guardar cambios' : 'Registrar gasto'} onPress={submit} disabled={!ready} loading={busy} />
    </Screen>
  );
}

function SplitLink({ title, onPress, noIcon }: { title: string; onPress: () => void; noIcon?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, alignSelf: 'flex-start' }}
    >
      {noIcon ? null : <SplitIcon />}
      <Txt weight="semibold" size={15} color={colors.accent}>
        {title}
      </Txt>
    </Pressable>
  );
}

function SplitSummary({ total, assigned, currency }: { total: number; assigned: number; currency: Parameters<typeof formatMoney>[1] }) {
  if (!(total > 0)) return <Muted size={14}>Escribí arriba el monto total del gasto.</Muted>;
  const rest = total - assigned;
  const head = `Repartido ${formatMoney(assigned, currency)} de ${formatMoney(total, currency)} · `;
  if (rest > 0)
    return (
      <Txt size={14} color={colors.textMuted} accessibilityLiveRegion="polite">
        {head}
        <Txt size={14} weight="bold" color={colors.textMuted}>{`falta ${formatMoney(rest, currency)}`}</Txt>
      </Txt>
    );
  if (rest < 0)
    return (
      <Txt size={14} color={colors.expense} accessibilityLiveRegion="polite">
        {head}
        <Txt size={14} weight="bold" color={colors.expense}>{`te pasaste ${formatMoney(-rest, currency)}`}</Txt>
      </Txt>
    );
  return (
    <Txt size={14} weight="semibold" color={colors.income} accessibilityLiveRegion="polite">
      {`✓ Repartido el total de ${formatMoney(total, currency)}`}
    </Txt>
  );
}
