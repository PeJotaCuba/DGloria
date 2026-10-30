import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { assertAdminPermission } from "./auth";

/**
 * Resuelve la URL pública final de la imagen del plato o ítem de restaurante.
 */
async function resolveItemImageUrl(
  ctx: QueryCtx,
  imageId?: string,
  imageUrl?: string
): Promise<string | undefined> {
  if (imageUrl) {
    return imageUrl;
  }

  if (imageId) {
    if (imageId.startsWith("http://") || imageId.startsWith("https://") || imageId.startsWith("/")) {
      return imageId;
    }
    try {
      const storageUrl = await ctx.storage.getUrl(imageId as any);
      if (storageUrl) return storageUrl;
    } catch {
      // Ignorar fallo de resolución de storage
    }
  }

  return imageId || imageUrl;
}

/**
 * Consulta pública / Android: Lista los platos e ítems de restaurante desde `menu_items`.
 * Utilizada directamente por la app Android Doña Gloria (`restaurant:listMenuItems`).
 */
export const listMenuItems = query({
  args: {
    availableOnly: v.optional(v.boolean()),
    adminToken: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let items;

    if (args.availableOnly) {
      items = await ctx.db
        .query("menu_items")
        .withIndex("by_available", (q) => q.eq("available", true))
        .collect();
    } else {
      items = await ctx.db.query("menu_items").collect();
    }

    // Ordenar por displayOrder
    items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    return await Promise.all(
      items.map(async (item) => {
        const resolvedImage = await resolveItemImageUrl(ctx, item.imageId, item.imageUrl);
        return {
          ...item,
          id: item.id || item._id,
          _id: item._id,
          imageUrl: resolvedImage || item.imageUrl || "",
          price: item.price ?? item.priceCup,
        };
      })
    );
  },
});

/**
 * Mutación protegida: Crear o actualizar un plato en `menu_items` desde Android.
 * Invocada por Android Doña Gloria (`restaurant:upsertMenuItem`).
 */
export const upsertMenuItem = mutation({
  args: {
    id: v.optional(v.string()),
    code: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.optional(v.union(v.number(), v.string())),
    priceCup: v.optional(v.number()),
    priceFormatted: v.optional(v.string()),
    category: v.optional(v.string()),
    imageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    featuredOrder: v.optional(v.number()),
    displayOrder: v.optional(v.number()),
    available: v.optional(v.boolean()),
    adminToken: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verificar permisos administrativos
    await assertAdminPermission(ctx, args.adminToken, args.sessionToken);

    const now = Date.now();
    const priceVal = args.priceCup !== undefined ? args.priceCup : typeof args.price === "number" ? args.price : undefined;

    let existing = null;
    if (args.id) {
      // Buscar por _id o por custom id
      try {
        existing = await ctx.db.get(args.id as any);
      } catch {
        // No es un Id válido directo
      }
      if (!existing) {
        existing = await ctx.db
          .query("menu_items")
          .withIndex("by_custom_id", (q) => q.eq("id", args.id!))
          .first();
      }
    }

    if (existing) {
      const updates: any = {
        updatedAt: now,
      };

      if (args.name !== undefined) updates.name = args.name.trim();
      if (args.description !== undefined) updates.description = args.description.trim();
      if (args.category !== undefined) updates.category = args.category.trim();
      if (args.code !== undefined) updates.code = args.code;
      if (args.price !== undefined) updates.price = args.price;
      if (priceVal !== undefined) updates.priceCup = priceVal;
      if (args.priceFormatted !== undefined) updates.priceFormatted = args.priceFormatted;
      if (args.imageId !== undefined) updates.imageId = args.imageId;
      if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;
      if (args.isPublished !== undefined) updates.isPublished = args.isPublished;
      if (args.isFeatured !== undefined) updates.isFeatured = args.isFeatured;
      if (args.featuredOrder !== undefined) updates.featuredOrder = args.featuredOrder;
      if (args.displayOrder !== undefined) updates.displayOrder = args.displayOrder;
      if (args.available !== undefined) updates.available = args.available;

      await ctx.db.patch(existing._id, updates);
      return { success: true, id: existing._id };
    } else {
      const displayOrder = args.displayOrder !== undefined ? args.displayOrder : 1;
      const newId = await ctx.db.insert("menu_items", {
        id: args.id || undefined,
        code: args.code || undefined,
        name: args.name.trim(),
        description: (args.description || "").trim(),
        category: (args.category || "General").trim(),
        price: args.price,
        priceCup: priceVal,
        priceFormatted: args.priceFormatted,
        imageId: args.imageId,
        imageUrl: args.imageUrl,
        isPublished: args.isPublished ?? true,
        isFeatured: args.isFeatured ?? false,
        featuredOrder: args.featuredOrder,
        displayOrder,
        available: args.available ?? true,
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, id: newId };
    }
  },
});

/**
 * Re-exportaciones de compatibilidad para reservaciones de Bar Terraza desde Android.
 */
export {
  createPublicReservation,
  submitReservation,
  listReservations,
  getReservations,
  getReservation,
  updateReservationStatus,
  deleteReservation,
  getPublicReservationStatus,
} from "./reservations";


