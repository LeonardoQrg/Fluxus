import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChartIcon, HomeIcon, ListIcon, WalletIcon } from '../../../components/icons';
import { colors, fonts, soft } from '../../../theme';

const ICONS = { index: HomeIcon, cuentas: WalletIcon, movimientos: ListIcon, informe: ChartIcon };

export default function TabsLayout() {
  // En Android con botones de navegación, la barra de abajo no debe quedar debajo de ellos
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, height: 68 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12 },
        tabBarIcon: ({ focused, color }) => {
          const Icon = ICONS[route.name as keyof typeof ICONS] ?? HomeIcon;
          return (
            <View style={{ paddingHorizontal: 18, paddingVertical: 3, borderRadius: 999, backgroundColor: focused ? soft.accent : 'transparent' }}>
              <Icon size={22} color={String(color)} />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="cuentas" options={{ title: 'Cuentas' }} />
      <Tabs.Screen name="movimientos" options={{ title: 'Movimientos' }} />
      <Tabs.Screen name="informe" options={{ title: 'Informe' }} />
    </Tabs>
  );
}
