// Informe: un selector de mes controla los cinco bloques.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Card } from '../../../components/Card';
import { Donut } from '../../../components/Donut';
import { SectionTitle } from '../../../components/SectionTitle';
import { Select } from '../../../components/Select';
import { TabScreen } from '../../../components/TabScreen';
import { Muted, Title, Txt } from '../../../components/Txt';
import { useAuth } from '../../../lib/auth';
import { monthKey, monthLabel, monthName, monthTitle, SHORT_MONTHS, shiftMonth } from '../../../lib/dates';
import { useFinance } from '../../../lib/finance';
import { formatMoney, type CurrencyCode } from '../../../lib/money';
import { averageWithSpending, donutSlices, monthTotals, percent, spendingByCategory } from '../../../lib/report';
import { categoryColor, colors, otherCategoryColor, soft } from '../../../theme';

export default function Informe() {
  const { profile } = useAuth();
  const f = useFinance();
  const c = profile!.currency;
  const [ym, setYm] = useState(monthKey());
  const [cmpA, setCmpA] = useState<string | null>(null); // por defecto, el mes anterior al del informe
  const [cmpB, setCmpB] = useState<string | null>(null); // por defecto, el mes del informe
  const [highlight, setHighlight] = useState<number | null>(null);
  const [evoCat, setEvoCat] = useState<string | null>(null);
  const [evoSel, setEvoSel] = useState<number | null>(null);

  const months = [...new Set([monthKey(0), monthKey(1), ...f.movements.map((m) => m.date.slice(0, 7))])].sort().reverse();
  const monthOptions = months.map((m) => ({ value: m, label: monthLabel(m) }));
  const titleOptions = months.map((m) => ({ value: m, label: monthTitle(m) }));
  const catName = (id: string) => f.categoryById(id)?.name ?? 'Sin categoría';
  const catColor = (id: string) => categoryColor(f.categoryById(id)?.sort_order ?? 99);

  const byCat = spendingByCategory(f.movements, ym);
  const ranked = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const { income, expense } = monthTotals(f.movements, ym);
  const mname = monthName(ym);

  // 1 · Dona
  const slices = donutSlices(byCat).map((s) => ({
    key: s.id,
    value: s.value,
    label: s.other ? 'Otras categorías' : catName(s.id),
    color: s.other ? otherCategoryColor : catColor(s.id),
  }));
  const hi = highlight !== null ? slices[highlight] : null;

  // 4 · Comparar meses
  const a = cmpA ?? shiftMonth(ym, -1);
  const b = cmpB ?? ym;
  const A = spendingByCategory(f.movements, a);
  const B = spendingByCategory(f.movements, b);
  const cmpCats = [...new Set([...A.keys(), ...B.keys()])].sort((x, y) => (B.get(y) ?? 0) - (B.get(x) ?? 0) || (A.get(y) ?? 0) - (A.get(x) ?? 0));
  const sum = (m: Map<string, number>) => [...m.values()].reduce((t, v) => t + v, 0);

  // 5 · Evolución
  const usedCats = [...new Set(f.movements.filter((m) => m.type === 'gasto' && m.category_id).map((m) => m.category_id!))].sort((x, y) =>
    catName(x).localeCompare(catName(y), 'es'),
  );
  const evoId = evoCat && usedCats.includes(evoCat) ? evoCat : (ranked[0]?.[0] ?? usedCats[0]);
  const evoMonths = [5, 4, 3, 2, 1, 0].map((k) => shiftMonth(ym, -k));
  const evoValues = evoMonths.map((m) => (evoId ? (spendingByCategory(f.movements, m).get(evoId) ?? 0) : 0));
  const sel = evoSel ?? 5;

  return (
    <TabScreen>
      <Title>Informe</Title>
      <Select
        value={ym}
        onChange={(v) => {
          setYm(v);
          setHighlight(null);
          setEvoSel(null);
          setCmpA(null);
          setCmpB(null);
        }}
        options={monthOptions}
        placeholder="Mes del informe"
      />

      {/* 1 · ¿En qué gastaste más? */}
      <Card style={{ gap: 16 }}>
        <SectionTitle>{`¿En qué gastaste más en ${mname}?`}</SectionTitle>
        {expense ? (
          <>
            <Donut slices={slices} selected={highlight} onSelect={setHighlight}>
              <Txt size={12} color={colors.textMuted} center numberOfLines={2}>
                {hi ? hi.label : `Gastos de ${mname}`}
              </Txt>
              <Txt weight="bold" size={17} tabular center numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {formatMoney(hi ? hi.value : expense, c)}
              </Txt>
              {hi ? (
                <Txt size={12} color={colors.textMuted} center>
                  {`${percent(hi.value, expense)}% del total`}
                </Txt>
              ) : null}
            </Donut>
            <View>
              {slices.map((s, i) => (
                <Pressable
                  key={s.key}
                  onPress={() => setHighlight(highlight === i ? null : i)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: highlight === i }}
                  accessibilityLabel={`${s.label}, ${percent(s.value, expense)}%, ${formatMoney(s.value, c)}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 10,
                    borderBottomWidth: i === slices.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                    opacity: highlight !== null && highlight !== i ? 0.45 : 1,
                  }}
                >
                  <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: s.color }} />
                  <Txt style={{ flex: 1 }} weight={highlight === i ? 'bold' : 'regular'}>
                    {s.label}
                  </Txt>
                  <Txt size={14} color={colors.textMuted} tabular>{`${percent(s.value, expense)}%`}</Txt>
                  <Txt weight="semibold" tabular>
                    {formatMoney(s.value, c)}
                  </Txt>
                </Pressable>
              ))}
            </View>
            <Muted size={13}>Tocá un color o una categoría para destacarla.</Muted>
          </>
        ) : (
          <Empty>{`No hay gastos registrados en ${mname}.`}</Empty>
        )}
      </Card>

      {/* 2 · Resumen del mes */}
      <Card style={{ gap: 8 }}>
        <SectionTitle>{`Resumen de ${mname}`}</SectionTitle>
        <Line label="Ingresos" value={`+${formatMoney(income, c)}`} color={colors.income} />
        <Line label="Gastos" value={`−${formatMoney(expense, c)}`} color={colors.expense} />
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <Txt weight="semibold">{income - expense >= 0 ? 'Te quedó' : 'Gastaste de más'}</Txt>
            <Txt weight="bold" size={20} tabular>
              {formatMoney(Math.abs(income - expense), c)}
            </Txt>
          </View>
        </View>
        <Muted size={13}>Los gastos con tarjeta cuentan en el mes de la compra. Los pagos de tarjetas y deudas no se suman otra vez.</Muted>
      </Card>

      {/* 3 · Todas las categorías */}
      {ranked.length ? (
        <Card style={{ gap: 4 }}>
          <SectionTitle>Todas las categorías</SectionTitle>
          {ranked.map(([id, v]) => (
            <Pressable
              key={id}
              onPress={() => router.navigate({ pathname: '/movimientos', params: { mes: ym, cat: id, tipo: 'gasto', t: String(Date.now()) } })}
              accessibilityRole="button"
              accessibilityLabel={`${catName(id)}, ${formatMoney(v, c)}, ${percent(v, expense)}%. Ver movimientos`}
              style={{ paddingVertical: 8, gap: 6 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <Txt style={{ flex: 1 }}>{catName(id)}</Txt>
                <Txt weight="semibold" tabular>
                  {formatMoney(v, c)}
                  <Txt size={14} color={colors.textMuted}>{` · ${percent(v, expense)}%`}</Txt>
                </Txt>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: soft.surface2, overflow: 'hidden' }}>
                <View style={{ width: `${Math.max(2, (v / ranked[0][1]) * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: catColor(id) }} />
              </View>
            </Pressable>
          ))}
          <Muted size={13}>Tocá una categoría para ver sus movimientos.</Muted>
        </Card>
      ) : null}

      {/* 4 · Comparar meses */}
      <Card style={{ gap: 12 }}>
        <SectionTitle>Comparar meses</SectionTitle>
        <Muted size={14}>Elegí los dos meses. A la izquierda el de antes, a la derecha el que querés comparar.</Muted>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Select compact value={a} onChange={setCmpA} options={titleOptions} placeholder="Mes de antes" />
          <Select compact value={b} onChange={setCmpB} options={titleOptions} placeholder="Mes a comparar" />
        </View>
        {cmpCats.length ? (
          <View>
            {cmpCats.map((id) => (
              <CompareRow key={id} name={catName(id)} color={catColor(id)} before={A.get(id) ?? 0} after={B.get(id) ?? 0} currency={c} />
            ))}
            <CompareRow name="Total" before={sum(A)} after={sum(B)} currency={c} total />
            <Muted size={13}>{`${monthTitle(b)} contra ${monthTitle(a)}: ▲ gastaste más · ▼ gastaste menos.`}</Muted>
          </View>
        ) : (
          <Empty>No hay gastos en ninguno de los dos meses.</Empty>
        )}
      </Card>

      {/* 5 · Evolución de una categoría */}
      {evoId ? (
        <Card style={{ gap: 12 }}>
          <SectionTitle>Evolución de una categoría</SectionTitle>
          <Select
            value={evoId}
            onChange={(v) => {
              setEvoCat(v);
              setEvoSel(null);
            }}
            options={usedCats.map((id) => ({ value: id, label: catName(id) }))}
            placeholder="Categoría"
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Muted>{monthTitle(evoMonths[sel])}</Muted>
            <Txt weight="bold" size={22} tabular>
              {formatMoney(evoValues[sel], c)}
            </Txt>
          </View>
          <EvolutionBars months={evoMonths} values={evoValues} selected={sel} color={catColor(evoId)} onSelect={setEvoSel} currency={c} />
          <Muted size={13}>{`Últimos 6 meses. Promedio de los meses con gasto: ${formatMoney(averageWithSpending(evoValues), c)}. Tocá una barra para ver su monto.`}</Muted>
        </Card>
      ) : null}
    </TabScreen>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <View style={{ backgroundColor: soft.surface2, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 12, padding: 12 }}>
      <Muted size={14}>{children}</Muted>
    </View>
  );
}

function Line({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Txt>{label}</Txt>
      <Txt weight="semibold" tabular color={color}>
        {value}
      </Txt>
    </View>
  );
}

function CompareRow({
  name,
  color,
  before,
  after,
  currency: c,
  total,
}: {
  name: string;
  color?: string;
  before: number;
  after: number;
  currency: CurrencyCode;
  total?: boolean;
}) {
  const d = after - before;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: total ? 0 : 1, borderBottomColor: colors.border }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {color ? <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: color }} /> : null}
          <Txt weight={total ? 'bold' : 'regular'} style={{ flexShrink: 1 }}>
            {name}
          </Txt>
        </View>
        <Txt size={14} tabular color={colors.textMuted} style={{ paddingLeft: color ? 22 : 0 }}>
          {`${formatMoney(before, c)} → `}
          <Txt size={14} weight={total ? 'bold' : 'semibold'} tabular>
            {formatMoney(after, c)}
          </Txt>
        </Txt>
      </View>
      <Txt weight="semibold" size={14} tabular color={d > 0 ? colors.expense : d < 0 ? colors.income : colors.textMuted}>
        {d === 0 ? 'Igual' : `${d > 0 ? '▲ +' : '▼ −'}${formatMoney(Math.abs(d), c)}`}
      </Txt>
    </View>
  );
}

function EvolutionBars({
  months,
  values,
  selected,
  color,
  onSelect,
  currency: c,
}: {
  months: string[];
  values: number[];
  selected: number;
  color: string;
  onSelect: (i: number) => void;
  currency: CurrencyCode;
}) {
  const max = Math.max(...values, 1);
  const H = 114;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {values.map((v, i) => (
          <Pressable
            key={months[i]}
            onPress={() => onSelect(i)}
            accessibilityRole="button"
            accessibilityLabel={`${monthTitle(months[i])}: ${formatMoney(v, c)}`}
            accessibilityState={{ selected: i === selected }}
            style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }}
          >
            {v > 0 ? (
              <View
                style={{
                  width: 30,
                  height: Math.max(4, (v / max) * (H - 8)),
                  backgroundColor: color,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  opacity: i === selected ? 1 : 0.4,
                }}
              />
            ) : null}
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {months.map((m, i) => (
          <Txt key={m} size={12} center weight={i === selected ? 'bold' : 'regular'} color={i === selected ? colors.text : colors.textMuted} style={{ flex: 1 }}>
            {SHORT_MONTHS[Number(m.slice(5, 7)) - 1]}
          </Txt>
        ))}
      </View>
    </View>
  );
}
