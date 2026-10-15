import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button, LinkButton } from '../components/Button';
import { Field } from '../components/Field';
import { Notice } from '../components/Notice';
import { Screen } from '../components/Screen';
import { Muted, Title, Txt } from '../components/Txt';
import { loginErrorMessage } from '../lib/authErrors';
import { supabase } from '../lib/supabase';
import { normalizeEmail } from '../lib/validation';

export default function IniciarSesion() {
  const params = useLocalSearchParams<{ email?: string; creado?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Completá el correo y la contraseña.');
      return;
    }
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
    setBusy(false);
    // Si salió bien, la app cambia sola a la pantalla de inicio
    if (e) setError(loginErrorMessage(e));
  }

  return (
    <Screen back={() => router.replace('/bienvenida')}>
      <View style={{ gap: 8 }}>
        <Title>Iniciar sesión</Title>
        <Muted>Ingresá con tu correo y contraseña.</Muted>
      </View>

      {params.creado ? <Notice kind="info">Perfil creado. Ya podés iniciar sesión.</Notice> : null}

      <Field
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        placeholder="nombre@correo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Field
        ref={passwordRef}
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        password
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <LinkButton
        title="Olvidé mi contraseña"
        onPress={() => router.push({ pathname: '/olvide-contrasena', params: { email } })}
      />

      {error ? <Notice kind="error">{error}</Notice> : null}

      <Button title="Ingresar" onPress={submit} loading={busy} />

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Txt size={14} color="#8D9BC4">
          ¿No tenés perfil?
        </Txt>
        <LinkButton title="Crear nuevo perfil" onPress={() => router.replace('/crear-perfil')} />
      </View>
    </Screen>
  );
}
