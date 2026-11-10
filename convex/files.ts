import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Operaciones de almacenamiento persistente de archivos (Convex File Storage)
 * para fotos de perfil y adjuntos de Doña Gloria.
 */

// Genera una URL única y firmada de carga para subir un archivo binario desde el cliente Android
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Obtiene la URL pública de visualización a partir del identificador de almacenamiento (storageId)
export const getFileUrl = query({
  args: {
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.storageId || args.storageId.trim().length === 0) {
      return null;
    }
    return await ctx.storage.getUrl(args.storageId as any);
  },
});
