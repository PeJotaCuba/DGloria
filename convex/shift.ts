import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { assertAdminPermission } from "./auth";

/**
 * Formatea una hora en formato "HH:mm" al formato amigable "H:MM AM/PM".
 */
function formatTimeStr(time?: string): string {
  if (!time) return "";
  const trimmed = time.trim();
  if (trimmed.toUpperCase().includes("AM") || trimmed.toUpperCase().includes("PM")) {
    return trimmed;
  }
  const [hourStr, minuteStr] = trimmed.split(":");
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return trimmed;
  const minute = minuteStr ? minuteStr.padStart(2, "0") : "00";
  const period = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${formattedHour}:${minute} ${period}`;
}

/**
 * Obtiene la configuración completa de horarios de apertura y turnos (para administración Android).
 * Si no existe una configuración guardada en la base de datos, retorna null sin inventar valores ficticios.
 */
export const getSchedule = query({
  args: {},
  handler: async (ctx) => {
    const schedules = await ctx.db.query("shift_schedules").collect();
    if (schedules.length > 0) {
      return schedules[0];
    }
    return null;
  },
});

/**
 * Consulta pública para la web: Retorna únicamente la información de días y horarios de apertura
 * compartida de Bar Terraza, sin exponer datos internos de auditoría, sesiones ni turnos.
 */
export const getPublicOpeningHours = query({
  args: {},
  handler: async (ctx) => {
    const schedules = await ctx.db.query("shift_schedules").collect();
    if (schedules.length === 0) {
      return null;
    }

    const schedule = schedules[0];
    const weeklySchedule: any[] = (schedule as any).weeklySchedule || [];
    const timeZone: string = (schedule as any).timeZone || "America/Havana";

    // Calcular estado actual en la zona horaria del establecimiento
    const now = new Date();
    const dayFormatter = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });
    const dayStr = dayFormatter.format(now);
    const dayMap: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    };
    const currentDayOfWeek = dayMap[dayStr] || 1;

    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = timeFormatter.formatToParts(now);
    const currentHour = parts.find((p) => p.type === "hour")?.value || "00";
    const currentMin = parts.find((p) => p.type === "minute")?.value || "00";
    const currentHourMin = `${currentHour.padStart(2, "0")}:${currentMin.padStart(2, "0")}`;

    const formattedDays = weeklySchedule.map((day) => {
      const openFormatted = formatTimeStr(day.openTime);
      const closeFormatted = formatTimeStr(day.closeTime);
      return {
        dayOfWeek: day.dayOfWeek,
        dayName: day.dayName,
        enabled: Boolean(day.enabled),
        openTime: day.openTime,
        closeTime: day.closeTime,
        openTimeFormatted: openFormatted,
        closeTimeFormatted: closeFormatted,
        closedReason: day.enabled ? undefined : (day.closedReason || "Cerrado por descanso"),
        displayText: day.enabled ? `${openFormatted} — ${closeFormatted}` : (day.closedReason || "Cerrado"),
      };
    });

    const todayConfig = formattedDays.find((d) => d.dayOfWeek === currentDayOfWeek);
    const isTodayOpen = Boolean(
      todayConfig?.enabled &&
      currentHourMin >= todayConfig.openTime &&
      currentHourMin <= todayConfig.closeTime
    );

    // Días abiertos y cerrados para resúmenes visuales en la portada y el menú
    const openDays = formattedDays.filter((d) => d.enabled);
    const closedDays = formattedDays.filter((d) => !d.enabled);

    let openDaysSummary = "";
    if (openDays.length > 0) {
      const firstOpen = openDays[0];
      const lastOpen = openDays[openDays.length - 1];
      const openTimeSample = firstOpen.openTimeFormatted || "11:00 AM";
      if (openDays.length === 6 && closedDays.length === 1 && closedDays[0].dayOfWeek === 1) {
        openDaysSummary = `Mar - Dom: Desde las ${openTimeSample}`;
      } else {
        openDaysSummary = `${firstOpen.dayName} a ${lastOpen.dayName}: Desde las ${openTimeSample}`;
      }
    }

    const closedDaysSummary = closedDays.length > 0
      ? closedDays.map((d) => `${d.dayName}: ${d.closedReason || "Cerrado por descanso"}`).join(", ")
      : "";

    return {
      isConfigured: true,
      timeZone,
      updatedAt: (schedule as any).updatedAt || null,
      weeklySchedule: formattedDays,
      openDaysSummary,
      closedDaysSummary,
      todayStatus: {
        dayName: todayConfig?.dayName || "Hoy",
        isOpenNow: isTodayOpen,
        isEnabledToday: Boolean(todayConfig?.enabled),
        displayText: isTodayOpen
          ? `Abierto hoy hasta ${todayConfig?.closeTimeFormatted}`
          : todayConfig?.enabled
          ? `Abre hoy a las ${todayConfig?.openTimeFormatted}`
          : "Cerrado hoy por descanso",
      },
    };
  },
});

/**
 * Alias de consulta de horarios públicos.
 */
export const getOpeningHours = getPublicOpeningHours;

/**
 * Actualiza la programación semanal de horarios y turnos de Bar Terraza.
 * Protegida con autenticación y validación de permisos administrativos (Android / Web Admin).
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
        closedReason: v.optional(v.string()),
      })
    ),
    timeZone: v.optional(v.string()),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    adminToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Autorización administrativa obligatoria
    await assertAdminPermission(ctx, args.adminToken, args.sessionToken);

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
 * Alias de mutación administrativa para guardar horarios de apertura.
 */
export const updateOpeningHours = updateSchedule;

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
