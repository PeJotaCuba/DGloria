import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { assertAdminPermission } from "./auth";

/**
 * Resuelve la URL pública final de la imagen del plato.
 */
async function resolveDishImageUrl(ctx: QueryCtx, imageId?: string, imageUrl?: string): Promise<string | undefined> {
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
      // Si falla la conversión de storage ID, retornar la referencia original
    }
  }

  return imageId || imageUrl;
}

// ==========================================
// CONSULTAS PÚBLICAS (Página Web & /menu)
// ==========================================

/**
 * Consulta pública: Devuelve todos los platos publicados para la página exclusiva /menu.
 * Organizados por categoría y orden de aparición.
 */
export const getPublishedDishes = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let dishes;

    if (args.category) {
      dishes = await ctx.db
        .query("menu_items")
        .withIndex("by_published_category", (q) =>
          q.eq("isPublished", true).eq("category", args.category!)
        )
        .collect();
    } else {
      dishes = await ctx.db
        .query("menu_items")
        .withIndex("by_published", (q) => q.eq("isPublished", true))
        .collect();
    }

    // Ordenar por displayOrder de menor a mayor
    dishes.sort((a, b) => a.displayOrder - b.displayOrder);

    // Resolver URLs de imágenes para consumo directo en la web
    const resolvedDishes = await Promise.all(
      dishes.map(async (dish) => {
        const resolvedImage = await resolveDishImageUrl(ctx, dish.imageId, dish.imageUrl);
        return {
          id: dish._id,
          _id: dish._id,
          name: dish.name,
          description: dish.description,
          category: dish.category,
          price: (dish as any).price,
          priceCup: (dish as any).priceCup,
          priceFormatted: (dish as any).priceFormatted,
          imageId: dish.imageId,
          imageUrl: resolvedImage || dish.imageUrl || "",
          isPublished: dish.isPublished,
          isFeatured: dish.isFeatured,
          featuredOrder: dish.featuredOrder,
          displayOrder: dish.displayOrder,
          createdAt: dish.createdAt,
          updatedAt: dish.updatedAt,
        };
      })
    );

    return resolvedDishes;
  },
});

/**
 * Consulta pública: Devuelve exactamente los platos destacados para la Landing Page (máximo 3).
 * Filtrados por isPublished: true e isFeatured: true, ordenados por featuredOrder.
 */
export const getFeaturedDishes = query({
  args: {},
  handler: async (ctx) => {
    const dishes = await ctx.db
      .query("menu_items")
      .withIndex("by_featured", (q) =>
        q.eq("isPublished", true).eq("isFeatured", true)
      )
      .collect();

    // Ordenar por featuredOrder (1, 2, 3)
    dishes.sort((a, b) => (a.featuredOrder || 99) - (b.featuredOrder || 99));

    // Tomar únicamente los primeros 3 platos destacados
    const topFeatured = dishes.slice(0, 3);

    return await Promise.all(
      topFeatured.map(async (dish) => {
        const resolvedImage = await resolveDishImageUrl(ctx, dish.imageId, dish.imageUrl);
        return {
          id: dish._id,
          _id: dish._id,
          name: dish.name,
          description: dish.description,
          category: dish.category,
          price: (dish as any).price,
          priceCup: (dish as any).priceCup,
          priceFormatted: (dish as any).priceFormatted,
          imageId: dish.imageId,
          imageUrl: resolvedImage || dish.imageUrl || "",
          isPublished: dish.isPublished,
          isFeatured: dish.isFeatured,
          featuredOrder: dish.featuredOrder,
          displayOrder: dish.displayOrder,
        };
      })
    );
  },
});

/**
 * Consulta pública: Devuelve las categorías únicas presentes en la carta de platos publicados.
 */
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const published = await ctx.db
      .query("menu_items")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();

    const categorySet = new Set<string>();
    published.forEach((d) => {
      if (d.category) categorySet.add(d.category);
    });

    return Array.from(categorySet);
  },
});

/**
 * Consulta pública/admin: Devuelve los detalles de un plato específico.
 */
export const getDishById = query({
  args: {
    id: v.id("menu_dishes"),
  },
  handler: async (ctx, args) => {
    const dish = await ctx.db.get(args.id);
    if (!dish) return null;

    const resolvedImage = await resolveDishImageUrl(ctx, dish.imageId, dish.imageUrl);
    return {
      ...dish,
      id: dish._id,
      imageUrl: resolvedImage || dish.imageUrl || "",
    };
  },
});

// ==========================================
// CONSULTAS & MUTACIONES ADMIN (Android)
// ==========================================

/**
 * Consulta para administración (Android): Devuelve la lista completa de platos (publicados y no publicados).
 */
export const listAllDishesForAdmin = query({
  args: {
    adminToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(ctx, args.adminToken);

    const dishes = await ctx.db.query("menu_dishes").collect();
    
    // Ordenar por categoría y luego por displayOrder
    dishes.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.displayOrder - b.displayOrder;
    });

    return await Promise.all(
      dishes.map(async (dish) => {
        const resolvedImage = await resolveDishImageUrl(ctx, dish.imageId, dish.imageUrl);
        return {
          ...dish,
          id: dish._id,
          resolvedImageUrl: resolvedImage || "",
        };
      })
    );
  },
});

/**
 * Mutación protegida: Crear un nuevo plato en el menú.
 */
export const createDish = mutation({
  args: {
    adminToken: v.optional(v.string()),
    name: v.string(),
    description: v.string(),
    category: v.string(),
    price: v.optional(v.union(v.number(), v.string())),
    priceCup: v.optional(v.number()),
    priceFormatted: v.optional(v.string()),
    imageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isPublished: v.boolean(),
    isFeatured: v.boolean(),
    featuredOrder: v.optional(v.number()),
    displayOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(ctx, args.adminToken);

    const now = Date.now();

    // Si no se proporciona displayOrder, colocarlo al final
    let displayOrder = args.displayOrder;
    if (displayOrder === undefined) {
      const existingInCat = await ctx.db
        .query("menu_dishes")
        .filter((q) => q.eq(q.field("category"), args.category))
        .collect();
      displayOrder = existingInCat.length + 1;
    }

    const dishId = await ctx.db.insert("menu_dishes", {
      name: args.name.trim(),
      description: args.description.trim(),
      category: args.category.trim(),
      price: args.price,
      priceCup: args.priceCup,
      priceFormatted: args.priceFormatted,
      imageId: args.imageId,
      imageUrl: args.imageUrl,
      isPublished: args.isPublished,
      isFeatured: args.isFeatured,
      featuredOrder: args.isFeatured ? (args.featuredOrder || 1) : undefined,
      displayOrder,
      createdAt: now,
      updatedAt: now,
    });

    return dishId;
  },
});

/**
 * Mutación protegida: Editar los datos de un plato existente.
 */
export const updateDish = mutation({
  args: {
    adminToken: v.optional(v.string()),
    id: v.id("menu_dishes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    price: v.optional(v.union(v.number(), v.string())),
    priceCup: v.optional(v.number()),
    priceFormatted: v.optional(v.string()),
    imageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    featuredOrder: v.optional(v.number()),
    displayOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(ctx, args.adminToken);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("El plato solicitado no existe en el menú.");
    }

    const updates: Partial<typeof existing> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.description !== undefined) updates.description = args.description.trim();
    if (args.category !== undefined) updates.category = args.category.trim();
    if (args.price !== undefined) (updates as any).price = args.price;
    if (args.priceCup !== undefined) (updates as any).priceCup = args.priceCup;
    if (args.priceFormatted !== undefined) (updates as any).priceFormatted = args.priceFormatted;
    if (args.imageId !== undefined) updates.imageId = args.imageId;
    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;
    if (args.isPublished !== undefined) updates.isPublished = args.isPublished;
    if (args.isFeatured !== undefined) updates.isFeatured = args.isFeatured;
    if (args.featuredOrder !== undefined) updates.featuredOrder = args.featuredOrder;
    if (args.displayOrder !== undefined) updates.displayOrder = args.displayOrder;

    await ctx.db.patch(args.id, updates);

    return { success: true, id: args.id };
  },
});

/**
 * Mutación protegida: Cambiar únicamente el estado de publicación (publicar o retirar de la carta).
 */
export const setPublishStatus = mutation({
  args: {
    adminToken: v.optional(v.string()),
    id: v.id("menu_dishes"),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(ctx, args.adminToken);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("El plato no existe.");
    }

    await ctx.db.patch(args.id, {
      isPublished: args.isPublished,
      updatedAt: Date.now(),
    });

    return { success: true, id: args.id, isPublished: args.isPublished };
  },
});

/**
 * Mutación protegida: Configurar los tres platos destacados para la landing.
 * Garantiza que se asignen correctamente hasta 3 destacados con sus respectivos órdenes (1, 2, 3).
 */
export const setFeaturedDishes = mutation({
  args: {
    adminToken: v.optional(v.string()),
    featuredAssignments: v.array(
      v.object({
        dishId: v.id("menu_dishes"),
        featuredOrder: v.number(), // 1, 2, o 3
      })
    ),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(ctx, args.adminToken);

    if (args.featuredAssignments.length > 3) {
      throw new Error("No se pueden destacar más de 3 platos en la landing page.");
    }

    // 1. Quitar estado destacado de todos los platos actuales
    const allFeatured = await ctx.db
      .query("menu_dishes")
      .filter((q) => q.eq(q.field("isFeatured"), true))
      .collect();

    for (const dish of allFeatured) {
      await ctx.db.patch(dish._id, {
        isFeatured: false,
        featuredOrder: undefined,
        updatedAt: Date.now(),
      });
    }

    // 2. Asignar los nuevos platos destacados con su orden
    for (const assignment of args.featuredAssignments) {
      const dish = await ctx.db.get(assignment.dishId);
      if (dish) {
        await ctx.db.patch(assignment.dishId, {
          isFeatured: true,
          featuredOrder: assignment.featuredOrder,
          updatedAt: Date.now(),
        });
      }
    }

    return { success: true, count: args.featuredAssignments.length };
  },
});

/**
 * Mutación protegida: Eliminar un plato del menú.
 */
export const deleteDish = mutation({
  args: {
    adminToken: v.optional(v.string()),
    id: v.id("menu_dishes"),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(ctx, args.adminToken);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("El plato no existe.");
    }

    // Si tenía una imagen almacenada en Convex Storage, intentar eliminarla
    if (existing.imageId && !existing.imageId.startsWith("http")) {
      try {
        await ctx.storage.delete(existing.imageId as any);
      } catch {
        // Ignorar si ya fue eliminada
      }
    }

    await ctx.db.delete(args.id);

    return { success: true, id: args.id };
  },
});
