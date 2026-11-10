import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertAdminPermission, authorizeUser } from "./auth";

export const getPublishedDishes = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let items = await ctx.db.query("menu_items").collect();
    let published = items.filter(
      (item) => item.available === true || item.isPublished === true
    );
    if (args.category && args.category.trim().length > 0 && args.category.trim() !== "Todos") {
      const targetCat = args.category.trim().toLowerCase();
      published = published.filter(
        (item) => item.category && item.category.trim().toLowerCase() === targetCat
      );
    }
    published.sort((a, b) => {
      const orderA = a.displayOrder ?? a.featuredOrder ?? 999;
      const orderB = b.displayOrder ?? b.featuredOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
    return published;
  },
});

export const getFeaturedDishes = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("menu_items").collect();
    const featured = items.filter(
      (item) => item.isFeatured === true && (item.available === true || item.isPublished === true)
    );
    featured.sort((a, b) => {
      const orderA = a.featuredOrder ?? a.displayOrder ?? 999;
      const orderB = b.featuredOrder ?? b.displayOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
    return featured;
  },
});

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("menu_items").collect();
    const published = items.filter(
      (item) => (item.available === true || item.isPublished === true) && item.category && item.category.trim().length > 0
    );
    const categoriesSet = new Set<string>();
    for (const item of published) {
      categoriesSet.add(item.category.trim());
    }
    return Array.from(categoriesSet);
  },
});

export const getDishById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("menu_items")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
  },
});

export const listAllDishesForAdmin = query({
  args: { adminToken: v.optional(v.string()) },
  handler: async (ctx) => {
    return await ctx.db.query("menu_items").collect();
  },
});

export const createDish = mutation({
  args: {
    adminToken: v.optional(v.string()),
    name: v.string(),
    category: v.string(),
    description: v.string(),
    portion: v.optional(v.string()),
    priceCup: v.optional(v.number()),
    isPublished: v.boolean(),
    isFeatured: v.boolean(),
    imageUrl: v.optional(v.string()),
    storageId: v.optional(v.string()),
    displayOrder: v.optional(v.number()),
    featuredOrder: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(ctx, { sessionToken: args.adminToken || args.sessionToken, userId: args.userId });
    const id = crypto.randomUUID();
    const now = Date.now();
    const code = `MNU-${Math.floor(Math.random() * 900 + 100)}`;
    const docData = {
      id,
      code,
      name: args.name.trim(),
      category: args.category.trim(),
      description: args.description.trim(),
      portion: args.portion?.trim(),
      priceCup: args.priceCup ?? 0,
      available: args.isPublished,
      isPublished: args.isPublished,
      isFeatured: args.isFeatured,
      imageUrl: args.imageUrl,
      storageId: args.storageId,
      displayOrder: args.displayOrder,
      featuredOrder: args.featuredOrder,
      updatedAt: now,
      createdAt: now,
    };
    await ctx.db.insert("menu_items", docData);
    return { success: true, ...docData };
  },
});

export const updateDish = mutation({
  args: {
    adminToken: v.optional(v.string()),
    id: v.string(),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    portion: v.optional(v.string()),
    priceCup: v.optional(v.number()),
    isPublished: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    imageUrl: v.optional(v.string()),
    storageId: v.optional(v.string()),
    displayOrder: v.optional(v.number()),
    featuredOrder: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(ctx, { sessionToken: args.adminToken || args.sessionToken, userId: args.userId });
    const item = await ctx.db
      .query("menu_items")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
    if (!item) {
      throw new Error("Plato no encontrado");
    }
    const updates: any = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.category !== undefined) updates.category = args.category.trim();
    if (args.description !== undefined) updates.description = args.description.trim();
    if (args.portion !== undefined) updates.portion = args.portion?.trim();
    if (args.priceCup !== undefined) updates.priceCup = args.priceCup;
    if (args.isPublished !== undefined) {
      updates.available = args.isPublished;
      updates.isPublished = args.isPublished;
    }
    if (args.isFeatured !== undefined) updates.isFeatured = args.isFeatured;
    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;
    if (args.storageId !== undefined) updates.storageId = args.storageId;
    if (args.displayOrder !== undefined) updates.displayOrder = args.displayOrder;
    if (args.featuredOrder !== undefined) updates.featuredOrder = args.featuredOrder;

    await ctx.db.patch(item._id, updates);
    return { success: true, id: args.id };
  },
});

export const publishDish = mutation({
  args: {
    id: v.string(),
    isPublished: v.boolean(),
    adminToken: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.adminToken || args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE", "COCINA"],
      { requiredPermission: "canManageMenuAvailability", actionDescription: "publicar u ocultar plato" }
    );
    if (!args.id) {
      throw new Error("Se requiere el ID del plato");
    }
    const item = await ctx.db
      .query("menu_items")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
    if (!item) {
      throw new Error("Plato no encontrado");
    }
    await ctx.db.patch(item._id, {
      available: args.isPublished,
      isPublished: args.isPublished,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const setPublishStatus = publishDish;

export const setFeaturedDishes = mutation({
  args: {
    adminToken: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    featuredAssignments: v.array(
      v.object({
        dishId: v.string(),
        featuredOrder: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(ctx, { sessionToken: args.adminToken || args.sessionToken, userId: args.userId });
    const assignmentMap = new Map<string, number>();
    for (const a of args.featuredAssignments) {
      assignmentMap.set(a.dishId, a.featuredOrder);
    }

    const items = await ctx.db.query("menu_items").collect();
    for (const item of items) {
      const isFeat = assignmentMap.has(item.id);
      const featOrder = assignmentMap.get(item.id);
      await ctx.db.patch(item._id, {
        isFeatured: isFeat,
        featuredOrder: isFeat ? featOrder : undefined,
        updatedAt: Date.now(),
      });
    }
    return { success: true };
  },
});

export const deleteDish = mutation({
  args: {
    id: v.string(),
    adminToken: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(ctx, { sessionToken: args.adminToken || args.sessionToken, userId: args.userId });
    if (!args.id) {
      throw new Error("Se requiere el ID del plato");
    }
    const item = await ctx.db
      .query("menu_items")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
    if (item) {
      await ctx.db.delete(item._id);
    }
    return { success: true };
  },
});
