import { router } from 'expo-router';
import { View } from 'react-native';
import { Button } from '../components/Button';
import { LogoMark } from '../components/icons';
import { Screen } from '../components/Screen';
import { Muted, Txt } from '../components/Txt';
import { colors } from '../theme';

export default function Bienvenida() {
  return (
    <Screen contentStyle={{ justifyContent: 'space-between', paddingTop: 48, gap: 32 }}>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: colors.highlight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LogoMark size={36} />
          </View>
          <Txt weight="extrabold" size={21} style={{ letterSpacing: 1.3 }}>
            FLUXUS
          </Txt>
        </View>
        <Txt weight="bold" size={36} style={{ marginTop: 28, lineHeight: 41, letterSpacing: -0.4 }} accessibilityRole="header">
          Tu dinero, en movimiento y en orden.
        </Txt>
        <View style={{ marginTop: 12, maxWidth: 320 }}>
          <Muted size={17}>Registrá lo que entra y lo que sale, cuenta por cuenta.</Muted>
        </View>
      </View>
      <View style={{ gap: 12 }}>
        <Button title="Iniciar sesión" onPress={() => router.push('/iniciar-sesion')} />
        <Button title="Crear nuevo perfil" variant="secondary" onPress={() => router.push('/crear-perfil')} />
      </View>
    </Screen>
  );
}
