// Eliminar mi cuenta: borra el perfil y todos los datos de la persona. No se puede deshacer.
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Field } from '../../components/Field';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { Muted, Txt } from '../../components/Txt';
import { useAuth } from '../../lib/auth';
import { call, errorMessage } from '../../lib/data';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme';

const WORD = 'ELIMINAR';

export default function EliminarCuenta() {
  const { session } = useAuth();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = typed.trim().toUpperCase() === WORD;

  async function remove() {
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      await call('delete_my_account', {});
      // La cuenta ya no existe: se cierra la sesión guardada en este celular
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen back title="Eliminar mi cuenta">
      <Card style={{ gap: 12, borderColor: colors.expense }}>
        <Txt weight="bold" color={colors.expense}>
          Esto no se puede deshacer
        </Txt>
        <Txt>
          Se borran para siempre tu perfil y todos tus datos: cuentas, movimientos, categorías y lo que tenés anotado por pagar. Nadie, ni nosotros, los puede recuperar después.
        </Txt>
        <Muted size={14}>{`Se va a eliminar el perfil de ${session?.user.email ?? 'tu cuenta'}.`}</Muted>
      </Card>

      <View style={{ gap: 6 }}>
        <Field label={`Para confirmar, escribí ${WORD}`} value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} />
      </View>

      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button title="Eliminar mi cuenta y mis datos" variant="danger" disabled={!ready} loading={busy} onPress={remove} />
    </Screen>
  );
}
