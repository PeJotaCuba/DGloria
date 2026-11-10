import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { authorizeUser } from "./auth";

declare const process: { env: Record<string, string | undefined> };

/**
 * Módulo de Administración y Registro de Dispositivos de Navegador (WEB DVC) para Doña Gloria.
 */

// ==========================================
// CONSULTAS PÚBLICAS Y REGISTRO DE DISPOSITIVO WEB (DVC)
// ==========================================

/**
 * Consulta pública del estado de un navegador registrado en WEB DVC.
 */
export const getBrowserDeviceStatus = query({
  args: {
    dvcCode: v.optional(v.string()),
    code: v.optional(v.string()),
    id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rawCode = args.dvcCode || args.code || args.id || "";
    const cleanCode = rawCode.trim().toUpperCase();

    if (!cleanCode) {
      return null;
    }

    let device = await ctx.db
      .query("browser_devices")
      .withIndex("by_dvcCode", (q) => q.eq("dvcCode", cleanCode))
      .first();

    if (!device) {
      const all = await ctx.db.query("browser_devices").collect();
      device = all.find(
        (d) =>
          d.dvcCode.trim().toUpperCase() === cleanCode ||
          d.id === rawCode ||
          d._id.toString() === rawCode
      ) || null;
    }

    if (!device) {
      return null;
    }

    return {
      status: device.status,
      dvcCode: device.dvcCode,
      userAgent: device.userAgent,
      createdAt: device.createdAt,
      registeredAt: device.registeredAt,
      lastActiveAt: device.lastActiveAt,
      authorized: device.status === "ACTIVE",
      active: device.status === "ACTIVE",
      id: device.id || device._id.toString(),
    };
  },
});

/**
 * Registro idempotente de un nuevo dispositivo WEB (DVC).
 * - Si no existe, se crea con estado 'PENDING'.
 * - Si ya existe, se preserva su estado actual ('ACTIVE', 'INACTIVE', 'PENDING' o 'PENDIENTE') sin degradarlo ni reactivarlo automáticamente.
 */
export const registerBrowserDevice = mutation({
  args: {
    dvcCode: v.optional(v.string()),
    code: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rawCode = args.dvcCode || args.code || "";
    const cleanCode = rawCode.trim().toUpperCase();
    const cleanUserAgent = (args.userAgent || "").trim();
    const now = Date.now();

    if (!cleanCode) {
      throw new Error("Debe proporcionar un identificador DVC válido");
    }

    // Buscar si ya existe por dvcCode
    let existing = await ctx.db
      .query("browser_devices")
      .withIndex("by_dvcCode", (q) => q.eq("dvcCode", cleanCode))
      .first();

    if (!existing) {
      const all = await ctx.db.query("browser_devices").collect();
      existing = all.find(
        (d) => d.dvcCode.trim().toUpperCase() === cleanCode
      ) || null;
    }

    if (existing) {
      // Registro idempotente: actualizar timestamps sin alterar el estado (ACTIVE / INACTIVE / PENDING)
      await ctx.db.patch(existing._id, {
        lastActiveAt: now,
        updatedAt: now,
        ...(cleanUserAgent ? { userAgent: cleanUserAgent } : {}),
      });

      return {
        success: true,
        status: existing.status,
        dvcCode: existing.dvcCode,
        id: existing.id || existing._id.toString(),
        alreadyRegistered: true,
      };
    }

    // Si es un DVC nuevo, registrar con estado PENDING
    const newId = args.id || crypto.randomUUID();
    const newDoc = {
      id: newId,
      dvcCode: cleanCode,
      userAgent: cleanUserAgent,
      status: "PENDING" as const,
      createdAt: now,
      updatedAt: now,
      registeredAt: now,
      lastActiveAt: now,
    };

    const docId = await ctx.db.insert("browser_devices", newDoc);

    return {
      success: true,
      status: "PENDING",
      dvcCode: cleanCode,
      id: newId,
      _id: docId,
      alreadyRegistered: false,
    };
  },
});

// ==========================================
// CONSULTAS ADMINISTRATIVAS: LISTAR DISPOSITIVOS DE NAVEGADOR
// ==========================================

export const listAuthorizedBrowserDevices = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken },
      ["ADMIN_GENERAL"],
      { actionDescription: "listar dispositivos de navegador autorizados" }
    );

    const devices = await ctx.db
      .query("browser_devices")
      .order("desc")
      .collect();

    // Devolver exclusivamente dispositivos con estado ACTIVE o INACTIVE
    return devices.filter(
      (d) => d.status === "ACTIVE" || d.status === "INACTIVE"
    );
  },
});

export const listAllBrowserDevices = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken },
      ["ADMIN_GENERAL"],
      { actionDescription: "listar dispositivos de navegador" }
    );

    const devices = await ctx.db
      .query("browser_devices")
      .order("desc")
      .collect();

    return devices.filter(
      (d) => d.status === "ACTIVE" || d.status === "INACTIVE"
    );
  },
});

// ==========================================
// MUTACIÓN ADMINISTRATIVA: AUTORIZAR DISPOSITIVO POR CÓDIGO DVC
// ==========================================

export const authorizeDeviceByCode = mutation({
  args: {
    dvcCode: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken },
      ["ADMIN_GENERAL"],
      { actionDescription: "autorizar dispositivo DVC de navegador" }
    );

    const cleanCode = args.dvcCode.trim().toUpperCase();

    const all = await ctx.db.query("browser_devices").collect();
    const device = all.find(
      (d) => d.dvcCode.trim().toUpperCase() === cleanCode
    );

    if (!device) {
      return {
        success: false,
        code: "NOT_FOUND",
        message: "El navegador todavía no se ha registrado en la WEB.",
      };
    }

    const currentStatus = (device.status || "").toUpperCase();

    if (currentStatus === "ACTIVE") {
      return {
        success: false,
        code: "ALREADY_ACTIVE",
        message: "El navegador ya se encuentra autorizado.",
      };
    }

    if (currentStatus === "INACTIVE") {
      return {
        success: false,
        code: "INACTIVE",
        message: "El navegador existe pero está INACTIVO. Puede reactivarse desde el listado.",
      };
    }

    // PENDING o PENDIENTE -> Cambiar a ACTIVE
    await ctx.db.patch(device._id, {
      status: "ACTIVE",
      updatedAt: Date.now(),
    });

    return {
      success: true,
      code: "AUTHORIZED",
      message: `Navegador ${cleanCode} autorizado con éxito.`,
    };
  },
});

// ==========================================
// MUTACIÓN ADMINISTRATIVA: ACTUALIZAR ESTADO DEL DISPOSITIVO
// ==========================================

export const updateDeviceStatus = mutation({
  args: {
    id: v.string(),
    status: v.union(
      v.literal("PENDIENTE"),
      v.literal("PENDING"),
      v.literal("ACTIVE"),
      v.literal("INACTIVE")
    ),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken },
      ["ADMIN_GENERAL"],
      { actionDescription: "actualizar estado de dispositivo de navegador" }
    );

    let device = await ctx.db
      .query("browser_devices")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!device) {
      const all = await ctx.db.query("browser_devices").collect();
      device = all.find(
        (d) =>
          d.id === args.id ||
          d._id.toString() === args.id ||
          d.dvcCode === args.id
      ) || null;
    }

    if (!device) {
      throw new Error("Dispositivo no encontrado");
    }

    await ctx.db.patch(device._id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ==========================================
// MUTACIÓN ADMINISTRATIVA: ELIMINAR DISPOSITIVO
// ==========================================

export const deleteDevice = mutation({
  args: {
    id: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken },
      ["ADMIN_GENERAL"],
      { actionDescription: "eliminar dispositivo de navegador" }
    );

    let device = await ctx.db
      .query("browser_devices")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!device) {
      const all = await ctx.db.query("browser_devices").collect();
      device = all.find(
        (d) =>
          d.id === args.id ||
          d._id.toString() === args.id ||
          d.dvcCode === args.id
      ) || null;
    }

    if (!device) {
      throw new Error("Dispositivo no encontrado");
    }

    await ctx.db.delete(device._id);

    return { success: true };
  },
});

// ==========================================
// WEB PUSH: SUSCRIPCIONES Y CONFIGURACIÓN VAPID
// ==========================================

export const getWebPushConfigStatus = query({
  args: {},
  handler: async () => {
    const vapidPublicKey =
      process.env.VAPID_PUBLIC_KEY?.trim() ||
      process.env.VITE_VAPID_PUBLIC_KEY?.trim() ||
      process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ||
      null;
    const hasPrivateKey = Boolean(
      process.env.VAPID_PRIVATE_KEY?.trim() ||
        process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim()
    );

    return {
      configured: Boolean(vapidPublicKey && hasPrivateKey),
      vapidPublicKey,
    };
  },
});

export const upsertBrowserPushSubscription = mutation({
  args: {
    dvcCode: v.string(),
    userAgent: v.optional(v.string()),
    permission: v.optional(
      v.union(v.literal("granted"), v.literal("denied"), v.literal("default"))
    ),
    subscription: v.optional(
      v.object({
        endpoint: v.string(),
        expirationTime: v.optional(v.union(v.number(), v.null())),
        keys: v.object({
          p256dh: v.string(),
          auth: v.string(),
        }),
      })
    ),
  },
  handler: async (ctx, args) => {
    const cleanCode = args.dvcCode.trim().toUpperCase();
    if (!cleanCode) {
      throw new Error("Debe proporcionar un identificador DVC válido");
    }

    const now = Date.now();
    let device = await ctx.db
      .query("browser_devices")
      .withIndex("by_dvcCode", (q) => q.eq("dvcCode", cleanCode))
      .first();

    if (!device) {
      const all = await ctx.db.query("browser_devices").collect();
      device =
        all.find((d) => d.dvcCode.trim().toUpperCase() === cleanCode) || null;
    }

    if (!device) {
      return {
        success: false,
        notFound: true,
        subscribed: false,
        message: "El dispositivo DVC aún no está registrado en browser_devices.",
      };
    }

    const patch: Record<string, any> = {
      pushUpdatedAt: now,
      updatedAt: now,
    };

    if (args.permission) {
      patch.pushPermission = args.permission;
    }
    if (args.subscription) {
      patch.pushSubscription = args.subscription;
    } else if (args.permission === "denied") {
      patch.pushSubscription = undefined;
    }

    await ctx.db.patch(device._id, patch);

    return {
      success: true,
      status: device.status,
      subscribed: Boolean(args.subscription ?? device.pushSubscription),
    };
  },
});

export const removeBrowserPushSubscription = mutation({
  args: {
    dvcCode: v.string(),
    endpoint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanCode = args.dvcCode.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false };
    }

    let device = await ctx.db
      .query("browser_devices")
      .withIndex("by_dvcCode", (q) => q.eq("dvcCode", cleanCode))
      .first();

    if (!device) {
      const all = await ctx.db.query("browser_devices").collect();
      device =
        all.find((d) => d.dvcCode.trim().toUpperCase() === cleanCode) || null;
    }

    if (!device) {
      return { success: true };
    }

    if (
      args.endpoint &&
      device.pushSubscription &&
      device.pushSubscription.endpoint !== args.endpoint
    ) {
      return { success: true };
    }

    await ctx.db.patch(device._id, {
      pushSubscription: undefined,
      pushUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const listActiveAdminPushSubscriptions = internalQuery({
  args: {},
  handler: async (ctx) => {
    const activeDevices = await ctx.db
      .query("browser_devices")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .collect();

    return activeDevices
      .filter(
        (d) =>
          d.status === "ACTIVE" &&
          d.pushPermission !== "denied" &&
          d.pushSubscription &&
          d.pushSubscription.endpoint &&
          d.pushSubscription.keys?.p256dh &&
          d.pushSubscription.keys?.auth
      )
      .map((d) => ({
        deviceId: d._id,
        dvcCode: d.dvcCode,
        subscription: d.pushSubscription!,
      }));
  },
});

export const getClientPushSubscriptionByDvc = internalQuery({
  args: {
    dvcCode: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanCode = args.dvcCode.trim().toUpperCase();
    if (!cleanCode) return null;

    let device = await ctx.db
      .query("browser_devices")
      .withIndex("by_dvcCode", (q) => q.eq("dvcCode", cleanCode))
      .first();

    if (!device) {
      const all = await ctx.db.query("browser_devices").collect();
      device =
        all.find((d) => d.dvcCode.trim().toUpperCase() === cleanCode) || null;
    }

    if (
      !device ||
      device.pushPermission === "denied" ||
      !device.pushSubscription ||
      !device.pushSubscription.endpoint ||
      !device.pushSubscription.keys?.p256dh ||
      !device.pushSubscription.keys?.auth
    ) {
      return null;
    }

    return {
      deviceId: device._id,
      dvcCode: device.dvcCode,
      subscription: device.pushSubscription,
    };
  },
});

export const clearExpiredPushSubscription = internalMutation({
  args: {
    deviceId: v.id("browser_devices"),
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) return;
    if (device.pushSubscription?.endpoint === args.endpoint) {
      await ctx.db.patch(device._id, {
        pushSubscription: undefined,
        pushUpdatedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});
