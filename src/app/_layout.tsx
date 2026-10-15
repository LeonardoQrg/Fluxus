import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/sora';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
  });

  return (
    <SafeAreaProvider style={{ backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <AuthProvider>
        <Navigation fontsReady={fontsLoaded || !!fontError} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function Navigation({ fontsReady }: { fontsReady: boolean }) {
  const { ready, session, recovering } = useAuth();
  const loaded = fontsReady && ready;

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  // Mientras tanto queda visible la pantalla de carga del sistema
  if (!loaded) return null;

  const signedIn = !!session;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
      {/* Sin sesión: bienvenida y acceso */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="bienvenida" />
        <Stack.Screen name="iniciar-sesion" />
        <Stack.Screen name="olvide-contrasena" />
        <Stack.Screen name="crear-perfil" />
      </Stack.Protected>

      {/* Entró desde el enlace del correo: elegir una contraseña nueva */}
      <Stack.Protected guard={signedIn && recovering}>
        <Stack.Screen name="nueva-contrasena" />
      </Stack.Protected>

      {/* Con sesión: la app */}
      <Stack.Protected guard={signedIn && !recovering}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
