import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertAdminPermission } from "./auth";

/**
 * Genera una URL de carga temporal para almacenar la foto de un plato en Convex Storage.
 * Protegido contra cargas no autorizadas mediante verificación de administrador.
 */
export const generateUploadUrl = mutation({
  args: {
    adminToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validar permisos de administración
    await assertAdminPermission(ctx, args.adminToken);

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Consulta pública de solo lectura: Obtiene la URL pública de una imagen almacenada en Convex Storage.
 * No expone datos privados ni permite modificar registros.
 */
export const getImageUrl = query({
  args: {
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.storageId) return null;

    // Si la cadena ya es una URL HTTP completa, retornarla directamente
    if (args.storageId.startsWith("http://") || args.storageId.startsWith("https://") || args.storageId.startsWith("/")) {
      return args.storageId;
    }

    try {
      const url = await ctx.storage.getUrl(args.storageId as any);
      return url;
    } catch {
      return null;
    }
  },
});
