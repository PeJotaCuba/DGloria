import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Consulta pública/protegida utilizada por la app Android Doña Gloria para
 * obtener la lista de usuarios activos (camareros, cajeros, administradores).
 */
export const listUsers = query({
  args: {
    adminToken: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let users = await ctx.db.query("users").collect();

    // Filtrar por estado activo si se solicita
    if (args.activeOnly) {
      users = users.filter((u) => u.active !== false);
    }

    // Filtrar por rol específico si se solicita
    if (args.role) {
      users = users.filter((u) => u.role === args.role);
    }

    // Devolver lista formateada
    return users.map((u) => ({
      id: u._id,
      _id: u._id,
      username: u.username,
      name: u.name || u.username,
      role: u.role || "staff",
      active: u.active ?? true,
      createdAt: u.createdAt,
    }));
  },
});

/**
 * Obtener un usuario por su ID.
 */
export const getUserById = query({
  args: {
    id: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) return null;

    return {
      id: user._id,
      _id: user._id,
      username: user.username,
      name: user.name || user.username,
      role: user.role || "staff",
      active: user.active ?? true,
      createdAt: user.createdAt,
    };
  },
});
