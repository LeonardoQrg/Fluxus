// Etapa 1: pantalla provisoria para comprobar que la app abre en el celular
// y que se conecta con Supabase. En la etapa 2 se reemplaza por la bienvenida.
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { checkConnection, isConfigured } from './src/lib/supabase';
import { formatMoney } from './src/lib/money';
import { colors } from './src/theme';

type Status = 'probando' | 'ok' | 'error' | 'sin-configurar';

export default function App() {
  const [status, setStatus] = useState<Status>(isConfigured ? 'probando' : 'sin-configurar');

  useEffect(() => {
    if (!isConfigured) return;
    checkConnection().then((ok) => setStatus(ok ? 'ok' : 'error'));
  }, []);

  const message = {
    probando: 'Conectando con Supabase…',
    ok: '✓ Conectado con Supabase',
    error: 'No se pudo conectar con Supabase. Revisá la URL y la clave del archivo .env',
    'sin-configurar': 'Falta configurar Supabase en el archivo .env',
  }[status];

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>FLUXUS</Text>
      <Text style={styles.tagline}>Tu dinero, en movimiento y en orden.</Text>
      <Text style={[styles.status, status === 'ok' && { color: colors.income }]}>{message}</Text>
      <Text style={styles.sample}>Ejemplo de monto: {formatMoney(123456, 'ARS')}</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  logo: { color: colors.accent, fontSize: 40, fontWeight: '800', letterSpacing: 4 },
  tagline: { color: colors.text, fontSize: 16 },
  status: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 24 },
  sample: { color: colors.textMuted, fontSize: 14 },
});
