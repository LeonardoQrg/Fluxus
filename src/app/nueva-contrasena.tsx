import { useState } from 'react';
import { View } from 'react-native';
import { Button, LinkButton } from '../components/Button';
import { Field } from '../components/Field';
import { Notice } from '../components/Notice';
import { Screen } from '../components/Screen';
import { Muted, Title } from '../components/Txt';
import { useAuth } from '../lib/auth';
import { passwordErrorMessage } from '../lib/authErrors';
import { supabase } from '../lib/supabase';

/** Se llega acá desde el enlace del correo de "Olvidé mi contraseña" */
export default function NuevaContrasena() {
  const { finishRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const match = repeat ? password === repeat : null;
  const ready = password.length > 0 && match === true;

  async function submit() {
    if (!ready) return;
    setError(null);
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) setError(passwordErrorMessage(e));
    else finishRecovery(); // entra directo a la app
  }

  return (
    <Screen>
      <View style={{ gap: 8, marginTop: 24 }}>
        <Title>Nueva contraseña</Title>
        <Muted>Elegí una contraseña nueva para tu perfil.</Muted>
      </View>
      <Field label="Contraseña nueva" value={password} onChangeText={setPassword} password autoCapitalize="none" autoComplete="new-password" />
      <Field
        label="Repetir contraseña"
        value={repeat}
        onChangeText={setRepeat}
        password
        autoCapitalize="none"
        autoComplete="new-password"
        message={match === null ? null : match ? { text: 'Contraseñas correctas', ok: true } : { text: 'Contraseñas incorrectas', ok: false }}
        onSubmitEditing={submit}
      />
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button title="Guardar contraseña" onPress={submit} disabled={!ready} loading={busy} />
      <LinkButton title="Cancelar" onPress={signOut} />
    </Screen>
  );
}
