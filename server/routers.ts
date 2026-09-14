import { COOKIE_NAME } from "../shared/const.js";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { verifyGoogleIdentityToken } from "./google-auth";
import { createGoogleSession } from "./google-session";
import { systemRouter } from "./_core/systemRouter";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");
const timeKey = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido.");
const attendanceStatus = z.enum(["PRESENT", "ABSENT", "EXCUSED", "NOT_MARKED"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    googleLogin: publicProcedure
      .input(z.object({ idToken: z.string().min(20) }))
      .mutation(async ({ input }) => {
        const identity = await verifyGoogleIdentityToken(input.idToken);
        await db.upsertUser({
          openId: `google:${identity.subject}`,
          email: identity.email,
          name: identity.name,
          loginMethod: "google",
        });
        const user = await db.getUserByOpenId(`google:${identity.subject}`);
        if (!user) throw new Error("Não foi possível iniciar a sessão Google.");
        const sessionToken = await createGoogleSession({ userId: user.id, email: user.email });
        return { sessionToken, user };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  attendance: router({
    listClasses: protectedProcedure.query(({ ctx }) => db.listClassesForUser(ctx.user)),
    listLessons: protectedProcedure
      .input(z.object({ classId: z.number().int().positive() }))
      .query(({ ctx, input }) => db.listLessonsForClass(ctx.user, input.classId)),
    getCallSheet: protectedProcedure
      .input(z.object({ classId: z.number().int().positive(), lessonDate: dateKey }))
      .query(({ ctx, input }) => db.getAttendanceScreen(ctx.user, input)),
    createLesson: protectedProcedure
      .input(z.object({ classId: z.number().int().positive(), lessonDate: dateKey, startTime: timeKey.optional(), endTime: timeKey.optional() }))
      .mutation(({ ctx, input }) => db.createLessonForClass(ctx.user, input)),
    saveBatch: protectedProcedure
      .input(z.object({
        classId: z.number().int().positive(),
        lessonDate: dateKey,
        entries: z.array(z.object({
          studentId: z.number().int().positive(),
          status: attendanceStatus,
          observation: z.string().trim().max(500).optional(),
        })).min(1),
      }))
      .mutation(({ ctx, input }) => db.saveAttendanceBatch(ctx.user, input)),
    addStudent: protectedProcedure
      .input(z.object({ classId: z.number().int().positive(), fullName: z.string().trim().min(3).max(255), notes: z.string().trim().max(500).optional() }))
      .mutation(({ ctx, input }) => db.addStudentToClass(ctx.user, input)),
    deactivateStudent: protectedProcedure
      .input(z.object({ studentId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => db.deactivateStudentFromClass(ctx.user, input.studentId)),
  }),
});

export type AppRouter = typeof appRouter;
