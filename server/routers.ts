import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const.js";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { createLocalSession, revokeAllUserSessions, revokeLocalSession } from "./local-session";
import { systemRouter } from "./_core/systemRouter";
import { createBatchId, enqueueAttendanceSync, processSyncBatch } from "./attendance-sync";
import { callAppsScript } from "./apps-script-sync";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");
const timeKey = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido.");
const attendanceStatus = z.enum(["PRESENT", "ABSENT", "EXCUSED", "NOT_MARKED"]);
const password = z.string().min(8).max(128);

function requestToken(req: { headers: Record<string, unknown>; cookies?: Record<string, unknown> }) {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) return header.slice(7).trim();
  const cookie = req.cookies?.[COOKIE_NAME];
  return typeof cookie === "string" ? cookie : undefined;
}

function setCookieForLocalSession(ctx: { req: any; res: any }, token: string) {
  const options = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, token, { ...options, maxAge: ONE_YEAR_MS });
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(({ ctx }) => (ctx.user ? db.publicUser(ctx.user) : null)),

    login: publicProcedure
      .input(z.object({ login: z.string().trim().min(3).max(320), password, deviceName: z.string().trim().max(160).optional() }))
      .mutation(async ({ ctx, input }) => {
        await db.bootstrapInitialAdmin();
        const user = await db.authenticateLocalUser(input.login, input.password);
        if (!user) throw new Error("Usuário ou senha inválidos.");
        const sessionToken = await createLocalSession(user, input.deviceName);
        setCookieForLocalSession(ctx, sessionToken);
        return { sessionToken, user: db.publicUser(user) };
      }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      await revokeLocalSession(requestToken(ctx.req));
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    changePassword: protectedProcedure
      .input(z.object({ currentPassword: password, newPassword: password }))
      .mutation(async ({ ctx, input }) => {
        await db.changeLocalPassword(ctx.user.id, input.currentPassword, input.newPassword);
        await db.createNotification(ctx.user.id, { type: "SECURITY", title: "Senha atualizada", message: "Sua senha foi alterada com sucesso." });
        return { success: true } as const;
      }),

    logoutAllDevices: protectedProcedure.mutation(async ({ ctx }) => {
      await revokeAllUserSessions(ctx.user.id);
      return { success: true } as const;
    }),
  }),

  attendance: router({
    listClasses: protectedProcedure.query(({ ctx }) => db.listClassesForUser(ctx.user)),
    listLessons: protectedProcedure.input(z.object({ classId: z.number().int().positive() })).query(({ ctx, input }) => db.listLessonsForClass(ctx.user, input.classId)),
    getCallSheet: protectedProcedure.input(z.object({ classId: z.number().int().positive(), lessonDate: dateKey })).query(({ ctx, input }) => db.getAttendanceScreen(ctx.user, input)),
    createLesson: protectedProcedure.input(z.object({ classId: z.number().int().positive(), lessonDate: dateKey, startTime: timeKey.optional(), endTime: timeKey.optional() })).mutation(({ ctx, input }) => db.createLessonForClass(ctx.user, input)),
    saveBatch: protectedProcedure
      .input(z.object({
        classId: z.number().int().positive(),
        lessonDate: dateKey,
        clientBatchId: z.string().trim().min(8).max(128).optional(),
        entries: z.array(z.object({ studentId: z.number().int().positive(), status: attendanceStatus, observation: z.string().trim().max(500).optional() })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.saveAttendanceBatch(ctx.user, input);
        const syncBatch = await enqueueAttendanceSync({
          lessonId: result.lessonId,
          classId: input.classId,
          userId: ctx.user.id,
          externalId: input.clientBatchId ?? createBatchId(),
        });
        void processSyncBatch(syncBatch.id).catch(() => undefined);
        await db.createNotification(ctx.user.id, {
          type: "ATTENDANCE_RECEIVED",
          title: "Chamada recebida",
          message: `${result.entriesSaved} registros foram salvos para a aula selecionada.`,
          referenceType: "lesson",
          referenceId: String(result.lessonId),
        });
        return { ...result, clientBatchId: syncBatch.externalId, syncStatus: syncBatch.status };
      }),
    addStudent: protectedProcedure.input(z.object({ classId: z.number().int().positive(), fullName: z.string().trim().min(3).max(255), notes: z.string().trim().max(500).optional() })).mutation(({ ctx, input }) => db.addStudentToClass(ctx.user, input)),
    deactivateStudent: protectedProcedure.input(z.object({ studentId: z.number().int().positive() })).mutation(({ ctx, input }) => db.deactivateStudentFromClass(ctx.user, input.studentId)),
  }),

  notifications: router({
    list: protectedProcedure.query(({ ctx }) => db.listNotifications(ctx.user)),
    markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(({ ctx, input }) => db.markNotificationRead(ctx.user, input.notificationId)),
  }),

  admin: router({
    listUsers: adminProcedure.query(() => db.listUsersForAdmin()),
    createTeacher: adminProcedure
      .input(z.object({ name: z.string().trim().min(3).max(160), email: z.string().trim().email().max(320), temporaryPassword: password, role: z.enum(["user", "admin"]).default("user") }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.createLocalUser({ name: input.name, email: input.email, password: input.temporaryPassword, role: input.role, mustChangePassword: true });
        await db.audit(ctx.user.id, "CREATE_USER", "user", String(user.id));
        await db.createNotification(user.id, { type: "ACCOUNT", title: "Conta criada", message: "Sua conta foi criada pela coordenação. Troque a senha temporária no primeiro acesso." });
        return db.publicUser(user);
      }),
    updateTeacher: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), name: z.string().trim().min(3).max(160).optional(), active: z.boolean().optional(), role: z.enum(["user", "admin"]).optional() }))
      .mutation(({ ctx, input }) => db.updateLocalUser(input.userId, { name: input.name, active: input.active, role: input.role }, ctx.user.id)),
    resetTeacherPassword: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), temporaryPassword: password }))
      .mutation(async ({ ctx, input }) => {
        await db.resetLocalPassword(input.userId, input.temporaryPassword, ctx.user.id);
        await revokeAllUserSessions(input.userId);
        await db.createNotification(input.userId, { type: "SECURITY", title: "Senha redefinida", message: "A coordenação definiu uma senha temporária. Troque-a no próximo acesso." });
        return { success: true } as const;
      }),
    revokeTeacherSessions: adminProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await revokeAllUserSessions(input.userId);
      await db.audit(ctx.user.id, "REVOKE_SESSIONS", "user", String(input.userId));
      return { success: true } as const;
    }),
    listClasses: adminProcedure.query(() => db.listClassesForAdmin()),
    createClass: adminProcedure
      .input(z.object({ code: z.string().trim().min(2).max(64), name: z.string().trim().min(3).max(160), course: z.string().trim().max(255).optional(), dayOfWeek: z.number().int().min(0).max(6).optional(), startTime: timeKey.optional(), endTime: timeKey.optional(), teacherIds: z.array(z.number().int().positive()).default([]) }))
      .mutation(async ({ ctx, input }) => {
        const created = await db.createClassForAdmin(ctx.user, input);
        try {
          const provisioned = await callAppsScript({
            action: "provisionClassSpreadsheet",
            class: {
              id: created.id,
              code: created.code,
              name: created.name,
              course: created.course,
              dayOfWeek: created.dayOfWeek,
              startTime: created.startTime,
              endTime: created.endTime,
              teacherName: created.teacherName,
              teacherEmail: created.teacherEmail,
            },
          });
          if (!provisioned.spreadsheetId || !provisioned.spreadsheetUrl) throw new Error("A ponte não retornou a planilha criada.");
          return await db.setClassSpreadsheet(created.id, provisioned.spreadsheetId, provisioned.spreadsheetUrl);
        } catch (error) {
          await db.createNotification(ctx.user.id, { type: "SHEET_PROVISIONING", title: "Planilha pendente", message: `A turma ${created.code} foi criada, mas a planilha individual ainda não foi provisionada. Tente novamente quando a ponte estiver disponível.`, referenceType: "class", referenceId: String(created.id) });
          return created;
        }
      }),
    provisionClassSpreadsheet: adminProcedure
      .input(z.object({ classId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const rows = await db.listClassesForAdmin();
        const attendanceClass = rows.find((item) => item.id === input.classId);
        if (!attendanceClass) throw new Error("Turma não encontrada.");
        if (attendanceClass.spreadsheetId && attendanceClass.spreadsheetUrl) return attendanceClass;
        const provisioned = await callAppsScript({ action: "provisionClassSpreadsheet", class: { id: attendanceClass.id, code: attendanceClass.code, name: attendanceClass.name, course: attendanceClass.course, dayOfWeek: attendanceClass.dayOfWeek, startTime: attendanceClass.startTime, endTime: attendanceClass.endTime, teacherName: attendanceClass.teacherName, teacherEmail: attendanceClass.teacherEmail } });
        if (!provisioned.spreadsheetId || !provisioned.spreadsheetUrl) throw new Error("A ponte não retornou a planilha criada.");
        await db.audit(ctx.user.id, "PROVISION_CLASS_SPREADSHEET", "class", String(input.classId), { spreadsheetId: provisioned.spreadsheetId });
        return db.setClassSpreadsheet(input.classId, provisioned.spreadsheetId, provisioned.spreadsheetUrl);
      }),
    updateClass: adminProcedure
      .input(z.object({ classId: z.number().int().positive(), name: z.string().trim().min(3).max(160).optional(), course: z.string().trim().max(255).nullable().optional(), dayOfWeek: z.number().int().min(0).max(6).nullable().optional(), startTime: timeKey.nullable().optional(), endTime: timeKey.nullable().optional(), active: z.boolean().optional(), teacherIds: z.array(z.number().int().positive()).optional() }))
      .mutation(({ ctx, input }) => db.updateClassForAdmin(ctx.user, input.classId, input)),
  }),
});

export type AppRouter = typeof appRouter;
