// Sesión de la persona: quién inició sesión, su perfil y el enlace para recuperar la contraseña.
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { CurrencyCode } from './money';
import { supabase } from './supabase';

export type OnboardingStep = 'intro' | 'moneda' | 'banco' | 'efectivo' | 'otras' | 'done';

export type Profile = {
  user_id: string;
  name: string;
  currency: CurrencyCode;
  onboarding_step: OnboardingStep;
  hide_owe_tip: boolean;
};

type AuthState = {
  /** Ya se sabe si hay sesión o no (antes de eso se muestra la pantalla de carga) */
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  /** La persona entró desde el enlace de "Olvidé mi contraseña" y tiene que elegir una nueva */
  recovering: boolean;
  /** No se pudo cargar el perfil (por ejemplo, sin conexión) */
  profileError: boolean;
  /** El enlace de recuperación venció o ya se usó */
  linkError: string | null;
  clearLinkError: () => void;
  finishRecovery: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (changes: Partial<Omit<Profile, 'user_id'>>) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth tiene que usarse dentro de <AuthProvider>');
  return ctx;
}

/** La dirección a la que vuelve el enlace del correo de recuperación */
export const recoveryRedirectUrl = () => Linking.createURL('/');

/** Lee los datos que Supabase agrega al final del enlace (después de # o ?) */
function linkParams(url: string) {
  const out = new URLSearchParams();
  const [, query = ''] = url.split('?');
  const [, hash = ''] = url.split('#');
  for (const part of [query.split('#')[0], hash]) {
    new URLSearchParams(part).forEach((v, k) => out.set(k, v));
  }
  return out;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState(false);

  const userId = session?.user.id ?? null;

  const loadProfile = useCallback(async (uid: string | null) => {
    if (!uid) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, name, currency, onboarding_step, hide_owe_tip')
      .eq('user_id', uid)
      .maybeSingle();
    setProfileError(!!error || !data);
    setProfile((data as Profile | null) ?? null);
  }, []);

  // Sesión guardada en el celular y sus cambios (iniciar o cerrar sesión).
  // Supabase avisa primero con la sesión inicial (INITIAL_SESSION).
  useEffect(() => {
    let lastUser: string | null | undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
      const uid = s?.user.id ?? null;
      if (uid === lastUser) return;
      lastUser = uid;
      // Supabase pide no llamarlo de nuevo dentro de este aviso: se hace apenas termina
      setTimeout(() => {
        loadProfile(uid).finally(() => setReady(true));
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // Enlace del correo de "Olvidé mi contraseña" (al abrir la app o con la app abierta)
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      const p = linkParams(url);
      if (p.get('error') || p.get('error_code')) {
        setLinkError('El enlace venció o ya se usó. Pedí uno nuevo.');
        return;
      }
      const access_token = p.get('access_token');
      const refresh_token = p.get('refresh_token');
      if (p.get('type') === 'recovery' && access_token && refresh_token) {
        setRecovering(true);
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
          if (error) {
            setRecovering(false);
            setLinkError('El enlace venció o ya se usó. Pedí uno nuevo.');
          }
        });
      }
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  const value: AuthState = {
    ready,
    session,
    profile,
    recovering,
    linkError,
    profileError,
    clearLinkError: () => setLinkError(null),
    finishRecovery: () => setRecovering(false),
    refreshProfile: () => loadProfile(userId),
    updateProfile: async (changes) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('profiles')
        .update(changes)
        .eq('user_id', userId)
        .select('user_id, name, currency, onboarding_step, hide_owe_tip')
        .single();
      if (error) throw error;
      setProfile(data as Profile);
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
