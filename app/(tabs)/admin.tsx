import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useMemo, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

const Button = ({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) => <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.72 : 1 })} className={`items-center rounded-xl border px-4 py-3 ${secondary ? "border-border bg-white" : "border-primary bg-primary"}`}><Text className={`text-sm font-black ${secondary ? "text-foreground" : "text-[#17263A]"}`}>{label}</Text></Pressable>;

export default function AdminScreen() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const teachers = trpc.admin.listUsers.useQuery(undefined, { enabled: user?.role === "admin" });
  const classes = trpc.admin.listClasses.useQuery(undefined, { enabled: user?.role === "admin" });
  const createTeacher = trpc.admin.createTeacher.useMutation();
  const createClass = trpc.admin.createClass.useMutation();
  const updateTeacher = trpc.admin.updateTeacher.useMutation();
  const [mode, setMode] = useState<"teacher" | "class" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [code, setCode] = useState("");
  const [course, setCourse] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState<number[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const activeTeachers = useMemo(() => (teachers.data || []).filter((item) => item.active && item.role === "user"), [teachers.data]);
  const reset = () => { setMode(null); setName(""); setEmail(""); setTemporaryPassword(""); setCode(""); setCourse(""); setStartTime(""); setEndTime(""); setSelectedTeachers([]); };
  const refresh = async () => { await Promise.all([utils.admin.listUsers.invalidate(), utils.admin.listClasses.invalidate()]); };

  const submitTeacher = async () => {
    try {
      await createTeacher.mutateAsync({ name, email, temporaryPassword });
      setNotice("Professor criado. Informe a senha temporária por um canal seguro.");
      reset(); await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível criar a conta."); }
  };
  const submitClass = async () => {
    try {
      await createClass.mutateAsync({ code, name, course: course || undefined, dayOfWeek: Number(dayOfWeek), startTime: startTime || undefined, endTime: endTime || undefined, teacherIds: selectedTeachers });
      setNotice("Turma criada e professores vinculados.");
      reset(); await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível criar a turma."); }
  };
  const toggleTeacher = (id: number) => setSelectedTeachers((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  if (!user) return <ScreenContainer className="items-center justify-center px-6"><Text className="text-base text-muted">Entre para acessar a administração.</Text></ScreenContainer>;
  if (user.role !== "admin") return <ScreenContainer className="items-center justify-center px-6"><Text className="text-base font-bold text-foreground">Área restrita</Text><Text className="mt-2 text-center text-sm text-muted">Somente a coordenação pode administrar contas e turmas.</Text></ScreenContainer>;

  return <ScreenContainer className="bg-background" edges={["top", "left", "right"]}>
    <FlatList data={classes.data || []} keyExtractor={(item) => String(item.id)} contentContainerStyle={{ padding: 20, paddingBottom: 110 }} ListHeaderComponent={<View><Text className="text-xs font-bold uppercase tracking-[1.5px] text-primary">Coordenação</Text><Text className="mt-1 text-2xl font-black text-foreground">Administração</Text><Text className="mt-2 text-sm leading-5 text-muted">Crie contas, cadastre turmas e defina quem pode registrar cada chamada.</Text>{notice ? <Text className="mt-4 rounded-xl bg-[#E8F6EE] p-3 text-xs leading-5 text-[#176E46]">{notice}</Text> : null}<View className="mt-5 flex-row gap-3"><View className="flex-1"><Button label="Novo professor" onPress={() => setMode("teacher")} /></View><View className="flex-1"><Button label="Nova turma" secondary onPress={() => setMode("class")} /></View></View><Text className="mt-7 text-base font-black text-foreground">Turmas</Text></View>} renderItem={({ item }) => <View className="border-b border-border py-4"><View className="flex-row items-start justify-between"><View className="flex-1 pr-4"><Text className="text-base font-bold text-foreground">{item.name}</Text><Text className="mt-1 text-xs text-muted">{item.code} · {item.course || "Sem curso"} · {item.active ? "Ativa" : "Arquivada"}</Text><Text className="mt-1 text-xs text-muted">{item.teachers.length ? item.teachers.map((teacher) => teacher?.name || teacher?.email).join(", ") : "Sem professor vinculado"}</Text></View><Text className="text-xl text-primary">›</Text></View></View>} ListEmptyComponent={classes.isLoading ? <ActivityIndicator color="#F28C28" className="mt-8" /> : <Text className="mt-4 text-sm text-muted">Ainda não há turmas cadastradas.</Text>} />
    <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-5 py-3"><Text className="text-xs text-muted">Contas ativas: {activeTeachers.length} · Turmas: {classes.data?.length || 0}</Text></View>
    <Modal visible={Boolean(mode)} transparent animationType="slide" onRequestClose={reset}><View className="flex-1 justify-end bg-black/40"><View className="max-h-[88%] rounded-t-3xl bg-background p-5"><Text className="text-xl font-black text-foreground">{mode === "teacher" ? "Novo professor" : "Nova turma"}</Text>{mode === "teacher" ? <><TextInput value={name} onChangeText={setName} placeholder="Nome completo" placeholderTextColor="#718096" className="mt-5 rounded-xl border border-border bg-surface px-4 py-3 text-foreground" /><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="E-mail" placeholderTextColor="#718096" className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-foreground" /><TextInput value={temporaryPassword} onChangeText={setTemporaryPassword} secureTextEntry placeholder="Senha temporária (letra e número)" placeholderTextColor="#718096" className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-foreground" /><View className="mt-5"><Button label={createTeacher.isPending ? "Criando..." : "Criar conta"} disabled={createTeacher.isPending || name.length < 3 || !email.includes("@") || temporaryPassword.length < 8} onPress={submitTeacher} /></View><Text className="mt-3 text-xs leading-5 text-muted">A senha temporária deve ser enviada ao professor por um canal seguro. A troca será exigida no primeiro acesso.</Text></> : <><TextInput value={name} onChangeText={setName} placeholder="Nome da turma" placeholderTextColor="#718096" className="mt-5 rounded-xl border border-border bg-surface px-4 py-3 text-foreground" /><TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="Código da turma" placeholderTextColor="#718096" className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-foreground" /><TextInput value={course} onChangeText={setCourse} placeholder="Curso ou escola (opcional)" placeholderTextColor="#718096" className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-foreground" /><View className="mt-3 flex-row gap-2"><TextInput value={dayOfWeek} onChangeText={setDayOfWeek} keyboardType="number-pad" placeholder="Dia 0–6" placeholderTextColor="#718096" className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-foreground" /><TextInput value={startTime} onChangeText={setStartTime} placeholder="Início 19:00" placeholderTextColor="#718096" className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-foreground" /><TextInput value={endTime} onChangeText={setEndTime} placeholder="Fim 20:00" placeholderTextColor="#718096" className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-foreground" /></View><Text className="mt-5 text-sm font-black text-foreground">Professores com acesso</Text><FlatList className="mt-2 max-h-44" data={activeTeachers} keyExtractor={(item) => String(item.id)} renderItem={({ item }) => <Pressable onPress={() => toggleTeacher(item.id)} className="flex-row items-center justify-between border-b border-border py-3"><View><Text className="text-sm font-bold text-foreground">{item.name}</Text><Text className="text-xs text-muted">{item.email}</Text></View><Text className="text-lg font-black text-primary">{selectedTeachers.includes(item.id) ? "✓" : "+"}</Text></Pressable>} /><View className="mt-5"><Button label={createClass.isPending ? "Criando..." : "Criar turma"} disabled={createClass.isPending || name.length < 3 || code.length < 2} onPress={submitClass} /></View></>}<Pressable onPress={reset} className="mt-4 items-center py-2"><Text className="font-bold text-muted">Cancelar</Text></Pressable></View></View></Modal>
  </ScreenContainer>;
}
