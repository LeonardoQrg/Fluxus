// Movimientos: todos, del más reciente al más antiguo, agrupados por día, con búsqueda y filtros.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { LinkButton } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Chips } from '../../../components/Chips';
import { DownIcon, SearchIcon, UpIcon } from '../../../components/icons';
import { MovementList, MovementRow } from '../../../components/MovementRow';
import { Select, type Option } from '../../../components/Select';
import { TabScreen } from '../../../components/TabScreen';
import { Muted, Title, Txt } from '../../../components/Txt';
import { useAuth } from '../../../lib/auth';
import type { Movement } from '../../../lib/data';
import { dayHeader, monthKey, monthLabel } from '../../../lib/dates';
import { describeForAccount, describeMovement, effectOnAccount } from '../../../lib/describe';
import { movementAccountIds, useFinance } from '../../../lib/finance';
import { formatMoney } from '../../../lib/money';
import { normalize } from '../../../lib/search';
import { colors, fonts, soft } from '../../../theme';

type TypeFilter = 'todo' | 'gasto' | 'ingreso' | 'otros';
type Filters = { q: string; period: string; acc: string; type: TypeFilter; cat: string };

const TYPES: { value: TypeFilter; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'gasto', label: 'Gastos' },
  { value: 'ingreso', label: 'Ingresos' },
  { value: 'otros', label: 'Pagos y transferencias' },
];

export default function Movimientos() {
  // Desde el Informe se puede llegar con filtros ya elegidos (mes, categoría)
  const p = useLocalSearchParams<{ mes?: string; cat?: string; tipo?: TypeFilter; t?: string }>();
  const initial: Filters = {
    q: '',
    period: p.mes ?? monthKey(),
    acc: '',
    type: p.tipo ?? 'todo',
    cat: p.cat ?? '',
  };
  return <Lista key={p.t ?? 'inicio'} initial={initial} />;
}

function Lista({ initial }: { initial: Filters }) {
  const { profile } = useAuth();
  const f = useFinance();
  const c = profile!.currency;
  const [filters, setFilters] = useState<Filters>(initial);
  const set = (change: Partial<Filters>) => setFilters((x) => ({ ...x, ...change }));

  // Opciones de los filtros
  const months = [...new Set([monthKey(0), monthKey(1), ...f.movements.map((m) => m.date.slice(0, 7))])].sort().reverse();
  const periodOptions: Option[] = [...months.map((ym) => ({ value: ym, label: monthLabel(ym) })), { value: 'todos', label: 'Todos los meses' }];
  const used = new Set(f.movements.flatMap(movementAccountIds));
  const accs = f.accounts.filter((a) => !a.deleted_at || used.has(a.id));
  const accountOptions: Option[] = [
    { value: '', label: 'Todas las cuentas' },
    ...accs.filter((a) => !a.deleted_at && a.kind === 'dinero').map((a) => ({ value: a.id, label: a.name, group: 'Dinero' })),
    ...accs.filter((a) => !a.deleted_at && a.kind === 'pagar').map((a) => ({ value: a.id, label: a.name, group: 'Por pagar' })),
    ...accs.filter((a) => a.deleted_at).map((a) => ({ value: a.id, label: a.name, group: 'Eliminadas' })),
  ];
  const usedCats = new Set(f.movements.filter((m) => m.type === 'gasto').map((m) => m.category_id));
  const categoryOptions: Option[] = [
    { value: '', label: 'Todas las categorías' },
    ...f.categories
      .filter((k) => usedCats.has(k.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((k) => ({ value: k.id, label: k.name })),
  ];

  // Aplicar los filtros
  const account = f.accountById(filters.acc);
  const q = normalize(filters.q.trim());
  const list = f.movements.filter((m) => {
    if (filters.period !== 'todos' && !m.date.startsWith(filters.period)) return false;
    if (filters.type === 'gasto' && m.type !== 'gasto') return false;
    if (filters.type === 'ingreso' && m.type !== 'ingreso') return false;
    if (filters.type === 'otros' && (m.type === 'gasto' || m.type === 'ingreso')) return false;
    if (filters.acc && !movementAccountIds(m).includes(filters.acc)) return false;
    if (filters.cat && (m.type !== 'gasto' || m.category_id !== filters.cat)) return false;
    if (q) {
      const text = [m.description, f.categoryById(m.category_id)?.name ?? '', ...movementAccountIds(m).map((id) => f.accountById(id)?.name ?? '')].join(' ');
      if (!normalize(text).includes(q)) return false;
    }
    return true;
  });

  const income = list.filter((m) => m.type === 'ingreso').reduce((t, m) => t + (account ? effectOnAccount(m, account) : m.amount), 0);
  const expense = list.filter((m) => m.type === 'gasto').reduce((t, m) => t + (account ? effectOnAccount(m, account) : m.amount), 0);

  const groups: { date: string; items: Movement[] }[] = [];
  for (const m of list) {
    const last = groups[groups.length - 1];
    if (last && last.date === m.date) last.items.push(m);
    else groups.push({ date: m.date, items: [m] });
  }

  const dirty = filters.q || filters.period !== monthKey() || filters.acc || filters.type !== 'todo' || filters.cat;
  const showCategory = (filters.type === 'todo' || filters.type === 'gasto') && categoryOptions.length > 1;

  return (
    <TabScreen>
      <Title>Movimientos</Title>

      <View style={{ gap: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 12,
            minHeight: 50,
            paddingHorizontal: 14,
          }}
        >
          <SearchIcon />
          <TextInput
            value={filters.q}
            onChangeText={(text) => set({ q: text })}
            placeholder="Buscar descripción, categoría o cuenta"
            placeholderTextColor={colors.onDisabled}
            accessibilityLabel="Buscar"
            autoCorrect={false}
            style={{ flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 10 }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Select compact value={filters.period} onChange={(period) => set({ period })} options={periodOptions} placeholder="Mes" />
          <Select compact value={filters.acc} onChange={(acc) => set({ acc })} options={accountOptions} placeholder="Cuenta" />
        </View>
        <Chips
          label="Tipo"
          options={TYPES}
          value={filters.type}
          onChange={(type) => set({ type, cat: type === 'todo' || type === 'gasto' ? filters.cat : '' })}
        />
        {showCategory ? <Select value={filters.cat} onChange={(cat) => set({ cat })} options={categoryOptions} placeholder="Categoría" /> : null}
        {dirty ? (
          <LinkButton
            title="Limpiar filtros"
            onPress={() => setFilters({ q: '', period: monthKey(), acc: '', type: 'todo', cat: '' })}
          />
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Total label="Ingresos" amount={formatMoney(income, c)} tone="in" />
        <Total label="Gastos" amount={formatMoney(expense, c)} tone="out" />
      </View>

      <Muted size={14}>
        {`${list.length === 1 ? '1 movimiento' : `${list.length} movimientos`}${account ? ` de ${account.name}` : ''}. Tocá uno para ver el detalle, editarlo o eliminarlo.`}
      </Muted>

      {groups.length ? (
        groups.map((g) => (
          <View key={g.date} style={{ gap: 6 }}>
            <Txt weight="semibold" size={13} color={colors.textMuted} style={{ paddingHorizontal: 4 }}>
              {dayHeader(g.date)}
            </Txt>
            <MovementList>
              {g.items.map((m, i) => (
                <MovementRow
                  key={m.id}
                  view={account ? describeForAccount(m, account, f, c) : describeMovement(m, f, c)}
                  last={i === g.items.length - 1}
                  onPress={() => router.push({ pathname: '/movimiento/[id]', params: { id: m.id } })}
                />
              ))}
            </MovementList>
          </View>
        ))
      ) : (
        <Card style={{ borderStyle: 'dashed', backgroundColor: soft.surface2, padding: 14 }}>
          <Muted size={14}>No hay movimientos con estos filtros.</Muted>
        </Card>
      )}
    </TabScreen>
  );
}

function Total({ label, amount, tone }: { label: string; amount: string; tone: 'in' | 'out' }) {
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
    </View>
  );
}
