// Cuentas: tu dinero y lo que tenés por pagar, cada una con su monto.
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Button } from '../../../components/Button';
import { SwapIcon } from '../../../components/icons';
import { SectionTitle } from '../../../components/SectionTitle';
import { TabScreen } from '../../../components/TabScreen';
import { Muted, Title, Txt } from '../../../components/Txt';
import { useAuth } from '../../../lib/auth';
import { OWE_TYPES, type Account } from '../../../lib/data';
import { movementAccountIds, useFinance } from '../../../lib/finance';
import { formatMoney } from '../../../lib/money';
import { colors } from '../../../theme';

export default function Cuentas() {
  const { profile } = useAuth();
  const f = useFinance();
  const c = profile!.currency;

  const counts = new Map<string, number>();
  for (const m of f.movements) for (const id of new Set(movementAccountIds(m))) counts.set(id, (counts.get(id) ?? 0) + 1);

  const card = (a: Account) => {
    const owe = a.kind === 'pagar';
    const n = counts.get(a.id) ?? 0;
    return (
      <Pressable
        key={a.id}
        onPress={() => router.push({ pathname: '/cuenta/[id]', params: { id: a.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${a.name}, ${formatMoney(a.amount, c)}`}
        style={({ pressed }) => ({
          width: '48.5%',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 18,
          padding: 14,
          gap: 4,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Txt weight="semibold" numberOfLines={2}>
          {a.name}
        </Txt>
        <Txt weight="bold" size={18} tabular color={owe ? colors.textMuted : colors.text} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(a.amount, c)}
        </Txt>
        <Muted size={12}>{owe ? OWE_TYPES[a.owe_type ?? 'otro'] : n === 1 ? '1 movimiento' : `${n} movimientos`}</Muted>
      </Pressable>
    );
  };

  return (
    <TabScreen>
      <Title>Cuentas</Title>

      <Group title="Tu dinero" total={formatMoney(f.totalMoney, c)}>
        {f.money.map(card)}
      </Group>
      {f.owe.length ? (
        <Group title="Por pagar" total={formatMoney(f.totalOwe, c)} muted>
          {f.owe.map(card)}
        </Group>
      ) : null}

      <View style={{ gap: 10 }}>
        <Button title="+ Nueva cuenta" onPress={() => router.push('/cuenta/nueva')} />
        {f.money.length > 1 ? (
          <Button title="Transferir entre cuentas" variant="secondary" icon={<SwapIcon size={20} />} onPress={() => router.push('/transferir')} />
        ) : null}
      </View>
      <Muted size={14}>Tocá una cuenta para ver sus movimientos, cambiarle el nombre, ajustar el saldo o eliminarla.</Muted>
    </TabScreen>
  );
}

function Group({ title, total, muted, children }: { title: string; total: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <SectionTitle>{title}</SectionTitle>
        <Txt weight="bold" tabular color={muted ? colors.textMuted : colors.text}>
          {total}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>{children}</View>
    </View>
  );
}
