import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "plug-presenca-offline-batches-v1";

type OfflineEntry = {
  studentId: number;
  status: "PRESENT" | "ABSENT" | "EXCUSED" | "NOT_MARKED";
  observation?: string;
};

export type OfflineAttendanceBatch = {
  clientBatchId: string;
  classId: number;
  lessonDate: string;
  entries: OfflineEntry[];
  createdAt: string;
};

export function createOfflineBatchId() {
  return `OFF-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function listOfflineBatches(): Promise<OfflineAttendanceBatch[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function queueOfflineBatch(batch: OfflineAttendanceBatch) {
  const current = await listOfflineBatches();
  const next = current.some((item) => item.clientBatchId === batch.clientBatchId) ? current : [...current, batch];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function removeOfflineBatch(clientBatchId: string) {
  const current = await listOfflineBatches();
  const next = current.filter((item) => item.clientBatchId !== clientBatchId);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
