import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Registra un identificador de navegador (DVC) de forma idempotente.
 * Si ya existe, actualiza la fecha de última actividad.
 */
export const registerBrowserDevice = mutation({
  args: {
    dvcCode: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validar formato DVC-XXXXXX (6 caracteres alfanuméricos tras el prefijo)
    const dvcRegex = /^DVC-[A-Z0-9]{6}$/;
    if (!dvcRegex.test(args.dvcCode)) {
      throw new Error("Formato de identificador DVC inválido.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("browser_devices")
      .withIndex("by_dvcCode", (q) => q.eq("dvcCode", args.dvcCode))
      .unique();

    if (existing) {
      // Registro idempotente: solo actualizar actividad
      await ctx.db.patch(existing._id, {
        lastActiveAt: now,
      });
      return {
        success: true,
        status: existing.status,
        alreadyRegistered: true,
      };
    }

    // Nuevo registro
    await ctx.db.insert("browser_devices", {
      dvcCode: args.dvcCode,
      status: "PENDING",
      registeredAt: now,
      lastActiveAt: now,
      userAgent: args.userAgent,
    });

    return {
      success: true,
      status: "PENDING",
      alreadyRegistered: false,
    };
  },
});

/**
 * Consulta el estado real de un DVC en Convex.
 */
export const getBrowserDeviceStatus = query({
  args: {
    dvcCode: v.string(),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("browser_devices")
      .withIndex("by_dvcCode", (q) => q.eq("dvcCode", args.dvcCode))
      .unique();

    if (!device) {
      return null;
    }

    return {
      dvcCode: device.dvcCode,
      status: device.status,
      registeredAt: device.registeredAt,
      lastActiveAt: device.lastActiveAt,
    };
  },
});
