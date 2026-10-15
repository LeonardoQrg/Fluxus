import { ScrollView, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

/** Pantalla de una sección con barra de navegación abajo */
export function TabScreen({ children, contentStyle }: { children: React.ReactNode; contentStyle?: ViewStyle }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 16, width: '100%', maxWidth: 480, alignSelf: 'center' }, contentStyle]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
