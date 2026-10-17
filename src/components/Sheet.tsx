import { KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { Txt } from './Txt';

/** Panel que sube desde abajo, sobre la pantalla */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* El teclado sube el panel para que lo que se escribe siga a la vista */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(8,14,24,0.55)', justifyContent: 'flex-end' }}
        onPress={onClose}
        accessibilityLabel="Cerrar"
      >
        <Pressable
          onPress={() => {}}
          accessibilityRole="none"
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '85%',
            width: '100%',
            maxWidth: 520,
            alignSelf: 'center',
            paddingTop: 10,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 }} />
          {title ? (
            <Txt weight="bold" size={18} style={{ paddingHorizontal: 20, marginBottom: 8 }} accessibilityRole="header">
              {title}
            </Txt>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
