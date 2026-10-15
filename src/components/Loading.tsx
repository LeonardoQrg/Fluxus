import { ActivityIndicator, View } from 'react-native';
import { colors } from '../theme';
import { Button } from './Button';
import { Muted } from './Txt';

/** Pantalla de espera; si hubo un error, ofrece reintentar */
export function Loading({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      {error ? (
        <>
          <Muted>{error}</Muted>
          {onRetry ? <Button title="Reintentar" variant="secondary" onPress={onRetry} style={{ alignSelf: 'stretch' }} /> : null}
        </>
      ) : (
        <ActivityIndicator color={colors.accent} size="large" />
      )}
    </View>
  );
}
