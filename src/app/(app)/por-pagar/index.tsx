// Por pagar: resumen, lista de tarjetas y deudas, anotar algo nuevo y registrar pagos.
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button } from '../../../components/Button';
import { Card, Row } from '../../../components/Card';
import { Screen } from '../../../components/Screen';
import { Muted, Txt } from '../../../components/Txt';
import { useAuth } from '../../../lib/auth';
import { OWE_TYPES } from '../../../lib/data';
import { useFinance } from '../../../lib/finance';
import { formatMoney } from '../../../lib/money';
import { colors, soft } from '../../../theme';

export default function PorPagar() {
  const { profile } = useAuth();
  const f = useFinance();
  const c = profile!.currency;

  return (
    <Screen back title="Por pagar">
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <Muted>Total por pagar</Muted>
          <Txt weight="bold" size={24} tabular>
            {formatMoney(f.totalOwe, c)}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Muted size={14}>Tu dinero disponible</Muted>
          <Txt weight="semibold" size={14} tabular>
            {formatMoney(f.totalMoney, c)}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Muted size={14}>Te queda libre</Muted>
          <Txt weight="semibold" size={14} tabular>
            {formatMoney(f.totalMoney - f.totalOwe, c)}
          </Txt>
        </View>
      </Card>

      {f.owe.length ? (
        <Card style={{ paddingVertical: 8 }}>
          {f.owe.map((a, i) => (
            <Row key={a.id} last={i === f.owe.length - 1}>
              <View style={{ flex: 1 }}>
                <Txt>{a.name}</Txt>
                <Muted size={13}>{OWE_TYPES[a.owe_type ?? 'otro']}</Muted>
              </View>
              <Txt weight="semibold" tabular>
                {formatMoney(a.amount, c)}
              </Txt>
            </Row>
          ))}
        </Card>
      ) : (
        <Card style={{ borderStyle: 'dashed', backgroundColor: soft.surface2, padding: 14 }}>
          <Muted size={14}>Todavía no anotaste nada. Sumá tus tarjetas de crédito, cuotas o préstamos para ver cuánto te queda libre.</Muted>
        </Card>
      )}

      <View style={{ gap: 10 }}>
        <Button title="Anotar algo por pagar" onPress={() => router.push('/por-pagar/anotar')} />
        {f.owe.some((a) => a.amount > 0) ? (
          <Button title="Registrar un pago" variant="secondary" onPress={() => router.push('/por-pagar/pago')} />
        ) : null}
      </View>
      <Txt size={14} color={colors.textMuted}>
        Cuando pagás algo con tarjeta, registralo como gasto eligiendo la tarjeta en &quot;Pagado con&quot;. Se suma acá automáticamente.
      </Txt>
    </Screen>
  );
}
