import { Stack } from 'expo-router';
import { Loading } from '../../components/Loading';
import { useAuth } from '../../lib/auth';
import { colors } from '../../theme';

export default function AppLayout() {
  const { profile, profileError, refreshProfile } = useAuth();

  if (!profile) {
    return (
      <Loading
        error={profileError ? 'No pudimos cargar tu perfil. Revisá tu conexión a internet.' : null}
        onRetry={refreshProfile}
      />
    );
  }

  const configured = profile.onboarding_step === 'done';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      {/* La configuración inicial se hace una sola vez */}
      <Stack.Protected guard={!configured}>
        <Stack.Screen name="configuracion" />
      </Stack.Protected>
      <Stack.Protected guard={configured}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
}
