import { Alert, Platform, Pressable, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { isGoogleSignInConfigured } from "@/lib/google-signin";

export default function AccountScreen() {
  const { user, logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert("Sair da conta?", "O acesso a turmas e chamadas será encerrado neste aparelho.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScreenContainer className="px-5 pt-4" edges={["top", "left", "right"]}>
      <Text className="text-xs font-bold uppercase tracking-[1.5px] text-primary">Plug and Plus</Text>
      <Text className="mt-1 text-2xl font-black text-foreground">Sua conta</Text>
      <View className="mt-6 rounded-3xl border border-border bg-surface p-5">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-[#E7EEF5]"><Text className="text-lg font-black text-[#36536F]">{(user?.name || user?.email || "P").slice(0, 1).toUpperCase()}</Text></View>
        <Text className="mt-4 text-lg font-black text-foreground">{user?.name || "Professor(a)"}</Text>
        <Text className="mt-1 text-sm text-muted">{user?.email || "Conta não identificada"}</Text>
        <View className="mt-5 self-start rounded-full bg-[#E8F6EE] px-3 py-1.5"><Text className="text-xs font-bold text-[#176E46]">Conta autenticada</Text></View>
      </View>

      <View className="mt-5 rounded-2xl border border-border bg-white p-4">
        <Text className="text-sm font-black text-foreground">Segurança e acesso</Text>
        <Text className="mt-2 text-sm leading-5 text-muted">O aplicativo compara o e-mail da conta com o professor definido em cada turma. Turmas não autorizadas não aparecem na chamada.</Text>
        <Text className="mt-3 text-xs font-semibold text-muted">Login Google: {isGoogleSignInConfigured ? "configurado para a compilação nativa" : "aguardando vinculação OAuth"}</Text>
        {Platform.OS === "web" ? <Text className="mt-2 text-xs leading-5 text-warning">A prévia web não abre o login nativo. Use o APK de desenvolvimento depois que a configuração OAuth estiver vinculada.</Text> : null}
      </View>

      <Pressable onPress={confirmLogout} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })} className="mt-6 items-center rounded-xl border border-[#F1C8C8] bg-white px-4 py-3.5">
        <Text className="text-sm font-bold text-[#B33F3F]">Sair desta conta</Text>
      </Pressable>
    </ScreenContainer>
  );
}
