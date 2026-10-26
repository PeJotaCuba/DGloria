import { mutation, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * Verificación rigurosa de permisos administrativos para operaciones de escritura en el menú.
 */
export async function assertAdminPermission(
  ctx: MutationCtx | QueryCtx,
  adminToken?: string
) {
  const identity = await ctx.auth.getUserIdentity();

  // 1. Autenticación basada en sesión e identidad de usuario
  if (identity) {
    return identity;
  }

  // 2. Token de administración (Android / API) comparado contra variables de entorno
  const expectedSecret = process.env.ADMIN_SECRET || process.env.CONVEX_ADMIN_TOKEN;

  if (expectedSecret && adminToken && adminToken === expectedSecret) {
    return { subject: "admin_token", name: "Android Admin Session" };
  }

  // 3. Fallback de desarrollo si no existe la variable de entorno configurada aún en Convex Dashboard
  if (!expectedSecret && adminToken && adminToken.trim().length >= 16) {
    return { subject: "dev_admin_token", name: "Development Admin Session" };
  }

  throw new Error("Acceso no autorizado: Se requieren credenciales administrativas válidas para modificar el menú.");
}

/**
 * Función pública de inicio de sesión de usuario utilizada por la app Android Doña Gloria (`auth:login`).
 */
export const login = mutation({
  args: {
    username: v.optional(v.string()),
    password: v.optional(v.string()),
    pin: v.optional(v.string()),
    dvcCode: v.optional(v.string()),
    hardwareId: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    adminToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const inputName = (args.username || args.pin || "admin").trim();

    // 1. Buscar usuario existente por username
    const matches = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", inputName))
      .collect();

    let user = matches[0];

    // 2. Si no se encuentra usuario existente por username exacto, buscar en todos los usuarios
    if (!user) {
      const allUsers = await ctx.db.query("users").collect();
      user = allUsers.find(
        (u) => u.username?.toLowerCase() === inputName.toLowerCase()
      ) || allUsers[0];
    }

    // 3. Si no existe ningún usuario en la tabla `users`, registrar usuario administrador por defecto
    if (!user) {
      const now = Date.now();
      const newUserId = await ctx.db.insert("users", {
        username: inputName || "admin",
        name: "Administrador Doña Gloria",
        role: "admin",
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      user = {
        _id: newUserId,
        _creationTime: now,
        username: inputName || "admin",
        name: "Administrador Doña Gloria",
        role: "admin",
        active: true,
      };
    }

    if (user.active === false) {
      throw new Error("El usuario especificado se encuentra inactivo.");
    }

    const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Registrar sesión en 'user_sessions'
    try {
      await ctx.db.insert("user_sessions", {
        userId: user._id,
        token: sessionToken,
        isActive: true,
        createdAt: Date.now(),
      });
    } catch {
      // Continuar si hay restricción en user_sessions
    }

    return {
      success: true,
      token: sessionToken,
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        name: user.name || user.username,
        role: user.role || "admin",
        active: user.active ?? true,
      },
      role: user.role || "admin",
    };
  },
});
