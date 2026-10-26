import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Función pública utilizada por la app Android Doña Gloria para consultar o registrar
 * un dispositivo (TPV, tablet, teléfono).
 */
export const getOrRegisterDevice = mutation({
  args: {
    dvcCode: v.optional(v.string()),
    hardwareId: v.optional(v.string()),
    deviceName: v.optional(v.string()),
    name: v.optional(v.string()),
    deviceType: v.optional(v.string()),
    model: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const code = args.dvcCode || args.hardwareId || `DVC-${Date.now().toString(36).toUpperCase()}`;
    const deviceName = args.deviceName || args.name || args.model || "Dispositivo Android Doña Gloria";

    let existingDevice = null;

    // 1. Buscar por dvcCode
    if (args.dvcCode) {
      const byCode = await ctx.db
        .query("devices")
        .withIndex("by_dvcCode", (q) => q.eq("dvcCode", args.dvcCode))
        .collect();
      existingDevice = byCode[0];
    }

    // 2. Buscar por hardwareId si no se encontró por dvcCode
    if (!existingDevice && args.hardwareId) {
      const byHardware = await ctx.db
        .query("devices")
        .withIndex("by_hardwareId", (q) => q.eq("hardwareId", args.hardwareId))
        .collect();
      existingDevice = byHardware[0];
    }

    const now = Date.now();

    // Si el dispositivo ya existe, actualizar última actividad
    if (existingDevice) {
      await ctx.db.patch(existingDevice._id, {
        lastActiveAt: now,
        ...(args.deviceName || args.name ? { name: deviceName } : {}),
      });

      return {
        success: true,
        device: {
          ...existingDevice,
          id: existingDevice._id,
        },
        authorized: existingDevice.authorized ?? true,
      };
    }

    // Si es un nuevo dispositivo, registrarlo en la base de datos
    const newDeviceId = await ctx.db.insert("devices", {
      dvcCode: code,
      hardwareId: args.hardwareId || code,
      name: deviceName,
      deviceType: args.deviceType || "android_app",
      authorized: true,
      registeredAt: now,
      lastActiveAt: now,
    });

    const createdDevice = await ctx.db.get(newDeviceId);

    return {
      success: true,
      device: {
        ...createdDevice,
        id: newDeviceId,
      },
      authorized: true,
    };
  },
});

/**
 * Consulta pública/admin de lista de dispositivos.
 */
export const listDevices = query({
  args: {},
  handler: async (ctx) => {
    const devices = await ctx.db.query("devices").collect();
    return devices.map((d) => ({
      ...d,
      id: d._id,
    }));
  },
});
