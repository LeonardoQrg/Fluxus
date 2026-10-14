// Conexión con Supabase. La URL y la clave pública salen del archivo .env
// (ver .env.example). La clave pública se puede incluir en la app sin riesgo:
// la seguridad la ponen las reglas de Row Level Security de la base de datos.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export const isConfigured = SUPABASE_URL.startsWith('https://') && SUPABASE_KEY.length > 0;

export const supabase = createClient(isConfigured ? SUPABASE_URL : 'https://sin-configurar.supabase.co', SUPABASE_KEY || 'x', {
  auth: {
    // Guarda la sesión en el celular para no pedir la contraseña cada vez
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Renueva la sesión solo mientras la app está abierta en pantalla
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Verifica que el servidor de Supabase responda. */
export async function checkConnection(): Promise<boolean> {
  if (!isConfigured) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_KEY } });
    return res.ok;
  } catch {
    return false;
  }
}

/** Error que devuelven las funciones del servidor (ver supabase/migrations/…_funciones.sql). */
export type FluxusError = {
  /** Texto para mostrar tal cual */
  message: string;
  /** Código estable, por ejemplo 'saldo_negativo' */
  code: string;
  /** Id de la cuenta involucrada, si hay una */
  accountId: string | null;
};

export function toFluxusError(e: { message: string; details?: string | null; hint?: string | null }): FluxusError {
  return { message: e.message, code: e.details ?? 'desconocido', accountId: e.hint || null };
}
