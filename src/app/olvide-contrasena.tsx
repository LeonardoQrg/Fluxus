import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Notice } from '../components/Notice';
import { Screen } from '../components/Screen';
import { Muted, Title } from '../components/Txt';
import { recoveryRedirectUrl, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { emailOk, normalizeEmail } from '../lib/validation';

export default function OlvideContrasena() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { linkError, clearLinkError } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => clearLinkError(), [clearLinkError]);

  async function submit() {
    setError(null);
    setSentTo(null);
    if (!emailOk(email)) {
      setError('Escribí un correo válido, por ejemplo nombre@correo.com.');
      return;
    }
    setBusy(true);
    // No se revela si el correo existe: la respuesta es siempre la misma
    await supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo: recoveryRedirectUrl() });
    setBusy(false);
    setSentTo(email.trim());
  }

  return (
    <Screen back>
      <View style={{ gap: 8 }}>
        <Title>Recuperar contraseña</Title>
        <Muted>Te enviamos un enlace a tu correo para crear una contraseña nueva.</Muted>
      </View>

      {linkError && !sentTo ? <Notice kind="warn">{linkError}</Notice> : null}

      <Field
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        placeholder="nombre@correo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
      />

      {error ? <Notice kind="error">{error}</Notice> : null}
      {sentTo ? <Notice kind="info">{`Si hay un perfil con ${sentTo}, vas a recibir el enlace en unos minutos.`}</Notice> : null}

      <Button title="Enviar enlace" onPress={submit} loading={busy} />
    </Screen>
  );
}
