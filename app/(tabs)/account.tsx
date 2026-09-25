import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useState } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function AccountScreen() {
  const { user, logout, refresh } = useAuth();
  const changePassword = trpc.auth.changePassword.useMutation();
  const logoutAll = trpc.auth.logoutAllDevices.useMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const confirmLogout = () => {
    Alert.alert("Sair da conta?", "O acesso a turmas e chamadas será encerrado neste aparelho.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: logout },
    ]);
  };

  const savePassword = async () => {
    try {
      setNotice(null);
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setModalOpen(false);
      await refresh();
      setNotice("Senha atualizada. Sua sessão continua protegida neste aparelho.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível trocar a senha.");
    }
  };

  const confirmLogoutAll = () => {
    Alert.alert("Encerrar outros acessos?", "Todos os aparelhos precisarão entrar novamente. Este aparelho também será desconectado após a confirmação.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Encerrar acessos", style: "destructive", onPress: async () => { await logoutAll.mutateAsync(); await logout(); } },
    ]);
  };

  return (
    <ScreenContainer className="px-5 pt-4" edges={["top", "left", "right"]}>
      <Text className="text-xs font-bold uppercase tracking-[1.5px] text-primary">Plug and Plus</Text>
      <Text className="mt-1 text-2xl font-black text-foreground">Sua conta</Text>
      <View className="mt-6 rounded-[28px] bg-foreground p-5 shadow-sm">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-[#E7EEF5]"><Text className="text-lg font-black text-[#36536F]">{(user?.name || user?.email || "P").slice(0, 1).toUpperCase()}</Text></View>
        <Text className="mt-4 text-lg font-black text-white">{user?.name || "Professor(a)"}</Text>
        <Text className="mt-1 text-sm text-[#C7D5E3]">{user?.email || "Conta não identificada"}</Text>
        <View className="mt-5 self-start rounded-full bg-[#29435D] px-3 py-1.5"><Text className="text-xs font-bold text-[#9BE0BC]">Sessão protegida neste aparelho</Text></View>
      </View>

      {user?.mustChangePassword ? <View className="mt-5 rounded-2xl border border-[#F4D6B4] bg-[#FFF8EF] p-4"><Text className="text-sm font-black text-[#8B5A20]">Troca de senha necessária</Text><Text className="mt-1 text-sm leading-5 text-[#8B5A20]">A coordenação definiu uma senha temporária. Troque-a antes de continuar usando a conta.</Text><Pressable onPress={() => setModalOpen(true)} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })} className="mt-3 self-start rounded-lg bg-primary px-4 py-2"><Text className="text-xs font-black text-[#17263A]">Trocar agora</Text></Pressable></View> : null}
      {notice ? <Text className="mt-5 rounded-xl bg-[#E8F6EE] p-3 text-xs leading-5 text-[#176E46]">{notice}</Text> : null}

      <View className="mt-5 rounded-2xl border border-border bg-white p-4">
        <Text className="text-sm font-black text-foreground">Segurança e acesso</Text>
        <Text className="mt-2 text-sm leading-5 text-muted">Suas turmas são definidas pela coordenação. A senha fica protegida no servidor e a sessão é salva de forma segura no aparelho.</Text>
        <Pressable onPress={() => setModalOpen(true)} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })} className="mt-4 rounded-xl border border-border px-4 py-3"><Text className="text-sm font-bold text-foreground">Trocar senha</Text></Pressable>
        <Pressable onPress={confirmLogoutAll} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })} className="mt-3 rounded-xl border border-[#F4D6B4] px-4 py-3"><Text className="text-sm font-bold text-[#8B5A20]">Encerrar acessos em todos os aparelhos</Text></Pressable>
      </View>

      <Pressable onPress={confirmLogout} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })} className="mt-6 items-center rounded-xl border border-[#F1C8C8] bg-white px-4 py-3.5"><Text className="text-sm font-bold text-[#B33F3F]">Sair desta conta</Text></Pressable>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View className="flex-1 items-center justify-center bg-black/40 px-5"><View className="w-full rounded-3xl bg-background p-5"><Text className="text-xl font-black text-foreground">Trocar senha</Text><TextInput value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Senha atual" placeholderTextColor="#718096" className="mt-5 rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground" /><TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Nova senha (letra e número)" placeholderTextColor="#718096" className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground" /><Pressable onPress={savePassword} disabled={changePassword.isPending || currentPassword.length < 8 || newPassword.length < 8} style={({ pressed }) => ({ opacity: changePassword.isPending || currentPassword.length < 8 || newPassword.length < 8 ? 0.5 : pressed ? 0.75 : 1 })} className="mt-5 items-center rounded-xl bg-primary px-4 py-3"><Text className="font-black text-[#17263A]">{changePassword.isPending ? "Salvando..." : "Salvar nova senha"}</Text></Pressable><Pressable onPress={() => setModalOpen(false)} className="mt-3 items-center py-2"><Text className="font-bold text-muted">Cancelar</Text></Pressable></View></View>
      </Modal>
    </ScreenContainer>
  );
}
