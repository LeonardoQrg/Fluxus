import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Notice } from '../components/Notice';
import { Screen } from '../components/Screen';
import { Muted, Title } from '../components/Txt';
import { signupErrorMessage } from '../lib/authErrors';
import { supabase } from '../lib/supabase';
import { emailOk, normalizeEmail } from '../lib/validation';

export default function CrearPerfil() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const match = repeat ? password === repeat : null;
  const ready = !!name.trim() && emailOk(email) && password.length > 0 && match === true;

  async function submit() {
    if (!ready) return;
    setError(null);
    setBusy(true);
    const mail = normalizeEmail(email);
    const { data, error: e } = await supabase.auth.signUp({
      email: mail,
      password,
      options: { data: { name: name.trim() } },
    });
    // Con la confirmación de correo activada, un correo repetido no da error: vuelve sin identidades
    const duplicated = !e && data.user && data.user.identities?.length === 0;
    if (e || duplicated) {
      setBusy(false);
      setError(signupErrorMessage(duplicated ? { code: 'user_already_exists' } : e));
      return;
    }
    // Según la especificación, después de crear el perfil se vuelve a Iniciar sesión
    if (data.session) await supabase.auth.signOut();
    setBusy(false);
    router.replace({ pathname: '/iniciar-sesion', params: { email: mail, creado: '1' } });
  }

  return (
    <Screen back={() => router.replace('/bienvenida')}>
      <View style={{ gap: 8 }}>
        <Title>Crear nuevo perfil</Title>
        <Muted>Solo necesitás un correo y una contraseña.</Muted>
      </View>

      <Field
        label="Tu nombre"
        hint="Así te vamos a saludar en la app."
        value={name}
        onChangeText={setName}
        placeholder="Ej.: Leo"
        autoCapitalize="words"
        autoComplete="given-name"
        maxLength={60}
      />
      <Field
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        placeholder="nombre@correo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Field
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        password
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Field
        label="Repetir contraseña"
        value={repeat}
        onChangeText={setRepeat}
        password
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        message={match === null ? null : match ? { text: 'Contraseñas correctas', ok: true } : { text: 'Contraseñas incorrectas', ok: false }}
        returnKeyType="done"
        onSubmitEditing={submit}
      />

      {error ? <Notice kind="error">{error}</Notice> : null}

      <Button title="Crear usuario" onPress={submit} disabled={!ready} loading={busy} />
    </Screen>
  );
}
