import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import * as Auth from "@/lib/_core/auth";
import * as Api from "@/lib/_core/api";
import { createOfflineBatchId, listOfflineBatches, queueOfflineBatch, removeOfflineBatch, type OfflineAttendanceBatch } from "@/lib/offline-attendance";
import { trpc } from "@/lib/trpc";
import { formatCivilDate, isDateKey, todayDateKey } from "@/shared/civil-date";

type AttendanceStatus = "PRESENT" | "ABSENT" | "EXCUSED" | "NOT_MARKED";
type AttendanceEntry = { studentId: number; fullName: string; active: boolean; status: AttendanceStatus; observation?: string };

const STATUS = {
  PRESENT: { label: "Presente", short: "P", color: "#1E8E5A", background: "#E8F6EE" },
  ABSENT: { label: "Ausente", short: "F", color: "#C44343", background: "#FCECEC" },
  EXCUSED: { label: "Justificada", short: "J", color: "#8B5A20", background: "#FFF4DF" },
  NOT_MARKED: { label: "Pendente", short: "—", color: "#718096", background: "#EDF1F5" },
} as const;

function todayKey() {
  return todayDateKey();
}

function formatDate(value: string | Date) {
  if (typeof value === "string" && isDateKey(value)) return formatCivilDate(value);
  if (value instanceof Date) return formatCivilDate(`${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`);
  return String(value);
}

function statusLabel(status: AttendanceStatus) {
  return STATUS[status].label;
}

function PressButton({
  children,
  onPress,
  disabled = false,
  tone = "primary",
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "outline" | "danger";
}) {
  const colors = {
    primary: { bg: "#F28C28", text: "#17263A", border: "#F28C28" },
    outline: { bg: "#FFFFFF", text: "#17324D", border: "#DCE5ED" },
    danger: { bg: "#FFFFFF", text: "#B33F3F", border: "#F1C8C8" },
  }[tone];
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
      className="items-center justify-center px-4 py-3"
    >
      <Text style={{ color: colors.text }} className="font-bold text-sm">{children}</Text>
    </Pressable>
  );
}

function LoginGate({ onLoggedIn }: { onLoggedIn: () => void | Promise<void> }) {
  const login = trpc.auth.login.useMutation();
  const [message, setMessage] = useState<string | null>(null);
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");

  const startLogin = async () => {
    try {
      setMessage(null);
      const response = await login.mutateAsync({
        login: loginName.trim(),
        password,
        deviceName: Platform.OS === "web" ? "Navegador" : `${Platform.OS} mobile`,
      });
      await Auth.setSessionToken(response.sessionToken);
      if (Platform.OS === "web") await Api.establishSession(response.sessionToken);
      await Auth.setUserInfo({
        id: response.user.id,
        openId: response.user.openId,
        name: response.user.name,
        email: response.user.email,
        loginMethod: response.user.loginMethod,
        role: response.user.role,
        mustChangePassword: response.user.mustChangePassword,
        active: response.user.active,
        lastSignedIn: new Date(response.user.lastSignedIn),
      });
      await onLoggedIn();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar.");
    }
  };

  return (
    <ScreenContainer className="px-6" edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1 justify-center">
        <View className="mb-10">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary">
            <Text className="text-xl font-black text-[#17263A]">P+</Text>
          </View>
          <Text className="mt-6 text-3xl font-black tracking-tight text-foreground">Presença</Text>
          <Text className="mt-2 text-base leading-6 text-muted">Chamada simples, segura e registrada em um único envio.</Text>
        </View>
        <View className="rounded-3xl border border-border bg-surface p-5">
          <Text className="text-lg font-bold text-foreground">Entrar</Text>
          <Text className="mt-2 text-sm leading-5 text-muted">Use o e-mail e a senha fornecidos pela coordenação. O acesso ficará salvo neste aparelho.</Text>
          <TextInput value={loginName} onChangeText={setLoginName} autoCapitalize="none" keyboardType="email-address" placeholder="E-mail" placeholderTextColor="#718096" className="mt-5 rounded-xl border border-border bg-white px-4 py-3 text-base text-foreground" />
          <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Senha" placeholderTextColor="#718096" className="mt-3 rounded-xl border border-border bg-white px-4 py-3 text-base text-foreground" returnKeyType="done" onSubmitEditing={startLogin} />
          {message ? <Text className="mt-4 rounded-xl bg-[#FCECEC] p-3 text-xs leading-5 text-error">{message}</Text> : null}
          <View className="mt-5">
            <PressButton onPress={startLogin} disabled={login.isPending || loginName.trim().length < 3 || password.length < 8}>
              {login.isPending ? "Entrando..." : "Entrar"}
            </PressButton>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

export default function AttendanceScreen() {
  const { user, loading, refresh } = useAuth();
  const utils = trpc.useUtils();
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [lessonDate, setLessonDate] = useState(todayKey());
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [lessonPickerOpen, setLessonPickerOpen] = useState(false);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentNotes, setNewStudentNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [whatsAppMessage, setWhatsAppMessage] = useState<string | null>(null);
  const [offlineBatches, setOfflineBatches] = useState<OfflineAttendanceBatch[]>([]);
  const [sendingPending, setSendingPending] = useState(false);
  const [webOnline, setWebOnline] = useState(() => Platform.OS !== "web" || typeof navigator === "undefined" ? true : navigator.onLine);

  const classesQuery = trpc.attendance.listClasses.useQuery(undefined, { enabled: Boolean(user) });
  useEffect(() => {
    if (!selectedClassId && classesQuery.data?.length) setSelectedClassId(classesQuery.data[0].id);
  }, [classesQuery.data, selectedClassId]);

  const lessonsQuery = trpc.attendance.listLessons.useQuery(
    { classId: selectedClassId ?? 0 },
    { enabled: Boolean(selectedClassId) },
  );
  const callSheetQuery = trpc.attendance.getCallSheet.useQuery(
    { classId: selectedClassId ?? 0, lessonDate },
    { enabled: Boolean(selectedClassId) && Boolean(lessonDate) },
  );
  const saveBatch = trpc.attendance.saveBatch.useMutation();
  const addStudent = trpc.attendance.addStudent.useMutation();
  const deactivateStudent = trpc.attendance.deactivateStudent.useMutation();

  useEffect(() => {
    listOfflineBatches().then(setOfflineBatches);
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const online = () => setWebOnline(true);
    const offline = () => setWebOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  const resendOfflineBatches = async () => {
    if (!offlineBatches.length) return;
    setSendingPending(true);
    let sent = 0;
    for (const batch of offlineBatches) {
      try {
        await saveBatch.mutateAsync(batch);
        await removeOfflineBatch(batch.clientBatchId);
        sent += 1;
      } catch {
        // Keep the batch until the server accepts it; duplicate delivery is safe by clientBatchId.
      }
    }
    const remaining = await listOfflineBatches();
    setOfflineBatches(remaining);
    setSendingPending(false);
    setNotice(sent ? `${sent} chamada(s) pendente(s) foram enviadas.` : "Ainda não foi possível enviar as chamadas pendentes.");
  };

  useEffect(() => {
    if (callSheetQuery.data) {
      setEntries(callSheetQuery.data.students.map((student) => ({
        studentId: student.id,
        fullName: student.fullName,
        active: student.active,
        status: student.status as AttendanceStatus,
        observation: student.observation || "",
      })));
    }
  }, [callSheetQuery.data, callSheetQuery.dataUpdatedAt, selectedClassId, lessonDate]);

  const selectedClass = useMemo(() => classesQuery.data?.find((item) => item.id === selectedClassId) ?? null, [classesQuery.data, selectedClassId]);
  const pendingCount = entries.filter((entry) => entry.status === "NOT_MARKED").length;
  const presentCount = entries.filter((entry) => entry.status === "PRESENT").length;
  const absentCount = entries.filter((entry) => entry.status === "ABSENT").length;
  const hasNoClasses = Boolean(classesQuery.data && classesQuery.data.length === 0);

  const setStatus = (studentId: number, status: AttendanceStatus) => {
    setEntries((current) => current.map((entry) => entry.studentId === studentId ? { ...entry, status } : entry));
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const markEveryone = (status: AttendanceStatus) => {
    if (!entries.length) return;
    setEntries((current) => current.map((entry) => ({ ...entry, status })));
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const submitAttendance = async () => {
    if (!selectedClassId || !entries.length) return;
    if (!isDateKey(lessonDate)) {
      setNotice("Informe uma data válida no formato AAAA-MM-DD.");
      return;
    }
    if (pendingCount) {
      setNotice(`Ainda existem ${pendingCount} aluno(s) sem marcação. Complete a chamada antes de enviar.`);
      return;
    }
    const clientBatchId = createOfflineBatchId();
    Alert.alert("Enviar chamada?", `Serão atualizados ${entries.length} registros desta aula de uma só vez.`, [
      { text: "Revisar", style: "cancel" },
      {
        text: "Enviar agora",
        onPress: async () => {
          try {
            setNotice(null);
            const result = await saveBatch.mutateAsync({
              classId: selectedClassId,
              lessonDate,
              clientBatchId,
              entries: entries.map(({ studentId, status, observation }) => ({ studentId, status, observation })),
            });
            await utils.attendance.getCallSheet.invalidate({ classId: selectedClassId, lessonDate });
            await utils.attendance.listLessons.invalidate({ classId: selectedClassId });
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setNotice(`${result.entriesSaved} presenças enviadas. Aula ${result.status === "CLOSED" ? "fechada" : "pendente"}.`);
            setWhatsAppMessage(`Plug Presença: chamada de ${selectedClass?.name || "turma"} em ${formatDate(lessonDate)} enviada. Presentes: ${presentCount}; ausentes: ${absentCount}.`);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Não foi possível salvar a chamada.";
            const likelyOffline = /network|fetch|timeout|offline|failed to fetch/i.test(message);
            if (likelyOffline) {
              const pending = await queueOfflineBatch({ classId: selectedClassId, lessonDate, clientBatchId, entries: entries.map(({ studentId, status, observation }) => ({ studentId, status, observation })), createdAt: new Date().toISOString() });
              setOfflineBatches(pending);
              setNotice("Sem conexão. A chamada foi guardada neste aparelho e poderá ser enviada depois.");
            } else setNotice(message);
          }
        },
      },
    ]);
  };

  const createStudent = async () => {
    if (!selectedClassId || newStudentName.trim().length < 3) return;
    try {
      await addStudent.mutateAsync({ classId: selectedClassId, fullName: newStudentName.trim(), notes: newStudentNotes.trim() || undefined });
      setNewStudentName("");
      setNewStudentNotes("");
      setStudentModalOpen(false);
      await utils.attendance.getCallSheet.invalidate({ classId: selectedClassId, lessonDate });
      setNotice("Aluno adicionado. Ele aparecerá nesta e nas próximas aulas.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível adicionar o aluno.");
    }
  };

  const deactivate = (studentId: number, fullName: string) => {
    Alert.alert("Retirar da lista?", `${fullName} não aparecerá em novas aulas. O histórico já registrado será preservado.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Retirar",
        style: "destructive",
        onPress: async () => {
          try {
            await deactivateStudent.mutateAsync({ studentId });
            await utils.attendance.getCallSheet.invalidate({ classId: selectedClassId ?? 0, lessonDate });
            setNotice("Aluno inativado. O histórico de presença foi preservado.");
          } catch (error) {
            setNotice(error instanceof Error ? error.message : "Não foi possível inativar o aluno.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return <ScreenContainer className="items-center justify-center"><ActivityIndicator size="large" color="#F28C28" /></ScreenContainer>;
  }
  if (!user) return <LoginGate onLoggedIn={refresh} />;

  return (
    <ScreenContainer className="bg-background" edges={["top", "left", "right"]}>
      <View className="px-5 pt-3 pb-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-bold uppercase tracking-[1.5px] text-primary">Plug and Plus</Text>
            <Text className="mt-1 text-2xl font-black text-foreground">Nova chamada</Text>
          </View>
          <View className="items-end">
            <Text className="text-sm font-semibold text-foreground">{user.name || "Professor(a)"}</Text>
            <Text className="mt-0.5 max-w-[150px] text-xs text-muted" numberOfLines={1}>{user.email}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.studentId)}
        refreshControl={<RefreshControl refreshing={classesQuery.isRefetching || callSheetQuery.isRefetching} onRefresh={() => { classesQuery.refetch(); callSheetQuery.refetch(); }} tintColor="#F28C28" />}
        ListHeaderComponent={
          <View className="px-5">
            <Pressable onPress={() => setClassPickerOpen(true)} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })} className="rounded-2xl border border-border bg-surface p-4">
              <Text className="text-[11px] font-bold uppercase tracking-[1.2px] text-muted">Turma</Text>
              <View className="mt-1 flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-base font-bold text-foreground">{selectedClass ? selectedClass.name : "Selecionar turma"}</Text>
                  <Text className="mt-0.5 text-xs text-muted">{selectedClass?.course || "Toque para escolher"}</Text>
                </View>
                <Text className="text-xl text-primary">⌄</Text>
              </View>
            </Pressable>

            <View className="mt-3 flex-row gap-3">
              <Pressable onPress={() => setLessonPickerOpen(true)} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })} className="flex-1 rounded-2xl border border-border bg-white p-4">
                <Text className="text-[11px] font-bold uppercase tracking-[1.2px] text-muted">Aula</Text>
                <Text className="mt-1 text-base font-bold text-foreground">{formatDate(lessonDate)}</Text>
                <Text className="mt-0.5 text-xs text-muted">{callSheetQuery.data?.lesson?.status === "CLOSED" ? "Chamada enviada" : "Selecionar ou criar"}</Text>
              </Pressable>
              <Pressable disabled={!selectedClassId} onPress={() => setStudentModalOpen(true)} style={({ pressed }) => ({ opacity: !selectedClassId ? 0.45 : pressed ? 0.75 : 1 })} className="w-28 items-center justify-center rounded-2xl border border-[#F4D6B4] bg-[#FFF8EF] p-3">
                <Text className="text-lg font-black text-primary">＋</Text>
                <Text className="mt-1 text-xs font-bold text-[#8B5A20]">Aluno</Text>
              </Pressable>
            </View>

            {notice ? <Text className="mt-3 rounded-xl bg-[#E8F6EE] p-3 text-xs leading-5 text-[#176E46]">{notice}</Text> : null}
            {whatsAppMessage ? <Pressable onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(whatsAppMessage)}`)} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })} className="mt-2 self-start rounded-lg border border-[#CBEBD8] bg-white px-3 py-2"><Text className="text-xs font-bold text-[#176E46]">Abrir resumo no WhatsApp</Text></Pressable> : null}
            {callSheetQuery.error ? <Text className="mt-3 rounded-xl bg-[#FCECEC] p-3 text-xs leading-5 text-error">{callSheetQuery.error.message}</Text> : null}
            <View className={`mt-3 flex-row items-center justify-between rounded-xl border p-3 ${webOnline ? "border-[#CBEBD8] bg-[#F3FBF6]" : "border-[#F4D6B4] bg-[#FFF8EF]"}`}><Text className={`text-xs font-bold ${webOnline ? "text-[#176E46]" : "text-[#8B5A20]"}`}>{webOnline ? "Conexão disponível para enviar" : "Sem conexão — os envios ficam pendentes"}</Text>{offlineBatches.length ? <Pressable onPress={resendOfflineBatches} disabled={sendingPending} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><Text className="text-xs font-black text-primary">{sendingPending ? "Enviando..." : `Enviar ${offlineBatches.length} pendente(s)`}</Text></Pressable> : null}</View>

            <View className="mt-5 flex-row items-end justify-between">
              <View>
                <Text className="text-lg font-black text-foreground">Quem esteve na aula?</Text>
                <Text className="mt-1 text-xs text-muted">Toque em P, F ou J para cada aluno.</Text>
              </View>
              <Text className="text-xs font-bold text-muted">{entries.length} alunos</Text>
            </View>

            <View className="mt-4 flex-row gap-2">
              <Pressable onPress={() => markEveryone("PRESENT")} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })} className="flex-1 rounded-xl bg-[#E8F6EE] px-3 py-2.5">
                <Text className="text-center text-xs font-bold text-[#176E46]">Todos presentes</Text>
              </Pressable>
              <Pressable onPress={() => markEveryone("ABSENT")} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })} className="flex-1 rounded-xl bg-[#FCECEC] px-3 py-2.5">
                <Text className="text-center text-xs font-bold text-[#B33F3F]">Todos ausentes</Text>
              </Pressable>
            </View>
            <View className="mt-3 flex-row gap-2 pb-3">
              <View className="rounded-full bg-[#E8F6EE] px-3 py-1.5"><Text className="text-xs font-bold text-[#176E46]">P {presentCount}</Text></View>
              <View className="rounded-full bg-[#FCECEC] px-3 py-1.5"><Text className="text-xs font-bold text-[#B33F3F]">F {absentCount}</Text></View>
              {pendingCount ? <View className="rounded-full bg-[#EDF1F5] px-3 py-1.5"><Text className="text-xs font-bold text-muted">Pendentes {pendingCount}</Text></View> : null}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const current = STATUS[item.status];
          return (
            <View className="mx-5 flex-row items-center border-b border-border py-3.5">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-[#E7EEF5]"><Text className="text-sm font-black text-[#36536F]">{item.fullName.slice(0, 1).toUpperCase()}</Text></View>
              <View className="min-w-0 flex-1 pr-2">
                <Text className="text-sm font-bold leading-5 text-foreground">{item.fullName}</Text>
                {!item.active ? <Text className="mt-0.5 text-[10px] font-semibold text-warning">Histórico — aluno inativo</Text> : <Text style={{ color: current.color }} className="mt-0.5 text-[11px] font-semibold">{statusLabel(item.status)}</Text>}
              </View>
              <View className="flex-row gap-1.5">
                {(["PRESENT", "ABSENT", "EXCUSED"] as AttendanceStatus[]).map((status) => {
                  const option = STATUS[status];
                  const selected = item.status === status;
                  return <Pressable key={status} onPress={() => setStatus(item.studentId, status)} style={({ pressed }) => ({ backgroundColor: selected ? option.color : option.background, borderColor: selected ? option.color : option.background, opacity: pressed ? 0.7 : 1 })} className="h-9 w-9 items-center justify-center rounded-xl border"><Text style={{ color: selected ? "#FFFFFF" : option.color }} className="text-xs font-black">{option.short}</Text></Pressable>;
                })}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={callSheetQuery.isLoading ? <View className="items-center py-12"><ActivityIndicator color="#F28C28" /><Text className="mt-3 text-sm text-muted">Carregando alunos...</Text></View> : <View className="mx-5 items-center rounded-2xl border border-dashed border-border bg-surface p-7"><Text className="text-base font-bold text-foreground">{hasNoClasses ? "Nenhuma turma autorizada" : "Nenhum aluno ativo"}</Text><Text className="mt-2 text-center text-sm leading-5 text-muted">{hasNoClasses ? "A coordenação precisa vincular sua conta a uma turma." : "Adicione o primeiro aluno para iniciar a chamada."}</Text></View>}
        contentContainerStyle={{ paddingBottom: 116 }}
      />

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-5 py-3">
        <PressButton onPress={submitAttendance} disabled={!entries.length || saveBatch.isPending}>
          {saveBatch.isPending ? "Enviando chamada..." : pendingCount ? `Faltam ${pendingCount} marcações` : "Enviar presença"}
        </PressButton>
      </View>

      <Modal visible={classPickerOpen} transparent animationType="slide" onRequestClose={() => setClassPickerOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[75%] rounded-t-3xl bg-background px-5 pb-9 pt-5">
            <View className="mb-4 h-1.5 w-10 self-center rounded-full bg-border" />
            <Text className="text-xl font-black text-foreground">Escolher turma</Text>
            <FlatList data={classesQuery.data || []} keyExtractor={(item) => String(item.id)} renderItem={({ item }) => <Pressable onPress={() => { setSelectedClassId(item.id); setClassPickerOpen(false); setNotice(null); }} className="flex-row items-center justify-between border-b border-border py-4"><View><Text className="text-base font-bold text-foreground">{item.name}</Text><Text className="mt-1 text-xs text-muted">{item.course || "Sem curso informado"}</Text></View>{item.id === selectedClassId ? <Text className="text-base font-black text-primary">✓</Text> : null}</Pressable>} />
          </View>
        </View>
      </Modal>

      <Modal visible={lessonPickerOpen} transparent animationType="slide" onRequestClose={() => setLessonPickerOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[82%] rounded-t-3xl bg-background px-5 pb-9 pt-5">
            <View className="mb-4 h-1.5 w-10 self-center rounded-full bg-border" />
            <Text className="text-xl font-black text-foreground">Selecionar aula</Text>
            <TextInput value={lessonDate} onChangeText={setLessonDate} placeholder="AAAA-MM-DD" placeholderTextColor="#718096" keyboardType="numbers-and-punctuation" className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground" />
            <PressButton onPress={() => { setLessonPickerOpen(false); setNotice("Data selecionada. A aula será criada ao enviar a chamada."); }} tone="outline">Usar esta data</PressButton>
            <Text className="mt-6 text-xs font-bold uppercase tracking-[1.2px] text-muted">Aulas recentes</Text>
            <FlatList className="mt-2" data={lessonsQuery.data || []} keyExtractor={(item) => String(item.id)} renderItem={({ item }) => <Pressable onPress={() => { const key = new Date(item.lessonDate).toISOString().slice(0, 10); setLessonDate(key); setLessonPickerOpen(false); setNotice(null); }} className="flex-row items-center justify-between border-b border-border py-4"><View><Text className="text-base font-bold text-foreground">{formatDate(item.lessonDate)}</Text><Text className="mt-1 text-xs text-muted">{item.startTime || "Horário não informado"} · {item.status === "CLOSED" ? "Enviada" : "Pendente"}</Text></View><Text className="text-primary">›</Text></Pressable>} ListEmptyComponent={<Text className="py-6 text-center text-sm text-muted">Ainda não há aulas registradas nesta turma.</Text>} />
          </View>
        </View>
      </Modal>

      <Modal visible={studentModalOpen} transparent animationType="fade" onRequestClose={() => setStudentModalOpen(false)}>
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-h-[86%] rounded-3xl bg-background p-5">
            <Text className="text-xl font-black text-foreground">Alunos da turma</Text>
            <Text className="mt-2 text-sm leading-5 text-muted">Adicione novos alunos ou retire quem não deve aparecer nas próximas aulas. O histórico nunca é apagado.</Text>
            <TextInput value={newStudentName} onChangeText={setNewStudentName} placeholder="Nome completo" placeholderTextColor="#718096" className="mt-5 rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground" />
            <TextInput value={newStudentNotes} onChangeText={setNewStudentNotes} placeholder="Observação opcional" placeholderTextColor="#718096" className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground" />
            <View className="mt-4"><PressButton onPress={createStudent} disabled={addStudent.isPending || newStudentName.trim().length < 3}>{addStudent.isPending ? "Adicionando..." : "Adicionar aluno"}</PressButton></View>
            <FlatList className="mt-5" data={entries} keyExtractor={(item) => `manage-${item.studentId}`} renderItem={({ item }) => <View className="flex-row items-center justify-between border-b border-border py-3"><View className="flex-1 pr-3"><Text className="text-sm font-bold text-foreground">{item.fullName}</Text><Text className="mt-0.5 text-xs text-muted">{item.active ? "Ativo" : "Inativo — histórico preservado"}</Text></View>{item.active ? <Pressable onPress={() => deactivate(item.studentId, item.fullName)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} className="rounded-lg border border-[#F1C8C8] px-3 py-2"><Text className="text-xs font-bold text-[#B33F3F]">Retirar</Text></Pressable> : null}</View>} ListEmptyComponent={<Text className="py-5 text-center text-sm text-muted">Ainda não há alunos cadastrados.</Text>} />
            <View className="mt-4"><PressButton tone="outline" onPress={() => setStudentModalOpen(false)}>Concluir</PressButton></View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
