import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { Txt } from './Txt';

const ToastContext = createContext<(message: string) => void>(() => {});

/** Muestra un aviso corto abajo de la pantalla: toast('Gasto registrado') */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(m);
    timer.current = setTimeout(() => setMessage(null), 2800);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 90, alignItems: 'center' }}
        >
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{ backgroundColor: colors.text, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, maxWidth: 440 }}
          >
            <Txt weight="medium" size={14} color={colors.background} center>
              {message}
            </Txt>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}
