import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authorizeUser, authenticateSession, hashPassword } from "./auth";

/**
 * Operaciones para gestión de usuarios, perfiles, roles y credenciales:
 * - Inicialización segura del administrador (idempotente, sin sobrescribir cuentas existentes)
 * - Consultas de operadores y roles (con exclusión segura de hashes de contraseña)
 * - Alta y edición de perfiles protegidas por rol de administrador
 * - Cambio de contraseña con validación de credenciales previas y sin filtración de hashes
 * - Activación y desactivación de usuarios con revocación inmediata de sesiones activas
 */

// ==========================================
// CONSULTAS: USUARIOS
// ==========================================

export const listUsers = query({
  args: {
    activeOnly: v.optional(v.boolean()),
    includeDeleted: v.optional(v.boolean()),
    role: v.optional(
      v.union(
        v.literal("ADMIN_GENERAL"),
        v.literal("DUENO"),
        v.literal("CAJERO"),
        v.literal("DEPENDIENTE"),
        v.literal("COCINA")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { activeOnly, role, includeDeleted } = args;

    let users;
    if (role !== undefined && activeOnly !== undefined) {
      users = await ctx.db
        .query("users")
        .withIndex("by_role_and_active", (q) =>
          q.eq("role", role).eq("active", activeOnly)
        )
        .collect();
    } else if (activeOnly !== undefined) {
      users = await ctx.db
        .query("users")
        .withIndex("by_active", (q) => q.eq("active", activeOnly))
        .collect();
    } else if (role !== undefined) {
      users = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", role))
        .collect();
    } else {
      users = await ctx.db.query("users").collect();
    }

    if (!includeDeleted) {
      users = users.filter((u) => !u.deleted);
    }

    // Por seguridad estricta, excluir passwordHash y pin de cualquier respuesta y resolver foto de perfil
    return await Promise.all(
      users.map(async ({ passwordHash, pin, ...safeUser }) => {
        let pictureUrl = safeUser.profilePictureUrl;
        if (safeUser.profileStorageId) {
          try {
            const url = await ctx.storage.getUrl(safeUser.profileStorageId);
            if (url) pictureUrl = url;
          } catch (_) {}
        }
        return { ...safeUser, profilePictureUrl: pictureUrl };
      })
    );
  },
});

export const getUserById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!user) return null;
    const { passwordHash, pin, ...safeUser } = user;
    let pictureUrl = safeUser.profilePictureUrl;
    if (safeUser.profileStorageId) {
      try {
        const url = await ctx.storage.getUrl(safeUser.profileStorageId);
        if (url) pictureUrl = url;
      } catch (_) {}
    }
    return { ...safeUser, profilePictureUrl: pictureUrl };
  },
});

export const getUserByUsername = query({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username.trim().toLowerCase()))
      .first();

    if (!user) return null;
    const { passwordHash, pin, ...safeUser } = user;
    let pictureUrl = safeUser.profilePictureUrl;
    if (safeUser.profileStorageId) {
      try {
        const url = await ctx.storage.getUrl(safeUser.profileStorageId);
        if (url) pictureUrl = url;
      } catch (_) {}
    }
    return { ...safeUser, profilePictureUrl: pictureUrl };
  },
});

// ==========================================
// UTILIDADES: NORMALIZACIÓN Y VALIDACIÓN DE PERMISOS
// ==========================================

export function normalizeAssignedArea(area?: string): string {
  if (!area) return "TIENDA";
  const upper = area.trim().toUpperCase();
  if (upper === "BAR_TERRAZA" || upper === "BAR_RESTAURANTE" || upper === "BAR" || upper === "RESTAURANTE") {
    return "BAR_TERRAZA";
  }
  return "TIENDA";
}

export function sanitizeAndValidateUserPermissions(
  role: "ADMIN_GENERAL" | "DUENO" | "CAJERO" | "DEPENDIENTE" | "COCINA" | "DUENO_CAJERO" | "BARTENDER",
  assignedAreaInput: string | undefined,
  perms: {
    canOverridePrices?: boolean;
    canManageInventory?: boolean;
    canConfirmPayments?: boolean;
    canManageMenuItems?: boolean;
    canManageMenuAvailability?: boolean;
    canManageRestaurantSchedule?: boolean;
  }
) {
  if (role === "BARTENDER") {
    throw new Error("El rol BARTENDER ha sido desactivado del sistema.");
  }
  const assignedArea = normalizeAssignedArea(assignedAreaInput);

  if (role === "ADMIN_GENERAL") {
    return {
      assignedArea: "BAR_TERRAZA",
      canOverridePrices: perms.canOverridePrices ?? true,
      canManageInventory: perms.canManageInventory ?? true,
      canConfirmPayments: perms.canConfirmPayments ?? true,
      canManageMenuItems: perms.canManageMenuItems ?? true,
      canManageMenuAvailability: perms.canManageMenuAvailability ?? true,
      canManageRestaurantSchedule: perms.canManageRestaurantSchedule ?? true,
    };
  }

  if (role === "DUENO" || role === "DUENO_CAJERO") {
    return {
      assignedArea: assignedArea || "BAR_TERRAZA",
      canOverridePrices: perms.canOverridePrices ?? true,
      canManageInventory: perms.canManageInventory ?? true,
      canConfirmPayments: perms.canConfirmPayments ?? true,
      canManageMenuItems: perms.canManageMenuItems ?? true,
      canManageMenuAvailability: perms.canManageMenuAvailability ?? true,
      canManageRestaurantSchedule: perms.canManageRestaurantSchedule ?? true,
    };
  }

  if (role === "CAJERO") {
    return {
      assignedArea: "BAR_TERRAZA",
      canOverridePrices: false,
      canManageInventory: false,
      canConfirmPayments: perms.canConfirmPayments ?? true,
      canManageMenuItems: false,
      canManageMenuAvailability: false,
      canManageRestaurantSchedule: false,
    };
  }

  if (role === "COCINA") {
    return {
      assignedArea: "BAR_TERRAZA",
      canOverridePrices: false,
      canManageInventory: false,
      canConfirmPayments: false,
      canManageMenuItems: false,
      canManageMenuAvailability: false,
      canManageRestaurantSchedule: false,
    };
  }

  // Rol DEPENDIENTE
  if (assignedArea === "TIENDA") {
    if (
      perms.canManageMenuItems === true ||
      perms.canManageMenuAvailability === true ||
      perms.canManageRestaurantSchedule === true
    ) {
      throw new Error("Un Dependiente asignado a Tienda no puede tener permisos de gestión del Bar-Terraza");
    }
    return {
      assignedArea: "TIENDA",
      canOverridePrices: perms.canOverridePrices ?? false,
      canManageInventory: perms.canManageInventory ?? false,
      canConfirmPayments: perms.canConfirmPayments ?? false,
      canManageMenuItems: false,
      canManageMenuAvailability: false,
      canManageRestaurantSchedule: false,
    };
  } else {
    // assignedArea === "BAR_TERRAZA"
    if (
      perms.canOverridePrices === true ||
      perms.canManageInventory === true ||
      perms.canConfirmPayments === true
    ) {
      throw new Error("Un Dependiente asignado a Bar-Terraza no puede tener permisos de caja o inventario de Tienda");
    }
    return {
      assignedArea: "BAR_TERRAZA",
      canOverridePrices: false,
      canManageInventory: false,
      canConfirmPayments: false,
      canManageMenuItems: perms.canManageMenuItems ?? false,
      canManageMenuAvailability: perms.canManageMenuAvailability ?? false,
      canManageRestaurantSchedule: perms.canManageRestaurantSchedule ?? false,
    };
  }
}

// ==========================================
// INICIALIZACIÓN SEGURA DE ADMINISTRADOR
// ==========================================

/**
 * Inicializa la cuenta administrativa inicial con el usuario 'admin' y contraseña temporal 'adminG26'.
 * 
 * Reglas de seguridad e idempotencia:
 * 1. Comprueba si ya existe un usuario con nombre 'admin' o cualquier usuario con rol 'ADMIN_GENERAL'.
 * 2. Si ya existe, NO hace nada: NUNCA sobrescribe una cuenta existente.
 * 3. La contraseña temporal se procesa exclusivamente en el servidor mediante hash criptográfico SHA-256.
 * 4. No devuelve hashes ni contraseñas en la respuesta.
 */
export const initializeAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Verificar si ya existe el usuario 'admin'
    const existingAdminByUsername = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", "admin"))
      .first();

    const now = Date.now();

    if (existingAdminByUsername) {
      if (!existingAdminByUsername.phone) {
        await ctx.db.patch(existingAdminByUsername._id, {
          phone: "54413935",
          updatedAt: now,
        });
      }
      return {
        initialized: false,
        message: "La cuenta de administrador ya existe y se verificó su asociación móvil.",
      };
    }

    // 2. Verificar si ya existe cualquier usuario con rol ADMIN_GENERAL
    const anyAdminRole = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "ADMIN_GENERAL"))
      .first();

    if (anyAdminRole) {
      return {
        initialized: false,
        message: "Ya existe un usuario con rol de Administrador General en el sistema.",
      };
    }

    // 3. Generar hash seguro de la contraseña temporal adminG26
    const temporaryPassword = "adminG26";
    const passwordHash = await hashPassword(temporaryPassword);

    const initialAdminDoc = {
      id: "u-admin",
      username: "admin",
      fullName: "Administrador General",
      pin: "",
      passwordHash,
      role: "ADMIN_GENERAL" as const,
      canOverridePrices: true,
      canManageInventory: true,
      canConfirmPayments: true,
      canManageMenuItems: true,
      canManageMenuAvailability: true,
      canManageRestaurantSchedule: true,
      assignedArea: "BAR_TERRAZA",
      active: true,
      phone: "54413935",
      createdAt: now,
      updatedAt: now,
    };

    await ctx.db.insert("users", initialAdminDoc);

    return {
      initialized: true,
      message: "Cuenta de administrador inicial creada exitosamente con usuario 'admin' y móvil '54413935'.",
    };
  },
});

// ==========================================
// MUTACIONES: GESTIÓN DE USUARIOS POR EL ADMINISTRADOR
// ==========================================

/**
 * Creación explícita de una nueva cuenta de usuario (exclusivo para ADMIN_GENERAL)
 */
export const createUser = mutation({
  args: {
    id: v.optional(v.string()),
    username: v.string(),
    fullName: v.string(),
    password: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    pin: v.optional(v.string()),
    phone: v.optional(v.string()),
    deleted: v.optional(v.boolean()),
    profileStorageId: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    restrictToAuthorizedDevices: v.optional(v.boolean()),
    maxDevicesPerUser: v.optional(v.number()),
    role: v.union(
      v.literal("ADMIN_GENERAL"),
      v.literal("DUENO"),
      v.literal("CAJERO"),
      v.literal("DEPENDIENTE"),
      v.literal("COCINA")
    ),
    canOverridePrices: v.optional(v.boolean()),
    canManageInventory: v.optional(v.boolean()),
    canConfirmPayments: v.optional(v.boolean()),
    canManageMenuItems: v.optional(v.boolean()),
    canManageMenuAvailability: v.optional(v.boolean()),
    canManageRestaurantSchedule: v.optional(v.boolean()),
    assignedArea: v.optional(v.string()),
    active: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
    adminUserId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId ?? args.userId },
      ["ADMIN_GENERAL"],
      { actionDescription: "crear cuentas de usuario" }
    );

    const cleanUsername = args.username.trim().toLowerCase();
    const cleanFullName = args.fullName.trim();

    if (!cleanUsername) throw new Error("El nombre de usuario no puede estar vacío");
    if (!cleanFullName) throw new Error("El nombre completo no puede estar vacío");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();

    if (existing) {
      throw new Error(`El nombre de usuario '${cleanUsername}' ya está registrado en el sistema`);
    }

    // Hashear contraseña si se proporciona
    let passwordHash: string | undefined = args.passwordHash;
    if (args.password && args.password.trim()) {
      if (args.password.trim().length < 6) {
        throw new Error("La contraseña debe contener al menos 6 caracteres");
      }
      passwordHash = await hashPassword(args.password.trim());
    } else if (args.pin && args.pin.trim().length >= 4 && !passwordHash && args.role !== "ADMIN_GENERAL") {
      passwordHash = await hashPassword(args.pin.trim());
    }

    const validatedPerms = sanitizeAndValidateUserPermissions(args.role, args.assignedArea, {
      canOverridePrices: args.canOverridePrices,
      canManageInventory: args.canManageInventory,
      canConfirmPayments: args.canConfirmPayments,
      canManageMenuItems: args.canManageMenuItems,
      canManageMenuAvailability: args.canManageMenuAvailability,
      canManageRestaurantSchedule: args.canManageRestaurantSchedule,
    });

    const now = Date.now();
    const userId = args.id?.trim() || crypto.randomUUID();

    const docData: Record<string, any> = {
      id: userId,
      username: cleanUsername,
      fullName: cleanFullName,
      pin: args.pin?.trim() || "",
      passwordHash,
      role: args.role,
      canOverridePrices: validatedPerms.canOverridePrices,
      canManageInventory: validatedPerms.canManageInventory,
      canConfirmPayments: validatedPerms.canConfirmPayments,
      canManageMenuItems: validatedPerms.canManageMenuItems,
      canManageMenuAvailability: validatedPerms.canManageMenuAvailability,
      canManageRestaurantSchedule: validatedPerms.canManageRestaurantSchedule,
      assignedArea: validatedPerms.assignedArea,
      active: args.active ?? true,
      deleted: args.deleted ?? false,
      createdAt: now,
      updatedAt: now,
    };

    if (args.phone !== undefined) docData.phone = args.phone.trim();
    if (args.profileStorageId !== undefined) docData.profileStorageId = args.profileStorageId;
    if (args.profilePictureUrl !== undefined) docData.profilePictureUrl = args.profilePictureUrl;
    if (args.restrictToAuthorizedDevices !== undefined) docData.restrictToAuthorizedDevices = args.restrictToAuthorizedDevices;
    if (args.maxDevicesPerUser !== undefined) docData.maxDevicesPerUser = args.maxDevicesPerUser;

    let resolvedPicUrl = docData.profilePictureUrl;
    if (docData.profileStorageId) {
      try {
        const url = await ctx.storage.getUrl(docData.profileStorageId);
        if (url) resolvedPicUrl = url;
      } catch (_) {}
    }

    const docId = await ctx.db.insert("users", docData as any);
    const { passwordHash: _p, pin: _pin, ...safeUser } = { _id: docId, ...docData } as any;
    return { ...safeUser, profilePictureUrl: resolvedPicUrl };
  },
});

/**
 * Edición de una cuenta de usuario existente (exclusivo para ADMIN_GENERAL)
 */
export const updateUser = mutation({
  args: {
    id: v.string(),
    username: v.optional(v.string()),
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    deleted: v.optional(v.boolean()),
    profileStorageId: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("ADMIN_GENERAL"),
        v.literal("DUENO"),
        v.literal("CAJERO"),
        v.literal("DEPENDIENTE"),
        v.literal("COCINA")
      )
    ),
    canOverridePrices: v.optional(v.boolean()),
    canManageInventory: v.optional(v.boolean()),
    canConfirmPayments: v.optional(v.boolean()),
    canManageMenuItems: v.optional(v.boolean()),
    canManageMenuAvailability: v.optional(v.boolean()),
    canManageRestaurantSchedule: v.optional(v.boolean()),
    assignedArea: v.optional(v.string()),
    restrictToAuthorizedDevices: v.optional(v.boolean()),
    maxDevicesPerUser: v.optional(v.number()),
    pin: v.optional(v.string()),
    password: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    active: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
    adminUserId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId ?? args.userId },
      ["ADMIN_GENERAL"],
      { actionDescription: "editar cuentas de usuario" }
    );

    const user = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!user) {
      throw new Error(`Usuario con ID ${args.id} no encontrado`);
    }

    // Regla de salvaguarda: no permitir desactivar ni degradar al único administrador activo
    if (user.role === "ADMIN_GENERAL") {
      const willDemote = args.role !== undefined && args.role !== "ADMIN_GENERAL";
      const willDeactivate = args.active === false;

      if (willDemote || willDeactivate) {
        const activeAdmins = await ctx.db
          .query("users")
          .withIndex("by_role_and_active", (q) =>
            q.eq("role", "ADMIN_GENERAL").eq("active", true)
          )
          .collect();

        if (activeAdmins.length <= 1 && activeAdmins[0]?._id === user._id) {
          throw new Error("Operación rechazada: No se puede desactivar ni degradar al único Administrador General activo");
        }
      }
    }

    const patch: Record<string, any> = { updatedAt: Date.now() };

    if (args.fullName !== undefined) {
      const trimmed = args.fullName.trim();
      if (!trimmed) throw new Error("El nombre completo no puede estar vacío");
      patch.fullName = trimmed;
    }
    if (args.username !== undefined) {
      const trimmed = args.username.trim().toLowerCase();
      if (!trimmed) throw new Error("El nombre de usuario no puede estar vacío");
      patch.username = trimmed;
    }
    if (args.phone !== undefined) patch.phone = args.phone.trim();
    if (args.deleted !== undefined) patch.deleted = args.deleted;
    if (args.profileStorageId !== undefined) patch.profileStorageId = args.profileStorageId;
    if (args.profilePictureUrl !== undefined) patch.profilePictureUrl = args.profilePictureUrl;
    if (args.restrictToAuthorizedDevices !== undefined) patch.restrictToAuthorizedDevices = args.restrictToAuthorizedDevices;
    if (args.maxDevicesPerUser !== undefined) patch.maxDevicesPerUser = args.maxDevicesPerUser;
    if (args.active !== undefined) patch.active = args.active;

    // Resolver rol y área resultantes
    const targetRole = args.role ?? user.role;
    const targetArea = args.assignedArea ?? user.assignedArea;

    const validatedPerms = sanitizeAndValidateUserPermissions(targetRole, targetArea, {
      canOverridePrices: args.canOverridePrices ?? user.canOverridePrices,
      canManageInventory: args.canManageInventory ?? user.canManageInventory,
      canConfirmPayments: args.canConfirmPayments ?? user.canConfirmPayments,
      canManageMenuItems: args.canManageMenuItems ?? user.canManageMenuItems,
      canManageMenuAvailability: args.canManageMenuAvailability ?? user.canManageMenuAvailability,
      canManageRestaurantSchedule: args.canManageRestaurantSchedule ?? user.canManageRestaurantSchedule,
    });

    patch.role = targetRole;
    patch.assignedArea = validatedPerms.assignedArea;
    patch.canOverridePrices = validatedPerms.canOverridePrices;
    patch.canManageInventory = validatedPerms.canManageInventory;
    patch.canConfirmPayments = validatedPerms.canConfirmPayments;
    patch.canManageMenuItems = validatedPerms.canManageMenuItems;
    patch.canManageMenuAvailability = validatedPerms.canManageMenuAvailability;
    patch.canManageRestaurantSchedule = validatedPerms.canManageRestaurantSchedule;

    if (args.pin !== undefined && args.pin.trim().length > 0) {
      patch.pin = args.pin.trim();
      if (!args.password && !args.passwordHash && (!user.passwordHash || targetRole !== "ADMIN_GENERAL")) {
        patch.passwordHash = await hashPassword(args.pin.trim());
      }
    }
    if (args.password && args.password.trim()) {
      patch.passwordHash = await hashPassword(args.password.trim());
    } else if (args.passwordHash) {
      patch.passwordHash = args.passwordHash;
    }

    await ctx.db.patch(user._id, patch);

    // Si el usuario fue desactivado, revocar de inmediato sus sesiones activas
    if (args.active === false) {
      const activeSessions = await ctx.db
        .query("user_sessions")
        .withIndex("by_user_and_active", (q) =>
          q.eq("userId", user.id).eq("isActive", true)
        )
        .collect();

      for (const s of activeSessions) {
        await ctx.db.patch(s._id, { isActive: false, closedAt: Date.now() });
      }
    }

    const updated = { ...user, ...patch };
    const { passwordHash, pin, ...safeUser } = updated;
    let pictureUrl = safeUser.profilePictureUrl;
    if (safeUser.profileStorageId) {
      try {
        const url = await ctx.storage.getUrl(safeUser.profileStorageId);
        if (url) pictureUrl = url;
      } catch (_) {}
    }
    return { ...safeUser, profilePictureUrl: pictureUrl };
  },
});

/**
 * Activación o desactivación de un usuario con revocación de sesiones (exclusivo para ADMIN_GENERAL)
 */
export const setUserStatus = mutation({
  args: {
    id: v.string(),
    active: v.boolean(),
    sessionToken: v.optional(v.string()),
    adminUserId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId ?? args.userId },
      ["ADMIN_GENERAL"],
      { actionDescription: "activar o desactivar cuentas de usuario" }
    );

    const user = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!user) {
      throw new Error(`Usuario con ID ${args.id} no encontrado`);
    }

    // Proteger al único administrador
    if (user.role === "ADMIN_GENERAL" && !args.active) {
      const activeAdmins = await ctx.db
        .query("users")
        .withIndex("by_role_and_active", (q) =>
          q.eq("role", "ADMIN_GENERAL").eq("active", true)
        )
        .collect();

      if (activeAdmins.length <= 1 && activeAdmins[0]?._id === user._id) {
        throw new Error("No se puede desactivar al único Administrador General activo");
      }
    }

    await ctx.db.patch(user._id, {
      active: args.active,
      updatedAt: Date.now(),
    });

    // Revocar sesiones activas si se desactiva
    if (!args.active) {
      const activeSessions = await ctx.db
        .query("user_sessions")
        .withIndex("by_user_and_active", (q) =>
          q.eq("userId", user.id).eq("isActive", true)
        )
        .collect();

      for (const s of activeSessions) {
        await ctx.db.patch(s._id, { isActive: false, closedAt: Date.now() });
      }
    }

    return { success: true, id: args.id, active: args.active };
  },
});

/**
 * Eliminación lógica y revocación de sesiones de usuario por el Administrador General
 */
export const deleteUser = mutation({
  args: {
    id: v.string(),
    sessionToken: v.optional(v.string()),
    adminUserId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId ?? args.userId },
      ["ADMIN_GENERAL"],
      { actionDescription: "eliminar cuentas de usuario" }
    );

    const user = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id.trim()))
      .first();

    if (!user) {
      return { success: true, message: "Usuario no encontrado o ya eliminado" };
    }

    if (user.role === "ADMIN_GENERAL") {
      throw new Error("No se puede eliminar la cuenta del Administrador General");
    }

    // Revocar sesiones activas del usuario eliminado
    const activeSessions = await ctx.db
      .query("user_sessions")
      .withIndex("by_user_and_active", (q) =>
        q.eq("userId", user.id).eq("isActive", true)
      )
      .collect();

    for (const s of activeSessions) {
      await ctx.db.patch(s._id, { isActive: false, closedAt: Date.now() });
    }

    // Marcado lógico como deleted: true, active: false
    await ctx.db.patch(user._id, {
      deleted: true,
      active: false,
      updatedAt: Date.now(),
    });

    return { success: true, id: args.id };
  },
});

/**
 * Restablecimiento de contraseña de un usuario por el Administrador General
 */
export const resetUserPassword = mutation({
  args: {
    userId: v.string(),
    newPassword: v.string(),
    sessionToken: v.optional(v.string()),
    adminUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId },
      ["ADMIN_GENERAL"],
      { actionDescription: "restablecer contraseña de usuario" }
    );

    const user = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", args.userId))
      .first();

    if (!user) {
      throw new Error(`Usuario con ID ${args.userId} no encontrado`);
    }

    const cleanPassword = args.newPassword.trim();
    if (cleanPassword.length < 6) {
      throw new Error("La nueva contraseña debe contener al menos 6 caracteres");
    }

    const passwordHash = await hashPassword(cleanPassword);
    const now = Date.now();

    await ctx.db.patch(user._id, {
      passwordHash,
      pin: "",
      updatedAt: now,
    });

    // Cerrar sesiones activas del usuario para forzar inicio con la nueva contraseña
    const userSessions = await ctx.db
      .query("user_sessions")
      .withIndex("by_user_and_active", (q) =>
        q.eq("userId", user.id).eq("isActive", true)
      )
      .collect();

    for (const s of userSessions) {
      await ctx.db.patch(s._id, { isActive: false, closedAt: now });
    }

    return { success: true, userId: args.userId, message: "Contraseña restablecida correctamente" };
  },
});

// ==========================================
// MUTACIONES: GESTIÓN DE PERFIL PROPIO Y CONTRASEÑA
// ==========================================

/**
 * Actualización del perfil propio del operador autenticado (nombre completo).
 * Los usuarios NO pueden modificar su propio rol ni asignarse privilegios.
 */
export const updateProfile = mutation({
  args: {
    fullName: v.string(),
    phone: v.optional(v.string()),
    profileStorageId: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await authenticateSession(ctx, args.sessionToken);

    const cleanFullName = args.fullName.trim();
    if (!cleanFullName) {
      throw new Error("El nombre no puede estar vacío");
    }

    const patch: Record<string, any> = {
      fullName: cleanFullName,
      updatedAt: Date.now(),
    };
    if (args.phone !== undefined) patch.phone = args.phone.trim();
    if (args.profileStorageId !== undefined) patch.profileStorageId = args.profileStorageId;
    if (args.profilePictureUrl !== undefined) patch.profilePictureUrl = args.profilePictureUrl;

    await ctx.db.patch(auth.user._id, patch);

    const updatedUser = { ...auth.user, ...patch };
    const { passwordHash, pin, ...safeUser } = updatedUser;
    let pictureUrl = safeUser.profilePictureUrl;
    if (safeUser.profileStorageId) {
      try {
        const url = await ctx.storage.getUrl(safeUser.profileStorageId);
        if (url) pictureUrl = url;
      } catch (_) {}
    }
    return { success: true, user: { ...safeUser, profilePictureUrl: pictureUrl } };
  },
});

/**
 * Cambio de contraseña del propio usuario autenticado.
 * Requiere validar la contraseña actual antes de aplicar el nuevo hash.
 * Nunca expone ni devuelve hashes.
 */
export const changePassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await authenticateSession(ctx, args.sessionToken);

    const cleanCurrent = args.currentPassword.trim();
    const cleanNew = args.newPassword.trim();

    if (!cleanCurrent || !cleanNew) {
      throw new Error("Debe proporcionar la contraseña actual y la nueva");
    }

    if (cleanNew.length < 6) {
      throw new Error("La nueva contraseña debe tener al menos 6 caracteres");
    }

    // 1. Validar contraseña actual contra hash almacenado
    const currentHash = await hashPassword(cleanCurrent);
    let isCurrentValid = false;

    if (auth.user.passwordHash) {
      isCurrentValid = auth.user.passwordHash === currentHash;
    } else if (auth.user.pin && auth.user.pin.trim() === cleanCurrent) {
      isCurrentValid = true;
    }

    if (!isCurrentValid) {
      throw new Error("La contraseña actual es incorrecta");
    }

    // 2. Hashear nueva contraseña y actualizar
    const newPasswordHash = await hashPassword(cleanNew);
    const now = Date.now();

    await ctx.db.patch(auth.user._id, {
      passwordHash: newPasswordHash,
      pin: "",
      updatedAt: now,
    });

    return { success: true, message: "Contraseña actualizada exitosamente" };
  },
});

// ==========================================
// COMPATIBILIDAD CONMUTADA (upsertUser & updatePassword)
// ==========================================

/**
 * Creación o actualización idempotente de usuario operador (compatible con cliente Android existente)
 */
export const upsertUser = mutation({
  args: {
    id: v.optional(v.string()),
    username: v.string(),
    fullName: v.string(),
    pin: v.optional(v.string()),
    password: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    phone: v.optional(v.string()),
    deleted: v.optional(v.boolean()),
    profileStorageId: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    restrictToAuthorizedDevices: v.optional(v.boolean()),
    maxDevicesPerUser: v.optional(v.number()),
    role: v.union(
      v.literal("ADMIN_GENERAL"),
      v.literal("DUENO"),
      v.literal("CAJERO"),
      v.literal("DEPENDIENTE"),
      v.literal("COCINA")
    ),
    canOverridePrices: v.optional(v.boolean()),
    canManageInventory: v.optional(v.boolean()),
    canConfirmPayments: v.optional(v.boolean()),
    canManageMenuItems: v.optional(v.boolean()),
    canManageMenuAvailability: v.optional(v.boolean()),
    canManageRestaurantSchedule: v.optional(v.boolean()),
    assignedArea: v.optional(v.string()),
    active: v.boolean(),
    sessionToken: v.optional(v.string()),
    adminUserId: v.optional(v.string()),
    operatorUserId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Permitir bootstrap inicial solo si no hay ningún usuario registrado
    const userCount = (await ctx.db.query("users").take(1)).length;
    if (userCount > 0) {
      await authorizeUser(
        ctx,
        { sessionToken: args.sessionToken, userId: args.adminUserId ?? args.operatorUserId ?? args.userId },
        ["ADMIN_GENERAL"],
        { actionDescription: "crear o modificar usuarios" }
      );
    }

    const trimmedUsername = args.username.trim().toLowerCase();
    const trimmedFullName = args.fullName.trim();

    if (!trimmedUsername) throw new Error("El nombre de usuario no puede estar vacío");
    if (!trimmedFullName) throw new Error("El nombre completo no puede estar vacío");

    const userId = args.id?.trim() || crypto.randomUUID();

    let existing = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", userId))
      .first();

    const usernameCheck = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", trimmedUsername))
      .first();

    if (!existing && usernameCheck) {
      existing = usernameCheck;
    } else if (existing && usernameCheck && usernameCheck._id !== existing._id) {
      throw new Error(`El nombre de usuario '${trimmedUsername}' ya está registrado`);
    }

    // Hashear contraseña si viene en texto claro o si se define/actualiza el PIN de acceso
    let resolvedHash = args.passwordHash ?? existing?.passwordHash;
    if (args.password && args.password.trim()) {
      resolvedHash = await hashPassword(args.password.trim());
    } else if (args.pin && args.pin.trim().length >= 4 && (!existing?.passwordHash || args.role !== "ADMIN_GENERAL")) {
      // Si se define o actualiza el PIN de un operador, sincronizamos su hash criptográfico
      resolvedHash = await hashPassword(args.pin.trim());
    }

    const pinToStore = (args.pin !== undefined && args.pin.trim().length > 0)
      ? args.pin.trim()
      : (existing?.pin ?? "");

    // Resolver y validar permisos según rol y área asignada
    const targetArea = args.assignedArea ?? existing?.assignedArea;
    const validatedPerms = sanitizeAndValidateUserPermissions(args.role, targetArea, {
      canOverridePrices: args.canOverridePrices ?? existing?.canOverridePrices,
      canManageInventory: args.canManageInventory ?? existing?.canManageInventory,
      canConfirmPayments: args.canConfirmPayments ?? existing?.canConfirmPayments,
      canManageMenuItems: args.canManageMenuItems ?? existing?.canManageMenuItems,
      canManageMenuAvailability: args.canManageMenuAvailability ?? existing?.canManageMenuAvailability,
      canManageRestaurantSchedule: args.canManageRestaurantSchedule ?? existing?.canManageRestaurantSchedule,
    });

    const now = Date.now();
    const docData: Record<string, any> = {
      id: existing?.id ?? userId,
      username: trimmedUsername,
      fullName: trimmedFullName,
      pin: pinToStore,
      passwordHash: resolvedHash,
      role: args.role,
      canOverridePrices: validatedPerms.canOverridePrices,
      canManageInventory: validatedPerms.canManageInventory,
      canConfirmPayments: validatedPerms.canConfirmPayments,
      canManageMenuItems: validatedPerms.canManageMenuItems,
      canManageMenuAvailability: validatedPerms.canManageMenuAvailability,
      canManageRestaurantSchedule: validatedPerms.canManageRestaurantSchedule,
      assignedArea: validatedPerms.assignedArea,
      active: args.active,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (args.phone !== undefined) docData.phone = args.phone.trim();
    if (args.deleted !== undefined) docData.deleted = args.deleted;
    if (args.profileStorageId !== undefined) docData.profileStorageId = args.profileStorageId;
    if (args.profilePictureUrl !== undefined) docData.profilePictureUrl = args.profilePictureUrl;
    if (args.restrictToAuthorizedDevices !== undefined) docData.restrictToAuthorizedDevices = args.restrictToAuthorizedDevices;
    if (args.maxDevicesPerUser !== undefined) docData.maxDevicesPerUser = args.maxDevicesPerUser;

    let resolvedPicUrl = docData.profilePictureUrl;
    if (docData.profileStorageId) {
      try {
        const url = await ctx.storage.getUrl(docData.profileStorageId);
        if (url) resolvedPicUrl = url;
      } catch (_) {}
    }

    if (existing) {
      await ctx.db.patch(existing._id, docData);
      const { passwordHash: _p, pin: _pin, ...safe } = { ...existing, ...docData } as any;
      return { ...safe, profilePictureUrl: resolvedPicUrl };
    } else {
      const docId = await ctx.db.insert("users", docData as any);
      const { passwordHash: _p, pin: _pin, ...safe } = { _id: docId, ...docData } as any;
      return { ...safe, profilePictureUrl: resolvedPicUrl };
    }
  },
});

/**
 * Actualización criptográfica de contraseña para la cuenta administradora u operador
 */
export const updatePassword = mutation({
  args: {
    userId: v.string(),
    passwordHash: v.string(),
    updatedAt: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
    adminUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId ?? args.userId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE", "COCINA"],
      { actionDescription: "actualizar contraseña" }
    );

    // Solo ADMIN_GENERAL puede cambiar contraseñas de otros usuarios; los operadores solo la suya propia
    if (auth.user.role !== "ADMIN_GENERAL" && auth.user.id !== args.userId) {
      throw new Error("No autorizado: Solo puedes actualizar la contraseña de tu propia cuenta");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", args.userId))
      .first();

    if (!user) {
      throw new Error(`Usuario con ID ${args.userId} no encontrado`);
    }

    if (!args.passwordHash || args.passwordHash.length < 32) {
      throw new Error("El hash de contraseña suministrado no es válido");
    }

    const now = args.updatedAt ?? Date.now();
    await ctx.db.patch(user._id, {
      passwordHash: args.passwordHash,
      pin: "",
      updatedAt: now,
    });

    return { success: true, userId: args.userId };
  },
});

// ==========================================
// MUTACIÓN: VINCULAR DISPOSITIVO A USUARIO
// ==========================================

export const rebindUserDevice = mutation({
  args: {
    userId: v.string(),
    newDeviceId: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Autorizar solo ADMIN_GENERAL
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken },
      ["ADMIN_GENERAL"],
      { actionDescription: "reemplazar vinculación de dispositivo" }
    );

    // 2. Verificar usuario afectado
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", args.userId.trim()))
      .first();

    if (!targetUser) {
      throw new Error(`Usuario con ID ${args.userId} no encontrado`);
    }

    // 3. Verificar dispositivo nuevo
    const newDevice = await ctx.db
      .query("devices")
      .withIndex("by_custom_id", (q) => q.eq("id", args.newDeviceId.trim()))
      .first();

    if (!newDevice) {
      throw new Error(`Dispositivo con ID ${args.newDeviceId} no encontrado`);
    }

    const oldDeviceId = targetUser.linkedDeviceId;

    // 4. Actualizar vinculación
    await ctx.db.patch(targetUser._id, {
      linkedDeviceId: newDevice.id,
      updatedAt: Date.now(),
    });

    // 5. Registrar en notificaciones (historial)
    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: "Dispositivo Reemplazado",
      message: `El administrador ${auth.user.fullName} reemplazó el dispositivo del usuario '${targetUser.username}' (anterior: ${oldDeviceId || "Ninguno"}, nuevo: ${newDevice.dvcCode}).`,
      targetRole: "ADMIN_GENERAL",
      targetUserId: targetUser.id,
      timestamp: Date.now(),
      isRead: false,
    });

    return { success: true };
  },
});

// ==========================================
// CONSULTA Y MUTACIONES DE POLÍTICAS MULTIDISPOSITIVO
// ==========================================

export const listUserDevices = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanUserId = args.userId.trim();
    return await ctx.db
      .query("user_devices")
      .withIndex("by_user", (q) => q.eq("userId", cleanUserId))
      .collect();
  },
});

export const updateUserDevicePolicy = mutation({
  args: {
    userId: v.string(),
    restrictToAuthorizedDevices: v.optional(v.boolean()),
    maxDevicesPerUser: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
    adminUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId },
      ["ADMIN_GENERAL"],
      { actionDescription: "modificar política de dispositivos de usuario" }
    );

    const user = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", args.userId.trim()))
      .first();

    if (!user) {
      throw new Error(`Usuario con ID ${args.userId} no encontrado`);
    }

    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.restrictToAuthorizedDevices !== undefined) {
      patch.restrictToAuthorizedDevices = args.restrictToAuthorizedDevices;
    }
    if (args.maxDevicesPerUser !== undefined) {
      if (args.maxDevicesPerUser < 1) {
        throw new Error("El límite de dispositivos debe ser al menos 1");
      }
      patch.maxDevicesPerUser = args.maxDevicesPerUser;
    }

    await ctx.db.patch(user._id, patch);
    return { success: true, userId: args.userId };
  },
});

export const updateGlobalDevicePolicy = mutation({
  args: {
    restrictToAuthorizedDevices: v.boolean(),
    sessionToken: v.optional(v.string()),
    adminUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId },
      ["ADMIN_GENERAL"],
      { actionDescription: "aplicar política global de restricción de dispositivos" }
    );

    const allUsers = await ctx.db.query("users").collect();
    const now = Date.now();

    for (const u of allUsers) {
      await ctx.db.patch(u._id, {
        restrictToAuthorizedDevices: args.restrictToAuthorizedDevices,
        updatedAt: now,
      });
    }

    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: "Política Global de Dispositivos Actualizada",
      message: `El administrador ${auth.user.fullName} ${args.restrictToAuthorizedDevices ? "activó" : "desactivó"} la restricción global de dispositivos autorizados.`,
      targetRole: "ADMIN_GENERAL",
      timestamp: now,
      isRead: false,
    });

    return { success: true, updatedCount: allUsers.length };
  },
});

export const setUserDeviceAuthorization = mutation({
  args: {
    userId: v.string(),
    deviceId: v.string(),
    authorized: v.boolean(),
    sessionToken: v.optional(v.string()),
    adminUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId },
      ["ADMIN_GENERAL"],
      { actionDescription: "cambiar autorización de dispositivo" }
    );

    const binding = await ctx.db
      .query("user_devices")
      .withIndex("by_user_and_device", (q) =>
        q.eq("userId", args.userId.trim()).eq("deviceId", args.deviceId.trim())
      )
      .first();

    if (!binding) {
      throw new Error("Registro de vinculación de dispositivo no encontrado");
    }

    const now = Date.now();
    await ctx.db.patch(binding._id, {
      authorized: args.authorized,
      lastSeenAt: now,
    });

    if (!args.authorized) {
      const activeSessions = await ctx.db
        .query("user_sessions")
        .withIndex("by_user_and_active", (q) =>
          q.eq("userId", args.userId.trim()).eq("isActive", true)
        )
        .filter((q) => q.eq(q.field("deviceInfo"), binding.dvcCode))
        .collect();

      for (const s of activeSessions) {
        await ctx.db.patch(s._id, {
          isActive: false,
          closedAt: now,
        });
      }
    }

    return { success: true, bindingId: binding.id, authorized: args.authorized };
  },
});

/**
 * Eliminación física de un dispositivo de usuario y liberación de cupo en la cuota del usuario.
 * Exclusivo para ADMIN_GENERAL.
 */
export const deleteUserDevice = mutation({
  args: {
    userId: v.string(),
    deviceId: v.string(),
    dvcCode: v.optional(v.string()),
    userDeviceId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    adminUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId },
      ["ADMIN_GENERAL"],
      { actionDescription: "eliminar dispositivo de usuario" }
    );

    const cleanUserId = args.userId.trim();
    const cleanDeviceId = (args.deviceId || "").trim();
    const cleanDvc = (args.dvcCode || "").trim();
    const cleanUserDevId = (args.userDeviceId || "").trim();

    // 1. Localizar registro de vinculación en user_devices con todas las estrategias posibles
    let binding: any = null;

    // Estrategia A: Por _id de Convex (si cleanUserDevId o cleanDeviceId es un Id de Convex)
    if (cleanUserDevId) {
      try {
        const doc: any = await ctx.db.get(cleanUserDevId as any);
        if (doc && "_id" in doc && doc.userId === cleanUserId) {
          binding = doc;
        }
      } catch (_) {}
    }
    if (!binding && cleanDeviceId) {
      try {
        const doc: any = await ctx.db.get(cleanDeviceId as any);
        if (doc && "_id" in doc && doc.userId === cleanUserId) {
          binding = doc;
        }
      } catch (_) {}
    }

    // Estrategia B: Por índice by_user_and_device
    if (!binding && cleanDeviceId) {
      binding = await ctx.db
        .query("user_devices")
        .withIndex("by_user_and_device", (q) =>
          q.eq("userId", cleanUserId).eq("deviceId", cleanDeviceId)
        )
        .first();
    }

    // Estrategia C: Por índice by_user_and_dvc
    const targetDvc = cleanDvc || (cleanDeviceId.startsWith("DVC-") ? cleanDeviceId : "");
    if (!binding && targetDvc) {
      binding = await ctx.db
        .query("user_devices")
        .withIndex("by_user_and_dvc", (q) =>
          q.eq("userId", cleanUserId).eq("dvcCode", targetDvc)
        )
        .first();
    }

    // Estrategia D: Buscar entre todos los registros vinculados al usuario
    if (!binding) {
      const allUserDevs = await ctx.db
        .query("user_devices")
        .withIndex("by_user", (q) => q.eq("userId", cleanUserId))
        .collect();

      binding = allUserDevs.find((ud) => {
        if (cleanUserDevId && ((ud as any)._id?.toString() === cleanUserDevId || ud.id === cleanUserDevId)) return true;
        if (cleanDeviceId && (ud.deviceId === cleanDeviceId || ud.id === cleanDeviceId || ud.dvcCode === cleanDeviceId || (ud as any)._id?.toString() === cleanDeviceId)) return true;
        if (cleanDvc && ud.dvcCode === cleanDvc) return true;
        return false;
      }) || null;
    }

    if (!binding) {
      throw new Error(`Dispositivo no encontrado para el usuario '${cleanUserId}'. Es posible que ya haya sido eliminado.`);
    }

    const dvcCodeToDelete = binding.dvcCode;
    const deviceTableId = binding.deviceId;
    const bindingId = binding._id;

    // 2. Eliminación física del documento en 'user_devices'
    await ctx.db.delete(bindingId);

    // 3. Cerrar sesiones activas de este usuario en este dispositivo
    const now = Date.now();
    if (dvcCodeToDelete) {
      const activeSessions = await ctx.db
        .query("user_sessions")
        .withIndex("by_user_and_active", (q) =>
          q.eq("userId", cleanUserId).eq("isActive", true)
        )
        .filter((q) => q.eq(q.field("deviceInfo"), dvcCodeToDelete))
        .collect();

      for (const s of activeSessions) {
        await ctx.db.patch(s._id, {
          isActive: false,
          closedAt: now,
        });
      }
    }

    // 4. Comprobar si existen otras asociaciones para este mismo dispositivo en user_devices
    let remainingBindings: any[] = [];
    if (deviceTableId) {
      remainingBindings = await ctx.db
        .query("user_devices")
        .withIndex("by_device", (q) => q.eq("deviceId", deviceTableId))
        .collect();
    }
    if (remainingBindings.length === 0 && dvcCodeToDelete) {
      remainingBindings = await ctx.db
        .query("user_devices")
        .withIndex("by_dvcCode", (q) => q.eq("dvcCode", dvcCodeToDelete))
        .collect();
    }

    // 5. Si ya no quedan asociaciones para este dispositivo en ningún usuario, eliminar físicamente de 'devices'
    if (remainingBindings.length === 0) {
      let deviceDoc: any = null;
      if (deviceTableId) {
        deviceDoc = await ctx.db
          .query("devices")
          .withIndex("by_custom_id", (q) => q.eq("id", deviceTableId))
          .first();
        if (!deviceDoc) {
          try {
            const byConvexId = await ctx.db.get(deviceTableId as any);
            if (byConvexId && "_id" in byConvexId) deviceDoc = byConvexId;
          } catch (_) {}
        }
      }
      if (!deviceDoc && dvcCodeToDelete) {
        deviceDoc = await ctx.db
          .query("devices")
          .withIndex("by_dvcCode", (q) => q.eq("dvcCode", dvcCodeToDelete))
          .first();
      }
      if (deviceDoc) {
        await ctx.db.delete(deviceDoc._id);
      }
    }

    // 6. Limpiar relación legada linkedDeviceId si aplica
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", cleanUserId))
      .first();

    if (targetUser && (targetUser.linkedDeviceId === deviceTableId || targetUser.linkedDeviceId === cleanDeviceId || targetUser.linkedDeviceId === dvcCodeToDelete)) {
      await ctx.db.patch(targetUser._id, {
        linkedDeviceId: undefined,
        updatedAt: now,
      });
    }

    // 7. Auditoría centralizada
    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: auth.user.id,
      userName: auth.user.fullName,
      module: "GENERAL",
      action: `ELIMINAR_DISPOSITIVO: Se eliminó físicamente el dispositivo ${dvcCodeToDelete || cleanDeviceId} del usuario '${targetUser?.username || cleanUserId}'.`,
      entityId: cleanUserId,
      result: "SUCCESS",
      timestamp: now,
      isOutsideShift: false,
    });

    return { success: true, message: "Dispositivo eliminado físicamente" };
  },
});

/**
 * Migración idempotente para convertir cuentas legadas con rol DUENO_CAJERO:
 * - Cuenta real del Dueño (id == "u-dueno" o username == "dueno") -> rol "DUENO"
 * - Cuentas de empleados de caja -> rol "CAJERO"
 */
export const migrateCashierRoles = mutation({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    let duenoCount = 0;
    let cajeroCount = 0;
    const ambiguous: string[] = [];

    for (const user of allUsers) {
      const rawRole = (user as any).role;
      if (rawRole === "DUENO_CAJERO" || user.role === "DUENO" || user.role === "CAJERO") {
        const cleanId = (user.id || "").trim().toLowerCase();
        const cleanUsername = (user.username || "").trim().toLowerCase();
        const cleanFullName = (user.fullName || "").trim().toLowerCase();

        const isOwner =
          cleanId === "u-dueno" ||
          cleanUsername === "dueno" ||
          cleanUsername === "dueño" ||
          cleanFullName === "dueño" ||
          cleanFullName === "dueno";

        if (isOwner) {
          if (user.role !== "DUENO") {
            await ctx.db.patch(user._id, { role: "DUENO", updatedAt: Date.now() });
            duenoCount++;
          }
        } else if (rawRole === "DUENO_CAJERO") {
          await ctx.db.patch(user._id, { role: "CAJERO", updatedAt: Date.now() });
          cajeroCount++;
        }
      }
    }

    const allSessions = await ctx.db.query("user_sessions").collect();
    for (const sess of allSessions) {
      if ((sess as any).role === "DUENO_CAJERO" && sess.userId) {
        const u = allUsers.find((x) => x.id === sess.userId);
        const newRole = u?.id === "u-dueno" || u?.username === "dueno" ? "DUENO" : (u?.role || "CAJERO");
        await ctx.db.patch(sess._id, { role: newRole as any });
      }
    }

    return {
      success: true,
      duenoMigrated: duenoCount,
      cajeroMigrated: cajeroCount,
      ambiguousRecords: ambiguous,
    };
  },
});


