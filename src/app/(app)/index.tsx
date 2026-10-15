// Provisorio (etapa 2): saludo y cerrar sesión. En las etapas 3 y 4 llegan
// la configuración inicial y la pantalla de Inicio completa.
import { ActivityIndicator, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Muted, Title } from '../../components/Txt';
import { useAuth } from '../../lib/auth';
import { colors } from '../../theme';

export default function Inicio() {
  const { profile, session, signOut } = useAuth();

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 8, marginTop: 24 }}>
        <Title>{`Hola, ${profile.name || session?.user.email?.split('@')[0]}`}</Title>
        <Muted>Ya iniciaste sesión. Pronto vas a ver acá tu dinero.</Muted>
      </View>
      <Button title="Cerrar sesión" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
