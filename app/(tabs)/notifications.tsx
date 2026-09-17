import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function NotificationsScreen() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const notifications = trpc.notifications.list.useQuery(undefined, { enabled: Boolean(user) });
  const markRead = trpc.notifications.markRead.useMutation();
  if (!user) return <ScreenContainer className="items-center justify-center px-6"><Text className="text-base text-muted">Entre para ver suas notificações.</Text></ScreenContainer>;
  return <ScreenContainer className="bg-background" edges={["top", "left", "right"]}><FlatList data={notifications.data || []} keyExtractor={(item) => String(item.id)} contentContainerStyle={{ padding: 20, paddingBottom: 100 }} ListHeaderComponent={<View><Text className="text-xs font-bold uppercase tracking-[1.5px] text-primary">Acompanhamento</Text><Text className="mt-1 text-2xl font-black text-foreground">Notificações</Text><Text className="mt-2 text-sm leading-5 text-muted">Aqui ficam confirmações de chamada, erros de sincronização e avisos da coordenação.</Text></View>} renderItem={({ item }) => <Pressable onPress={async () => { if (!item.readAt) { await markRead.mutateAsync({ notificationId: item.id }); await utils.notifications.list.invalidate(); } }} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })} className={`mt-3 rounded-2xl border p-4 ${item.readAt ? "border-border bg-white" : "border-[#F4D6B4] bg-[#FFF8EF]"}`}><View className="flex-row items-start justify-between"><Text className="flex-1 text-sm font-black text-foreground">{item.title}</Text>{!item.readAt ? <View className="ml-3 h-2 w-2 rounded-full bg-primary" /> : null}</View><Text className="mt-2 text-sm leading-5 text-muted">{item.message}</Text><Text className="mt-3 text-[11px] font-semibold text-muted">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</Text></Pressable>} ListEmptyComponent={notifications.isLoading ? <ActivityIndicator color="#F28C28" className="mt-10" /> : <View className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-6"><Text className="text-center text-sm text-muted">Não há notificações por enquanto.</Text></View>} /></ScreenContainer>;
}
