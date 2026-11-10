import { mutation, query, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { authorizeUser, isOwnerAccount } from "./auth";
import { internal } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

/**
 * Operaciones para notificaciones operativas en tiempo real:
 * - Consultas de alertas por rol, usuario o no leídas
 * - Mutaciones para emitir avisos y marcar lecturas
 */

// ==========================================
// CONSULTAS: NOTIFICACIONES
// ==========================================

export const listNotifications = query({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    targetRole: v.optional(
      v.union(
        v.literal("ADMIN_GENERAL"),
        v.literal("DUENO"),
        v.literal("CAJERO"),
        v.literal("DEPENDIENTE"),
        v.literal("COCINA")
      )
    ),
    targetUserId: v.optional(v.string()),
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const { targetRole, targetUserId, unreadOnly } = args;

    // 1. Autenticar al usuario que consulta
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE", "COCINA"],
      { actionDescription: "consultar notificaciones" }
    );

    const isOwner = isOwnerAccount(auth.user);
    const isAdmin = auth.user.role === "ADMIN_GENERAL";

    // 2. Si se solicita un usuario específico, solo permitir al propio usuario o Administrador
    if (targetUserId !== undefined) {
      if (targetUserId !== auth.user.id && !isAdmin) {
        throw new Error("Acceso denegado: No puede consultar notificaciones de otro usuario");
      }
    }

    // 3. Si se solicita un rol específico, validar privilegios
    if (targetRole === "ADMIN_GENERAL" && !isAdmin) {
      throw new Error("Acceso denegado: Solo administradores pueden ver estas alertas");
    }

    if (targetRole === "DUENO" && auth.user.role !== "DUENO" && !isAdmin) {
      throw new Error("Acceso denegado: No tiene autorización para el canal del Dueño");
    }

    // 4. Construir consulta base
    let queryBuilder = ctx.db.query("notifications");

    // Filtrado por usuario (incluye las dirigidas al rol del usuario)
    let results;

    if (targetUserId !== undefined) {
      results = await ctx.db
        .query("notifications")
        .withIndex("by_targetUser", (q) => q.eq("targetUserId", targetUserId))
        .order("desc")
        .take(limit);
    } else if (targetRole !== undefined) {
       results = await ctx.db
        .query("notifications")
        .withIndex("by_targetRole", (q) => q.eq("targetRole", targetRole))
        .order("desc")
        .take(limit);
    } else {
       // Por defecto, mostrar notificaciones para su rol y para su ID
       const byRole = await ctx.db
         .query("notifications")
         .withIndex("by_targetRole", (q) => q.eq("targetRole", auth.user.role))
         .collect();
       
       const byUserId = await ctx.db
         .query("notifications")
         .withIndex("by_targetUser", (q) => q.eq("targetUserId", auth.user.id))
         .collect();
       
       results = [...byRole, ...byUserId].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    }

    // 5. Filtrado de seguridad adicional para CAJERO (Cajeros no ven reservaciones privadas ni informes del Dueño)
    if (auth.user.role === "CAJERO" && !isOwner) {
       results = results.filter(n => {
         if (n.targetRole === "CAJERO") {
           const lowTitle = n.title.toLowerCase();
           if (lowTitle.includes("reservación") || lowTitle.includes("reserva")) return false;
         }
         return true;
       });
    }

    // Filtrar por no leídas si se solicita
    if (unreadOnly) {
      results = results.filter(n => !n.isRead);
    }

    return results;
  },
});


// ==========================================
// MUTACIONES: GESTIÓN DE NOTIFICACIONES
// ==========================================

/**
 * Emitir una nueva notificación operativa dirigida a un rol, usuario o comanda
 */
export const createNotification = mutation({
  args: {
    title: v.string(),
    message: v.string(),
    targetRole: v.optional(
      v.union(
        v.literal("ADMIN_GENERAL"),
        v.literal("DUENO"),
        v.literal("CAJERO"),
        v.literal("DEPENDIENTE"),
        v.literal("COCINA")
      )
    ),
    targetUserId: v.optional(v.string()),
    orderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trimmedTitle = args.title.trim();
    const trimmedMessage = args.message.trim();

    if (!trimmedTitle) throw new Error("El título de la notificación no puede estar vacío");
    if (!trimmedMessage) throw new Error("El contenido de la notificación no puede estar vacío");

    const id = crypto.randomUUID();
    const docData = {
      id,
      title: trimmedTitle,
      message: trimmedMessage,
      targetRole: args.targetRole,
      targetUserId: args.targetUserId,
      orderId: args.orderId,
      isRead: false,
      timestamp: Date.now(),
    };

    const docId = await ctx.db.insert("notifications", docData);
    return { _id: docId, ...docData };
  },
});

/**
 * Marcar una notificación individual como leída
 */
export const markNotificationRead = mutation({
  args: {
    id: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE", "COCINA"],
      { actionDescription: "marcar notificación como leída" }
    );

    const notif = await ctx.db
      .query("notifications")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!notif) {
      throw new Error(`Notificación con ID ${args.id} no encontrada`);
    }

    // Seguridad: Solo permitir marcar como leída si es el destinatario o Administrador
    const isAdmin = auth.user.role === "ADMIN_GENERAL";
    const isTargetUser = notif.targetUserId === auth.user.id;
    const isTargetRole = notif.targetRole === auth.user.role;

    if (!isAdmin && !isTargetUser && !isTargetRole) {
      throw new Error("Acceso denegado: No puede marcar como leída una notificación dirigida a otro usuario o rol");
    }

    await ctx.db.patch(notif._id, { isRead: true });
    return { success: true, id: args.id, isRead: true };
  },
});

export const markAsRead = markNotificationRead;

/**
 * Marcar todas las notificaciones pendientes como leídas
 */
export const markAllNotificationsRead = mutation({
  args: {
    targetRole: v.optional(
      v.union(
        v.literal("ADMIN_GENERAL"),
        v.literal("DUENO"),
        v.literal("CAJERO"),
        v.literal("DEPENDIENTE"),
        v.literal("COCINA")
      )
    ),
    targetUserId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE", "COCINA"],
      { actionDescription: "marcar todas las notificaciones como leídas" }
    );

    const isAdmin = auth.user.role === "ADMIN_GENERAL";
    let unreadList;

    if (args.targetRole !== undefined) {
      if (args.targetRole !== auth.user.role && !isAdmin) {
        throw new Error("Acceso denegado: No puede marcar como leídas las notificaciones de otro rol");
      }
      unreadList = await ctx.db
        .query("notifications")
        .withIndex("by_targetRole_and_isRead", (q) =>
          q.eq("targetRole", args.targetRole!).eq("isRead", false)
        )
        .collect();
    } else if (args.targetUserId !== undefined) {
      if (args.targetUserId !== auth.user.id && !isAdmin) {
        throw new Error("Acceso denegado: No puede marcar como leídas las notificaciones de otro usuario");
      }
      unreadList = await ctx.db
        .query("notifications")
        .withIndex("by_targetUser_and_isRead", (q) =>
          q.eq("targetUserId", args.targetUserId!).eq("isRead", false)
        )
        .collect();
    } else {
      // Si no se especifica, limpiar solo las propias (rol e ID)
      const byRole = await ctx.db
        .query("notifications")
        .withIndex("by_targetRole_and_isRead", (q) =>
          q.eq("targetRole", auth.user.role).eq("isRead", false)
        )
        .collect();
      
      const byUserId = await ctx.db
        .query("notifications")
        .withIndex("by_targetUser_and_isRead", (q) =>
          q.eq("targetUserId", auth.user.id).eq("isRead", false)
        )
        .collect();
      
      unreadList = [...byRole, ...byUserId];
    }

    for (const notif of unreadList) {
      await ctx.db.patch(notif._id, { isRead: true });
    }

    return { success: true, count: unreadList.length };
  },
});

// ==========================================
// REGISTRO DE TOKENS PUSHY (MQTT INDEPENDIENTE)
// ==========================================

export const registerPushyToken = mutation({
  args: {
    userId: v.string(),
    username: v.string(),
    pushyToken: v.string(),
    deviceInfo: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Verificar que el usuario sea activo y tenga rol operativo
    const user = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", args.userId))
      .first();

    if (!user || !user.active || !["ADMIN_GENERAL", "DUENO", "CAJERO", "COCINA", "DEPENDIENTE"].includes(user.role)) {
      throw new Error("No autorizado para registrar tokens de notificación push");
    }

    const now = Date.now();

    // 2. Comprobar si ya existe este token
    const existing = await ctx.db
      .query("pushy_tokens")
      .withIndex("by_pushyToken", (q) => q.eq("pushyToken", args.pushyToken))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: args.userId,
        username: args.username,
        deviceInfo: args.deviceInfo,
        updatedAt: now,
        active: true,
      });
      return { success: true, tokenId: existing.id };
    }

    // Desactivar otros tokens del mismo usuario en este dispositivo si existen
    const userTokens = await ctx.db
      .query("pushy_tokens")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const t of userTokens) {
      if (t.deviceInfo === args.deviceInfo && t.active) {
        await ctx.db.patch(t._id, { pushyToken: args.pushyToken, updatedAt: now });
        return { success: true, tokenId: t.id };
      }
    }

    const tokenId = crypto.randomUUID();
    await ctx.db.insert("pushy_tokens", {
      id: tokenId,
      userId: args.userId,
      username: args.username,
      pushyToken: args.pushyToken,
      deviceInfo: args.deviceInfo,
      updatedAt: now,
      active: true,
    });

    return { success: true, tokenId };
  },
});

export const unregisterPushyToken = mutation({
  args: {
    userId: v.string(),
    deviceInfo: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushy_tokens")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const t of existing) {
      if (t.deviceInfo === args.deviceInfo && t.active) {
        await ctx.db.patch(t._id, { active: false, updatedAt: Date.now() });
      }
    }
    return { success: true };
  },
});

/**
 * Consulta interna para obtener tokens Pushy de destinatarios de reservaciones (Admin y Dueño real).
 */
/**
 * Consulta interna para obtener tokens Pushy de destinatarios de reservaciones (Admin y Dueño real).
 */
export const listPushyTokensForReservations = internalQuery({
  args: {},
  handler: async (ctx) => {
    const tokens = await ctx.db
      .query("pushy_tokens")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "ADMIN_GENERAL"))
      .collect();

    const adminIds = new Set(admins.map(u => u.id));

    return tokens.filter(t => {
      const isAdmin = adminIds.has(t.userId);
      const isOwner = t.userId === "u-dueno" || t.username === "dueno" || t.username === "dueño";
      return isAdmin || isOwner;
    }).map(t => t.pushyToken);
  },
});

/**
 * Consulta interna para obtener tokens Pushy de un rol específico (e.g. COCINA)
 */
export const listPushyTokensForRole = internalQuery({
  args: { role: v.string() },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("pushy_tokens")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    const roleUsers = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", args.role as any))
      .collect();

    const activeUserIds = new Set(roleUsers.filter(u => u.active).map(u => u.id));

    return tokens.filter(t => activeUserIds.has(t.userId)).map(t => t.pushyToken);
  },
});

/**
 * Consulta interna para obtener tokens Pushy de un usuario específico (e.g. Waiter/Dependiente)
 */
export const listPushyTokensForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("pushy_tokens")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return tokens.filter(t => t.active).map(t => t.pushyToken);
  },
});

// ==========================================
// ACCIÓN PARA ENVÍO EXTERNO A PUSHY API
// ==========================================

export const sendPushyNotification = internalAction({
  args: {
    title: v.string(),
    message: v.string(),
    type: v.string(), // "RESERVACION", "COCINA", "DEPENDIENTE", etc.
    reservationId: v.optional(v.string()),
    orderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pushySecretKey = process.env.PUSHY_SECRET_API_KEY;
    if (!pushySecretKey) {
      console.log("PUSHY_SECRET_API_KEY no configurada. Omitiendo notificación push externa.");
      return { success: false, reason: "MISSING_API_KEY" };
    }

    const tokens = await ctx.runQuery(internal.notifications.listPushyTokensForReservations);
    if (tokens.length === 0) {
      console.log("No hay dispositivos registrados para recibir esta notificación push.");
      return { success: false, reason: "NO_TOKENS" };
    }

    const payload = {
      to: tokens,
      data: {
        title: args.title,
        message: args.message,
        type: args.type,
        reservationId: args.reservationId,
        orderId: args.orderId,
      },
      notification: {
        badge: 1,
        sound: "default",
        title: args.title,
        body: args.message
      }
    };

    try {
      const response = await fetch(`https://api.pushy.me/push?api_key=${pushySecretKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error en API de Pushy (${response.status}): ${errorText}`);
        return { success: false, status: response.status };
      }

      const result = await response.json();
      return { success: true, pushyId: result.id };
    } catch (e) {
      console.error("Error al comunicar con la API de Pushy:", e);
      return { success: false, error: String(e) };
    }
  },
});

export const sendPushNotificationToRole = internalAction({
  args: {
    role: v.string(),
    title: v.string(),
    message: v.string(),
    type: v.string(),
    orderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pushySecretKey = process.env.PUSHY_SECRET_API_KEY;
    if (!pushySecretKey) {
      console.log("PUSHY_SECRET_API_KEY no configurada. Omitiendo notificación push a rol.");
      return { success: false, reason: "MISSING_API_KEY" };
    }

    const tokens = await ctx.runQuery(internal.notifications.listPushyTokensForRole, { role: args.role });
    if (tokens.length === 0) {
      console.log(`No hay tokens Pushy registrados para el rol ${args.role}.`);
      return { success: false, reason: "NO_TOKENS" };
    }

    const payload = {
      to: tokens,
      data: {
        title: args.title,
        message: args.message,
        type: args.type,
        orderId: args.orderId,
      },
      notification: {
        badge: 1,
        sound: "default",
        title: args.title,
        body: args.message,
      },
    };

    try {
      const response = await fetch(`https://api.pushy.me/push?api_key=${pushySecretKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error en API de Pushy (${response.status}): ${errorText}`);
        return { success: false, status: response.status };
      }

      const result = await response.json();
      return { success: true, pushyId: result.id };
    } catch (e) {
      console.error("Error al comunicar con la API de Pushy:", e);
      return { success: false, error: String(e) };
    }
  },
});

export const sendPushNotificationToUser = internalAction({
  args: {
    userId: v.string(),
    title: v.string(),
    message: v.string(),
    type: v.string(),
    orderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pushySecretKey = process.env.PUSHY_SECRET_API_KEY;
    if (!pushySecretKey) {
      console.log("PUSHY_SECRET_API_KEY no configurada. Omitiendo notificación push a usuario.");
      return { success: false, reason: "MISSING_API_KEY" };
    }

    const tokens = await ctx.runQuery(internal.notifications.listPushyTokensForUser, { userId: args.userId });
    if (tokens.length === 0) {
      console.log(`No hay tokens Pushy registrados para el usuario ${args.userId}.`);
      return { success: false, reason: "NO_TOKENS" };
    }

    const payload = {
      to: tokens,
      data: {
        title: args.title,
        message: args.message,
        type: args.type,
        orderId: args.orderId,
      },
      notification: {
        badge: 1,
        sound: "default",
        title: args.title,
        body: args.message,
      },
    };

    try {
      const response = await fetch(`https://api.pushy.me/push?api_key=${pushySecretKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error en API de Pushy (${response.status}): ${errorText}`);
        return { success: false, status: response.status };
      }

      const result = await response.json();
      return { success: true, pushyId: result.id };
    } catch (e) {
      console.error("Error al comunicar con la API de Pushy:", e);
      return { success: false, error: String(e) };
    }
  },
});

export const sendKitchenPushNotification = internalAction({
  args: {
    orderId: v.string(),
    orderNumber: v.number(),
    tableName: v.string(),
    waiterName: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runAction(internal.notifications.sendPushNotificationToRole, {
      role: "COCINA",
      title: `NUEVA COMANDA #${args.orderNumber}`,
      message: `${args.tableName}: Pedido de cocina recibido de ${args.waiterName}`,
      type: "COCINA",
      orderId: args.orderId,
    });
  },
});

