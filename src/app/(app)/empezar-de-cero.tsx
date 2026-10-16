// Empezar de cero: borra movimientos, cuentas y lo que se debe, y vuelve a la configuración inicial.
// El perfil (nombre y correo) se mantiene. No se puede deshacer.
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Field } from '../../components/Field';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { Muted, Txt } from '../../components/Txt';
import { useAuth } from '../../lib/auth';
import { call, errorMessage } from '../../lib/data';
import { colors } from '../../theme';

const WORD = 'BORRAR';

export default function EmpezarDeCero() {
  const { refreshProfile } = useAuth();
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = typed.trim().toUpperCase() === WORD;

  async function reset() {
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      await call('reset_my_data', {});
      toast('Listo, todo borrado. Cargá de nuevo lo que tenés hoy.');
      await refreshProfile(); // la app vuelve sola a la configuración inicial
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen back title="Empezar de cero">
      <Muted>Sirve si pasó mucho tiempo y preferís arrancar limpio en vez de corregir cuenta por cuenta.</Muted>
      <Card style={{ gap: 12, borderColor: colors.expense }}>
        <Txt weight="bold" color={colors.expense}>
          Esto no se puede deshacer
        </Txt>
        <Txt>Se borran todos tus movimientos, tus cuentas y lo que tenés anotado por pagar. Tus categorías vuelven a las iniciales.</Txt>
        <Txt>Se mantienen tu perfil (nombre y correo) y tu moneda. Después vas a cargar de nuevo lo que tenés hoy y lo que debés.</Txt>
      </Card>
      <View style={{ gap: 6 }}>
        <Field label={`Para confirmar, escribí ${WORD}`} value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} />
      </View>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button title="Borrar todo y empezar de cero" variant="danger" disabled={!ready} loading={busy} onPress={reset} />
    </Screen>
  );
}
