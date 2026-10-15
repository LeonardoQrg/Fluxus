import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { BackIcon } from './icons';
import { Txt } from './Txt';

type Props = {
  children: React.ReactNode;
  /** Muestra la flecha para volver (por defecto vuelve a la pantalla anterior) */
  back?: boolean | (() => void);
  title?: string;
  contentStyle?: ViewStyle;
};

/** Pantalla con fondo, márgenes, desplazamiento y teclado bien resueltos */
export function Screen({ children, back, title, contentStyle }: Props) {
  const goBack = typeof back === 'function' ? back : () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 16, width: '100%', maxWidth: 480, alignSelf: 'center' }, contentStyle]}
        >
          {back || title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 4 }}>
              {back ? (
                <Pressable
                  onPress={goBack}
                  accessibilityRole="button"
                  accessibilityLabel="Volver"
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 }}
                >
                  <BackIcon />
                </Pressable>
              ) : null}
              {title ? (
                <Txt weight="bold" size={20}>
                  {title}
                </Txt>
              ) : null}
            </View>
          ) : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
