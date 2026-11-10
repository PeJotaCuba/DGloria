import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { authorizeUser, authorizeOwnerOrAdmin } from "./auth";

const DEFAULT_SCHEDULE = [
  { dayOfWeek: 1, dayName: "Lunes", enabled: true, openTime: "08:00", closeTime: "23:59", session1OpenTime: "08:00", session1CloseTime: "23:59", session2Enabled: false, session2OpenTime: "", session2CloseTime: "" },
  { dayOfWeek: 2, dayName: "Martes", enabled: true, openTime: "08:00", closeTime: "23:59", session1OpenTime: "08:00", session1CloseTime: "23:59", session2Enabled: false, session2OpenTime: "", session2CloseTime: "" },
  { dayOfWeek: 3, dayName: "Miércoles", enabled: true, openTime: "08:00", closeTime: "23:59", session1OpenTime: "08:00", session1CloseTime: "23:59", session2Enabled: false, session2OpenTime: "", session2CloseTime: "" },
  { dayOfWeek: 4, dayName: "Jueves", enabled: true, openTime: "08:00", closeTime: "23:59", session1OpenTime: "08:00", session1CloseTime: "23:59", session2Enabled: false, session2OpenTime: "", session2CloseTime: "" },
  { dayOfWeek: 5, dayName: "Viernes", enabled: true, openTime: "08:00", closeTime: "23:59", session1OpenTime: "08:00", session1CloseTime: "23:59", session2Enabled: false, session2OpenTime: "", session2CloseTime: "" },
  { dayOfWeek: 6, dayName: "Sábado", enabled: true, openTime: "08:00", closeTime: "23:59", session1OpenTime: "08:00", session1CloseTime: "23:59", session2Enabled: false, session2OpenTime: "", session2CloseTime: "" },
  { dayOfWeek: 7, dayName: "Domingo", enabled: true, openTime: "08:00", closeTime: "23:59", session1OpenTime: "08:00", session1CloseTime: "23:59", session2Enabled: false, session2OpenTime: "", session2CloseTime: "" },
];

const DEFAULT_TIMEZONE = "America/Havana";

const DayScheduleValidator = v.object({
  dayOfWeek: v.number(),
  dayName: v.string(),
  enabled: v.boolean(),
  openTime: v.optional(v.string()),
  closeTime: v.optional(v.string()),
  session1OpenTime: v.optional(v.string()),
  session1CloseTime: v.optional(v.string()),
  session2Enabled: v.optional(v.boolean()),
  session2OpenTime: v.optional(v.string()),
  session2CloseTime: v.optional(v.string()),
  openTime2: v.optional(v.string()),
  closeTime2: v.optional(v.string()),
  sessions: v.optional(v.any()),
});

function normalizeScheduleItem(item: any) {
  const isEnabled = !!item.enabled;
  const s1Open = item.session1OpenTime ?? item.openTime ?? (isEnabled ? "08:00" : "");
  const s1Close = item.session1CloseTime ?? item.closeTime ?? (isEnabled ? "23:59" : "");

  let s2Open = item.session2OpenTime ?? item.openTime2 ?? "";
  let s2Close = item.session2CloseTime ?? item.closeTime2 ?? "";

  if (Array.isArray(item.sessions) && item.sessions.length > 1) {
    if (!s2Open && item.sessions[1]?.openTime) s2Open = String(item.sessions[1].openTime);
    if (!s2Close && item.sessions[1]?.closeTime) s2Close = String(item.sessions[1].closeTime);
  }

  const s2Enabled = isEnabled && (
    item.session2Enabled === true ||
    (s2Open.trim().length > 0 && s2Close.trim().length > 0)
  );

  return {
    dayOfWeek: Number(item.dayOfWeek),
    dayName: String(item.dayName || ""),
    enabled: isEnabled,
    openTime: s1Open,
    closeTime: (s2Enabled && s2Close) ? s2Close : s1Close,
    session1OpenTime: s1Open,
    session1CloseTime: s1Close,
    session2Enabled: s2Enabled,
    session2OpenTime: s2Open,
    session2CloseTime: s2Close,
    openTime2: s2Open,
    closeTime2: s2Close,
  };
}

/**
 * Retorna la programación semanal configurada o la predeterminada si no existe.
 */
export const getSchedule = query({
  args: {},
  handler: async (ctx) => {
    const record = await ctx.db
      .query("shift_schedules")
      .withIndex("by_custom_id", (q) => q.eq("id", "default"))
      .first();

    if (!record) {
      return {
        id: "default",
        timeZone: DEFAULT_TIMEZONE,
        weeklySchedule: DEFAULT_SCHEDULE.map(normalizeScheduleItem),
        manualOverride: undefined,
        updatedAt: Date.now(),
        updatedByUserId: "system",
        updatedByUserName: "Sistema",
      };
    }

    return {
      ...record,
      weeklySchedule: (record.weeklySchedule || []).map(normalizeScheduleItem),
    };
  },
});

/**
 * Consulta pública de los horarios de apertura para la web y clientes externos.
 */
export const getPublicOpeningHours = query({
  args: {},
  handler: async (ctx) => {
    const record = await ctx.db
      .query("shift_schedules")
      .withIndex("by_custom_id", (q) => q.eq("id", "default"))
      .first();

    if (!record) {
      return {
        id: "default",
        isConfigured: false,
        timeZone: DEFAULT_TIMEZONE,
        weeklySchedule: DEFAULT_SCHEDULE.map(normalizeScheduleItem),
        manualOverride: undefined,
        updatedAt: Date.now(),
        updatedByUserId: "system",
        updatedByUserName: "Sistema",
      };
    }

    const weekly = (record.weeklySchedule || []).map(normalizeScheduleItem);
    const isConfigured = (record.updatedByUserId && record.updatedByUserId !== "system") || weekly.some((d) => d.enabled);

    return {
      ...record,
      isConfigured,
      timeZone: record.timeZone || DEFAULT_TIMEZONE,
      weeklySchedule: weekly,
    };
  },
});

/**
 * Guarda o actualiza la programación semanal de jornadas (solo Administrador y Dueño).
 */
export const updateSchedule = mutation({
  args: {
    weeklySchedule: v.array(DayScheduleValidator),
    timeZone: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "actualizar programación semanal de jornada" }
    );

    const timeZone = args.timeZone?.trim() || DEFAULT_TIMEZONE;
    const now = Date.now();

    const normalizedWeeklySchedule = args.weeklySchedule.map(normalizeScheduleItem);

    const existing = await ctx.db
      .query("shift_schedules")
      .withIndex("by_custom_id", (q) => q.eq("id", "default"))
      .first();

    const recordData = {
      id: "default",
      timeZone,
      weeklySchedule: normalizedWeeklySchedule,
      manualOverride: existing?.manualOverride,
      updatedAt: now,
      updatedByUserId: auth.user.id,
      updatedByUserName: auth.user.fullName || auth.user.username,
    };

    if (existing) {
      await ctx.db.patch(existing._id, recordData);
    } else {
      await ctx.db.insert("shift_schedules", recordData);
    }

    // Registrar en auditoría/notificaciones
    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: "Programación de Jornada Actualizada",
      message: `La programación semanal fue modificada por ${auth.user.fullName || auth.user.username}.`,
      targetRole: "ADMIN_GENERAL",
      timestamp: now,
      isRead: false,
    });

    return recordData;
  },
});

/**
 * Apertura manual inmediata de la jornada.
 */
export const manualOpenShift = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "apertura manual de jornada" }
    );

    const now = Date.now();

    let activeShift = await ctx.db
      .query("shop_shifts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();

    if (!activeShift) {
      const shiftId = crypto.randomUUID();
      const docData = {
        id: shiftId,
        openedAt: now,
        openedByUserId: auth.user.id,
        openedByUserName: auth.user.fullName || auth.user.username,
        isActive: true,
        notes: args.notes?.trim() || "Apertura manual por administración",
      };
      const docId = await ctx.db.insert("shop_shifts", docData);
      activeShift = await ctx.db.get(docId);
    }

    const existingSchedule = await ctx.db
      .query("shift_schedules")
      .withIndex("by_custom_id", (q) => q.eq("id", "default"))
      .first();

    const overrideObj = {
      overrideType: "MANUAL_OPEN" as const,
      overrideAt: now,
      overrideByUserId: auth.user.id,
      overrideByUserName: auth.user.fullName || auth.user.username,
    };

    if (existingSchedule) {
      await ctx.db.patch(existingSchedule._id, {
        manualOverride: overrideObj,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("shift_schedules", {
        id: "default",
        timeZone: DEFAULT_TIMEZONE,
        weeklySchedule: DEFAULT_SCHEDULE,
        manualOverride: overrideObj,
        updatedAt: now,
        updatedByUserId: auth.user.id,
        updatedByUserName: auth.user.fullName || auth.user.username,
      });
    }

    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: "Jornada Abierta Manualmente",
      message: `El usuario ${auth.user.fullName || auth.user.username} abrió la jornada manualmente.`,
      targetRole: "ADMIN_GENERAL",
      timestamp: now,
      isRead: false,
    });

    return { success: true, shift: activeShift };
  },
});

/**
 * Consulta las jornadas archivadas para el historial (solo Administrador y Dueño).
 */
export const listArchivedShifts = query({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "consultar archivo de jornadas" }
    );

    return await ctx.db
      .query("archived_shifts")
      .withIndex("by_closedAt", (q) => q)
      .order("desc")
      .collect();
  },
});

/**
 * Guarda o actualiza el cuadre de caja de una jornada (solo Administrador y Dueño).
 */
export const saveCashReconciliation = mutation({
  args: {
    id: v.string(),
    shiftId: v.string(),
    dateStr: v.string(),
    initialFloatCup: v.number(),
    expectedCashCup: v.number(),
    countedCashCup: v.number(),
    cashInCup: v.number(),
    cashOutCup: v.number(),
    differenceCup: v.number(),
    nonCashTotalCup: v.number(),
    resultStatus: v.string(),
    confirmedByUserId: v.string(),
    confirmedByUserName: v.string(),
    confirmedAt: v.number(),
    notes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "guardar cuadre de caja" }
    );

    const { sessionToken, userId, ...record } = args;

    const existing = await ctx.db
      .query("cash_reconciliations")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", record.shiftId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...record,
        updatedAt: Date.now(),
      });
      return { success: true, id: existing.id };
    } else {
      const docId = await ctx.db.insert("cash_reconciliations", {
        ...record,
        updatedAt: Date.now(),
      });
      return { success: true, id: record.id };
    }
  },
});

/**
 * Obtiene los cuadres de caja recientes (solo Administrador y Dueño).
 */
export const listCashReconciliations = query({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "consultar cuadres de caja" }
    );

    const limit = args.limit ?? 50;
    return await ctx.db
      .query("cash_reconciliations")
      .order("desc")
      .take(limit);
  },
});

/**
 * Obtiene el cuadre de caja para una jornada específica (solo Administrador y Dueño).
 */
export const getCashReconciliationByShift = query({
  args: {
    shiftId: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "consultar detalle de cuadre" }
    );

    return await ctx.db
      .query("cash_reconciliations")
      .withIndex("by_shiftId", (q) => q.eq("shiftId", args.shiftId))
      .first();
  },
});

/**
 * Función interna para cerrar y archivar una jornada.
 */
async function closeAndArchiveShift(
  ctx: any,
  shiftId: string,
  closedByUserId: string,
  closedByUserName: string,
  notes: string,
  now: number
) {
  const shift = await ctx.db
    .query("shop_shifts")
    .withIndex("by_custom_id", (q: any) => q.eq("id", shiftId))
    .first();

  if (!shift) return;

  // Actualizar jornada (marcar como cerrada o eliminar)
  // Decidimos eliminarla de shop_shifts una vez archivada para mantener la tabla limpia
  await ctx.db.delete(shift._id);

  // Obtener logs
  const logs = await ctx.db
    .query("audit_logs")
    .withIndex("by_shift", (q: any) => q.eq("shiftId", shift.id))
    .collect();

  // Insertar en archived_shifts
  await ctx.db.insert("archived_shifts", {
    id: shift.id,
    openedAt: shift.openedAt,
    closedAt: now,
    openedByUserId: shift.openedByUserId,
    openedByUserName: shift.openedByUserName,
    closedByUserId: closedByUserId,
    closedByUserName: closedByUserName,
    notes: notes,
    events: logs,
    exportedAt: now,
  });
}

/**
 * Cierre manual inmediato de la jornada.
 */
export const manualCloseShift = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "cierre manual de jornada" }
    );

    const now = Date.now();

    const activeShift = await ctx.db
      .query("shop_shifts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();

    if (activeShift) {
      await closeAndArchiveShift(
        ctx,
        activeShift.id,
        auth.user.id,
        auth.user.fullName || auth.user.username,
        args.notes?.trim() || activeShift.notes || "Cierre manual por administración",
        now
      );
    }

    const existingSchedule = await ctx.db
      .query("shift_schedules")
      .withIndex("by_custom_id", (q) => q.eq("id", "default"))
      .first();

    const overrideObj = {
      overrideType: "MANUAL_CLOSE" as const,
      overrideAt: now,
      overrideByUserId: auth.user.id,
      overrideByUserName: auth.user.fullName || auth.user.username,
    };

    if (existingSchedule) {
      await ctx.db.patch(existingSchedule._id, {
        manualOverride: overrideObj,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("shift_schedules", {
        id: "default",
        timeZone: DEFAULT_TIMEZONE,
        weeklySchedule: DEFAULT_SCHEDULE,
        manualOverride: overrideObj,
        updatedAt: now,
        updatedByUserId: auth.user.id,
        updatedByUserName: auth.user.fullName || auth.user.username,
      });
    }

    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: "Jornada Cerrada Manualmente",
      message: `El usuario ${auth.user.fullName || auth.user.username} cerró la jornada manualmente.`,
      targetRole: "ADMIN_GENERAL",
      timestamp: now,
      isRead: false,
    });

    return { success: true };
  },
});

/**
 * Consulta del estado detallado de la jornada para Android (incluyendo cálculo de horas en America/Havana)
 */
export const getShiftStatusDetails = query({
  args: {},
  handler: async (ctx) => {
    const activeShift = await ctx.db
      .query("shop_shifts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();

    const scheduleRec = await ctx.db
      .query("shift_schedules")
      .withIndex("by_custom_id", (q) => q.eq("id", "default"))
      .first();

    const weekly = scheduleRec?.weeklySchedule ?? DEFAULT_SCHEDULE;
    const timeZone = scheduleRec?.timeZone ?? DEFAULT_TIMEZONE;
    const manualOverride = scheduleRec?.manualOverride;

    const isActive = !!activeShift;

    function formatTime12h(time24?: string): string {
      const safeTime = time24 || "00:00";
      const [hStr, mStr] = safeTime.split(":");
      let h = parseInt(hStr, 10);
      if (isNaN(h)) h = 0;
      const m = mStr || "00";
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12;
      if (h === 0) h = 12;
      return `${h}:${m} ${ampm}`;
    }

    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      hour12: false,
    }).formatToParts(now);

    const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Monday";
    const weekdayMap: Record<string, number> = {
      Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7
    };
    const currentDayNum = weekdayMap[weekdayStr] ?? 1;

    const dayConfig = weekly.find((d) => d.dayOfWeek === currentDayNum) ?? {
      dayOfWeek: currentDayNum,
      dayName: "Hoy",
      enabled: true,
      openTime: "08:00",
      closeTime: "23:59",
    };

    let displayStatus = "";
    if (isActive) {
      displayStatus = `Abierta hasta ${formatTime12h(dayConfig.closeTime || "23:59")}`;
    } else {
      displayStatus = `Cerrada hasta ${formatTime12h(dayConfig.openTime || "08:00")}`;
    }

    return {
      isActive,
      activeShift: activeShift
        ? {
            id: activeShift.id,
            openedAt: activeShift.openedAt,
            openedByUserId: activeShift.openedByUserId,
            openedByUserName: activeShift.openedByUserName,
            notes: activeShift.notes,
          }
        : null,
      timeZone,
      displayStatus,
      openTimeFormatted: formatTime12h(dayConfig.openTime || "08:00"),
      closeTimeFormatted: formatTime12h(dayConfig.closeTime || "23:59"),
      manualOverride,
      weeklySchedule: weekly,
    };
  },
});

/**
 * Función interna de comprobación y ejecución automática invocada por el cron job de Convex.
 */
export const checkAndUpdateScheduledShift = internalMutation({
  args: {},
  handler: async (ctx) => {
    const scheduleRec = await ctx.db
      .query("shift_schedules")
      .withIndex("by_custom_id", (q) => q.eq("id", "default"))
      .first();

    const weekly = scheduleRec?.weeklySchedule ?? DEFAULT_SCHEDULE;
    const timeZone = scheduleRec?.timeZone ?? DEFAULT_TIMEZONE;
    const manualOverride = scheduleRec?.manualOverride;

    const activeShift = await ctx.db
      .query("shop_shifts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();

    const now = Date.now();

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "long",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(new Date(now));

    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;

    const weekdayMap: Record<string, number> = {
      Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7
    };
    const currentDayNum = weekdayMap[map.weekday] ?? 1;

    const currentHour = parseInt(map.hour, 10);
    const currentMinute = parseInt(map.minute, 10);
    const currentMinutesFromMidnight = currentHour * 60 + currentMinute;

    const dayConfigRaw = weekly.find((d) => d.dayOfWeek === currentDayNum);
    const dayConfig = dayConfigRaw ? normalizeScheduleItem(dayConfigRaw) : null;

    if (!dayConfig || !dayConfig.enabled) {
      if (activeShift) {
        if (!manualOverride || manualOverride.overrideAt < now - 24 * 60 * 60 * 1000) {
          await closeAndArchiveShift(
            ctx,
            activeShift.id,
            "system-cron",
            "Automatización Programada",
            "Cierre automático por día no laborable programado",
            now
          );
          await ctx.db.insert("notifications", {
            id: crypto.randomUUID(),
            title: "Jornada Cerrada Automáticamente",
            message: "La jornada se cerró automáticamente por programación de día no laborable.",
            targetRole: "ADMIN_GENERAL",
            timestamp: now,
            isRead: false,
          });
        }
      }
      return;
    }

    function checkMinutesInInterval(curr: number, oStr: string, cStr: string): boolean {
      if (!oStr || !cStr) return false;
      const [oH, oM] = oStr.split(":").map((s) => parseInt(s, 10));
      const [cH, cM] = cStr.split(":").map((s) => parseInt(s, 10));
      if (isNaN(oH) || isNaN(cH)) return false;
      const oMin = oH * 60 + (oM || 0);
      const cMin = cH * 60 + (cM || 0);
      if (cMin >= oMin) {
        return curr >= oMin && curr < cMin;
      } else {
        return curr >= oMin || curr < cMin;
      }
    }

    let shouldBeOpen = checkMinutesInInterval(
      currentMinutesFromMidnight,
      dayConfig.session1OpenTime || dayConfig.openTime,
      dayConfig.session1CloseTime || dayConfig.closeTime
    );

    if (dayConfig.session2Enabled && dayConfig.session2OpenTime && dayConfig.session2CloseTime) {
      shouldBeOpen = shouldBeOpen || checkMinutesInInterval(
        currentMinutesFromMidnight,
        dayConfig.session2OpenTime,
        dayConfig.session2CloseTime
      );
    }

    if (manualOverride) {
      const overrideAgeMs = now - manualOverride.overrideAt;
      if (overrideAgeMs < 12 * 60 * 60 * 1000) {
        return;
      }
    }

    if (shouldBeOpen && !activeShift) {
      const shiftId = crypto.randomUUID();
      await ctx.db.insert("shop_shifts", {
        id: shiftId,
        openedAt: now,
        openedByUserId: "system-cron",
        openedByUserName: "Automatización Programada",
        isActive: true,
        notes: "Apertura automática según programación semanal",
      });
      await ctx.db.insert("notifications", {
        id: crypto.randomUUID(),
        title: "Jornada Abierta Automáticamente",
        message: "La jornada fue iniciada automáticamente por la programación semanal.",
        targetRole: "ADMIN_GENERAL",
        timestamp: now,
        isRead: false,
      });
    } else if (!shouldBeOpen && activeShift) {
      await closeAndArchiveShift(
        ctx,
        activeShift.id,
        "system-cron",
        "Automatización Programada",
        "Cierre automático según programación semanal",
        now
      );
      await ctx.db.insert("notifications", {
        id: crypto.randomUUID(),
        title: "Jornada Cerrada Automáticamente",
        message: "La jornada fue finalizada automáticamente por la programación semanal.",
        targetRole: "ADMIN_GENERAL",
        timestamp: now,
        isRead: false,
      });
    }
  },
});
