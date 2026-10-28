import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Obtiene la configuración de horarios de turnos programados.
 */
export const getSchedule = query({
  args: {},
  handler: async (ctx) => {
    const schedules = await ctx.db.query("shift_schedules").collect();
    if (schedules.length > 0) {
      return schedules[0];
    }

    return {
      id: "default",
      timeZone: "America/Havana",
      weeklySchedule: [
        { dayOfWeek: 1, dayName: "Lunes", enabled: false, openTime: "08:00", closeTime: "23:59" },
        { dayOfWeek: 2, dayName: "Martes", enabled: true, openTime: "08:00", closeTime: "23:59" },
        { dayOfWeek: 3, dayName: "Miércoles", enabled: true, openTime: "08:00", closeTime: "23:59" },
        { dayOfWeek: 4, dayName: "Jueves", enabled: true, openTime: "08:00", closeTime: "23:59" },
        { dayOfWeek: 5, dayName: "Viernes", enabled: true, openTime: "08:00", closeTime: "23:59" },
        { dayOfWeek: 6, dayName: "Sábado", enabled: true, openTime: "08:00", closeTime: "23:59" },
        { dayOfWeek: 7, dayName: "Domingo", enabled: true, openTime: "08:00", closeTime: "23:59" },
      ],
      manualOverride: null,
    };
  },
});

/**
 * Actualiza la programación semanal de turnos.
 */
export const updateSchedule = mutation({
  args: {
    weeklySchedule: v.array(
      v.object({
        dayOfWeek: v.number(),
        dayName: v.string(),
        enabled: v.boolean(),
        openTime: v.string(),
        closeTime: v.string(),
      })
    ),
    timeZone: v.optional(v.string()),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const schedules = await ctx.db.query("shift_schedules").collect();
    const now = Date.now();
    const timeZone = args.timeZone || "America/Havana";

    if (schedules.length > 0) {
      await ctx.db.patch(schedules[0]._id, {
        weeklySchedule: args.weeklySchedule,
        timeZone,
        updatedAt: now,
        updatedByUserId: args.userId || "u-admin",
        updatedByUserName: "Administrador General",
      } as any);
      return { success: true, id: schedules[0]._id };
    } else {
      const newId = await ctx.db.insert("shift_schedules", {
        id: "default",
        weeklySchedule: args.weeklySchedule,
        timeZone,
        updatedAt: now,
        updatedByUserId: args.userId || "u-admin",
        updatedByUserName: "Administrador General",
      } as any);
      return { success: true, id: newId };
    }
  },
});

/**
 * Apertura manual de turno desde Android o administración.
 */
export const manualOpenShift = mutation({
  args: {
    notes: v.optional(v.string()),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verificar si ya existe un turno activo
    const activeShifts = await ctx.db
      .query("shop_shifts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    if (activeShifts.length > 0) {
      return { success: true, message: "Ya existe un turno activo", shift: activeShifts[0] };
    }

    const now = Date.now();
    const shiftUuid = `shift-${now}-${Math.random().toString(36).substring(2, 8)}`;

    const shiftId = await ctx.db.insert("shop_shifts", {
      id: shiftUuid,
      isActive: true,
      openedAt: now,
      openedByUserId: args.userId || "u-admin",
      openedByUserName: "Administrador General",
      notes: args.notes || "Apertura manual desde panel",
    } as any);

    // Registrar override manual en el horario
    const schedules = await ctx.db.query("shift_schedules").collect();
    if (schedules.length > 0) {
      await ctx.db.patch(schedules[0]._id, {
        manualOverride: {
          overrideAt: now,
          overrideByUserId: args.userId || "u-admin",
          overrideByUserName: "Administrador General",
          overrideType: "MANUAL_OPEN",
        },
      } as any);
    }

    const created = await ctx.db.get(shiftId);
    return { success: true, shift: created };
  },
});

/**
 * Cierre manual de turno desde Android o administración.
 */
export const manualCloseShift = mutation({
  args: {
    notes: v.optional(v.string()),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const activeShifts = await ctx.db
      .query("shop_shifts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    if (activeShifts.length === 0) {
      return { success: false, message: "No hay ningún turno activo para cerrar" };
    }

    const currentShift = activeShifts[0];
    const now = Date.now();

    // 1. Cerrar el turno activo en shop_shifts
    await ctx.db.patch(currentShift._id, {
      isActive: false,
      closedAt: now,
      closedByUserId: args.userId || "u-admin",
      closedByUserName: "Administrador General",
      notes: args.notes || "Cierre manual desde panel de administración",
    } as any);

    // 2. Archivar el turno en archived_shifts
    await ctx.db.insert("archived_shifts", {
      id: currentShift.id || `shift-${now}`,
      openedAt: currentShift.openedAt,
      openedByUserId: currentShift.openedByUserId,
      openedByUserName: currentShift.openedByUserName,
      closedAt: now,
      closedByUserId: args.userId || "u-admin",
      closedByUserName: "Administrador General",
      notes: args.notes || "Cierre manual desde panel de administración",
      exportedAt: now,
      events: [],
    } as any);

    // 3. Registrar override manual en shift_schedules
    const schedules = await ctx.db.query("shift_schedules").collect();
    if (schedules.length > 0) {
      await ctx.db.patch(schedules[0]._id, {
        manualOverride: {
          overrideAt: now,
          overrideByUserId: args.userId || "u-admin",
          overrideByUserName: "Administrador General",
          overrideType: "MANUAL_CLOSE",
        },
      } as any);
    }

    return { success: true, message: "Turno cerrado exitosamente" };
  },
});

/**
 * Consulta del estado y detalles del turno actual.
 */
export const getShiftStatusDetails = query({
  args: {},
  handler: async (ctx) => {
    const activeShifts = await ctx.db
      .query("shop_shifts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    const schedules = await ctx.db.query("shift_schedules").collect();
    const schedule = schedules[0] || null;

    const isActive = activeShifts.length > 0;
    const activeShift = isActive ? activeShifts[0] : null;

    return {
      isActive,
      activeShift,
      timeZone: schedule?.timeZone || "America/Havana",
      weeklySchedule: schedule?.weeklySchedule || [],
      manualOverride: schedule?.manualOverride || null,
      displayStatus: isActive ? "Turno activo" : "Cerrada hasta 8:00 AM",
      openTimeFormatted: "8:00 AM",
      closeTimeFormatted: "11:59 PM",
    };
  },
});

/**
 * Lista de turnos cerrados y archivados.
 */
export const listArchivedShifts = query({
  args: {},
  handler: async (ctx) => {
    const archives = await ctx.db.query("archived_shifts").collect();
    return archives.sort((a, b) => ((b as any).closedAt || 0) - ((a as any).closedAt || 0));
  },
});

/**
 * Verificación y actualización de turnos programados (automatización de cron job).
 * Incluye guardias para evitar escrituras redundantes o ciclos continuos de ejecución.
 */
export const checkAndUpdateScheduledShift = internalMutation({
  args: {},
  handler: async (ctx) => {
    const schedules = await ctx.db.query("shift_schedules").collect();
    if (schedules.length === 0) return;

    const schedule = schedules[0];
    const timeZone = (schedule as any).timeZone || "America/Havana";

    // Obtener día de la semana y hora actual en la zona horaria de Cuba
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "narrow",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour")?.value || "0";
    const minutePart = parts.find((p) => p.type === "minute")?.value || "0";
    const currentHourMin = `${hourPart.padStart(2, "0")}:${minutePart.padStart(2, "0")}`;

    // Obtener día de la semana numérico (1 = Lunes, ..., 7 = Domingo)
    const dayFormatter = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });
    const dayStr = dayFormatter.format(now);
    const dayMap: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    };
    const currentDayOfWeek = dayMap[dayStr] || 1;

    const weeklySchedule: any[] = (schedule as any).weeklySchedule || [];
    const todayConfig = weeklySchedule.find((d) => d.dayOfWeek === currentDayOfWeek);

    const shouldBeOpen =
      todayConfig?.enabled &&
      currentHourMin >= todayConfig.openTime &&
      currentHourMin <= todayConfig.closeTime;

    const activeShifts = await ctx.db
      .query("shop_shifts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    const isCurrentlyOpen = activeShifts.length > 0;

    // Verificar si hay un override manual de hoy para no revertir la decisión del usuario
    const manualOverride: any = (schedule as any).manualOverride;
    const nowMs = Date.now();
    const isOverrideRecent =
      manualOverride &&
      nowMs - manualOverride.overrideAt < 8 * 60 * 60 * 1000; // 8 horas

    if (shouldBeOpen && !isCurrentlyOpen) {
      if (isOverrideRecent && manualOverride.overrideType === "MANUAL_CLOSE") {
        // Respetar el cierre manual reciente hecho por el administrador
        return;
      }

      // Apertura automática programada
      const shiftUuid = `shift-${nowMs}-${Math.random().toString(36).substring(2, 8)}`;
      await ctx.db.insert("shop_shifts", {
        id: shiftUuid,
        isActive: true,
        openedAt: nowMs,
        openedByUserId: "system-cron",
        openedByUserName: "Automatización Programada",
        notes: "Apertura automática según programación semanal",
      } as any);
    } else if (!shouldBeOpen && isCurrentlyOpen) {
      if (isOverrideRecent && manualOverride.overrideType === "MANUAL_OPEN") {
        // Respetar la apertura manual reciente del administrador
        return;
      }

      // Cierre automático programado
      const shiftToClose = activeShifts[0];
      await ctx.db.patch(shiftToClose._id, {
        isActive: false,
        closedAt: nowMs,
        closedByUserId: "system-cron",
        closedByUserName: "Automatización Programada",
        notes: "Cierre automático según programación semanal",
      } as any);

      await ctx.db.insert("archived_shifts", {
        id: shiftToClose.id || `shift-${nowMs}`,
        openedAt: shiftToClose.openedAt,
        openedByUserId: "system-cron",
        openedByUserName: "Automatización Programada",
        closedAt: nowMs,
        closedByUserId: "system-cron",
        closedByUserName: "Automatización Programada",
        notes: "Cierre automático según programación semanal",
        exportedAt: nowMs,
        events: [],
      } as any);
    }
  },
});
