import { Stack } from 'expo-router';
import { Loading } from '../../components/Loading';
import { useAuth } from '../../lib/auth';
import { FinanceProvider, useFinance } from '../../lib/finance';
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
    // Al terminar la configuración inicial se vuelven a cargar los datos
    <FinanceProvider key={configured ? 'lista' : 'configurando'}>
      <AppStack configured={configured} />
    </FinanceProvider>
  );
}

function AppStack({ configured }: { configured: boolean }) {
  const { loaded, error, refresh } = useFinance();
  if (configured && !loaded) return <Loading error={error} onRetry={refresh} />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      {/* La configuración inicial se hace una sola vez */}
      <Stack.Protected guard={!configured}>
        <Stack.Screen name="configuracion" />
      </Stack.Protected>
      <Stack.Protected guard={configured}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="gasto" />
        <Stack.Screen name="ingreso" />
        <Stack.Screen name="por-pagar/index" />
        <Stack.Screen name="por-pagar/anotar" />
        <Stack.Screen name="por-pagar/pago" />
        <Stack.Screen name="cuenta/nueva" />
        <Stack.Screen name="cuenta/[id]" />
        <Stack.Screen name="transferir" />
      </Stack.Protected>
    </Stack>
  );
}
