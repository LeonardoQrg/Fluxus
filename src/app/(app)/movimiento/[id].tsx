// Detalle de un movimiento: monto, fecha, categoría, cuentas, descripción y fecha de registro.
// Los ingresos y gastos se pueden editar; todos se pueden eliminar (si no usan una cuenta eliminada).
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '../../../components/Button';
import { Card, Row } from '../../../components/Card';
import { Notice } from '../../../components/Notice';
import { Screen } from '../../../components/Screen';
import { SectionTitle } from '../../../components/SectionTitle';
import { useToast } from '../../../components/Toast';
import { Muted, Title, Txt } from '../../../components/Txt';
import { useAuth } from '../../../lib/auth';
import { call, errorMessage, type MovementType } from '../../../lib/data';
import { dateTime, longDate } from '../../../lib/dates';
import { movementAccountIds, useFinance } from '../../../lib/finance';
import { formatMoney } from '../../../lib/money';
import { useArmed } from '../../../lib/useArmed';
import { colors, soft } from '../../../theme';

const TYPE_NAMES: Record<MovementType, string> = {
  ingreso: 'Ingreso',
  gasto: 'Gasto',
  pago: 'Pago',
  transfer: 'Transferencia',
  nuevo_pagar: 'Anotado por pagar',
  ajuste_pagar: 'Monto por pagar actualizado',
};

export default function MovimientoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const f = useFinance();
  const c = profile!.currency;
  const [confirming, setConfirming] = useState(false);
  const m = f.movements.find((x) => x.id === id);

  if (!m) {
    return (
      <Screen back>
        <Muted>Este movimiento ya no existe.</Muted>
      </Screen>
    );
  }

  const money = (v: number) => formatMoney(v, c);
  const acc = f.accountById;
  const name = (accId: string | null) => {
    const a = acc(accId);
    return a ? `${a.name}${a.deleted_at ? ' (eliminada)' : ''}` : 'Cuenta eliminada';
  };
  const category = f.categoryById(m.category_id)?.name ?? '';

  const rows: [string, string][] = [['Fecha', longDate(m.date)]];
  if (m.type === 'gasto') {
    rows.push(['Categoría', category]);
    rows.push(['Pagado con', m.parts.map((p) => `${name(p.account_id)}${m.parts.length > 1 ? ` · ${money(p.amount)}` : ''}`).join('\n')]);
  }
  if (m.type === 'ingreso') rows.push(['Cuenta', name(m.account_id)]);
  if (m.type === 'pago') {
    rows.push(['Pagado desde', name(m.from_account_id)]);
    rows.push(['Qué pagaste', name(m.to_account_id)]);
  }
  if (m.type === 'transfer') {
    rows.push(['Desde', name(m.from_account_id)]);
    rows.push(['Hacia', name(m.to_account_id)]);
  }
  if (m.type === 'nuevo_pagar' || m.type === 'ajuste_pagar') rows.push(['Cuenta', name(m.to_account_id)]);
  if (m.description) rows.push(['Descripción', m.description]);
  rows.push(['Registrado', dateTime(m.created_at)]);

  const amountText =
    m.type === 'ingreso'
      ? `+${money(m.amount)}`
      : m.type === 'gasto'
        ? `−${money(m.amount)}`
        : m.type === 'ajuste_pagar'
          ? `${(m.delta ?? 0) > 0 ? '+' : '−'}${money(Math.abs(m.delta ?? 0))}`
          : money(m.amount);
  const amountColor = m.type === 'ingreso' ? colors.income : m.type === 'gasto' ? colors.expense : colors.text;

  // Qué pasa si se elimina
  const effects: string[] = [];
  if (m.type === 'ingreso') effects.push(`Se descuentan ${money(m.amount)} de ${name(m.account_id)}.`);
  if (m.type === 'gasto')
    for (const p of m.parts)
      effects.push(
        acc(p.account_id)?.kind === 'pagar'
          ? `Baja ${money(p.amount)} lo que debés en ${name(p.account_id)}.`
          : `Vuelven ${money(p.amount)} a ${name(p.account_id)}.`,
      );
  if (m.type === 'pago') effects.push(`Vuelven ${money(m.amount)} a ${name(m.from_account_id)} y sube lo mismo lo que debés en ${name(m.to_account_id)}.`);
  if (m.type === 'transfer') effects.push(`Vuelven ${money(m.amount)} de ${name(m.to_account_id)} a ${name(m.from_account_id)}.`);
  if (m.type === 'nuevo_pagar') effects.push(`Baja ${money(m.amount)} lo que debés en ${name(m.to_account_id)}.`);
  if (m.type === 'ajuste_pagar')
    effects.push(`${(m.delta ?? 0) > 0 ? 'Baja' : 'Sube'} ${money(Math.abs(m.delta ?? 0))} lo que debés en ${name(m.to_account_id)}.`);

  const locked = movementAccountIds(m).some((x) => !acc(x) || acc(x)!.deleted_at);
  const editable = (m.type === 'ingreso' || m.type === 'gasto') && !locked;
  const title = m.description || (m.type === 'gasto' ? category : TYPE_NAMES[m.type]);

  return (
    <Screen back={confirming ? () => setConfirming(false) : true}>
      <View style={{ gap: 4 }}>
        <SectionTitle color={colors.accent}>{TYPE_NAMES[m.type]}</SectionTitle>
        <Title>{title}</Title>
        <Txt weight="bold" size={34} tabular color={amountColor} style={{ marginTop: 6, lineHeight: 40 }}>
          {amountText}
        </Txt>
      </View>

      <Card style={{ paddingVertical: 6 }}>
        {rows.map(([k, v], i) => (
          <Row key={k} last={i === rows.length - 1}>
            <Muted>{k}</Muted>
            <Txt style={{ flex: 1, textAlign: 'right' }} weight="semibold">
              {v}
            </Txt>
          </Row>
        ))}
      </Card>

      {confirming ? (
        <DeleteConfirm movementId={m.id} effects={effects} onCancel={() => setConfirming(false)} />
      ) : locked ? (
        <Card style={{ borderStyle: 'dashed', backgroundColor: soft.surface2, padding: 14 }}>
          <Muted size={14}>Este movimiento usa una cuenta eliminada, por eso no se puede editar ni eliminar.</Muted>
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {editable ? (
            <Button
              title="Editar"
              onPress={() => router.push({ pathname: m.type === 'gasto' ? '/gasto' : '/ingreso', params: { id: m.id } })}
            />
          ) : null}
          <Button title="Eliminar" variant="secondary" textColor={colors.expense} onPress={() => setConfirming(true)} />
          {!editable ? <Muted size={14}>Para corregir este movimiento, eliminalo y registralo de nuevo con los datos correctos.</Muted> : null}
        </View>
      )}
    </Screen>
  );
}

function DeleteConfirm({ movementId, effects, onCancel }: { movementId: string; effects: string[]; onCancel: () => void }) {
  const f = useFinance();
  const toast = useToast();
  const armed = useArmed();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setError(null);
    setBusy(true);
    try {
      await call('delete_movement', { p_id: movementId });
      router.back();
      await f.refresh();
      toast('Movimiento eliminado');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <View style={{ backgroundColor: colors.warningBackground, borderRadius: 12, padding: 14, gap: 12 }} accessibilityRole="alert">
      <Txt weight="bold" color={colors.warning}>
        ¿Eliminar este movimiento?
      </Txt>
      {effects.map((e) => (
        <Txt key={e} color={colors.warning}>
          {e}
        </Txt>
      ))}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button title="Cancelar" variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
        <Button title="Eliminar" variant="danger" style={{ flex: 1 }} disabled={!armed} loading={busy} onPress={remove} />
      </View>
    </View>
  );
}
