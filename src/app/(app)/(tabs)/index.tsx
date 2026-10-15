// Inicio: dinero disponible, lo que queda libre, ingresos y gastos del mes,
// accesos para registrar y los últimos movimientos.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Field } from '../../../components/Field';
import { CardIcon, DownIcon, UpIcon } from '../../../components/icons';
import { MovementList, MovementRow } from '../../../components/MovementRow';
import { SectionTitle } from '../../../components/SectionTitle';
import { Sheet } from '../../../components/Sheet';
import { TabScreen } from '../../../components/TabScreen';
import { useToast } from '../../../components/Toast';
import { Muted, Txt } from '../../../components/Txt';
import { useAuth } from '../../../lib/auth';
import { describeMovement } from '../../../lib/describe';
import { monthKey, monthName, todayTitle } from '../../../lib/dates';
import { useFinance } from '../../../lib/finance';
import { CURRENCIES, formatMoney } from '../../../lib/money';
import { colors, soft } from '../../../theme';

export default function Inicio() {
  const { profile, session } = useAuth();
  const f = useFinance();
  const toast = useToast();
  const [menu, setMenu] = useState(false);

  if (!profile) return null;
  const c = profile.currency;
  const name = profile.name || session?.user.email?.split('@')[0] || '';
  const ym = monthKey();
  const thisMonth = f.movements.filter((m) => m.date.startsWith(ym));
  const income = thisMonth.filter((m) => m.type === 'ingreso').reduce((t, m) => t + m.amount, 0);
  const expense = thisMonth.filter((m) => m.type === 'gasto').reduce((t, m) => t + m.amount, 0);
  const free = f.totalMoney - f.totalOwe;
  const freePct = f.totalMoney > 0 ? Math.max(0, Math.min(100, (free / f.totalMoney) * 100)) : 0;
  const recent = f.movements.slice(0, 5);
  const month = monthName(ym);

  return (
    <TabScreen>
      {/* Encabezado */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight="semibold" size={20} numberOfLines={1}>{`Hola, ${name}`}</Txt>
          <Muted size={14}>{todayTitle()}</Muted>
        </View>
        <Pressable
          onPress={() => setMenu(true)}
          accessibilityRole="button"
          accessibilityLabel="Menú"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: soft.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt weight="bold" color={colors.accent}>
            {(name[0] ?? '?').toUpperCase()}
          </Txt>
        </Pressable>
      </View>

      {/* Dinero disponible */}
      <Card highlight style={{ paddingVertical: 22 }}>
        <Muted size={14}>Dinero disponible</Muted>
        <Txt weight="bold" size={36} tabular style={{ marginTop: 6, lineHeight: 42 }}>
          {formatMoney(f.totalMoney, c)}
        </Txt>
        <Muted size={13}>{`Suma de tus ${f.money.length} ${f.money.length === 1 ? 'cuenta' : 'cuentas'}`}</Muted>
        {f.owe.length ? (
          <>
            <View
              style={{ height: 8, borderRadius: 4, backgroundColor: colors.background, marginTop: 16, overflow: 'hidden' }}
              accessibilityLabel={`Libre ${Math.round(freePct)}% de tu dinero`}
            >
              <View style={{ width: `${freePct}%`, height: '100%', backgroundColor: colors.accent, borderRadius: 4 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 12 }}>
              <View>
                <Muted size={13}>Te queda libre</Muted>
                <Txt weight="semibold" tabular>
                  {formatMoney(free, c)}
                </Txt>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Muted size={13}>Por pagar</Muted>
                <Txt weight="semibold" tabular>
                  {formatMoney(f.totalOwe, c)}
                </Txt>
              </View>
            </View>
          </>
        ) : null}
      </Card>

      {f.totalOwe > f.totalMoney ? (
        <Muted size={14}>Hoy lo que tenés por pagar es más que tu dinero disponible. Verlo claro es el primer paso para ordenarlo.</Muted>
      ) : null}

      {!f.owe.length && !profile.hide_owe_tip ? <OweTip onHide={() => toast('Lo encontrás siempre en el botón "Por pagar"')} /> : null}

      {/* Ingresos y gastos del mes */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <MonthBox label="Ingresos" amount={formatMoney(income, c)} month={month} tone="in" />
        <MonthBox label="Gastos" amount={formatMoney(expense, c)} month={month} tone="out" />
      </View>

      {/* Acciones */}
      <View style={{ gap: 10 }}>
        <ActionButton sign="−" color={colors.expense} title="Registrar gastos" onPress={() => router.push('/gasto')} />
        <ActionButton sign="+" color={colors.income} title="Registrar ingresos" onPress={() => router.push('/ingreso')} />
        <Button
          title={`Por pagar${f.owe.length ? ` · ${formatMoney(f.totalOwe, c)}` : ''}`}
          variant="secondary"
          small
          icon={<CardIcon size={20} />}
          onPress={() => router.push('/por-pagar')}
        />
      </View>

      {/* Últimos movimientos */}
      <View style={{ gap: 8 }}>
        <SectionTitle>Últimos movimientos</SectionTitle>
        {recent.length ? (
          <MovementList>
            {recent.map((m, i) => (
              <MovementRow
                key={m.id}
                view={describeMovement(m, f, c)}
                last={i === recent.length - 1}
                onPress={() => router.push({ pathname: '/movimiento/[id]', params: { id: m.id } })}
              />
            ))}
          </MovementList>
        ) : (
          <Card style={{ borderStyle: 'dashed', backgroundColor: soft.surface2, padding: 14 }}>
            <Muted size={14}>Todavía no registraste movimientos. Empezá con tu primer gasto o ingreso.</Muted>
          </Card>
        )}
      </View>

      <Menu visible={menu} onClose={() => setMenu(false)} />
    </TabScreen>
  );
}

function OweTip({ onHide }: { onHide: () => void }) {
  const { updateProfile } = useAuth();
  return (
    <View style={{ backgroundColor: soft.accent, borderRadius: 18, padding: 16, gap: 10 }}>
      <Txt weight="bold">Sumá lo que tenés por pagar</Txt>
      <Txt size={15}>Tarjetas de crédito, cuotas o préstamos. Así ves cuánto te queda libre de verdad.</Txt>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button
          title="Ahora no"
          variant="secondary"
          small
          style={{ flex: 1 }}
          onPress={async () => {
            await updateProfile({ hide_owe_tip: true }).catch(() => {});
            onHide();
          }}
        />
        <Button title="Anotar" small style={{ flex: 1 }} onPress={() => router.push('/por-pagar/anotar')} />
      </View>
    </View>
  );
}

function MonthBox({ label, amount, month, tone }: { label: string; amount: string; month: string; tone: 'in' | 'out' }) {
  const fg = tone === 'in' ? colors.income : colors.expense;
  const bg = tone === 'in' ? soft.income : soft.expense;
  const Icon = tone === 'in' ? UpIcon : DownIcon;
  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={fg} />
        </View>
        <Txt weight="semibold" size={15} color={fg}>
          {label}
        </Txt>
      </View>
      <Txt weight="bold" size={18} color={colors.textMuted} tabular style={{ marginTop: 10 }} numberOfLines={1} adjustsFontSizeToFit>
        {amount}
      </Txt>
      <Muted size={12}>{`en ${month}`}</Muted>
    </View>
  );
}

function ActionButton({ sign, color, title, onPress }: { sign: string; color: string; title: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <Txt weight="bold" size={20} color={colors.background} style={{ lineHeight: 24 }}>
          {sign}
        </Txt>
      </View>
      <Txt weight="semibold">{title}</Txt>
    </Pressable>
  );
}

/** Menú del círculo con la inicial: cambiar el nombre y cerrar sesión */
function Menu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { profile, session, updateProfile, signOut } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name ?? '');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setEditing(false);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={editing ? 'Tu nombre' : undefined}>
      {editing ? (
        <>
          <Field label="Así te saludamos en la app" value={name} onChangeText={setName} placeholder="Ej.: Leo" autoFocus maxLength={60} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button title="Cancelar" variant="secondary" style={{ flex: 1 }} onPress={() => setEditing(false)} />
            <Button
              title="Guardar"
              style={{ flex: 1 }}
              disabled={!name.trim()}
              loading={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await updateProfile({ name: name.trim() });
                  toast(`Listo, ${name.trim()}`);
                  close();
                } catch {
                  toast('No pudimos guardar el nombre. Intentá de nuevo.');
                }
                setBusy(false);
              }}
            />
          </View>
        </>
      ) : (
        <>
          <View>
            <Txt weight="semibold">{profile?.name}</Txt>
            <Muted size={14}>{`${session?.user.email ?? ''} · Moneda ${profile ? `${profile.currency} (${CURRENCIES[profile.currency].name})` : ''}`}</Muted>
          </View>
          <Button
            title="Cambiar mi nombre"
            variant="secondary"
            onPress={() => {
              setName(profile?.name ?? '');
              setEditing(true);
            }}
          />
          <Button
            title="Cerrar sesión"
            variant="secondary"
            onPress={() => {
              close();
              signOut();
            }}
          />
          <Button
            title="Eliminar mi cuenta"
            variant="ghost"
            textColor={colors.expense}
            onPress={() => {
              close();
              router.push('/eliminar-cuenta');
            }}
          />
        </>
      )}
    </Sheet>
  );
}
