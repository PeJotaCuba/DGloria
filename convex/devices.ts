import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authorizeUser } from "./auth";

/**
 * Registro único y persistente de dispositivos (DVC) para Doña Gloria.
 * Utilizado por la WEB para identificación de navegadores.
 */
export const getOrRegisterDevice = mutation({
  args: {
    hardwareId: v.string(),
    deviceType: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanHardwareId = args.hardwareId.trim();
    if (!cleanHardwareId) {
      throw new Error("Identificador de hardware no válido");
    }

    // 1. Buscar si ya existe un registro para este hardwareId
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_hardwareId", (q) => q.eq("hardwareId", cleanHardwareId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeenAt: now,
        lastActiveAt: now,
      });
      return {
        id: existing.id,
        dvcCode: existing.dvcCode,
        status: existing.status || "PENDING",
        isNew: false,
      };
    }

    // 2. Generar código DVC-XXXXXX único (6 caracteres alfanuméricos en mayúsculas)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let dvcCode = "";
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      let codePart = "";
      const randomValues = new Uint8Array(6);
      crypto.getRandomValues(randomValues);
      for (let i = 0; i <  randomValues.length; i++) {
        codePart += chars.charAt(randomValues[i] % chars.length);
      }
      dvcCode = `DVC-${codePart}`;

      const collision = await ctx.db
        .query("devices")
        .withIndex("by_dvcCode", (q) => q.eq("dvcCode", dvcCode))
        .first();

      if (!collision) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new Error("No se pudo generar un código DVC único tras varios intentos");
    }

    const deviceId = crypto.randomUUID();
    await ctx.db.insert("devices", {
      id: deviceId,
      hardwareId: cleanHardwareId,
      dvcCode,
      status: "PENDING",
      createdAt: now,
      registeredAt: now,
      lastSeenAt: now,
      lastActiveAt: now,
      deviceType: args.deviceType || "WEB_BROWSER",
      name: args.name || "Navegador Web",
      authorized: false,
    });

    return {
      id: deviceId,
      dvcCode,
      status: "PENDING",
      isNew: true,
    };
  },
});

/**
 * Consulta de estado de un DVC específico (utilizado por WEB).
 */
export const checkDeviceStatus = query({
  args: {
    dvcCode: v.string(),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_dvcCode", (q) => q.eq("dvcCode", args.dvcCode))
      .first();
    
    if (!device) return { exists: false };
    
    return {
      exists: true,
      status: device.status || "PENDING",
      authorized: device.status === "ACTIVE",
    };
  },
});

// ==========================================
// OPERACIONES ADMINISTRATIVAS (ADMIN_GENERAL)
// ==========================================

/**
 * Listado completo de dispositivos registrados para administración.
 */
export const listDevices = query({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    status: v.optional(v.union(v.literal("ALL"), v.literal("PENDING"), v.literal("ACTIVE"), v.literal("INACTIVE"))),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL"],
      { actionDescription: "consultar identificadores de navegadores" }
    );

    let devicesQuery;
    
    if (args.status && args.status !== "ALL") {
      devicesQuery = ctx.db.query("devices").withIndex("by_status", (q) => q.eq("status", args.status as any));
    } else {
      devicesQuery = ctx.db.query("devices");
    }

    const results = await devicesQuery.order("desc").collect();
    return results;
  },
});

/**
 * Autoriza un dispositivo DVC (PENDING/INACTIVE -> ACTIVE).
 */
export const authorizeDevice = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    adminUserId: v.string(),
    dvcCode: v.string(),
  },
  handler: async (ctx, args) => {
    const { user: admin } = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId },
      ["ADMIN_GENERAL"],
      { actionDescription: "autorizar navegador web" }
    );

    const device = await ctx.db
      .query("devices")
      .withIndex("by_dvcCode", (q) => q.eq("dvcCode", args.dvcCode.trim().toUpperCase()))
      .first();

    if (!device) {
      throw new Error(`El identificador ${args.dvcCode} no existe en el sistema`);
    }

    const now = Date.now();
    await ctx.db.patch(device._id, {
      status: "ACTIVE",
      authorized: true,
      registeredAt: device.registeredAt || now, // Si no tenía, fijar ahora
      lastSeenAt: now,
    });

    // Registrar log de auditoría
    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: admin.id,
      userName: admin.fullName || admin.username,
      module: "GENERAL",
      action: "AUTORIZAR_DVC",
      entityId: device.dvcCode,
      result: "SUCCESS",
      timestamp: now,
      isOutsideShift: false,
      details: `Dispositivo ${device.dvcCode} autorizado por administrador.`,
    });

    return { success: true };
  },
});

/**
 * Desactiva un dispositivo DVC (ACTIVE -> INACTIVE).
 */
export const deactivateDevice = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    adminUserId: v.string(),
    dvcCode: v.string(),
  },
  handler: async (ctx, args) => {
    const { user: admin } = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId },
      ["ADMIN_GENERAL"],
      { actionDescription: "desactivar navegador web" }
    );

    const device = await ctx.db
      .query("devices")
      .withIndex("by_dvcCode", (q) => q.eq("dvcCode", args.dvcCode.trim().toUpperCase()))
      .first();

    if (!device) {
      throw new Error("Dispositivo no encontrado");
    }

    const now = Date.now();
    await ctx.db.patch(device._id, {
      status: "INACTIVE",
      authorized: false,
      lastSeenAt: now,
    });

    // Registrar log de auditoría
    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: admin.id,
      userName: admin.fullName || admin.username,
      module: "GENERAL",
      action: "DESACTIVAR_DVC",
      entityId: device.dvcCode,
      result: "SUCCESS",
      timestamp: now,
      isOutsideShift: false,
      details: `Dispositivo ${device.dvcCode} desactivado por administrador.`,
    });

    return { success: true };
  },
});

/**
 * Reactiva un dispositivo DVC (INACTIVE -> ACTIVE).
 */
export const reactivateDevice = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    adminUserId: v.string(),
    dvcCode: v.string(),
  },
  handler: async (ctx, args) => {
    const { user: admin } = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId },
      ["ADMIN_GENERAL"],
      { actionDescription: "reactivar navegador web" }
    );

    const device = await ctx.db
      .query("devices")
      .withIndex("by_dvcCode", (q) => q.eq("dvcCode", args.dvcCode.trim().toUpperCase()))
      .first();

    if (!device) {
      throw new Error("Dispositivo no encontrado");
    }

    const now = Date.now();
    await ctx.db.patch(device._id, {
      status: "ACTIVE",
      authorized: true,
      lastSeenAt: now,
    });

    // Registrar log de auditoría
    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: admin.id,
      userName: admin.fullName || admin.username,
      module: "GENERAL",
      action: "REACTIVAR_DVC",
      entityId: device.dvcCode,
      result: "SUCCESS",
      timestamp: now,
      isOutsideShift: false,
      details: `Dispositivo ${device.dvcCode} reactivado por administrador.`,
    });

    return { success: true };
  },
});

/**
 * Elimina definitivamente un registro DVC.
 */
export const deleteDevice = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    adminUserId: v.string(),
    dvcCode: v.string(),
  },
  handler: async (ctx, args) => {
    const { user: admin } = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId },
      ["ADMIN_GENERAL"],
      { actionDescription: "eliminar registro de navegador" }
    );

    const device = await ctx.db
      .query("devices")
      .withIndex("by_dvcCode", (q) => q.eq("dvcCode", args.dvcCode.trim().toUpperCase()))
      .first();

    if (!device) {
      throw new Error("Dispositivo no encontrado");
    }

    const now = Date.now();
    await ctx.db.delete(device._id);

    // Registrar log de auditoría
    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: admin.id,
      userName: admin.fullName || admin.username,
      module: "GENERAL",
      action: "ELIMINAR_DVC",
      entityId: args.dvcCode,
      result: "SUCCESS",
      timestamp: now,
      isOutsideShift: false,
      details: `Registro DVC ${args.dvcCode} eliminado definitivamente por administrador.`,
    });

    return { success: true };
  },
});
