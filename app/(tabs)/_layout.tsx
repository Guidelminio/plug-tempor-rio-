import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";

export default function TabLayout() {
  const colors = useColors();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 60 + bottomPadding;
  return <Tabs screenOptions={{ tabBarActiveTintColor: colors.tint, tabBarInactiveTintColor: colors.muted, headerShown: false, tabBarButton: HapticTab, tabBarLabelStyle: { fontWeight: "700", fontSize: 12 }, tabBarStyle: { paddingTop: 8, paddingBottom: bottomPadding, height: tabBarHeight, backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: 0.5 } }}>
    <Tabs.Screen name="index" options={{ title: "Chamada", tabBarIcon: ({ color }) => <IconSymbol size={24} name="checklist" color={color} /> }} />
    <Tabs.Screen name="notifications" options={{ title: "Avisos", tabBarIcon: ({ color }) => <IconSymbol size={24} name="bell.fill" color={color} /> }} />
    <Tabs.Screen name="account" options={{ title: "Conta", tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.circle" color={color} /> }} />
    <Tabs.Screen name="admin" options={{ title: "Admin", href: user?.role === "admin" ? undefined : null, tabBarIcon: ({ color }) => <IconSymbol size={24} name="gearshape.fill" color={color} /> }} />
  </Tabs>;
}
