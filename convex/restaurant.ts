import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authorizeUser, authorizeOwnerOrAdmin, assertAdminPermission } from "./auth";
import { internal } from "./_generated/api";

/**
 * Operaciones del módulo de Bar-Restaurante (Terraza):
 * - Consultas de mesas, carta y comandas
 * - Mutaciones para gestión de platos del menú y mesas
 * - Autorización y control de acceso seguro por roles en servidor
 */

export const OFFICIAL_CATEGORIES = [
  "ENTRANTES",
  "PLATOS FUERTES",
  "HAMBURGUESAS",
  "PASTAS",
  "ESPECIAL",
  "BEBIDAS",
  "CAFÉS",
  "BEBIDAS SIN ALCOHOL",
  "OTROS",
  "COCTELERÍA",
];

function normalizeCategory(category: string): string {
  const clean = category
    .trim()
    .replace(/[.,;:]+$/g, "")
    .trim();
  const upper = clean.toUpperCase();
  const withoutAccents = upper
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Normalización básica de variantes comunes si es inequívoca
  if (
    withoutAccents === "ENTRANTE" ||
    withoutAccents === "TAPAS" ||
    withoutAccents === "TAPAS & ENTRANTES" ||
    withoutAccents === "TAPAS Y ENTRANTES"
  )
    return "ENTRANTES";
  if (
    withoutAccents === "PLATO FUERTE" ||
    withoutAccents === "PLATOS PRINCIPALES" ||
    withoutAccents === "PLATO PRINCIPAL"
  )
    return "PLATOS FUERTES";
  if (withoutAccents === "HAMBURGUESA") return "HAMBURGUESAS";
  if (withoutAccents === "PASTA") return "PASTAS";
  if (withoutAccents === "CAFE" || withoutAccents === "CAFES") return "CAFÉS";
  if (withoutAccents === "BEBIDA" || withoutAccents === "BEBIDAS") return "BEBIDAS";
  if (
    withoutAccents === "BEBIDA SIN ALCOHOL" ||
    withoutAccents === "BEBIDAS SIN ALCOHOL"
  )
    return "BEBIDAS SIN ALCOHOL";
  if (
    withoutAccents === "COCTEL" ||
    withoutAccents === "COCTELES" ||
    withoutAccents === "COCTELERIA" ||
    withoutAccents === "BEBIDAS & COCTELERIA" ||
    withoutAccents === "BEBIDAS Y COCTELES"
  )
    return "COCTELERÍA";
  if (withoutAccents === "OTRO" || withoutAccents === "OTROS") return "OTROS";

  // Si coincide exactamente con una oficial, devolverla
  if (OFFICIAL_CATEGORIES.includes(upper)) return upper;

  return clean;
}

/**
 * Regla central única de distribución de productos entre Cocina y Bartender.
 * BARTENDER:
 * - BEBIDAS.
 * - BEBIDAS SIN ALCOHOL.
 * - CAFÉS.
 * - COCTELERÍA.
 * - OTROS.
 * COCINA: todas las demás categorías válidas.
 */
export function determineItemStation(category?: string): "COCINA" | "BARTENDER" {
  if (!category) return "COCINA";
  const normalized = normalizeCategory(category);

  // BARTENDER recibe exclusivamente estas categorías:
  // - BEBIDAS.
  // - BEBIDAS SIN ALCOHOL.
  // - CAFÉS.
  // - COCTELERÍA.
  // - OTROS.
  if (
    normalized === "BEBIDAS" ||
    normalized === "BEBIDAS SIN ALCOHOL" ||
    normalized === "CAFÉS" ||
    normalized === "COCTELERÍA" ||
    normalized === "OTROS" ||
    normalized === "BARTENDER" ||
    normalized === "BAR"
  ) {
    return "BARTENDER";
  }

  // COCINA recibe todas las demás categorías válidas del catálogo.
  return "COCINA";
}

/**
 * Determina si un artículo individual ya ha comenzado su preparación en Cocina o Bar.
 */
export function isItemPrepStarted(item: { status?: string; prepStartedAt?: number }): boolean {
  return (
    item.status === "EN_PREPARACION" ||
    item.status === "LISTO" ||
    (typeof item.prepStartedAt === "number" && item.prepStartedAt > 0)
  );
}

/**
 * Determina si una comanda o alguno de sus artículos ya ha iniciado preparación.
 */
export function isOrderPrepStarted(order: {
  status: string;
  prepStartedAt?: number;
  items: Array<{ status?: string; prepStartedAt?: number }>;
}): boolean {
  if (order.status !== "NUEVO" || (typeof order.prepStartedAt === "number" && order.prepStartedAt > 0)) {
    return true;
  }
  return order.items.some((it) => isItemPrepStarted(it));
}

// ==========================================
// CONSULTAS: MESAS
// ==========================================

export const listTables = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.activeOnly !== undefined) {
      return await ctx.db
        .query("restaurant_tables")
        .withIndex("by_active", (q) => q.eq("active", args.activeOnly!))
        .collect();
    }
    return await ctx.db.query("restaurant_tables").collect();
  },
});

export const getTableById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("restaurant_tables")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
  },
});

export const getTableByNumber = query({
  args: {
    number: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("restaurant_tables")
      .withIndex("by_number", (q) => q.eq("number", args.number))
      .first();
  },
});

// ==========================================
// CONSULTAS: CARTA / MENÚ
// ==========================================

export const listMenuItems = query({
  args: {
    category: v.optional(v.string()),
    availableOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { category, availableOnly } = args;
    let items = await ctx.db.query("menu_items").collect();

    if (availableOnly !== undefined) {
      items = items.filter((item) =>
        availableOnly
          ? item.available === true || item.isPublished === true
          : item.available === false && item.isPublished === false
      );
    }

    if (category !== undefined) {
      items = items.filter((item) => item.category === category);
    }

    return items;
  },
});

export const getMenuItemById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("menu_items")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
  },
});

export const getMenuItemByCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("menu_items")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

// ==========================================
// CONSULTAS: COMANDAS / ÓRDENES DE RESTAURANTE
// ==========================================

export const listOrders = query({
  args: {
    tableId: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("NUEVO"),
        v.literal("EN_PREPARACION"),
        v.literal("LISTO"),
        v.literal("SERVIDO"),
        v.literal("PENDIENTE_COBRO"),
        v.literal("PAGADO"),
        v.literal("CANCELADO")
      )
    ),
    waiterId: v.optional(v.string()),
    limit: v.optional(v.number()),
    jornadaId: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    const activeOnly = args.activeOnly ?? true;

    // Si se solicita solo lo activo, usar el índice por isConsolidated
    if (activeOnly) {
      let query: any = ctx.db.query("restaurant_orders");
      if (args.jornadaId && args.jornadaId !== "no-active-shift") {
        query = ctx.db.query("restaurant_orders").withIndex("by_active_jornada", (q) => q.eq("isConsolidated", false).eq("jornadaId", args.jornadaId!));
      } else {
        query = ctx.db.query("restaurant_orders").filter((q) => q.eq(q.field("isConsolidated"), false));
      }

      if (args.tableId) {
        query = query.filter((q: any) => q.eq(q.field("tableId"), args.tableId));
      }
      if (args.waiterId) {
        query = query.filter((q: any) => q.eq(q.field("waiterId"), args.waiterId));
      }
      if (args.status) {
        query = query.filter((q: any) => q.eq(q.field("status"), args.status));
      }

      let results = await query.order("desc").take(limit);
      if (args.jornadaId && args.jornadaId !== "no-active-shift" && results.length === 0) {
        let fallbackQuery = ctx.db.query("restaurant_orders").filter((q: any) => q.eq(q.field("isConsolidated"), false));
        if (args.tableId) fallbackQuery = fallbackQuery.filter((q: any) => q.eq(q.field("tableId"), args.tableId));
        if (args.waiterId) fallbackQuery = fallbackQuery.filter((q: any) => q.eq(q.field("waiterId"), args.waiterId));
        if (args.status) fallbackQuery = fallbackQuery.filter((q: any) => q.eq(q.field("status"), args.status));
        return await fallbackQuery.order("desc").take(limit);
      }
      return results;
    }

    if (args.tableId !== undefined && args.status !== undefined) {
      return await ctx.db
        .query("restaurant_orders")
        .withIndex("by_table_and_status", (q) =>
          q.eq("tableId", args.tableId!).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    }

    if (args.tableId !== undefined) {
      return await ctx.db
        .query("restaurant_orders")
        .withIndex("by_table", (q) => q.eq("tableId", args.tableId!))
        .order("desc")
        .take(limit);
    }

    if (args.waiterId !== undefined && args.status !== undefined) {
      return await ctx.db
        .query("restaurant_orders")
        .withIndex("by_waiter_and_status", (q) =>
          q.eq("waiterId", args.waiterId!).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    }

    if (args.waiterId !== undefined) {
      return await ctx.db
        .query("restaurant_orders")
        .withIndex("by_waiter_and_createdAt", (q) =>
          q.eq("waiterId", args.waiterId!)
        )
        .order("desc")
        .take(limit);
    }

    if (args.status !== undefined) {
      return await ctx.db
        .query("restaurant_orders")
        .withIndex("by_status_and_createdAt", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    }

    // Si limit no se especificó y se solicita la lista general, devolver todas las órdenes activas de la jornada
    if (args.limit === undefined) {
      return await ctx.db
        .query("restaurant_orders")
        .withIndex("by_createdAt")
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("restaurant_orders")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});

export const getOrderById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
  },
});

export const getOrderByOrderNumber = query({
  args: {
    orderNumber: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("restaurant_orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", args.orderNumber))
      .first();
  },
});

export const listKitchenOrders = query({
  args: {
    jornadaId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("restaurant_orders");
    query = query.filter((q) => q.eq(q.field("isConsolidated"), false));
    const allActive = await query.collect();

    return allActive
      .filter((o) => {
        const hasKitchenItems = o.items.some((it) => (it.station ?? "COCINA") === "COCINA");
        const notConsolidatedKitchen = o.kitchenConsolidationId === undefined || o.kitchenConsolidationId === null;
        if (!hasKitchenItems || !notConsolidatedKitchen) return false;
        if (args.jornadaId && args.jornadaId !== "no-active-shift" && o.jornadaId && o.jornadaId !== args.jornadaId) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((o) => ({
        ...o,
        items: o.items.filter((it) => (it.station ?? "COCINA") === "COCINA"),
      }));
  },
});

export const listBartenderOrders = query({
  args: {},
  handler: async (ctx) => {
    const nuevos = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "NUEVO"))
      .collect();

    const enPreparacion = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_status_and_createdAt", (q) =>
        q.eq("status", "EN_PREPARACION")
      )
      .collect();

    const listos = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "LISTO"))
      .collect();

    const sorted = [...nuevos, ...enPreparacion, ...listos].sort(
      (a, b) => a.createdAt - b.createdAt
    );

    return sorted
      .filter((o) => o.items.some((it) => it.station === "BARTENDER"))
      .map((o) => ({
        ...o,
        items: o.items.filter((it) => it.station === "BARTENDER"),
      }));
  },
});

export const listPendingPaymentOrders = query({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_status_and_createdAt", (q) =>
        q.eq("status", "PENDIENTE_COBRO")
      )
      .order("asc")
      .collect();
    
    return orders.filter(o => o.cashierConsolidationId === undefined);
  },
});

// ==========================================
// MUTACIONES: GESTIÓN DE MENÚ / CARTA
// ==========================================

/**
 * Creación o actualización idempotente de artículo del menú
 */
export const upsertMenuItem = mutation({
  args: {
    id: v.optional(v.string()),
    code: v.string(),
    name: v.string(),
    category: v.string(),
    description: v.optional(v.string()),
    portion: v.optional(v.string()),
    priceCup: v.number(),
    available: v.optional(v.boolean()),
    isPublished: v.optional(v.boolean()),
    storageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isFeatured: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId }
    );

    const trimmedName = args.name.trim();
    const trimmedCode = args.code.trim();
    const normalizedCategory = normalizeCategory(args.category);

    if (!trimmedName) throw new Error("El nombre del plato/bebida no puede estar vacío");
    if (!trimmedCode) throw new Error("El código de carta no puede estar vacío");
    if (args.priceCup < 0) throw new Error("El precio no puede ser negativo");

    const itemId = args.id?.trim() || crypto.randomUUID();
    const existing = await ctx.db
      .query("menu_items")
      .withIndex("by_custom_id", (q) => q.eq("id", itemId))
      .first();

    const codeCheck = await ctx.db
      .query("menu_items")
      .withIndex("by_code", (q) => q.eq("code", trimmedCode))
      .first();

    if (codeCheck && codeCheck.id !== itemId) {
      throw new Error(`El código '${trimmedCode}' ya está asignado a '${codeCheck.name}'`);
    }

    const availableStatus = args.available ?? args.isPublished ?? true;
    const isFeatured = args.isFeatured ?? false;

    // Validación de máximo 3 platos destacados
    if (isFeatured) {
      const allFeatured = await ctx.db
        .query("menu_items")
        .collect();
      const currentFeatured = allFeatured.filter((it) => it.isFeatured === true && it.id !== itemId);
      if (currentFeatured.length >= 3) {
        throw new Error("Solo se permiten hasta 3 platos destacados simultáneamente");
      }
    }

    const docData: Record<string, any> = {
      id: itemId,
      code: trimmedCode,
      name: trimmedName,
      category: normalizedCategory,
      description: args.description?.trim() || "",
      portion: args.portion?.trim() || "",
      priceCup: args.priceCup,
      available: availableStatus,
      isPublished: availableStatus,
      isFeatured,
      updatedAt: Date.now(),
    };

    if (args.storageId !== undefined) docData.storageId = args.storageId;
    if (args.imageUrl !== undefined) docData.imageUrl = args.imageUrl;

    if (existing) {
      await ctx.db.patch(existing._id, docData);
      return { ...existing, ...docData };
    } else {
      const docId = await ctx.db.insert("menu_items", docData as any);
      return { _id: docId, ...docData };
    }
  },
});

/**
 * Creación explícita de un artículo de la carta
 */
export const createMenuItem = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    category: v.string(),
    description: v.optional(v.string()),
    portion: v.optional(v.string()),
    priceCup: v.number(),
    available: v.optional(v.boolean()),
    isPublished: v.optional(v.boolean()),
    storageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isFeatured: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId }
    );

    const trimmedName = args.name.trim();
    const trimmedCode = args.code.trim();
    const normalizedCategory = normalizeCategory(args.category);

    if (!trimmedName) throw new Error("El nombre no puede estar vacío");
    if (!trimmedCode) throw new Error("El código no puede estar vacío");
    if (args.priceCup < 0) throw new Error("El precio no puede ser negativo");

    const existingCode = await ctx.db
      .query("menu_items")
      .withIndex("by_code", (q) => q.eq("code", trimmedCode))
      .first();

    if (existingCode) {
      throw new Error(`El código '${trimmedCode}' ya está en uso por '${existingCode.name}'`);
    }

    const isFeatured = args.isFeatured ?? false;
    if (isFeatured) {
      const allFeatured = await ctx.db.query("menu_items").collect();
      const currentFeatured = allFeatured.filter((it) => it.isFeatured === true);
      if (currentFeatured.length >= 3) {
        throw new Error("Solo se permiten hasta 3 platos destacados simultáneamente");
      }
    }

    const id = crypto.randomUUID();
    const availableStatus = args.available ?? args.isPublished ?? true;
    const docData: Record<string, any> = {
      id,
      code: trimmedCode,
      name: trimmedName,
      category: normalizedCategory,
      description: args.description?.trim() || "",
      portion: args.portion?.trim() || "",
      priceCup: args.priceCup,
      available: availableStatus,
      isPublished: availableStatus,
      isFeatured,
      updatedAt: Date.now(),
    };

    if (args.storageId !== undefined) docData.storageId = args.storageId;
    if (args.imageUrl !== undefined) docData.imageUrl = args.imageUrl;

    const docId = await ctx.db.insert("menu_items", docData as any);
    return { _id: docId, ...docData };
  },
});

/**
 * Actualización granular de un artículo de la carta
 */
export const updateMenuItem = mutation({
  args: {
    id: v.string(),
    code: v.optional(v.string()),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    portion: v.optional(v.string()),
    priceCup: v.optional(v.number()),
    available: v.optional(v.boolean()),
    isPublished: v.optional(v.boolean()),
    storageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isFeatured: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId }
    );

    const existing = await ctx.db
      .query("menu_items")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!existing) {
      throw new Error(`Plato o bebida con ID ${args.id} no encontrado`);
    }

    const patch: Record<string, any> = { updatedAt: Date.now() };

    if (args.code !== undefined) {
      const trimmedCode = args.code.trim();
      if (!trimmedCode) throw new Error("El código no puede estar vacío");
      const codeCheck = await ctx.db
        .query("menu_items")
        .withIndex("by_code", (q) => q.eq("code", trimmedCode))
        .first();
      if (codeCheck && codeCheck.id !== args.id) {
        throw new Error(`El código '${trimmedCode}' ya pertenece a '${codeCheck.name}'`);
      }
      patch.code = trimmedCode;
    }

    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (!trimmedName) throw new Error("El nombre no puede estar vacío");
      patch.name = trimmedName;
    }

    if (args.category !== undefined) patch.category = normalizeCategory(args.category);
    if (args.description !== undefined) patch.description = args.description.trim();
    if (args.portion !== undefined) patch.portion = args.portion.trim();

    if (args.priceCup !== undefined) {
      if (args.priceCup < 0) throw new Error("El precio no puede ser negativo");
      patch.priceCup = args.priceCup;
    }

    if (args.available !== undefined) {
      patch.available = args.available;
      patch.isPublished = args.available;
    } else if (args.isPublished !== undefined) {
      patch.available = args.isPublished;
      patch.isPublished = args.isPublished;
    }

    if (args.storageId !== undefined) patch.storageId = args.storageId;
    if (args.imageUrl !== undefined) patch.imageUrl = args.imageUrl;

    if (args.isFeatured !== undefined) {
      if (args.isFeatured) {
        const allFeatured = await ctx.db.query("menu_items").collect();
        const currentFeatured = allFeatured.filter((it) => it.isFeatured === true && it.id !== args.id);
        if (currentFeatured.length >= 3) {
          throw new Error("Solo se permiten hasta 3 platos destacados simultáneamente");
        }
      }
      patch.isFeatured = args.isFeatured;
    }

    await ctx.db.patch(existing._id, patch);
    return { ...existing, ...patch };
  },
});

/**
 * Activación o desactivación de disponibilidad de un plato/bebida
 * Accesible por ADMIN_GENERAL, DUENO_CAJERO y personal de COCINA
 */
export const setMenuItemAvailability = mutation({
  args: {
    id: v.string(),
    available: v.boolean(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE", "COCINA"],
      { requiredPermission: "canManageMenuAvailability", actionDescription: "marcar disponibilidad de plato en cocina/carta" }
    );

    const existing = await ctx.db
      .query("menu_items")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!existing) {
      throw new Error(`Plato o bebida con ID ${args.id} no encontrado`);
    }

    await ctx.db.patch(existing._id, {
      available: args.available,
      isPublished: args.available,
      updatedAt: Date.now(),
    });

    return { success: true, id: args.id, available: args.available };
  },
});

/**
 * Eliminación/Retiro de un plato de la carta
 */
export const deleteMenuItem = mutation({
  args: {
    id: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId }
    );

    const existing = await ctx.db
      .query("menu_items")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { success: true, id: args.id };
  },
});

// ==========================================
// MUTACIONES: GESTIÓN DE MESAS
// ==========================================

/**
 * Creación o actualización idempotente de mesa
 */
export const upsertTable = mutation({
  args: {
    id: v.optional(v.string()),
    number: v.number(),
    name: v.string(),
    capacity: v.optional(v.number()),
    active: v.boolean(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO"],
      { actionDescription: "gestionar mesas del restaurante" }
    );

    if (args.number < 1) throw new Error("El número de mesa debe ser un entero positivo mayor o igual a 1");
    const trimmedName = args.name.trim();
    if (!trimmedName) throw new Error("El nombre de la mesa no puede estar vacío");

    const tableId = args.id?.trim() || crypto.randomUUID();
    const existing = await ctx.db
      .query("restaurant_tables")
      .withIndex("by_custom_id", (q) => q.eq("id", tableId))
      .first();

    const numberCheck = await ctx.db
      .query("restaurant_tables")
      .withIndex("by_number", (q) => q.eq("number", args.number))
      .first();

    if (numberCheck && numberCheck.id !== tableId) {
      throw new Error(`El número de mesa ${args.number} ya está registrado ('${numberCheck.name}')`);
    }

    const docData = {
      id: tableId,
      number: args.number,
      name: trimmedName,
      capacity: args.capacity !== undefined && args.capacity > 0 ? args.capacity : 4,
      active: args.active,
    };

    if (existing) {
      await ctx.db.patch(existing._id, docData);
      return { ...existing, ...docData };
    } else {
      const docId = await ctx.db.insert("restaurant_tables", docData);
      return { _id: docId, ...docData };
    }
  },
});

/**
 * Creación explícita de mesa
 */
export const createTable = mutation({
  args: {
    number: v.number(),
    name: v.string(),
    capacity: v.optional(v.number()),
    active: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO"],
      { actionDescription: "crear mesa en el restaurante" }
    );

    if (args.number < 1) throw new Error("El número de mesa debe ser un entero positivo mayor o igual a 1");
    const trimmedName = args.name.trim();
    if (!trimmedName) throw new Error("El nombre de la mesa no puede estar vacío");

    const existingNumber = await ctx.db
      .query("restaurant_tables")
      .withIndex("by_number", (q) => q.eq("number", args.number))
      .first();

    if (existingNumber) {
      throw new Error(`La mesa número ${args.number} ya existe ('${existingNumber.name}')`);
    }

    const id = crypto.randomUUID();
    const docData = {
      id,
      number: args.number,
      name: trimmedName,
      capacity: args.capacity !== undefined && args.capacity > 0 ? args.capacity : 4,
      active: args.active ?? true,
    };

    const docId = await ctx.db.insert("restaurant_tables", docData);
    return { _id: docId, ...docData };
  },
});

/**
 * Actualización granular de mesa
 */
export const updateTable = mutation({
  args: {
    id: v.string(),
    number: v.optional(v.number()),
    name: v.optional(v.string()),
    capacity: v.optional(v.number()),
    active: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO"],
      { actionDescription: "actualizar configuración de mesa" }
    );

    const existing = await ctx.db
      .query("restaurant_tables")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!existing) {
      throw new Error(`Mesa con ID ${args.id} no encontrada`);
    }

    const patch: Record<string, any> = {};

    if (args.number !== undefined) {
      if (args.number < 1) throw new Error("El número de mesa debe ser mayor o igual a 1");
      const targetNum = args.number;
      const numberCheck = await ctx.db
        .query("restaurant_tables")
        .withIndex("by_number", (q) => q.eq("number", targetNum))
        .first();
      if (numberCheck && numberCheck.id !== args.id) {
        throw new Error(`El número de mesa ${targetNum} ya está ocupado por '${numberCheck.name}'`);
      }
      patch.number = targetNum;
    }

    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (!trimmedName) throw new Error("El nombre de la mesa no puede estar vacío");
      patch.name = trimmedName;
    }

    if (args.capacity !== undefined) {
      if (args.capacity < 1) throw new Error("La capacidad debe ser de al menos 1 persona");
      patch.capacity = args.capacity;
    }

    if (args.active !== undefined) patch.active = args.active;

    await ctx.db.patch(existing._id, patch);
    return { ...existing, ...patch };
  },
});

/**
 * Habilitar o inhabilitar mesa para servicio
 */
export const setTableStatus = mutation({
  args: {
    id: v.string(),
    active: v.boolean(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO"],
      { actionDescription: "cambiar estado de mesa" }
    );

    const existing = await ctx.db
      .query("restaurant_tables")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!existing) {
      throw new Error(`Mesa con ID ${args.id} no encontrada`);
    }

    await ctx.db.patch(existing._id, { active: args.active });
    return { success: true, id: args.id, active: args.active };
  },
});

/**
 * Eliminación de mesa con validación de integridad referencial.
 * Impide eliminar si existen reservaciones activas/pendientes o comandas en curso asociadas.
 */
export const deleteTable = mutation({
  args: {
    id: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO"],
      { actionDescription: "eliminar mesa del restaurante" }
    );

    const existing = await ctx.db
      .query("restaurant_tables")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!existing) {
      throw new Error(`Mesa con ID ${args.id} no encontrada`);
    }

    // 1. Validar que no existan reservaciones activas o pendientes asociadas (Pendiente, Negociación, Confirmado)
    const activeStatuses = ["Pendiente", "Negociación", "Confirmado"];
    const allReservations = await ctx.db.query("restaurant_reservations").collect();
    const conflictingReservations = allReservations.filter((r) => {
      const matchesTable =
        (r.tableId && r.tableId === existing.id) ||
        (r.assignedTableId && r.assignedTableId === existing.id) ||
        (r.tableNumber !== undefined && r.tableNumber === existing.number) ||
        (r.assignedTableNumber !== undefined && r.assignedTableNumber === existing.number);
      return matchesTable && activeStatuses.includes(r.status);
    });

    if (conflictingReservations.length > 0) {
      throw new Error(
        `No es posible eliminar la mesa '${existing.name}' (#${existing.number}) porque tiene ${conflictingReservations.length} reservación(es) activa(s) o pendiente(s). Cancele o reasigne las reservaciones primero.`
      );
    }

    // 2. Validar que no existan comandas activas
    const activeOrderStatuses = ["NUEVO", "EN_PREPARACION", "LISTO", "SERVIDO", "PENDIENTE_COBRO"];
    const conflictingOrders = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_table", (q) => q.eq("tableId", existing.id))
      .collect();
    const activeOrders = conflictingOrders.filter((o) => activeOrderStatuses.includes(o.status));

    if (activeOrders.length > 0) {
      throw new Error(
        `No es posible eliminar la mesa '${existing.name}' (#${existing.number}) porque tiene ${activeOrders.length} comanda(s) en curso. Cierre o cancele las comandas primero.`
      );
    }

    await ctx.db.delete(existing._id);
    return { success: true, id: args.id, deletedNumber: existing.number, deletedName: existing.name };
  },
});


// ==========================================
// MUTACIONES CRÍTICAS: CREACIÓN Y GESTIÓN DE PEDIDOS
// ==========================================

const OrderItemValidator = v.object({
  id: v.optional(v.string()),
  menuItemId: v.string(),
  itemName: v.string(),
  quantity: v.number(),
  unitPriceCup: v.number(),
  subtotalCup: v.number(),
  notes: v.optional(v.string()),
  station: v.optional(v.union(v.literal("COCINA"), v.literal("BARTENDER"))),
  status: v.optional(
    v.union(
      v.literal("NUEVO"),
      v.literal("EN_PREPARACION"),
      v.literal("LISTO"),
      v.literal("ENTREGADO"),
      v.literal("SERVIDO"),
      v.literal("PENDIENTE_COBRO"),
      v.literal("PAGADO"),
      v.literal("CANCELADO")
    )
  ),
  prepStartedAt: v.optional(v.number()),
  readyAt: v.optional(v.number()),
  deliveredToWaiterAt: v.optional(v.number()),
  servedAt: v.optional(v.number()),
  servedByUserId: v.optional(v.string()),
  cookUserId: v.optional(v.string()),
  cookUserName: v.optional(v.string()),
});

/**
 * Creación de una nueva comanda/orden de bar-restaurante.
 *
 * Reglas de consistencia e integridad:
 * 1. Idempotencia estricta: si ya existe una orden con la misma idempotencyKey, se devuelve sin duplicar.
 * 2. Validación de mesa: la mesa debe existir y estar activa para servicio.
 * 3. Validación de artículos: debe tener al menos un artículo, con cantidades > 0 e importes no negativos.
 * 4. Disponibilidad de carta: valida que los platos y bebidas existan y estén marcados como disponibles.
 * 5. Secuencia de comanda: calcula el número de orden correlativo si no viene especificado.
 * 6. Aislamiento financiero: el pedido se crea en estado 'NUEVO'. En ningún caso se contabiliza como ingreso confirmado.
 * 7. Notificación automática: emite notificación en tiempo real para el rol COCINA.
 */
export const createOrder = mutation({
  args: {
    id: v.optional(v.string()),
    tableId: v.string(),
    tableName: v.optional(v.string()),
    orderNumber: v.optional(v.number()),
    waiterId: v.string(),
    waiterName: v.optional(v.string()),
    items: v.array(OrderItemValidator),
    generalNotes: v.optional(v.string()),
    totalCup: v.optional(v.number()),
    idempotencyKey: v.string(),
    jornadaId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Autorización estricta por rol en el servidor (ADMIN_GENERAL, DUENO_CAJERO o DEPENDIENTE)
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.waiterId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE"],
      { actionDescription: "crear comanda de bar-restaurante" }
    );
    const resolvedWaiterId = auth.user.id;
    const resolvedWaiterName = auth.user.fullName || auth.user.username;

    const { idempotencyKey } = args;
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new Error("La clave de idempotencia es obligatoria para crear una comanda");
    }

    // 2. Verificación de Idempotencia: ¿Ya se registró esta comanda?
    const existingByIdempotency = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
      .first();

    if (existingByIdempotency) {
      return existingByIdempotency;
    }

    const orderId = args.id?.trim() || crypto.randomUUID();
    const existingById = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", orderId))
      .first();

    if (existingById) {
      return existingById;
    }

    // 3. Validación de mesa
    const table = await ctx.db
      .query("restaurant_tables")
      .withIndex("by_custom_id", (q) => q.eq("id", args.tableId))
      .first();

    if (!table) {
      throw new Error(`Mesa con ID ${args.tableId} no encontrada`);
    }

    if (!table.active) {
      throw new Error(`La mesa '${table.name}' no está habilitada actualmente para el servicio`);
    }

    // 4. Validación de artículos de la comanda
    if (!args.items || args.items.length === 0) {
      throw new Error("La comanda debe contener al menos un artículo");
    }

    let calculatedTotal = 0;
    const validatedItems = [];

    for (const item of args.items) {
      if (item.quantity <= 0) {
        throw new Error(`Cantidad inválida en comanda para '${item.itemName}': debe ser al menos 1`);
      }
      if (item.unitPriceCup < 0 || item.subtotalCup < 0) {
        throw new Error(`Importe inválido para '${item.itemName}': los precios no pueden ser negativos`);
      }

      // Validar existencia y disponibilidad en la carta
      const menuItem = await ctx.db
        .query("menu_items")
        .withIndex("by_custom_id", (q) => q.eq("id", item.menuItemId))
        .first();

      if (!menuItem) {
        throw new Error(`Plato o bebida '${item.itemName}' no existe en la carta del restaurante`);
      }

      if (!menuItem.available) {
        throw new Error(`El producto '${menuItem.name}' no está disponible actualmente en cocina/barra`);
      }

      // Regla central inmutable: la estación depende exclusivamente de la categoría del catálogo
      const station = determineItemStation(menuItem.category);
      const itemStatus = item.status ?? "NUEVO";

      calculatedTotal += item.subtotalCup;
      validatedItems.push({
        id: item.id?.trim() || crypto.randomUUID(),
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPriceCup: item.unitPriceCup,
        subtotalCup: item.subtotalCup,
        notes: item.notes?.trim() || "",
        station,
        status: itemStatus,
        prepStartedAt: item.prepStartedAt,
        readyAt: item.readyAt,
        cookUserId: item.cookUserId,
        cookUserName: item.cookUserName,
      });
    }

    const finalTotal = args.totalCup !== undefined ? args.totalCup : calculatedTotal;

    // 5. Determinar número de orden secuencial si no fue especificado
    let finalOrderNumber = args.orderNumber;
    if (finalOrderNumber === undefined || finalOrderNumber <= 0) {
      const lastOrder = await ctx.db
        .query("restaurant_orders")
        .withIndex("by_orderNumber")
        .order("desc")
        .first();

      finalOrderNumber = lastOrder ? lastOrder.orderNumber + 1 : 101;
    }

    const now = args.createdAt ?? Date.now();

    // 6. Creación de la orden con estado inicial 'NUEVO' vinculada a la identidad autenticada
    const orderDoc = {
      id: orderId,
      tableId: table.id,
      tableName: table.name,
      orderNumber: finalOrderNumber,
      waiterId: resolvedWaiterId,
      waiterName: resolvedWaiterName,
      createdAt: now,
      items: validatedItems,
      generalNotes: args.generalNotes?.trim() || "",
      totalCup: finalTotal,
      status: "NUEVO" as const,
      idempotencyKey,
      jornadaId: args.jornadaId,
      isConsolidated: false,
      updatedAt: now,
    };

    const docId = await ctx.db.insert("restaurant_orders", orderDoc);

    // 7. Notificaciones para estaciones de trabajo (Cocina y Bartender)
    const kitchenCount = validatedItems.filter((i) => i.station === "COCINA").length;
    const bartenderCount = validatedItems.filter((i) => i.station === "BARTENDER").length;

    if (kitchenCount > 0) {
      const kTitle = "NUEVA COMANDA";
      const kMsg = `${table.name} (Orden #${finalOrderNumber}): ${kitchenCount} producto(s) para cocina solicitados por ${resolvedWaiterName}`;

      await ctx.db.insert("notifications", {
        id: crypto.randomUUID(),
        title: kTitle,
        message: kMsg,
        targetRole: "COCINA",
        timestamp: now,
        orderId,
        isRead: false,
      });

      await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotificationToRole, {
        role: "COCINA",
        title: kTitle,
        message: kMsg,
        type: "COCINA",
        orderId,
      });
    }

    if (bartenderCount > 0) {
      const bTitle = `Nueva Orden Bar #${finalOrderNumber}`;
      const bMsg = `${table.name}: ${bartenderCount} bebidas solicitadas por ${resolvedWaiterName}`;

    }

    return { _id: docId, ...orderDoc };
  },
});

/**
 * Sincronización completa de orden desde cliente Android (AppRepository: syncOrderToConvex).
 * Soporta actualización reactiva del estado completo de la comanda sin crear duplicados.
 */
export const syncOrder = mutation({
  args: {
    id: v.string(),
    tableId: v.string(),
    tableName: v.optional(v.string()),
    orderNumber: v.number(),
    waiterId: v.string(),
    waiterName: v.optional(v.string()),
    status: v.union(
      v.literal("NUEVO"),
      v.literal("EN_PREPARACION"),
      v.literal("LISTO"),
      v.literal("SERVIDO"),
      v.literal("PENDIENTE_COBRO"),
      v.literal("PAGADO"),
      v.literal("CANCELADO")
    ),
    totalCup: v.number(),
    generalNotes: v.optional(v.string()),
    items: v.array(OrderItemValidator),
    createdAt: v.number(),
    prepStartedAt: v.optional(v.number()),
    cookUserId: v.optional(v.string()),
    cookUserName: v.optional(v.string()),
    readyAt: v.optional(v.number()),
    servedAt: v.optional(v.number()),
    servedByUserId: v.optional(v.string()),
    paymentRequestedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    cashierUserId: v.optional(v.string()),
    cashierUserName: v.optional(v.string()),
    paymentMethod: v.optional(
      v.union(
        v.literal("EFECTIVO"),
        v.literal("TRANSFERENCIA"),
        v.literal("MIXTO")
      )
    ),
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(v.string()),
    cancelledByUserId: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    jornadaId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Control de autorización según estado de la comanda
    if (args.status === "PAGADO") {
      await authorizeUser(
        ctx,
        { sessionToken: args.sessionToken, userId: args.cashierUserId || args.waiterId },
        ["ADMIN_GENERAL", "DUENO", "CAJERO"],
        { requiredPermission: "canConfirmPayments", actionDescription: "sincronizar orden pagada" }
      );
    } else if (args.status === "CANCELADO") {
      const auth = await authorizeUser(
        ctx,
        { sessionToken: args.sessionToken, userId: args.waiterId },
        ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE"],
        { actionDescription: "cancelar orden de restaurante" }
      );
      if (auth.user.role === "DEPENDIENTE" && auth.user.assignedArea === "TIENDA") {
        throw new Error("Acceso denegado: tu área asignada es TIENDA. No tienes permiso para anular órdenes de Bar.");
      }
    } else {
      await authorizeUser(
        ctx,
        { sessionToken: args.sessionToken, userId: args.waiterId },
        ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE", "COCINA"],
        { actionDescription: "sincronizar orden de restaurante" }
      );
    }

    const existing = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    const isExistingOrderStarted =
      existing &&
      (existing.status !== "NUEVO" ||
        (typeof existing.prepStartedAt === "number" && existing.prepStartedAt > 0) ||
        existing.items.some((it) => isItemPrepStarted(it)));

    if (existing && isExistingOrderStarted && args.status !== "CANCELADO" && args.status !== "PAGADO") {
      const startedItems = existing.items.filter(isItemPrepStarted);
      for (const started of startedItems) {
        const matched = args.items.find(
          (ai) => (ai.id && ai.id === started.id) || ai.menuItemId === started.menuItemId
        );
        if (!matched) {
          throw new Error(
            `No es posible retirar '${started.itemName}' porque su preparación ya ha comenzado en ${started.station}.`
          );
        }
        if (matched.quantity < started.quantity) {
          throw new Error(
            `No es posible reducir la cantidad de '${started.itemName}' porque su preparación ya ha comenzado en ${started.station}.`
          );
        }
      }
    }

    const formattedItems = [];
    for (const it of args.items) {
      let station: "COCINA" | "BARTENDER" = "COCINA";
      const prevItem = existing?.items.find(
        (ei) => (ei.id && ei.id === it.id) || ei.menuItemId === it.menuItemId
      );

      if (isExistingOrderStarted && prevItem && isItemPrepStarted(prevItem)) {
        // Preservar la asignación en curso sin reclasificación retroactiva
        station = prevItem.station ?? "COCINA";
      } else {
        // En orden no iniciada o item nuevo, resolver mediante la regla central única
        const mi = await ctx.db
          .query("menu_items")
          .withIndex("by_custom_id", (q) => q.eq("id", it.menuItemId))
          .first();
        station = mi ? determineItemStation(mi.category) : determineItemStation(it.station);
      }

      formattedItems.push({
        id: it.id?.trim() || crypto.randomUUID(),
        menuItemId: it.menuItemId,
        itemName: it.itemName,
        quantity: it.quantity,
        unitPriceCup: it.unitPriceCup,
        subtotalCup: it.subtotalCup,
        notes: it.notes?.trim() || "",
        station,
        status: it.status ?? "NUEVO",
        prepStartedAt: it.prepStartedAt,
        readyAt: it.readyAt,
        cookUserId: it.cookUserId,
        cookUserName: it.cookUserName,
      });
    }

    const resolvedTableName = args.tableName?.trim() || `Mesa ${args.tableId}`;
    const resolvedWaiterName = args.waiterName?.trim() || "Dependiente";
    const idempotencyKey = args.idempotencyKey || args.id;
    const now = Date.now();

    if (existing) {
      const patchData: Record<string, any> = {
        tableName: resolvedTableName,
        status: args.status,
        totalCup: args.totalCup,
        generalNotes: args.generalNotes?.trim() || "",
        items: formattedItems,
        jornadaId: args.jornadaId,
        updatedAt: now,
      };

      if (args.prepStartedAt !== undefined) patchData.prepStartedAt = args.prepStartedAt;
      if (args.cookUserId !== undefined) patchData.cookUserId = args.cookUserId;
      if (args.cookUserName !== undefined) patchData.cookUserName = args.cookUserName;
      if (args.readyAt !== undefined) patchData.readyAt = args.readyAt;
      if (args.servedAt !== undefined) patchData.servedAt = args.servedAt;
      if (args.servedByUserId !== undefined) patchData.servedByUserId = args.servedByUserId;
      if (args.paymentRequestedAt !== undefined) patchData.paymentRequestedAt = args.paymentRequestedAt;
      if (args.paidAt !== undefined) patchData.paidAt = args.paidAt;
      if (args.cashierUserId !== undefined) patchData.cashierUserId = args.cashierUserId;
      if (args.cashierUserName !== undefined) patchData.cashierUserName = args.cashierUserName;
      if (args.paymentMethod !== undefined) patchData.paymentMethod = args.paymentMethod;
      if (args.cancelledAt !== undefined) patchData.cancelledAt = args.cancelledAt;
      if (args.cancellationReason !== undefined) patchData.cancellationReason = args.cancellationReason;
      if (args.cancelledByUserId !== undefined) patchData.cancelledByUserId = args.cancelledByUserId;

      let addedKitchenCount = 0;
      let addedBartenderCount = 0;

      for (const newItem of formattedItems) {
        const oldItem = existing.items.find(
          (ei) => (ei.id && ei.id === newItem.id) || ei.menuItemId === newItem.menuItemId
        );
        const oldQty = oldItem ? oldItem.quantity : 0;
        const diffQty = newItem.quantity - oldQty;
        if (diffQty > 0) {
          if (newItem.station === "COCINA") {
            addedKitchenCount += diffQty;
          } else if (newItem.station === "BARTENDER") {
            addedBartenderCount += diffQty;
          }
        }
      }

      if (addedKitchenCount > 0) {
        const title = `Actualización Comanda — ${resolvedTableName}`;
        const msg = `Orden #${existing.orderNumber}: ${addedKitchenCount} producto(s) nuevo(s) en cocina por ${resolvedWaiterName}`;
        await ctx.db.insert("notifications", {
          id: crypto.randomUUID(),
          title,
          message: msg,
          targetRole: "COCINA",
          timestamp: now,
          orderId: existing.id,
          isRead: false,
        });
        await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotificationToRole, {
          role: "COCINA",
          title,
          message: msg,
          type: "COCINA",
          orderId: existing.id,
        });
      }

      if (addedBartenderCount > 0) {
        const title = `Actualización Orden Bar — ${resolvedTableName}`;
        const msg = `Orden #${existing.orderNumber}: ${addedBartenderCount} bebida(s) nueva(s) en barra por ${resolvedWaiterName}`;
      }

      // Notificar inmediatamente al dependiente si productos de cocina pasaron a LISTO o la comanda quedó LISTA
      const wasKitchenReady = existing.items.some(
        (it) => (it.station ?? "COCINA") === "COCINA" && it.status === "LISTO"
      );
      const isNowKitchenReady = formattedItems.some(
        (it) => (it.station ?? "COCINA") === "COCINA" && it.status === "LISTO"
      );
      const becameKitchenReady = (!wasKitchenReady && isNowKitchenReady) || (existing.status !== "LISTO" && args.status === "LISTO");

      if (becameKitchenReady) {
        const readyTitle = "PEDIDO LISTO PARA RECOGER";
        const readyMsg = `Mesa ${resolvedTableName} (Orden #${existing.orderNumber}): Comanda de cocina lista para recoger (Cocina)`;
        await ctx.db.insert("notifications", {
          id: crypto.randomUUID(),
          title: readyTitle,
          message: readyMsg,
          targetRole: "DEPENDIENTE",
          targetUserId: existing.waiterId,
          orderId: existing.id,
          timestamp: now,
          isRead: false,
        });
        if (existing.waiterId) {
          await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotificationToUser, {
            userId: existing.waiterId,
            title: readyTitle,
            message: readyMsg,
            type: "DEPENDIENTE",
            orderId: existing.id,
          });
        }
      }

      await ctx.db.patch(existing._id, patchData);
      return { ...existing, ...patchData };
    } else {
      const newDoc = {
        id: args.id,
        tableId: args.tableId,
        tableName: resolvedTableName,
        orderNumber: args.orderNumber,
        waiterId: args.waiterId,
        waiterName: resolvedWaiterName,
        createdAt: args.createdAt,
        items: formattedItems,
        generalNotes: args.generalNotes?.trim() || "",
        totalCup: args.totalCup,
        status: args.status,
        prepStartedAt: args.prepStartedAt,
        cookUserId: args.cookUserId,
        cookUserName: args.cookUserName,
        readyAt: args.readyAt,
        servedAt: args.servedAt,
        servedByUserId: args.servedByUserId,
        paymentRequestedAt: args.paymentRequestedAt,
        paidAt: args.paidAt,
        cashierUserId: args.cashierUserId,
        cashierUserName: args.cashierUserName,
        paymentMethod: args.paymentMethod,
        cancelledAt: args.cancelledAt,
        cancellationReason: args.cancellationReason,
        cancelledByUserId: args.cancelledByUserId,
        idempotencyKey,
        jornadaId: args.jornadaId,
        isConsolidated: false,
        updatedAt: now,
      };

      const docId = await ctx.db.insert("restaurant_orders", newDoc);

      // Notificación inmediata a Cocina si la nueva comanda contiene platos para elaborar
      const newKitchenCount = formattedItems.filter((i) => (i.station ?? "COCINA") === "COCINA").length;
      if (newKitchenCount > 0) {
        const kTitle = "NUEVA COMANDA";
        const kMsg = `${resolvedTableName} (Orden #${args.orderNumber}): ${newKitchenCount} producto(s) para cocina solicitados por ${resolvedWaiterName}`;
        await ctx.db.insert("notifications", {
          id: crypto.randomUUID(),
          title: kTitle,
          message: kMsg,
          targetRole: "COCINA",
          timestamp: now,
          orderId: args.id,
          isRead: false,
        });
        await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotificationToRole, {
          role: "COCINA",
          title: kTitle,
          message: kMsg,
          type: "COCINA",
          orderId: args.id,
        });
      }

      return { _id: docId, ...newDoc };
    }
  },
});

// ==========================================
// TRANSICIONES DE ESTADO DE COMANDAS DE RESTAURANTE
// ==========================================

/**
 * Inicio de preparación en cocina: 'NUEVO' -> 'EN_PREPARACION'
 */
export const startKitchenPreparation = mutation({
  args: {
    orderId: v.string(),
    cookUserId: v.string(),
    cookUserName: v.string(),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.cookUserId },
      ["ADMIN_GENERAL", "DUENO", "COCINA"],
      { actionDescription: "iniciar preparación en cocina" }
    );

    const order = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
      .first();

    if (!order) {
      throw new Error(`Comanda con ID ${args.orderId} no encontrada`);
    }

    const now = Date.now();
    const cookName = auth.user.fullName || auth.user.username;
    const updatedItems = order.items.map((it) => {
      if ((it.station ?? "COCINA") === "COCINA" && (it.status ?? "NUEVO") === "NUEVO") {
        return {
          ...it,
          status: "EN_PREPARACION" as const,
          prepStartedAt: now,
          cookUserId: auth.user.id,
          cookUserName: cookName,
        };
      }
      return it;
    });

    const patch = {
      status: "EN_PREPARACION" as const,
      prepStartedAt: order.prepStartedAt ?? now,
      cookUserId: order.cookUserId ?? auth.user.id,
      cookUserName: order.cookUserName ?? cookName,
      items: updatedItems,
      updatedAt: now,
    };

    await ctx.db.patch(order._id, patch);
    return { ...order, ...patch };
  },
});

/**
 * Aviso de comanda lista en cocina: 'EN_PREPARACION' | 'NUEVO' -> 'LISTO'
 * Notifica automáticamente al dependiente asignado a la mesa.
 */
export const markKitchenReady = mutation({
  args: {
    orderId: v.string(),
    idempotencyKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "COCINA"],
      { actionDescription: "marcar comanda lista en cocina" }
    );

    const order = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
      .first();

    if (!order) {
      throw new Error(`Comanda con ID ${args.orderId} no encontrada`);
    }

    const now = Date.now();
    let anyChanged = false;
    const updatedItems = order.items.map((it) => {
      if ((it.station ?? "COCINA") === "COCINA") {
        if (it.status !== "ENTREGADO" && it.status !== "SERVIDO" && it.status !== "PAGADO" && it.status !== "CANCELADO") {
          anyChanged = true;
        }
        return {
          ...it,
          status: "ENTREGADO" as const,
          readyAt: it.readyAt ?? now,
          deliveredToWaiterAt: it.deliveredToWaiterAt ?? now,
        };
      }
      return it;
    });

    if (!anyChanged) {
      // Idempotencia: ya está entregado
      return order;
    }

    const allKitchenDelivered = updatedItems
      .filter((it) => (it.station ?? "COCINA") === "COCINA")
      .every((it) => it.status === "ENTREGADO" || it.status === "SERVIDO" || it.status === "PAGADO" || it.status === "CANCELADO");

    const patch: Record<string, any> = {
      items: updatedItems,
      updatedAt: now,
    };

    if (allKitchenDelivered) {
      patch.deliveredToWaiterAt = now;
      if (order.status === "LISTO" || order.status === "EN_PREPARACION" || order.status === "NUEVO") {
        patch.status = "ENTREGADO" as const;
      }
    }

    await ctx.db.patch(order._id, patch);

    const notifTitle = "COMANDA ENTREGADA A DEPENDIENTE";
    const notifMsg = `Mesa ${order.tableName} (Orden #${order.orderNumber}): Comanda de cocina lista y entregada a dependiente`;

    // Notificar al dependiente responsable
    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: notifTitle,
      message: notifMsg,
      targetRole: "DEPENDIENTE",
      targetUserId: order.waiterId,
      orderId: order.id,
      timestamp: now,
      isRead: false,
    });

    if (order.waiterId) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotificationToUser, {
        userId: order.waiterId,
        title: notifTitle,
        message: notifMsg,
        type: "DEPENDIENTE",
        orderId: order.id,
      });
    }

    return { ...order, ...patch };
  },
});

/**
 * Confirmación de entrega física a dependiente: 'LISTO' -> 'ENTREGADO'
 * Registra el momento exacto de la entrega para el historial de la jornada.
 */
export const confirmKitchenDelivery = mutation({
  args: {
    orderId: v.string(),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "COCINA"],
      { actionDescription: "confirmar entrega de comanda a dependiente" }
    );

    const order = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
      .first();

    if (!order) throw new Error(`Comanda con ID ${args.orderId} no encontrada`);

    const now = Date.now();
    let anyChanged = false;
    const updatedItems = order.items.map((it) => {
      if ((it.station ?? "COCINA") === "COCINA" && it.status === "LISTO") {
        anyChanged = true;
        return {
          ...it,
          status: "ENTREGADO" as const,
          deliveredToWaiterAt: now,
        };
      }
      return it;
    });

    if (!anyChanged) {
      throw new Error("No hay productos listos para entregar en esta orden.");
    }

    const allKitchenDelivered = updatedItems
      .filter((it) => (it.station ?? "COCINA") === "COCINA")
      .every((it) => it.status === "ENTREGADO" || it.status === "SERVIDO" || it.status === "PAGADO" || it.status === "CANCELADO");

    const patch: Record<string, any> = {
      items: updatedItems,
      updatedAt: now,
    };

    if (allKitchenDelivered) {
      // Si todos los de cocina están entregados, actualizamos el estado global si procede
      // Pero el estado global suele seguir el flujo completo hasta SERVIDO
      // Por ahora marcamos el timestamp global de entrega de cocina
      patch.deliveredToWaiterAt = now;
      
      // Si la orden ya estaba lista globalmente, podemos pasarla a ENTREGADO
      if (order.status === "LISTO") {
        patch.status = "ENTREGADO" as const;
      }
    }

    await ctx.db.patch(order._id, patch);
    return { ...order, ...patch };
  },
});

/**
 * Marca un producto individual de cocina como LISTO: 'NUEVO' | 'EN_PREPARACION' -> 'LISTO'
 * Notifica al dependiente asignado indicando el nombre del plato listo.
 */
export const markKitchenItemReady = mutation({
  args: {
    orderId: v.string(),
    itemId: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "COCINA"],
      { actionDescription: "marcar plato de cocina como listo" }
    );

    const order = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
      .first();

    if (!order) {
      throw new Error(`Comanda con ID ${args.orderId} no encontrada`);
    }

    const now = Date.now();
    let targetItemName = "Plato de cocina";
    const updatedItems = order.items.map((it) => {
      if (it.id === args.itemId || it.menuItemId === args.itemId) {
        targetItemName = it.itemName;
        return {
          ...it,
          status: "LISTO" as const,
          readyAt: now,
        };
      }
      return it;
    });

    const allKitchenReady = updatedItems
      .filter((it) => (it.station ?? "COCINA") === "COCINA")
      .every((it) => it.status === "LISTO" || it.status === "SERVIDO" || it.status === "CANCELADO");

    const patch = {
      status: allKitchenReady ? ("LISTO" as const) : ("EN_PREPARACION" as const),
      readyAt: allKitchenReady ? now : order.readyAt,
      items: updatedItems,
      updatedAt: now,
    };

    await ctx.db.patch(order._id, patch);

    const notifTitle = "PEDIDO LISTO PARA RECOGER";
    const notifMsg = `Mesa ${order.tableName} (Orden #${order.orderNumber}): ${targetItemName} listo para recoger (Cocina)`;

    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: notifTitle,
      message: notifMsg,
      targetRole: "DEPENDIENTE",
      targetUserId: order.waiterId,
      orderId: order.id,
      timestamp: now,
      isRead: false,
    });

    if (order.waiterId) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotificationToUser, {
        userId: order.waiterId,
        title: notifTitle,
        message: notifMsg,
        type: "DEPENDIENTE",
        orderId: order.id,
      });
    }

    return { ...order, ...patch };
  },
});

/**
 * Inicio de preparación en bar: 'NUEVO' -> 'EN_PREPARACION'
 */
export const startBartenderPreparation = mutation({
  args: {
    orderId: v.string(),
    bartenderUserId: v.string(),
    bartenderUserName: v.string(),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.bartenderUserId },
      ["ADMIN_GENERAL", "DUENO"],
      { actionDescription: "iniciar preparación en bar" }
    );

    const order = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
      .first();

    if (!order) {
      throw new Error(`Comanda con ID ${args.orderId} no encontrada`);
    }

    const now = Date.now();
    const bartenderName = auth.user.fullName || auth.user.username;
    const updatedItems = order.items.map((it) => {
      if (it.station === "BARTENDER" && (it.status ?? "NUEVO") === "NUEVO") {
        return {
          ...it,
          status: "EN_PREPARACION" as const,
          prepStartedAt: now,
          cookUserId: auth.user.id,
          cookUserName: bartenderName,
        };
      }
      return it;
    });

    const patch = {
      status: "EN_PREPARACION" as const,
      items: updatedItems,
      updatedAt: now,
    };

    await ctx.db.patch(order._id, patch);
    return { ...order, ...patch };
  },
});

/**
 * Aviso de comanda lista en bar: 'EN_PREPARACION' | 'NUEVO' -> 'LISTO'
 */
export const markBartenderReady = mutation({
  args: {
    orderId: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO"],
      { actionDescription: "marcar comanda lista en bar" }
    );

    const order = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
      .first();

    if (!order) {
      throw new Error(`Comanda con ID ${args.orderId} no encontrada`);
    }

    const now = Date.now();
    const updatedItems = order.items.map((it) => {
      if (it.station === "BARTENDER") {
        return {
          ...it,
          status: "LISTO" as const,
          readyAt: now,
        };
      }
      return it;
    });

    const allReady = updatedItems.every(
      (it) => it.status === "LISTO" || it.status === "SERVIDO" || it.status === "CANCELADO"
    );

    const patch = {
      status: allReady ? ("LISTO" as const) : ("EN_PREPARACION" as const),
      readyAt: allReady ? now : order.readyAt,
      items: updatedItems,
      updatedAt: now,
    };

    await ctx.db.patch(order._id, patch);

    const notifTitle = "PEDIDO LISTO PARA RECOGER";
    const notifMsg = `Mesa ${order.tableName} (Orden #${order.orderNumber}): Bebidas listas para recoger (Barra)`;

    // Notificar al dependiente responsable
    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: notifTitle,
      message: notifMsg,
      targetRole: "DEPENDIENTE",
      targetUserId: order.waiterId,
      orderId: order.id,
      timestamp: now,
      isRead: false,
    });

    if (order.waiterId) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotificationToUser, {
        userId: order.waiterId,
        title: notifTitle,
        message: notifMsg,
        type: "DEPENDIENTE",
        orderId: order.id,
      });
    }

    return { ...order, ...patch };
  },
});

/**
 * Marca un producto individual de bar como LISTO: 'NUEVO' | 'EN_PREPARACION' -> 'LISTO'
 * Notifica al dependiente asignado indicando el nombre de la bebida lista.
 */
export const markBartenderItemReady = mutation({
  args: {
    orderId: v.string(),
    itemId: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO"],
      { actionDescription: "marcar bebida de bar como lista" }
    );

    const order = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
      .first();

    if (!order) {
      throw new Error(`Comanda con ID ${args.orderId} no encontrada`);
    }

    const now = Date.now();
    let targetItemName = "Bebida de barra";
    const updatedItems = order.items.map((it) => {
      if (it.id === args.itemId || it.menuItemId === args.itemId) {
        targetItemName = it.itemName;
        return {
          ...it,
          status: "LISTO" as const,
          readyAt: now,
        };
      }
      return it;
    });

    const allBartenderReady = updatedItems
      .filter((it) => (it.station ?? "COCINA") === "BARTENDER")
      .every((it) => it.status === "LISTO" || it.status === "SERVIDO" || it.status === "CANCELADO");

    const allReady = updatedItems.every(
      (it) => it.status === "LISTO" || it.status === "SERVIDO" || it.status === "CANCELADO"
    );

    const patch = {
      status: allReady ? ("LISTO" as const) : ("EN_PREPARACION" as const),
      readyAt: allReady ? now : order.readyAt,
      items: updatedItems,
      updatedAt: now,
    };

    await ctx.db.patch(order._id, patch);

    const notifTitle = "PEDIDO LISTO PARA RECOGER";
    const notifMsg = `Mesa ${order.tableName} (Orden #${order.orderNumber}): ${targetItemName} listo para recoger (Barra)`;

    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: notifTitle,
      message: notifMsg,
      targetRole: "DEPENDIENTE",
      targetUserId: order.waiterId,
      orderId: order.id,
      timestamp: now,
      isRead: false,
    });

    if (order.waiterId) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotificationToUser, {
        userId: order.waiterId,
        title: notifTitle,
        message: notifMsg,
        type: "DEPENDIENTE",
        orderId: order.id,
      });
    }

    return { ...order, ...patch };
  },
});

/**
 * Confirmación de entrega en mesa: 'LISTO' -> 'SERVIDO'
 */
/**
 * Marca como SERVIDO EN MESA todos los artículos de una estación específica (COCINA o BARTENDER)
 * que se encuentren en estado LISTO.
 */
export const markStationServed = mutation({
  args: {
    orderId: v.string(),
    station: v.union(v.literal("COCINA"), v.literal("BARTENDER")),
    servedByUserId: v.string(),
    userId: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.servedByUserId || args.userId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE"],
      { actionDescription: "marcar platos de estación como servidos" }
    );

    const order = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
      .first();

    if (!order) throw new Error(`Orden con ID ${args.orderId} no encontrada`);

    const now = Date.now();
    let anyChanged = false;
    const updatedItems = order.items.map((it) => {
      const itemStation = it.station ?? "COCINA";
      if (itemStation === args.station) {
        const canServe = args.station === "BARTENDER"
          ? (it.status !== "SERVIDO" && it.status !== "PAGADO" && it.status !== "CANCELADO")
          : (it.status === "LISTO" || it.status === "ENTREGADO" || !!it.deliveredToWaiterAt);

        if (canServe) {
          anyChanged = true;
          return {
            ...it,
            status: "SERVIDO" as const,
            servedAt: now,
            servedByUserId: auth.user.id,
          };
        }
      }
      return it;
    });

    if (!anyChanged) {
      // Idempotencia real: si los ítems de esta estación ya fueron servidos previamente,
      // considerar la operación como exitosa (reintento repetido) sin lanzar error.
      const stationItems = order.items.filter(it => (it.station ?? "COCINA") === args.station);
      const allStationServedOrNonPending = stationItems.length > 0 && stationItems.every(
        it => it.status === "SERVIDO" || it.status === "PAGADO" || it.status === "CANCELADO"
      );

      if (allStationServedOrNonPending || stationItems.length === 0) {
        return order;
      }

      if (args.station === "BARTENDER") {
        throw new Error("No hay productos de Barra pendientes de servicio en esta orden.");
      } else {
        throw new Error("No hay productos en estado 'LISTO' para Cocina en esta orden.");
      }
    }

    // Calcular nuevo estado global de la orden
    const allServed = updatedItems.every(
      (it) => it.status === "SERVIDO" || it.status === "PAGADO" || it.status === "CANCELADO"
    );

    const patch: Record<string, any> = {
      items: updatedItems,
      updatedAt: now,
    };

    if (allServed && order.status !== "PAGADO") {
      patch.status = "SERVIDO" as const;
      patch.servedAt = now;
      patch.servedByUserId = auth.user.id;
    }

    await ctx.db.patch(order._id, patch);
    return { ...order, ...patch };
  },
});

/**
 * Crea una solicitud de cobro (Parcial o Total) para el Cajero.
 */
export const createPaymentRequest = mutation({
  args: {
    orderId: v.string(),
    station: v.union(v.literal("COCINA"), v.literal("BARTENDER"), v.literal("TOTAL")),
    requestType: v.union(v.literal("PARCIAL"), v.literal("TOTAL")),
    waiterId: v.string(),
    idempotencyKey: v.string(),
    jornadaId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.waiterId },
      ["ADMIN_GENERAL", "DUENO", "DEPENDIENTE"],
      { actionDescription: "solicitar cobro de comanda" }
    );

    // Verificar idempotencia
    const existing = await ctx.db
      .query("payment_requests")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
    if (existing) return existing;

    const order = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
      .first();

    if (!order) throw new Error(`Comanda con ID ${args.orderId} no encontrada`);

    // Verificar si esta orden está incluida en una solicitud conjunta de mesa pendiente
    const pendingJointRequests = await ctx.db
      .query("payment_requests")
      .withIndex("by_status", (q) => q.eq("status", "PENDIENTE"))
      .filter((q) => q.eq(q.field("requestType"), "JOINT_TABLE"))
      .collect();
    
    const isIncludedInJoint = pendingJointRequests.some(jr => 
      jr.groupedOrders?.some(go => go.orderId === args.orderId)
    );

    if (isIncludedInJoint) {
      throw new Error(`La Orden #${order.orderNumber} ya está incluida en una solicitud de cobro conjunto de mesa pendiente. Procésela o cancélela antes de solicitar cobro individual.`);
    }

    // Filtrar ítems para cobrar: artículos de la estación que no estén PAGADOS ni CANCELADOS
    const itemsToPay = order.items.filter((it) => {
      const itemSt = (it.station === "BARTENDER") ? "BARTENDER" : "COCINA";
      const matchStation = args.station === "TOTAL" || itemSt === args.station;
      const isPayable = it.status !== "PAGADO" && it.status !== "CANCELADO";
      return matchStation && isPayable;
    });

    if (itemsToPay.length === 0) {
      throw new Error(`No hay artículos pendientes de cobro para ${args.station} en esta orden.`);
    }

    // REFUERZO: Validar que todos los productos a cobrar estén SERVIDOS
    const unservedItems = itemsToPay.filter(it => it.status !== "SERVIDO");
    if (unservedItems.length > 0) {
      throw new Error(`No se puede solicitar el cobro: tiene ${unservedItems.length} productos pendientes de servicio (${args.station}). Márquelos como servidos primero.`);
    }

    const amountRequested = itemsToPay.reduce((sum, it) => sum + it.subtotalCup, 0);
    
    // Calcular pagos anteriores (ítems ya pagados)
    const previousPayments = order.items
      .filter((it) => it.status === "PAGADO")
      .reduce((sum, it) => sum + it.subtotalCup, 0);
    
    const pendingBalance = Math.max(0, order.totalCup - previousPayments - amountRequested);

    const now = Date.now();

    // Si ya existe una solicitud PENDIENTE para la misma orden y estación (o si es TOTAL),
    // actualizar para evitar duplicados o solapamientos en el panel de Caja.
    const pendingForOrder = await ctx.db
      .query("payment_requests")
      .withIndex("by_status", (q) => q.eq("status", "PENDIENTE"))
      .filter((q) => q.eq(q.field("orderId"), args.orderId))
      .collect();

    const existingExact = pendingForOrder.find(p => p.station === args.station);
    if (existingExact) {
      await ctx.db.patch(existingExact._id, {
        station: args.station,
        requestType: args.requestType,
        items: itemsToPay.map(it => ({
          id: it.id,
          itemName: it.itemName,
          quantity: it.quantity,
          subtotalCup: it.subtotalCup,
        })),
        amountRequested,
        requestedAmount: amountRequested,
        previousPayments,
        pendingBalance,
        waiterId: auth.user.id,
        waiterName: auth.user.fullName || auth.user.username,
        requestedAt: now,
        idempotencyKey: args.idempotencyKey,
        jornadaId: args.jornadaId,
        isConsolidated: false,
      });

      await ctx.db.patch(order._id, {
        status: "PENDIENTE_COBRO",
        paymentRequestedAt: now,
        updatedAt: now,
      });

      return {
        ...existingExact,
        station: args.station,
        requestType: args.requestType,
        items: itemsToPay.map(it => ({
          id: it.id,
          itemName: it.itemName,
          quantity: it.quantity,
          subtotalCup: it.subtotalCup,
        })),
        amountRequested,
        requestedAmount: amountRequested,
        previousPayments,
        pendingBalance,
        waiterId: auth.user.id,
        waiterName: auth.user.fullName || auth.user.username,
        requestedAt: now,
      };
    }

    if (args.station === "TOTAL") {
      // Cancelar solicitudes parciales previas en PENDIENTE para no duplicar importes en Caja
      for (const pr of pendingForOrder) {
        if (pr.status === "PENDIENTE") {
          await ctx.db.patch(pr._id, { status: "CANCELADO" as const });
        }
      }
    }

    const requestId = crypto.randomUUID();
    const requestDoc = {
      id: requestId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableName: order.tableName,
      station: args.station,
      requestType: args.requestType,
      items: itemsToPay.map(it => ({
        id: it.id,
        itemName: it.itemName,
        quantity: it.quantity,
        subtotalCup: it.subtotalCup,
      })),
      amountRequested,
      requestedAmount: amountRequested,
      previousPayments,
      pendingBalance,
      waiterId: auth.user.id,
      waiterName: auth.user.fullName || auth.user.username,
      requestedAt: now,
      status: "PENDIENTE" as const,
      idempotencyKey: args.idempotencyKey,
      jornadaId: args.jornadaId,
      isConsolidated: false,
    };

    await ctx.db.insert("payment_requests", requestDoc);

    // Actualizar estado de la orden a PENDIENTE_COBRO
    await ctx.db.patch(order._id, {
      status: "PENDIENTE_COBRO",
      paymentRequestedAt: now,
      updatedAt: now,
    });

    // Notificar al Cajero
    const stationLabel = args.station === "TOTAL" ? "TOTAL" : (args.station === "COCINA" ? "Cocina" : "Barra");
    const payReqTitle = `Cobro ${args.requestType} (${stationLabel}) — ${order.tableName}`;
    const payReqMsg = `Mesa ${order.tableName} (#${order.orderNumber}) solicita cobro de $${amountRequested.toFixed(2)} CUP por ${requestDoc.waiterName}`;
    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: payReqTitle,
      message: payReqMsg,
      targetRole: "CAJERO",
      orderId: order.id,
      timestamp: now,
      isRead: false,
    });
    await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotificationToRole, {
      role: "CAJERO",
      title: payReqTitle,
      message: payReqMsg,
      type: "CAJERO",
      orderId: order.id,
    });

    return requestDoc;
  },
});

/**
 * Crea una solicitud de cobro total agrupado para toda una mesa.
 * Incluye todas las órdenes activas de la mesa que tengan saldo pendiente,
 * siempre que todos sus artículos pendientes estén SERVIDOS.
 */
export const createJointTablePaymentRequest = mutation({
  args: {
    tableId: v.string(),
    waiterId: v.string(),
    idempotencyKey: v.string(),
    jornadaId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.waiterId },
      ["ADMIN_GENERAL", "DUENO", "DEPENDIENTE"],
      { actionDescription: "solicitar cobro conjunto de mesa" }
    );

    // 1. Verificar idempotencia
    const existing = await ctx.db
      .query("payment_requests")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
    if (existing) return existing;

    // 2. Obtener mesa para validar nombre
    const table = await ctx.db
      .query("restaurant_tables")
      .withIndex("by_custom_id", (q) => q.eq("id", args.tableId))
      .first();
    if (!table) throw new Error("Mesa no encontrada");

    // Verificar si ya existe una solicitud conjunta pendiente para esta mesa
    const tableJointPending = await ctx.db
      .query("payment_requests")
      .withIndex("by_status", (q) => q.eq("status", "PENDIENTE"))
      .filter((q) => q.and(q.eq(q.field("requestType"), "JOINT_TABLE"), q.eq(q.field("tableId"), args.tableId)))
      .first();
    
    if (tableJointPending) return tableJointPending;

    // 3. Buscar todas las órdenes activas de esta mesa con saldo pendiente
    const orders = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();

    const activeOrders = orders.filter(o => 
      o.status !== "PAGADO" && o.status !== "CANCELADO"
    );

    if (activeOrders.length === 0) {
      throw new Error(`No hay órdenes pendientes de cobro en ${table.name}.`);
    }

    // 4. Validaciones de Servicio y Conflictos
    const groupedOrdersData = [];
    const allItemsToPay: any[] = [];
    let totalAmountRequested = 0;
    let totalPreviousPayments = 0;

    for (const order of activeOrders) {
      // a) Verificar si hay una solicitud individual pendiente para esta orden
      const pendingRequest = await ctx.db
        .query("payment_requests")
        .withIndex("by_order", (q) => q.eq("orderId", order.id))
        .filter((q) => q.eq(q.field("status"), "PENDIENTE"))
        .first();
      
      if (pendingRequest) {
        throw new Error(`La Orden #${order.orderNumber} ya tiene una solicitud de cobro pendiente (${pendingRequest.station}). Resuélvala antes de solicitar cobro conjunto.`);
      }

      // b) Filtrar ítems pendientes
      const pendingItems = order.items.filter(it => it.status !== "PAGADO" && it.status !== "CANCELADO");
      
      if (pendingItems.length === 0) continue; // Orden técnica ya pagada en ítems pero no en status global (raro)

      // c) Validar que todos estén SERVIDOS
      const unservedItems = pendingItems.filter(it => it.status !== "SERVIDO");
      if (unservedItems.length > 0) {
        throw new Error(`No se puede cobrar la Orden #${order.orderNumber} en ${table.name}: tiene ${unservedItems.length} productos sin servir.`);
      }

      const orderAmountRequested = pendingItems.reduce((sum, it) => sum + it.subtotalCup, 0);
      const orderPreviousPayments = order.items
        .filter(it => it.status === "PAGADO")
        .reduce((sum, it) => sum + it.subtotalCup, 0);
      
      const orderPendingBalance = order.totalCup - orderPreviousPayments - orderAmountRequested;

      groupedOrdersData.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        amountRequested: orderAmountRequested,
        previousPayments: orderPreviousPayments,
        pendingBalance: orderPendingBalance,
      });

      pendingItems.forEach(it => {
        allItemsToPay.push({
          id: it.id,
          itemName: it.itemName,
          quantity: it.quantity,
          subtotalCup: it.subtotalCup,
          orderId: order.id,
        });
      });

      totalAmountRequested += orderAmountRequested;
      totalPreviousPayments += orderPreviousPayments;
    }

    if (groupedOrdersData.length === 0) {
      throw new Error("No hay saldos pendientes reales para procesar en esta mesa.");
    }

    const now = Date.now();
    const requestId = crypto.randomUUID();
    const requestDoc = {
      id: requestId,
      tableId: table.id,
      tableName: table.name,
      station: "TOTAL" as const,
      requestType: "JOINT_TABLE" as const,
      items: allItemsToPay,
      groupedOrders: groupedOrdersData,
      amountRequested: totalAmountRequested,
      requestedAmount: totalAmountRequested,
      previousPayments: totalPreviousPayments,
      pendingBalance: 0, // En cobro total conjunto de mesa asumimos que el saldo queda en 0 tras este cobro (si se paga todo)
      waiterId: auth.user.id,
      waiterName: auth.user.fullName || auth.user.username,
      requestedAt: now,
      status: "PENDIENTE" as const,
      idempotencyKey: args.idempotencyKey,
      jornadaId: args.jornadaId,
      isConsolidated: false,
    };

    await ctx.db.insert("payment_requests", requestDoc);

    // 5. Marcar las órdenes involucradas como PENDIENTE_COBRO
    for (const order of activeOrders) {
      await ctx.db.patch(order._id, {
        status: "PENDIENTE_COBRO",
        paymentRequestedAt: now,
        updatedAt: now,
      });
    }

    // 6. Notificar al Cajero (Una sola notificación para toda la mesa)
    const jointTitle = `Cobro Conjunto — ${table.name}`;
    const jointMsg = `${table.name} solicita cobro total de ${groupedOrdersData.length} comandas por $${totalAmountRequested.toFixed(2)} CUP (Solicitado por ${requestDoc.waiterName})`;
    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: jointTitle,
      message: jointMsg,
      targetRole: "CAJERO",
      timestamp: now,
      isRead: false,
    });
    await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotificationToRole, {
      role: "CAJERO",
      title: jointTitle,
      message: jointMsg,
      type: "CAJERO",
    });

    return requestDoc;
  },
});


/**
 * Consulta las solicitudes de cobro activas (no consolidadas).
 */
export const listPaymentRequests = query({
  args: {
    status: v.optional(v.union(v.literal("PENDIENTE"), v.literal("CONFIRMADO"), v.literal("CANCELADO"))),
    orderId: v.optional(v.string()),
    jornadaId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetStatus = args.status ?? "PENDIENTE";
    let query: any;

    if (args.jornadaId && args.jornadaId !== "no-active-shift") {
      query = ctx.db.query("payment_requests").withIndex("by_active_jornada", (q) => q.eq("isConsolidated", false).eq("jornadaId", args.jornadaId!));
    } else {
      query = ctx.db.query("payment_requests").withIndex("by_active_jornada", (q) => q.eq("isConsolidated", false));
    }

    query = query.filter((q: any) => q.eq(q.field("status"), targetStatus));

    if (args.orderId !== undefined) {
      query = query.filter((q: any) => q.eq(q.field("orderId"), args.orderId));
    }

    let requests = await query.collect();

    if (requests.length === 0 && args.jornadaId && args.jornadaId !== "no-active-shift") {
      let fallbackQuery = ctx.db.query("payment_requests").filter((q: any) =>
        q.and(
          q.eq(q.field("isConsolidated"), false),
          q.eq(q.field("status"), targetStatus)
        )
      );
      if (args.orderId !== undefined) {
        fallbackQuery = fallbackQuery.filter((q: any) => q.eq(q.field("orderId"), args.orderId));
      }
      requests = await fallbackQuery.collect();
    }

    // Ordenar de más reciente a más antigua
    return requests.sort((a: any, b: any) => b.requestedAt - a.requestedAt);
  },
});

/**
 * Consulta las transacciones de pago realizadas activas (no consolidadas).
 */
export const listPayments = query({
  args: {
    orderId: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    jornadaId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query: any;

    if (args.jornadaId) {
      query = ctx.db.query("restaurant_payments").withIndex("by_jornada_and_consolidated", (q) => q.eq("jornadaId", args.jornadaId!).eq("isConsolidated", false));
    } else {
      query = ctx.db.query("restaurant_payments").filter((q) => q.eq(q.field("isConsolidated"), false));
    }

    if (args.orderId) {
      query = query.filter((q: any) => q.eq(q.field("orderId"), args.orderId));
    }

    if (args.startTime !== undefined && args.endTime !== undefined) {
      query = query.filter((q: any) => q.and(q.gte(q.field("timestamp"), args.startTime!), q.lte(q.field("timestamp"), args.endTime!)));
    }

    return await query.collect();
  },
});

/**
 * Confirmación definitiva de cobro de comanda: 'PENDIENTE_COBRO' | 'SERVIDO' -> 'PAGADO'
 */
export const confirmOrderPayment = mutation({
  args: {
    orderId: v.string(),
    cashierUserId: v.string(),
    cashierUserName: v.string(),
    paymentMethod: v.union(
      v.literal("EFECTIVO"),
      v.literal("TRANSFERENCIA"),
      v.literal("MIXTO")
    ),
    mixedCash: v.optional(v.number()),
    mixedTransfer: v.optional(v.number()),
    paymentRequestId: v.optional(v.string()), // Referencia opcional a una solicitud de cobro
    idempotencyKey: v.optional(v.string()),
    jornadaId: v.optional(v.string()),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.cashierUserId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO"],
      { requiredPermission: "canConfirmPayments", actionDescription: "confirmar cobro de comanda" }
    );

    const now = Date.now();
    const effectiveIdempotencyKey = args.idempotencyKey || (args.paymentRequestId ? `pay_req_${args.paymentRequestId}` : `pay_${args.orderId}_${now}`);

    // 1. Idempotencia estricta: si la transacción ya existe por idempotencyKey o por paymentRequestId
    let existingPayment = await ctx.db
      .query("restaurant_payments")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", effectiveIdempotencyKey))
      .first();

    if (!existingPayment && args.paymentRequestId) {
      existingPayment = await ctx.db
        .query("restaurant_payments")
        .withIndex("by_payment_request", (q) => q.eq("paymentRequestId", args.paymentRequestId!))
        .first();
    }

    if (existingPayment) {
      const existingOrder = await ctx.db
        .query("restaurant_orders")
        .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
        .first();
      return existingOrder ?? { id: args.orderId, status: "PAGADO" };
    }

    // 2. Localizar y validar la orden en el servidor
    const order = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
      .first();

    if (!order) throw new Error(`Comanda con ID ${args.orderId} no encontrada`);
    if (order.status === "PAGADO") throw new Error("La comanda ya está totalmente cobrada.");
    if (order.status === "CANCELADO") throw new Error("La comanda está cancelada y no admite cobros.");

    // Calcular saldo pendiente real actual
    const currentPendingBalance = order.items
      .filter((it) => it.status !== "PAGADO" && it.status !== "CANCELADO")
      .reduce((sum, it) => sum + it.subtotalCup, 0);

    if (currentPendingBalance <= 0.001) {
      throw new Error("La comanda ya está totalmente cobrada. No se admiten pagos adicionales.");
    }

    let updatedItems = [...order.items];
    let requestDoc = null;

    if (args.paymentRequestId) {
      // 3. Validación estricta de la solicitud de cobro en el backend
      requestDoc = await ctx.db
        .query("payment_requests")
        .withIndex("by_custom_id", (q) => q.eq("id", args.paymentRequestId!))
        .first();

      if (!requestDoc) {
        // Si la solicitud ya fue eliminada por haberse procesado previamente, comprobar si ya existe su pago
        const paymentByReq = await ctx.db
          .query("restaurant_payments")
          .withIndex("by_payment_request", (q) => q.eq("paymentRequestId", args.paymentRequestId!))
          .first();
        if (paymentByReq) {
          return order;
        }
        throw new Error(`Solicitud de cobro con ID ${args.paymentRequestId} no encontrada`);
      }
      
      if (requestDoc.status !== "PENDIENTE") {
        throw new Error(`La solicitud de cobro se encuentra en estado ${requestDoc.status} y no puede procesarse.`);
      }

      // Validar correspondencia con la orden
      if (requestDoc.orderId && requestDoc.orderId !== order.id) {
        throw new Error(`La solicitud no coincide con la orden seleccionada (Solicitud: ${requestDoc.orderId}, Orden: ${order.id}).`);
      }

      const requestItemIds = new Set(requestDoc.items.map((it) => it.id));
      const itemsToPay = order.items.filter(
        (it) => requestItemIds.has(it.id) && it.status !== "PAGADO" && it.status !== "CANCELADO"
      );

      if (itemsToPay.length === 0) {
        throw new Error("Los productos de esta solicitud ya han sido cobrados o cancelados.");
      }

      // Comprobar que todos los artículos a cobrar estén SERVIDO EN MESA
      const unserved = itemsToPay.filter((it) => it.status !== "SERVIDO");
      if (unserved.length > 0) {
        const names = unserved.map((i) => `${i.itemName} (${i.status || "NO SERVIDO"})`).join(", ");
        throw new Error(`No se puede cobrar la Orden #${order.orderNumber}: contiene productos no servidos en mesa (${names}).`);
      }

      // Marcar exclusivamente los ítems de esta solicitud como PAGADO
      updatedItems = order.items.map((it) => {
        if (requestItemIds.has(it.id) && it.status !== "PAGADO" && it.status !== "CANCELADO") {
          return { ...it, status: "PAGADO" as const };
        }
        return it;
      });
    } else {
      // Cobro total de la orden
      const pendingItems = order.items.filter((it) => it.status !== "CANCELADO" && it.status !== "PAGADO");
      const unserved = pendingItems.filter((it) => it.status !== "SERVIDO");
      if (unserved.length > 0) {
        const names = unserved.map((i) => `${i.itemName} (${i.status || "NO SERVIDO"})`).join(", ");
        throw new Error(`No se puede liquidar la Orden #${order.orderNumber}: tiene productos pendientes de servicio (${names}).`);
      }

      updatedItems = order.items.map((it) => {
        if (it.status !== "CANCELADO" && it.status !== "PAGADO") {
          return { ...it, status: "PAGADO" as const };
        }
        return it;
      });
    }

    // 4. Calcular en el servidor el importe exacto cobrado en esta transacción
    const amountPaidInThisTransaction = updatedItems.reduce((sum, it, idx) => {
      if (it.status === "PAGADO" && order.items[idx].status !== "PAGADO") {
        return sum + it.subtotalCup;
      }
      return sum;
    }, 0);

    if (amountPaidInThisTransaction <= 0.001) {
      throw new Error("No hay montos pendientes de cobro seleccionados para esta transacción.");
    }

    if (amountPaidInThisTransaction > currentPendingBalance + 0.01) {
      throw new Error("El importe del cobro excede el saldo pendiente real de la orden.");
    }

    // 5. Transición atómica de estados: actualizar orden y eliminar solicitud en la misma mutación
    const allPaid = updatedItems.every((it) => it.status === "PAGADO" || it.status === "CANCELADO");
    const remainingBalance = updatedItems
      .filter((it) => it.status !== "PAGADO" && it.status !== "CANCELADO")
      .reduce((sum, it) => sum + it.subtotalCup, 0);

    const remainingActive = updatedItems.filter((it) => it.status !== "PAGADO" && it.status !== "CANCELADO");
    let nextStatus: "PAGADO" | "SERVIDO" | "EN_PREPARACION" = "PAGADO";
    if (allPaid) {
      nextStatus = "PAGADO";
    } else if (remainingActive.length > 0 && remainingActive.every((it) => it.status === "SERVIDO")) {
      nextStatus = "SERVIDO";
    } else {
      nextStatus = "EN_PREPARACION";
    }

    const patch: Record<string, any> = {
      items: updatedItems,
      status: nextStatus,
      paidAt: allPaid ? now : order.paidAt,
      cashierUserId: auth.user.id,
      cashierUserName: auth.user.fullName || auth.user.username,
      paymentMethod: args.paymentMethod,
      updatedAt: now,
    };

    await ctx.db.patch(order._id, patch);

    // Retirar la solicitud de PAGOS SOLICITADOS eliminando exclusivamente el documento del servidor
    if (requestDoc) {
      await ctx.db.delete(requestDoc._id);
    }

    // 6. Registrar en PAGOS REGISTRADOS (restaurant_payments) de forma atómica e idempotente
    const dateStr = new Date(now).toISOString().split("T")[0];
    const finalJornadaId = args.jornadaId || order.jornadaId || `jornada-${dateStr}`;

    const requestSnapshot = requestDoc
      ? {
          requestType: requestDoc.requestType,
          station: requestDoc.station,
          requestedAt: requestDoc.requestedAt,
          waiterId: requestDoc.waiterId,
          waiterName: requestDoc.waiterName,
          pendingBalance: requestDoc.pendingBalance,
          previousPayments: requestDoc.previousPayments,
        }
      : undefined;

    const itemsToPayDetails = updatedItems
      .filter((it, idx) => it.status === "PAGADO" && order.items[idx].status !== "PAGADO")
      .map((it) => ({
        id: it.id,
        menuItemId: it.menuItemId,
        itemName: it.itemName,
        quantity: it.quantity,
        unitPriceCup: it.unitPriceCup,
        subtotalCup: it.subtotalCup,
      }));

    const paymentId = crypto.randomUUID();
    const paymentDoc = {
      id: paymentId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableId: order.tableId,
      tableName: order.tableName,
      paymentRequestId: args.paymentRequestId,
      amount: amountPaidInThisTransaction,
      method: args.paymentMethod,
      mixedCash: args.mixedCash,
      mixedTransfer: args.mixedTransfer,
      cashierUserId: auth.user.id,
      cashierUserName: auth.user.fullName || auth.user.username,
      timestamp: now,
      items: itemsToPayDetails,
      type: "ORDER_PAYMENT" as const,
      isConsolidated: false,
      jornadaId: finalJornadaId,
      requestSnapshot: requestSnapshot,
      idempotencyKey: effectiveIdempotencyKey,
    };

    await ctx.db.insert("restaurant_payments", paymentDoc);

    // 7. Registro de auditoría
    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: auth.user.id,
      userName: auth.user.fullName || auth.user.username,
      module: "BAR",
      action: allPaid ? "COBRO_ORDEN_TOTAL" : "COBRO_ORDEN_PARCIAL",
      entityId: order.id,
      result: "SUCCESS",
      timestamp: now,
      isOutsideShift: false,
      details: `Cobro ${allPaid ? "TOTAL" : "PARCIAL"} de Orden #${order.orderNumber} (${order.tableName}) por $${amountPaidInThisTransaction.toFixed(2)} CUP con método ${args.paymentMethod}. Saldo restante: $${remainingBalance.toFixed(2)} CUP`,
    });

    // 8. Notificar al dependiente responsable
    const paidLabel = allPaid ? "TOTAL" : "PARCIAL";
    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: `Cobro ${paidLabel} Confirmado — #${order.orderNumber}`,
      message: `Pago de $${amountPaidInThisTransaction.toFixed(2)} CUP confirmado por caja (${order.tableName}).`,
      targetRole: "DEPENDIENTE",
      targetUserId: order.waiterId,
      orderId: order.id,
      timestamp: now,
      isRead: false,
    });

    return { ...order, ...patch };
  },
});

/**
 * Registro de venta directa de Barra (Cajero POS Directo).
 * Permite cobrar productos sin crear órdenes de restaurante previas.
 */
export const registerDirectBarSale = mutation({
  args: {
    cashierUserId: v.string(),
    cashierUserName: v.string(),
    paymentMethod: v.optional(
      v.union(
        v.literal("EFECTIVO"),
        v.literal("TRANSFERENCIA"),
        v.literal("MIXTO")
      )
    ),
    method: v.optional(
      v.union(
        v.literal("EFECTIVO"),
        v.literal("TRANSFERENCIA"),
        v.literal("MIXTO")
      )
    ),
    items: v.array(
      v.object({
        menuItemId: v.string(),
        itemName: v.string(),
        quantity: v.number(),
        unitPriceCup: v.number(),
        subtotalCup: v.number(),
      })
    ),
    totalCup: v.optional(v.number()),
    amount: v.optional(v.number()),
    mixedCash: v.optional(v.number()),
    mixedTransfer: v.optional(v.number()),
    idempotencyKey: v.string(),
    jornadaId: v.optional(v.string()),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Autorización estricta para el Cajero
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.cashierUserId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO"],
      { requiredPermission: "canConfirmPayments", actionDescription: "registrar venta directa de barra" }
    );

    const resolvedMethod = args.paymentMethod || args.method;
    if (!resolvedMethod) {
      throw new Error("Debe especificar un método de pago válido (EFECTIVO, TRANSFERENCIA, MIXTO).");
    }

    const expectedTotal = args.totalCup !== undefined ? args.totalCup : args.amount;
    if (expectedTotal === undefined || expectedTotal <= 0) {
      throw new Error("El importe total de la venta debe ser mayor a cero.");
    }

    if (args.items.length === 0) {
      throw new Error("Debe incluir al menos un producto para registrar una venta directa.");
    }

    // 2. Idempotencia: evitar duplicados por reintentos
    const existing = await ctx.db
      .query("restaurant_payments")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
    if (existing) return existing;

    // 3. Validación de integridad en el servidor (precios y productos de barra)
    let calculatedTotal = 0;
    const validatedItems = [];

    for (const item of args.items) {
      if (item.quantity <= 0) {
        throw new Error(`Cantidad inválida (${item.quantity}) para el producto '${item.itemName}'.`);
      }

      const dbItem = await ctx.db
        .query("menu_items")
        .withIndex("by_custom_id", (q) => q.eq("id", item.menuItemId))
        .first();

      if (!dbItem) throw new Error(`El producto '${item.itemName}' no existe en el catálogo.`);
      if (!dbItem.available) throw new Error(`El producto '${dbItem.name}' no está disponible actualmente.`);

      const station = determineItemStation(dbItem.category);
      if (station !== "BARTENDER") {
        throw new Error(`El producto '${dbItem.name}' no pertenece a las categorías de Barra.`);
      }

      const itemSubtotal = item.quantity * dbItem.priceCup!;
      calculatedTotal += itemSubtotal;

      validatedItems.push({
        id: crypto.randomUUID(),
        menuItemId: item.menuItemId,
        itemName: dbItem.name,
        quantity: item.quantity,
        unitPriceCup: dbItem.priceCup!,
        subtotalCup: itemSubtotal,
      });
    }

    // Comprobación de total con margen de error para decimales
    if (Math.abs(calculatedTotal - expectedTotal) > 0.1) {
      throw new Error("El importe total no coincide con los precios vigentes del catálogo.");
    }

    // Validación estricta para pago mixto
    if (resolvedMethod === "MIXTO") {
      const cash = args.mixedCash ?? 0;
      const transfer = args.mixedTransfer ?? 0;
      if (Math.abs(cash + transfer - calculatedTotal) > 0.1) {
        throw new Error(`La suma de efectivo ($${cash}) y transferencia ($${transfer}) no coincide con el total ($${calculatedTotal}).`);
      }
    }

    const now = Date.now();
    const dateStr = new Date(now).toISOString().split("T")[0];
    const finalJornadaId = args.jornadaId || `jornada-${dateStr}`;
    const paymentId = crypto.randomUUID();

    // 4. Registro de la transacción como VENTA DIRECTA DE BARRA directamente en restaurant_payments
    const paymentDoc = {
      id: paymentId,
      tableName: "VENTA DIRECTA DE BARRA",
      amount: calculatedTotal,
      method: resolvedMethod,
      mixedCash: resolvedMethod === "MIXTO" ? args.mixedCash : undefined,
      mixedTransfer: resolvedMethod === "MIXTO" ? args.mixedTransfer : undefined,
      cashierUserId: auth.user.id,
      cashierUserName: auth.user.fullName || auth.user.username,
      timestamp: now,
      type: "DIRECT_BAR_SALE" as const,
      items: validatedItems,
      isConsolidated: false,
      jornadaId: finalJornadaId,
      idempotencyKey: args.idempotencyKey,
    };

    const docId = await ctx.db.insert("restaurant_payments", paymentDoc);

    // 5. Registro en auditoría
    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: auth.user.id,
      userName: auth.user.fullName || auth.user.username,
      module: "BAR",
      action: "VENTA_DIRECTA_BARRA",
      entityId: paymentId,
      result: "SUCCESS",
      timestamp: now,
      isOutsideShift: false,
      details: `Venta directa registrada: ${validatedItems.length} producto(s) por $${calculatedTotal.toFixed(2)} CUP.`,
    });

    return { _id: docId, ...paymentDoc };
  },
});

/**
 * Cancelación autorizada de comanda: -> 'CANCELADO'
 *
 * Reglas de matriz de estados:
 * 1. RECIBIDA ('NUEVO'): Permitido a DEPENDIENTE (área != 'TIENDA'), ADMIN_GENERAL y DUENO_CAJERO.
 * 2. EN_PREPARACION, LISTO, SERVIDO, PENDIENTE_COBRO, PAGADO: Prohibido anular por DEPENDIENTE.
 */
export const cancelOrder = mutation({
  args: {
    orderId: v.string(),
    reason: v.optional(v.string()),
    cancelledByUserId: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.cancelledByUserId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE"],
      { actionDescription: "cancelar orden de restaurante" }
    );

    if (auth.user.role === "DEPENDIENTE" && auth.user.assignedArea === "TIENDA") {
      throw new Error("Acceso denegado: tu área asignada es TIENDA. No tienes permiso para anular órdenes de Bar.");
    }

    const order = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
      .first();

    if (!order) {
      throw new Error(`Orden con ID ${args.orderId} no encontrada`);
    }

    if (order.status === "CANCELADO") {
      return order;
    }

    if (auth.user.role === "DEPENDIENTE") {
      if (order.status !== "NUEVO") {
        if (order.status === "EN_PREPARACION") {
          throw new Error(`No es posible anular la Orden #${order.orderNumber} porque ya se encuentra en preparación en Cocina.`);
        }
        if (order.status === "LISTO" || order.status === "SERVIDO") {
          throw new Error(`No es posible anular la Orden #${order.orderNumber} porque su estado es '${order.status}'.`);
        }
        throw new Error(`No tienes permisos para anular órdenes en estado '${order.status}'.`);
      }
    }

    if (order.status === "PAGADO") {
      throw new Error(
        `No es posible cancelar la orden #${order.orderNumber} porque ya ha sido cobrada y liquidada.`
      );
    }

    const trimmedReason = args.reason?.trim() || "Anulación confirmada por usuario";
    const now = Date.now();
    const patch = {
      status: "CANCELADO" as const,
      cancelledAt: now,
      cancellationReason: trimmedReason,
      cancelledByUserId: auth.user.id,
      updatedAt: now,
    };

    await ctx.db.patch(order._id, patch);
    return { ...order, ...patch };
  },
});

/**
 * Modificación de platos y cantidades de una orden activa.
 * Aplica la matriz de estados:
 * - RECIBIDA ('NUEVO'): permite modificar cantidades y platos. Si se vacían todos los platos, anula la orden.
 * - EN_PREPARACION: permite modificar cantidades y retirar platos (manteniendo al menos 1). No permite anular completa.
 * - LISTO / SERVIDO / PENDIENTE_COBRO / PAGADO / CANCELADO: bloquea toda modificación.
 */
export const updateOrderItems = mutation({
  args: {
    orderId: v.string(),
    items: v.array(OrderItemValidator),
    generalNotes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE"],
      { actionDescription: "modificar platos de la orden" }
    );

    if (auth.user.role === "DEPENDIENTE" && auth.user.assignedArea === "TIENDA") {
      throw new Error("Acceso denegado: tu área asignada es TIENDA. No tienes permiso para modificar órdenes de Bar.");
    }

    const order = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
      .first();

    if (!order) {
      throw new Error(`Orden con ID ${args.orderId} no encontrada`);
    }

    // Matriz de reglas por estado
    if (order.status === "LISTO" || order.status === "SERVIDO" || order.status === "PENDIENTE_COBRO") {
      throw new Error(`La Orden #${order.orderNumber} se encuentra en estado '${order.status}' y no permite modificaciones.`);
    }
    if (order.status === "PAGADO" || order.status === "CANCELADO") {
      throw new Error(`La Orden #${order.orderNumber} está ${order.status.toLowerCase()} y no se puede modificar.`);
    }

    const now = Date.now();
    const isOrderStarted =
      order.status !== "NUEVO" ||
      (typeof order.prepStartedAt === "number" && order.prepStartedAt > 0);
    const hasItemStarted = order.items.some(isItemPrepStarted);
    const prepStarted = isOrderStarted || hasItemStarted;

    // Caso: la orden se queda sin platos
    if (!args.items || args.items.length === 0) {
      if (prepStarted) {
        throw new Error(
          "No es posible retirar todos los platos de una orden cuya preparación ya ha comenzado. Mantén al menos los artículos en preparación activos."
        );
      }
      // En estado RECIBIDA ('NUEVO'), al vaciar la orden se anula automáticamente
      const patch = {
        status: "CANCELADO" as const,
        cancelledAt: now,
        cancellationReason: "Orden vaciada por el usuario",
        cancelledByUserId: auth.user.id,
        items: [],
        totalCup: 0,
        updatedAt: now,
      };
      await ctx.db.patch(order._id, patch);
      return { ...order, ...patch };
    }

    // Si la preparación ya comenzó en algún producto, no permitir retirar ni reducir ese producto
    if (prepStarted) {
      const startedItems = order.items.filter(isItemPrepStarted);
      for (const started of startedItems) {
        const matched = args.items.find(
          (ai) => (ai.id && ai.id === started.id) || ai.menuItemId === started.menuItemId
        );
        if (!matched) {
          throw new Error(
            `No es posible retirar '${started.itemName}' porque su preparación ya ha comenzado en ${started.station}.`
          );
        }
        if (matched.quantity < started.quantity) {
          throw new Error(
            `No es posible reducir la cantidad de '${started.itemName}' porque su preparación ya ha comenzado en ${started.station}.`
          );
        }
      }
    }

    let calculatedTotal = 0;
    const validatedItems = [];

    for (const item of args.items) {
      if (item.quantity <= 0) {
        throw new Error(`Cantidad inválida para '${item.itemName}': debe ser al menos 1`);
      }
      if (item.unitPriceCup < 0 || item.subtotalCup < 0) {
        throw new Error(`Importe inválido para '${item.itemName}'`);
      }

      // Validar existencia en carta
      const menuItem = await ctx.db
        .query("menu_items")
        .withIndex("by_custom_id", (q) => q.eq("id", item.menuItemId))
        .first();

      if (!menuItem) {
        throw new Error(`Plato o bebida '${item.itemName}' no existe en la carta del restaurante`);
      }

      const existingItem = order.items.find(
        (ei) => (ei.id && ei.id === item.id) || ei.menuItemId === item.menuItemId
      );
      const isExistingStarted = existingItem && isItemPrepStarted(existingItem);

      let station: "COCINA" | "BARTENDER";
      let status: "NUEVO" | "EN_PREPARACION" | "LISTO" | "ENTREGADO" | "SERVIDO" | "PENDIENTE_COBRO" | "PAGADO" | "CANCELADO" = "NUEVO";
      let prepStartedAt: number | undefined = undefined;
      let readyAt: number | undefined = undefined;
      let cookUserId: string | undefined = undefined;
      let cookUserName: string | undefined = undefined;

      if (!prepStarted) {
        // REGLA 1: Si NINGÚN artículo de la orden ha iniciado preparación, recalculamos
        // todas las asignaciones según la regla central única del catálogo actual.
        station = determineItemStation(menuItem.category);
      } else {
        // REGLA 2: Si la preparación ya comenzó en alguna estación, protegemos las asignaciones.
        if (existingItem) {
          // Mantener la estación asignada originalmente para artículos existentes
          station = existingItem.station ?? determineItemStation(menuItem.category);
          status = existingItem.status ?? "NUEVO";
          prepStartedAt = existingItem.prepStartedAt;
          readyAt = existingItem.readyAt;
          cookUserId = existingItem.cookUserId;
          cookUserName = existingItem.cookUserName;
        } else {
          // Artículos nuevos incorporados a una orden ya iniciada siguen la regla central
          station = determineItemStation(menuItem.category);
        }
      }

      calculatedTotal += item.subtotalCup;
      validatedItems.push({
        id: item.id?.trim() || crypto.randomUUID(),
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPriceCup: item.unitPriceCup,
        subtotalCup: item.subtotalCup,
        notes: item.notes?.trim() || "",
        station,
        status,
        prepStartedAt,
        readyAt,
        cookUserId,
        cookUserName,
      });
    }

    let addedKitchenCount = 0;
    let addedBartenderCount = 0;

    for (const newItem of validatedItems) {
      const oldItem = order.items.find(
        (ei) => (ei.id && ei.id === newItem.id) || ei.menuItemId === newItem.menuItemId
      );
      const oldQty = oldItem ? oldItem.quantity : 0;
      const diffQty = newItem.quantity - oldQty;
      if (diffQty > 0) {
        if (newItem.station === "COCINA") {
          addedKitchenCount += diffQty;
        } else if (newItem.station === "BARTENDER") {
          addedBartenderCount += diffQty;
        }
      }
    }

    const waiterName = auth.user.fullName || auth.user.username;
    if (addedKitchenCount > 0) {
      const title = `Actualización Comanda — ${order.tableName}`;
      const msg = `Orden #${order.orderNumber}: ${addedKitchenCount} producto(s) nuevo(s) en cocina por ${waiterName}`;
      await ctx.db.insert("notifications", {
        id: crypto.randomUUID(),
        title,
        message: msg,
        targetRole: "COCINA",
        timestamp: now,
        orderId: order.id,
        isRead: false,
      });
      await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotificationToRole, {
        role: "COCINA",
        title,
        message: msg,
        type: "COCINA",
        orderId: order.id,
      });
    }

    if (addedBartenderCount > 0) {
      const title = `Actualización Orden Bar — ${order.tableName}`;
      const msg = `Orden #${order.orderNumber}: ${addedBartenderCount} bebida(s) nueva(s) en barra por ${waiterName}`;
    }

    const patchData: Record<string, any> = {
      items: validatedItems,
      totalCup: calculatedTotal,
      updatedAt: now,
    };

    if (args.generalNotes !== undefined) {
      patchData.generalNotes = args.generalNotes.trim();
    }

    await ctx.db.patch(order._id, patchData);
    return { ...order, ...patchData };
  },
});

// ==========================================
// CONSOLIDACIÓN DE JORNADA DE COCINA Y REPORTE AL DUEÑO (PROMPT 3.3)
// ==========================================

export const consolidateKitchenShift = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    cookUserId: v.string(),
    cookUserName: v.string(),
    jornadaId: v.string(),
    dateStr: v.string(),
    totalOrdersReceived: v.number(),
    totalAmountReceived: v.number(),
    totalOrdersDelivered: v.number(),
    totalAmountDelivered: v.number(),
    totalOrdersPending: v.number(),
    totalAmountPending: v.number(),
    totalOrdersCancelled: v.number(),
    totalAmountCancelled: v.number(),
    orders: v.array(v.any()),
    aggregatedDishes: v.array(
      v.object({
        menuItemId: v.string(),
        itemName: v.string(),
        quantity: v.number(),
        totalCup: v.number(),
      })
    ),
    idempotencyKey: v.string(),
    notes: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Autenticación de personal autorizado (Cocina o Administración)
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.cookUserId },
      ["ADMIN_GENERAL", "DUENO", "COCINA"],
      { actionDescription: "consolidar jornada de cocina" }
    );

    // 1. Idempotencia estricta para evitar duplicaciones por doble pulsación o reintentos
    const existingConsolidation = await ctx.db
      .query("kitchen_consolidations")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();

    if (existingConsolidation) {
      return {
        success: true,
        consolidationId: existingConsolidation.id,
        jornadaId: existingConsolidation.jornadaId,
        isDuplicate: true,
      };
    }

    const now = Date.now();
    const consId = crypto.randomUUID();

    // 2. Guardar en el Archivo de Cocina
    await ctx.db.insert("kitchen_consolidations", {
      id: consId,
      jornadaId: args.jornadaId,
      dateStr: args.dateStr,
      consolidatedAt: now,
      cookUserId: args.cookUserId,
      cookUserName: args.cookUserName,
      totalOrdersReceived: args.totalOrdersReceived,
      totalAmountReceived: args.totalAmountReceived,
      totalOrdersDelivered: args.totalOrdersDelivered,
      totalAmountDelivered: args.totalAmountDelivered,
      totalOrdersPending: args.totalOrdersPending,
      totalAmountPending: args.totalAmountPending,
      totalOrdersCancelled: args.totalOrdersCancelled,
      totalAmountCancelled: args.totalAmountCancelled,
      orders: args.orders,
      aggregatedDishes: args.aggregatedDishes,
      idempotencyKey: args.idempotencyKey,
      notes: args.notes,
    });

    // 3. Identificar la cuenta real del Dueño (DUENO)
    let ownerUser = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "DUENO"))
      .first();

    if (!ownerUser) {
      ownerUser = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", "dueno"))
        .first();
    }

    if (!ownerUser) {
      ownerUser = await ctx.db
        .query("users")
        .withIndex("by_custom_id", (q) => q.eq("id", "u-dueno"))
        .first();
    }

    const reportId = crypto.randomUUID();

    // 4. Registrar atómicamente el informe en la bandeja del Dueño para auditoría
    await ctx.db.insert("owner_reports", {
      id: reportId,
      reportType: "COCINA",
      targetAudience: "DUEÑO",
      targetOwnerUserId: ownerUser ? ownerUser.id : "u-dueno",
      targetOwnerUserName: ownerUser ? ownerUser.fullName : "Dueno",
      sourceModule: "COCINA",
      sourceUserId: args.cookUserId,
      sourceUserName: args.cookUserName,
      jornadaId: args.jornadaId,
      dateStr: args.dateStr,
      createdAt: now,
      status: "PENDIENTE_REVISION",
      summary: {
        totalOrdersReceived: args.totalOrdersReceived,
        totalAmountReceived: args.totalAmountReceived,
        totalOrdersDelivered: args.totalOrdersDelivered,
        totalAmountDelivered: args.totalAmountDelivered,
        totalOrdersPending: args.totalOrdersPending,
        totalAmountPending: args.totalAmountPending,
        totalOrdersCancelled: args.totalOrdersCancelled,
        totalAmountCancelled: args.totalAmountCancelled,
      },
      details: {
        orders: args.orders,
        aggregatedDishes: args.aggregatedDishes,
        notes: args.notes,
      },
      idempotencyKey: args.idempotencyKey,
    });

    // 5. Enviar notificación individual al Dueño con el informe en formato texto
    const defaultReportText = `INFORME DE JORNADA DE COCINA\n` +
      `Cocinero: ${args.cookUserName}\n` +
      `Jornada: ${args.jornadaId} (${args.dateStr})\n` +
      `Total Órdenes Recibidas: ${args.totalOrdersReceived} ($${args.totalAmountReceived.toFixed(2)} CUP)\n` +
      `Completadas / Entregadas: ${args.totalOrdersDelivered} ($${args.totalAmountDelivered.toFixed(2)} CUP)\n` +
      `Pendientes: ${args.totalOrdersPending} ($${args.totalAmountPending.toFixed(2)} CUP)\n` +
      `Canceladas: ${args.totalOrdersCancelled} ($${args.totalAmountCancelled.toFixed(2)} CUP)`;

    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: `Informe de Cierre de Cocina — ${args.cookUserName}`,
      message: defaultReportText,
      targetUserId: ownerUser ? ownerUser.id : "u-dueno",
      targetRole: "DUENO",
      timestamp: now,
      isRead: false,
    });

    // 6. Marcar las órdenes originales como consolidadas por Cocina
    if (args.orders && Array.isArray(args.orders)) {
      for (const orderSnapshot of args.orders) {
        if (orderSnapshot.id) {
          const orderDoc = await ctx.db
            .query("restaurant_orders")
            .withIndex("by_custom_id", (q) => q.eq("id", orderSnapshot.id))
            .first();
          
          if (orderDoc && !orderDoc.kitchenConsolidationId) {
            await ctx.db.patch(orderDoc._id, {
              kitchenConsolidationId: consId,
              updatedAt: now
            });
          }
        }
      }
    }

    // 7. Registrar log de auditoría
    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: args.cookUserId,
      userName: args.cookUserName,
      module: "BAR",
      action: "CONSOLIDAR_JORNADA_COCINA",
      entityId: consId,
      result: "SUCCESS",
      timestamp: now,
      isOutsideShift: false,
    });

    return {
      success: true,
      consolidationId: consId,
      reportId: reportId,
      jornadaId: args.jornadaId,
      isDuplicate: false,
    };
  },
});

export const listKitchenConsolidations = query({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "COCINA"],
      { actionDescription: "consultar consolidaciones de cocina" }
    );

    let consolidations = await ctx.db
      .query("kitchen_consolidations")
      .withIndex("by_consolidatedAt")
      .order("desc")
      .collect();

    if (user.role === "COCINA") {
      // Mostrar consolidaciones de cocina
      if (args.limit !== undefined && args.limit > 0) {
        return consolidations.slice(0, args.limit);
      }
      return consolidations;
    }

    if (args.limit !== undefined && args.limit > 0) {
      consolidations = consolidations.slice(0, args.limit);
    }

    return consolidations;
  },
});

/**
 * Eliminación explícita e irreversible de una consolidación de Cocina archivada.
 * Disponible únicamente para DUEÑO y COCINA previa confirmación textual requerida.
 */
export const deleteKitchenConsolidation = mutation({
  args: {
    consolidationId: v.string(),
    cookUserId: v.string(),
    confirmationText: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.cookUserId },
      ["ADMIN_GENERAL", "DUENO", "COCINA"],
      { actionDescription: "eliminar consolidación de cocina archivada" }
    );

    const expectedConfirmation = "He descargado y guardado el PDF y deseo eliminar definitivamente esta consolidación";
    if (args.confirmationText.trim() !== expectedConfirmation) {
      throw new Error("Confirmación explícita requerida no coincide. Escriba exactamente: 'He descargado y guardado el PDF y deseo eliminar definitivamente esta consolidación'.");
    }

    const cons = await ctx.db
      .query("kitchen_consolidations")
      .withIndex("by_custom_id", (q) => q.eq("id", args.consolidationId))
      .first();

    if (!cons) {
      throw new Error("Consolidación no encontrada o ya fue eliminada.");
    }

    await ctx.db.delete(cons._id);

    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: args.cookUserId,
      userName: args.cookUserId,
      module: "GENERAL",
      action: "ELIMINAR_CONSOLIDACION_COCINA",
      entityId: args.consolidationId,
      result: "SUCCESS",
      timestamp: Date.now(),
      isOutsideShift: false,
      details: `Consolidación de Cocina ${args.consolidationId} (jornada: ${cons.jornadaId}) eliminada definitivamente por el usuario.`,
    });

    return { success: true, deletedId: args.consolidationId };
  },
});


export const getKitchenConsolidationById = query({
  args: {
    id: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "consultar detalle de consolidación" }
    );

    return await ctx.db
      .query("kitchen_consolidations")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
  },
});

// ==========================================
// CONSOLIDACIÓN DE JORNADA DE CAJA (PROMPT 5.5)
// ==========================================

export const consolidateCashierShift = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    cashierUserId: v.string(),
    cashierUserName: v.string(),
    cashierRole: v.optional(v.string()),
    userId: v.optional(v.string()),
    jornadaId: v.string(),
    dateStr: v.string(),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    totalOrdersPaid: v.number(),
    totalAmountPaid: v.number(),
    totalCashCup: v.number(),
    totalTransferCup: v.number(),
    totalOtherCup: v.number(),
    ordersPaid: v.array(v.any()),
    pendingOrders: v.array(v.any()),
    totalOrdersPending: v.number(),
    totalAmountPending: v.number(),
    cancelledOrders: v.array(v.any()),
    totalOrdersCancelled: v.number(),
    totalAmountCancelled: v.number(),
    cashMovements: v.optional(v.array(v.any())),
    totalCashInCup: v.optional(v.number()),
    totalCashOutCup: v.optional(v.number()),
    payments: v.optional(
      v.array(
        v.object({
          id: v.string(),
          idempotencyKey: v.optional(v.string()),
          paymentRequestId: v.optional(v.string()),
          amount: v.number(),
          timestamp: v.number(),
          cashierUserId: v.optional(v.string()),
          cashierUserName: v.optional(v.string()),
          items: v.optional(
            v.array(
              v.object({
                id: v.optional(v.string()),
                menuItemId: v.optional(v.string()),
                itemName: v.optional(v.string()),
                quantity: v.optional(v.number()),
                unitPriceCup: v.optional(v.number()),
                subtotalCup: v.optional(v.number()),
              })
            )
          ),
          method: v.optional(v.union(v.literal("EFECTIVO"), v.literal("TRANSFERENCIA"), v.literal("MIXTO"))),
          mixedCash: v.optional(v.number()),
          mixedTransfer: v.optional(v.number()),
          orderId: v.optional(v.string()),
          orderIds: v.optional(v.array(v.string())),
          orderNumber: v.optional(v.number()),
          tableId: v.optional(v.string()),
          tableName: v.optional(v.string()),
          type: v.optional(v.union(v.literal("ORDER_PAYMENT"), v.literal("DIRECT_BAR_SALE"))),
          isJoint: v.optional(v.boolean()),
          cashierConsolidationId: v.optional(v.string()),
          isConsolidated: v.optional(v.boolean()),
          jornadaId: v.optional(v.string()),
          requestSnapshot: v.optional(
            v.object({
              requestType: v.optional(v.union(v.literal("PARCIAL"), v.literal("TOTAL"), v.literal("JOINT_TABLE"))),
              station: v.optional(v.union(v.literal("COCINA"), v.literal("BARTENDER"), v.literal("TOTAL"))),
              requestedAt: v.optional(v.number()),
              waiterId: v.optional(v.string()),
              waiterName: v.optional(v.string()),
              pendingBalance: v.optional(v.number()),
              previousPayments: v.optional(v.number()),
            })
          ),
        })
      )
    ),
    idempotencyKey: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 0. Autenticación de personal de caja autorizado (Cajero, Dueño o Admin)
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.cashierUserId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO"],
      { actionDescription: "consolidar jornada de caja" }
    );

    // 1. Idempotencia estricta para evitar duplicaciones
    const existingConsolidation = await ctx.db
      .query("cashier_consolidations")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();

    if (existingConsolidation) {
      return {
        success: true,
        consolidationId: existingConsolidation.id,
        jornadaId: existingConsolidation.jornadaId,
        isDuplicate: true,
      };
    }

    // 2. PROTECCIÓN DE OPERACIONES PENDIENTES
    // Impedir consolidación si existen solicitudes de pago PENDIENTES sin procesar
    const pendingReqs = await ctx.db
      .query("payment_requests")
      .withIndex("by_status", (q) => q.eq("status", "PENDIENTE"))
      .filter((q) => q.eq(q.field("cashierConsolidationId"), undefined))
      .collect();

    if (pendingReqs.length > 0) {
      const tableNames = pendingReqs.map(r => r.tableName).join(", ");
      throw new Error(`No se puede consolidar: existen ${pendingReqs.length} solicitud(es) de pago pendientes (${tableNames}). Procéselas o cancélelas antes de cerrar.`);
    }

    const now = Date.now();
    const consId = crypto.randomUUID();

    // 3. IDENTIFICAR REGISTROS A ARCHIVAR (PAGOS Y SOLICITUDES PROCESADAS)
    // Buscamos todos los registros que NO tienen consolidationId asignado
    const activePayments = await ctx.db
      .query("restaurant_payments")
      .filter((q) => q.eq(q.field("cashierConsolidationId"), undefined))
      .collect();

    const processedRequests = await ctx.db
      .query("payment_requests")
      .filter((q) => 
        q.and(
          q.neq(q.field("status"), "PENDIENTE"),
          q.eq(q.field("cashierConsolidationId"), undefined)
        )
      )
      .collect();

    // Combined map for payments to avoid duplicates while preserving all payments from DB & payload
    const combinedPaymentsMap = new Map<string, any>();

    for (const p of activePayments) {
      const key = p.id || p.idempotencyKey || `db-${Math.random()}`;
      combinedPaymentsMap.set(key, {
        id: p.id,
        idempotencyKey: p.idempotencyKey || "",
        paymentRequestId: p.paymentRequestId,
        amount: p.amount,
        timestamp: p.timestamp,
        cashierUserId: p.cashierUserId || args.cashierUserId,
        cashierUserName: p.cashierUserName || args.cashierUserName,
        items: p.items,
        method: p.method,
        mixedCash: p.mixedCash,
        mixedTransfer: p.mixedTransfer,
        orderId: p.orderId,
        orderIds: p.orderIds,
        orderNumber: p.orderNumber,
        tableId: p.tableId,
        tableName: p.tableName || "",
        type: p.type,
        isJoint: p.isJoint,
        jornadaId: p.jornadaId || args.jornadaId,
        requestSnapshot: p.requestSnapshot,
      });
    }

    if (args.payments && Array.isArray(args.payments)) {
      for (const p of args.payments) {
        if (!p) continue;
        const key = p.id || p.idempotencyKey || `arg-${Math.random()}`;
        if (!combinedPaymentsMap.has(key)) {
          combinedPaymentsMap.set(key, {
            id: p.id || crypto.randomUUID(),
            idempotencyKey: p.idempotencyKey || "",
            paymentRequestId: p.paymentRequestId,
            amount: p.amount || 0,
            timestamp: p.timestamp || now,
            cashierUserId: p.cashierUserId || args.cashierUserId,
            cashierUserName: p.cashierUserName || args.cashierUserName,
            items: p.items,
            method: p.method || "EFECTIVO",
            mixedCash: p.mixedCash,
            mixedTransfer: p.mixedTransfer,
            orderId: p.orderId,
            orderIds: p.orderIds,
            orderNumber: p.orderNumber,
            tableId: p.tableId,
            tableName: p.tableName || "",
            type: p.type,
            isJoint: p.isJoint,
            jornadaId: p.jornadaId || args.jornadaId,
            requestSnapshot: p.requestSnapshot,
          });
        }
      }
    }

    const archivedPayments = Array.from(combinedPaymentsMap.values());

    // a. Guardar en el Archivo de Consolidaciones de Caja (Snapshot inmutable)
    await ctx.db.insert("cashier_consolidations", {
      id: consId,
      jornadaId: args.jornadaId,
      dateStr: args.dateStr,
      consolidatedAt: now,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd || now,
      cashierUserId: args.cashierUserId,
      cashierUserName: args.cashierUserName,
      cashierRole: args.cashierRole || "CAJERO",
      totalOrdersPaid: args.totalOrdersPaid,
      totalAmountPaid: args.totalAmountPaid,
      totalCashCup: args.totalCashCup,
      totalTransferCup: args.totalTransferCup,
      totalOtherCup: args.totalOtherCup,
      ordersPaid: args.ordersPaid,
      pendingOrders: args.pendingOrders,
      totalOrdersPending: args.totalOrdersPending,
      totalAmountPending: args.totalAmountPending,
      cancelledOrders: args.cancelledOrders,
      totalOrdersCancelled: args.totalOrdersCancelled,
      totalAmountCancelled: args.totalAmountCancelled,
      cashMovements: args.cashMovements,
      totalCashInCup: args.totalCashInCup,
      totalCashOutCup: args.totalCashOutCup,
      payments: archivedPayments,
      idempotencyKey: args.idempotencyKey,
      notes: args.notes,
    });

    // b. MARCADO DE DOCUMENTOS TRANSITARIOS COMO CONSOLIDADOS (PARA PERMANENCIA)
    for (const payment of activePayments) {
      await ctx.db.patch(payment._id, {
        cashierConsolidationId: consId,
        isConsolidated: true
      });
    }

    for (const req of processedRequests) {
      await ctx.db.patch(req._id, {
        cashierConsolidationId: consId,
        isConsolidated: true
      });
    }

    // 5. Informe para el Dueño
    let ownerUser = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", "dueno"))
      .first();

    if (!ownerUser) {
      ownerUser = await ctx.db
        .query("users")
        .withIndex("by_custom_id", (q) => q.eq("id", "u-dueno"))
        .first();
    }

    if (!ownerUser) {
      ownerUser = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "DUENO"))
        .first();
    }

    await ctx.db.insert("owner_reports", {
      id: consId,
      reportType: "CAJERO",
      targetAudience: "DUEÑO",
      targetOwnerUserId: ownerUser ? ownerUser.id : "u-dueno",
      targetOwnerUserName: ownerUser ? ownerUser.fullName : "Dueno",
      sourceModule: "CAJERO",
      sourceUserId: args.cashierUserId,
      sourceUserName: args.cashierUserName,
      jornadaId: args.jornadaId,
      dateStr: args.dateStr,
      createdAt: now,
      status: "PENDIENTE_REVISION",
      summary: {
        totalOrdersReceived: args.totalOrdersPaid + args.totalOrdersPending,
        totalAmountReceived: args.totalAmountPaid + args.totalAmountPending,
        totalOrdersDelivered: args.totalOrdersPaid,
        totalAmountDelivered: args.totalAmountPaid,
        totalOrdersPending: args.totalOrdersPending,
        totalAmountPending: args.totalAmountPending,
        totalOrdersCancelled: args.totalOrdersCancelled,
        totalAmountCancelled: args.totalAmountCancelled,
        totalOrdersPaid: args.totalOrdersPaid,
        totalAmountPaid: args.totalAmountPaid,
        totalCashCup: args.totalCashCup,
        totalTransferCup: args.totalTransferCup,
        totalOtherCup: args.totalOtherCup,
      },
      details: {
        consolidationId: consId,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd || now,
        ordersPaid: args.ordersPaid,
        pendingOrders: args.pendingOrders,
        cancelledOrders: args.cancelledOrders,
        cashMovements: args.cashMovements,
        notes: args.notes,
      },
      idempotencyKey: args.idempotencyKey,
    });

    // 6. Marcar todas las órdenes pagadas, canceladas o de pagos activos como consolidadas por Caja
    const allPaidOrderIds = new Set<string>();
    for (const p of archivedPayments) {
      if (p.orderId) allPaidOrderIds.add(p.orderId);
      if (p.orderIds && Array.isArray(p.orderIds)) {
        for (const oid of p.orderIds) {
          if (oid) allPaidOrderIds.add(oid);
        }
      }
    }
    if (args.ordersPaid && Array.isArray(args.ordersPaid)) {
      for (const op of args.ordersPaid) {
        if (op && op.id) allPaidOrderIds.add(op.id);
      }
    }

    const unconsOrders = await ctx.db
      .query("restaurant_orders")
      .filter((q) => q.eq(q.field("cashierConsolidationId"), undefined))
      .collect();

    for (const orderDoc of unconsOrders) {
      if (
        allPaidOrderIds.has(orderDoc.id) ||
        orderDoc.status === "PAGADO" ||
        orderDoc.status === "CANCELADO"
      ) {
        await ctx.db.patch(orderDoc._id, {
          cashierConsolidationId: consId,
          isConsolidated: true,
          updatedAt: now,
        });
      }
    }

    // 7. Registrar log de auditoría
    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: args.cashierUserId,
      userName: args.cashierUserName,
      module: "BAR",
      action: "CONSOLIDAR_JORNADA_CAJA",
      entityId: consId,
      result: "SUCCESS",
      timestamp: now,
      isOutsideShift: false,
    });

    return {
      success: true,
      consolidationId: consId,
      jornadaId: args.jornadaId,
      isDuplicate: false,
    };
  },
});

export const listCashierConsolidations = query({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO"],
      { actionDescription: "consultar consolidaciones de caja" }
    );

    let consolidations = await ctx.db
      .query("cashier_consolidations")
      .withIndex("by_consolidatedAt")
      .order("desc")
      .collect();

    if (args.limit !== undefined && args.limit > 0) {
      consolidations = consolidations.slice(0, args.limit);
    }

    return consolidations;
  },
});

export const getCashierConsolidationById = query({
  args: {
    id: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO"],
      { actionDescription: "consultar detalle de consolidación de caja" }
    );

    return await ctx.db
      .query("cashier_consolidations")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
  },
});

/**
 * Eliminación explícita e irreversible de una consolidación de Caja archivada.
 * Disponible únicamente para DUEÑO y CAJERO previa confirmación textual requerida.
 */
export const deleteCashierConsolidation = mutation({
  args: {
    consolidationId: v.string(),
    cashierUserId: v.string(),
    confirmationText: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.cashierUserId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO"],
      { actionDescription: "eliminar consolidación de caja archivada" }
    );

    const expectedConfirmation = "He descargado y guardado el PDF y deseo eliminar definitivamente esta consolidación";
    if (args.confirmationText.trim() !== expectedConfirmation) {
      throw new Error("Confirmación explícita requerida no coincide. Escriba exactamente: 'He descargado y guardado el PDF y deseo eliminar definitivamente esta consolidación'.");
    }

    const cons = await ctx.db
      .query("cashier_consolidations")
      .withIndex("by_custom_id", (q) => q.eq("id", args.consolidationId))
      .first();

    if (!cons) {
      throw new Error("Consolidación no encontrada o ya fue eliminada.");
    }

    await ctx.db.delete(cons._id);

    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: args.cashierUserId,
      userName: args.cashierUserId,
      module: "BAR",
      action: "ELIMINAR_CONSOLIDACION_CAJA",
      entityId: args.consolidationId,
      result: "SUCCESS",
      timestamp: Date.now(),
      isOutsideShift: false,
      details: `Consolidación de Caja ${args.consolidationId} (jornada: ${cons.jornadaId}) eliminada definitivamente por el usuario.`,
    });

    return { success: true, deletedId: args.consolidationId };
  },
});

export const listOwnerReports = query({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    reportType: v.optional(
      v.union(
        v.literal("COCINA"),
        v.literal("DEPENDIENTE_BAR"),
        v.literal("DEPENDIENTE_TIENDA"),
        v.literal("CAJERO")
      )
    ),
    targetOwnerUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "consultar informes de auditoría del Dueño" }
    );

    let reports = await ctx.db
      .query("owner_reports")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();

    if (args.reportType !== undefined) {
      reports = reports.filter((r) => r.reportType === args.reportType);
    }

    if (args.targetOwnerUserId !== undefined) {
      reports = reports.filter(
        (r) => !r.targetOwnerUserId || r.targetOwnerUserId === args.targetOwnerUserId
      );
    }

    return reports;
  },
});

// ==========================================
// REGISTRO DE TOKENS FCM Y NOTIFICACIONES PUSH A COCINA (PROMPT 3.4)
// ==========================================

export const registerFcmToken = mutation({
  args: {
    userId: v.string(),
    username: v.string(),
    fcmToken: v.string(),
    deviceInfo: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Verificar que el usuario pertenezca estrictamente al rol COCINA
    const user = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", args.userId))
      .first();

    if (!user || !user.active || (user.role !== "COCINA" && user.role !== "ADMIN_GENERAL" && user.role !== "DUENO")) {
      throw new Error("No autorizado: Solo usuarios activos autorizados pueden registrar tokens de notificación push");
    }

    const now = Date.now();

    // 2. Comprobar si ya existe un registro para este token o dispositivo
    const existing = await ctx.db
      .query("fcm_tokens")
      .withIndex("by_fcmToken", (q) => q.eq("fcmToken", args.fcmToken))
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

    // Desactivar tokens antiguos del mismo usuario si cambiaron de dispositivo
    const userTokens = await ctx.db
      .query("fcm_tokens")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const t of userTokens) {
      if (t.deviceInfo === args.deviceInfo && t.active) {
        await ctx.db.patch(t._id, { fcmToken: args.fcmToken, updatedAt: now });
        return { success: true, tokenId: t.id };
      }
    }

    const tokenId = crypto.randomUUID();
    await ctx.db.insert("fcm_tokens", {
      id: tokenId,
      userId: args.userId,
      username: args.username,
      fcmToken: args.fcmToken,
      deviceInfo: args.deviceInfo,
      updatedAt: now,
      active: true,
    });

    return { success: true, tokenId };
  },
});


// ==========================================
// RE-EXPORTACIÓN DE RESERVACIONES (COMPATIBILIDAD WEB Y ANDROID)
// ==========================================
export {
  createPublicReservation,
  submitReservation,
  listReservations,
  getReservations,
  getReservation,
  getReservationById,
  getPublicReservationStatus,
  updateReservationStatus,
  deleteReservation,
  migrateExistingReservationStatuses,
  checkTableAvailability,
  assignTableAndConfirmReservation,
  assignAndConfirmReservation,
} from "./reservations";




// ==========================================


export const purgeLegacyTestOrders = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    adminUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.adminUserId },
      ["ADMIN_GENERAL", "DUENO"],
      { actionDescription: "purgar órdenes de prueba legacy" }
    );

    const allOrders = await ctx.db.query("restaurant_orders").collect();
    let deletedCount = 0;
    const deletedIds: string[] = [];

    for (const ord of allOrders) {
      const isTestOrder =
        ord.generalNotes === "Comanda de prueba" ||
        ord.items.some((it) => it.menuItemId === "test_item_mojito");

      if (isTestOrder) {
        await ctx.db.delete(ord._id);
        deletedCount++;
        deletedIds.push(ord.id);

        const notifs = await ctx.db
          .query("notifications")
          .withIndex("by_orderId", (q) => q.eq("orderId", ord.id))
          .collect();
        for (const n of notifs) {
          await ctx.db.delete(n._id);
        }
      }
    }

    const allReports = await ctx.db.query("owner_reports").collect();
    for (const rep of allReports) {
      const isTestReport =
        rep.sourceUserName?.includes("Administrador") &&
        (rep.summary?.totalAmountReceived === 700 || rep.summary?.totalAmountReceived === 350);
      if (isTestReport) {
        await ctx.db.delete(rep._id);
      }
    }

    return { success: true, deletedCount, deletedIds };
  },
});

// ==========================================
// CONSOLIDACIÓN DE JORNADA DE DEPENDIENTE Y REPORTE AL DUEÑO
// ==========================================

export const consolidateWaiterShift = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    waiterUserId: v.string(),
    waiterUserName: v.string(),
    assignedArea: v.optional(v.string()),
    userId: v.optional(v.string()),
    jornadaId: v.string(),
    dateStr: v.string(),
    totalOrders: v.number(),
    totalAmount: v.number(),
    totalKitchenItems: v.number(),
    totalBartenderItems: v.number(),
    totalPendingOrders: v.number(),
    totalDeliveredOrders: v.number(),
    totalCancelledOrders: v.number(),
    totalPaidOrders: v.number(),
    orders: v.array(v.any()),
    itemsSummary: v.array(
      v.object({
        menuItemId: v.string(),
        itemName: v.string(),
        destination: v.string(),
        quantity: v.number(),
        totalCup: v.number(),
      })
    ),
    idempotencyKey: v.string(),
    notes: v.optional(v.string()),
    reportText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Autenticación del dependiente responsable o administración
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.waiterUserId },
      ["ADMIN_GENERAL", "DUENO", "DEPENDIENTE"],
      { actionDescription: "consolidar jornada de dependiente" }
    );

    // 1. Idempotencia estricta para evitar duplicaciones por doble pulsación o reintentos
    const existingConsolidation =
      (await ctx.db
        .query("waiter_consolidations")
        .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
        .first()) ||
      (await ctx.db
        .query("waiter_consolidations")
        .withIndex("by_jornadaId", (q) => q.eq("jornadaId", args.jornadaId))
        .first());

    if (existingConsolidation) {
      // Reintento o duplicado: asegurar eliminación física de cualquier orden remanente para esa jornada
      const allOrders = await ctx.db.query("restaurant_orders").collect();
      for (const ord of allOrders) {
        const ordDateStr = new Date(ord.createdAt).toISOString().split("T")[0];
        if (
          ordDateStr === args.dateStr ||
          ord.waiterConsolidationId === existingConsolidation.id
        ) {
          await ctx.db.delete(ord._id);
        }
      }

      return {
        success: true,
        consolidationId: existingConsolidation.id,
        jornadaId: existingConsolidation.jornadaId,
        isDuplicate: true,
      };
    }

    // 2. VALIDAR LAS DOS CONSOLIDACIONES PREVIAS (REGLA INNEGOCIABLE)
    // A. CONSOLIDACIÓN DE COCINA
    let kitchenConsolidation = await ctx.db
      .query("kitchen_consolidations")
      .withIndex("by_jornadaId", (q) => q.eq("jornadaId", args.jornadaId))
      .first();
    
    if (!kitchenConsolidation) {
      kitchenConsolidation = await ctx.db
        .query("kitchen_consolidations")
        .withIndex("by_dateStr", (q) => q.eq("dateStr", args.dateStr))
        .first();
    }

    const allShiftOrders = await ctx.db.query("restaurant_orders").collect();
    const shiftOrdersForDate = allShiftOrders.filter((ord) => {
      const ordDateStr = new Date(ord.createdAt).toISOString().split("T")[0];
      return (
        ordDateStr === args.dateStr ||
        ord.waiterId === args.waiterUserId
      );
    });

    const hasKitchenItems = shiftOrdersForDate.some(
      (ord) => ord.items && ord.items.some((it) => it.station === "COCINA")
    );

    if (hasKitchenItems && !kitchenConsolidation) {
      throw new Error(
        "No se puede consolidar la jornada: Falta la consolidación de Cocina para esta jornada. Cocina debe consolidar su turno antes de realizar el cierre definitivo."
      );
    }

    // B. CONSOLIDACIÓN DE CAJERO
    let cashierConsolidation = await ctx.db
      .query("cashier_consolidations")
      .withIndex("by_jornadaId", (q) => q.eq("jornadaId", args.jornadaId))
      .first();

    if (!cashierConsolidation) {
      cashierConsolidation = await ctx.db
        .query("cashier_consolidations")
        .withIndex("by_dateStr", (q) => q.eq("dateStr", args.dateStr))
        .first();
    }

    const hasPaymentsOrPaidOrders = shiftOrdersForDate.some(
      (ord) => ord.status === "PAGADO" || ord.cashierUserId || ord.paidAt
    );

    if (hasPaymentsOrPaidOrders && !cashierConsolidation) {
      throw new Error(
        "No se puede consolidar la jornada: Falta la consolidación de Caja para esta jornada. Cajero debe consolidar su turno antes de realizar el cierre definitivo."
      );
    }

    const now = Date.now();
    const consId = crypto.randomUUID();

    // 3. CONSTRUIR LA COPIA COMPLETA DE ÓRDENES (REGLA #4)
    // Preservar la totalidad de campos existentes de cada orden de la jornada
    const fullOrdersSnapshot = shiftOrdersForDate.map((ord) => ({
      _id: ord._id.toString(),
      id: ord.id,
      tableId: ord.tableId,
      tableName: ord.tableName,
      orderNumber: ord.orderNumber,
      waiterId: ord.waiterId,
      waiterName: ord.waiterName,
      createdAt: ord.createdAt,
      items: ord.items || [],
      generalNotes: ord.generalNotes || "",
      totalCup: ord.totalCup || 0,
      status: ord.status,
      prepStartedAt: ord.prepStartedAt,
      cookUserId: ord.cookUserId,
      cookUserName: ord.cookUserName,
      readyAt: ord.readyAt,
      deliveredToWaiterAt: ord.deliveredToWaiterAt,
      servedAt: ord.servedAt,
      servedByUserId: ord.servedByUserId,
      paymentRequestedAt: ord.paymentRequestedAt,
      paidAt: ord.paidAt,
      cashierUserId: ord.cashierUserId,
      cashierUserName: ord.cashierUserName,
      paymentMethod: ord.paymentMethod,
      cancelledAt: ord.cancelledAt,
      cancellationReason: ord.cancellationReason,
      cancelledByUserId: ord.cancelledByUserId,
      idempotencyKey: ord.idempotencyKey,
      cashierConsolidationId: ord.cashierConsolidationId || cashierConsolidation?.id,
      kitchenConsolidationId: ord.kitchenConsolidationId || kitchenConsolidation?.id,
      waiterConsolidationId: consId,
      updatedAt: ord.updatedAt || now,
    }));

    // 4. VERIFICACIÓN ANTES DE LA ELIMINACIÓN (#5)
    if (shiftOrdersForDate.length > 0 && fullOrdersSnapshot.length !== shiftOrdersForDate.length) {
      throw new Error(
        "Error de integridad: La cantidad de órdenes recopiladas para archivo no coincide con el total de órdenes originales en restaurant_orders."
      );
    }

    // 5. REGISTRAR EN waiter_consolidations
    await ctx.db.insert("waiter_consolidations", {
      id: consId,
      jornadaId: args.jornadaId,
      dateStr: args.dateStr,
      consolidatedAt: now,
      waiterUserId: args.waiterUserId,
      waiterUserName: args.waiterUserName,
      assignedArea: args.assignedArea || "BAR_TERRAZA",
      totalOrders: fullOrdersSnapshot.length,
      totalAmount: fullOrdersSnapshot
        .filter((o) => o.status !== "CANCELADO")
        .reduce((sum, o) => sum + o.totalCup, 0),
      totalKitchenItems: args.totalKitchenItems,
      totalBartenderItems: args.totalBartenderItems,
      totalPendingOrders: fullOrdersSnapshot.filter(
        (o) => o.status !== "SERVIDO" && o.status !== "PAGADO" && o.status !== "CANCELADO"
      ).length,
      totalDeliveredOrders: fullOrdersSnapshot.filter((o) => o.status === "SERVIDO").length,
      totalCancelledOrders: fullOrdersSnapshot.filter((o) => o.status === "CANCELADO").length,
      totalPaidOrders: fullOrdersSnapshot.filter((o) => o.status === "PAGADO").length,
      orders: fullOrdersSnapshot,
      itemsSummary: args.itemsSummary,
      idempotencyKey: args.idempotencyKey,
      notes: args.notes,
      reportText: args.reportText,
    });

    // 6. INFORMES Y NOTIFICACIONES AL DUEÑO
    let ownerUser =
      (await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", "dueno"))
        .first()) ||
      (await ctx.db
        .query("users")
        .withIndex("by_custom_id", (q) => q.eq("id", "u-dueno"))
        .first()) ||
      (await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "DUENO"))
        .first());

    const ownerId = ownerUser ? ownerUser.id : "u-dueno";
    const reportId = consId;

    await ctx.db.insert("owner_reports", {
      id: reportId,
      reportType: "DEPENDIENTE",
      targetAudience: "DUEÑO",
      targetOwnerUserId: ownerId,
      targetOwnerUserName: ownerUser ? ownerUser.fullName : "Dueno",
      sourceModule: "DEPENDIENTE",
      sourceUserId: args.waiterUserId,
      sourceUserName: args.waiterUserName,
      jornadaId: args.jornadaId,
      dateStr: args.dateStr,
      createdAt: now,
      status: "PENDIENTE_REVISION",
      summary: {
        totalOrdersReceived: fullOrdersSnapshot.length,
        totalAmountReceived: args.totalAmount,
        totalOrdersDelivered: args.totalDeliveredOrders,
        totalAmountDelivered: args.totalAmount,
        totalOrdersPending: args.totalPendingOrders,
        totalAmountPending: 0,
        totalOrdersCancelled: args.totalCancelledOrders,
        totalAmountCancelled: 0,
      },
      details: {
        consolidationId: consId,
        assignedArea: args.assignedArea,
        orders: fullOrdersSnapshot,
        itemsSummary: args.itemsSummary,
        notes: args.notes,
        reportText: args.reportText,
      },
      idempotencyKey: args.idempotencyKey,
    });

    const defaultReportText =
      `INFORME DE JORNADA DEL DEPENDIENTE\n` +
      `Dependiente: ${args.waiterUserName}\n` +
      `Jornada: ${args.jornadaId} (${args.dateStr})\n` +
      `Total Órdenes: ${fullOrdersSnapshot.length} ($${args.totalAmount} CUP)\n` +
      `Ítems Cocina: ${args.totalKitchenItems} | Ítems Bar: ${args.totalBartenderItems}\n` +
      `Órdenes Entregadas: ${args.totalDeliveredOrders} | Pendientes: ${args.totalPendingOrders} | Canceladas: ${args.totalCancelledOrders}`;

    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: `Informe de Jornada — Dependiente ${args.waiterUserName}`,
      message: args.reportText || defaultReportText,
      targetUserId: ownerId,
      targetRole: "DUENO",
      timestamp: now,
      isRead: false,
    });

    // 7. ELIMINACIÓN FÍSICA DE LOS DOCUMENTOS ORIGINALES (REGLA #6)
    // Eliminar físicamente todos los documentos de restaurant_orders para esta jornada
    for (const orderDoc of shiftOrdersForDate) {
      await ctx.db.delete(orderDoc._id);

      // Eliminar notificaciones operativas asociadas a esa orden específica
      const orderNotifs = await ctx.db
        .query("notifications")
        .withIndex("by_orderId", (q) => q.eq("orderId", orderDoc.id))
        .collect();
      for (const n of orderNotifs) {
        await ctx.db.delete(n._id);
      }
    }

    // 8. REGISTRAR LOG DE AUDITORÍA
    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: args.waiterUserId,
      userName: args.waiterUserName,
      module: "BAR",
      action: "CONSOLIDAR_JORNADA_DEPENDIENTE",
      entityId: consId,
      result: "SUCCESS",
      timestamp: now,
      isOutsideShift: false,
    });

    return {
      success: true,
      consolidationId: consId,
      reportId: reportId,
      jornadaId: args.jornadaId,
      isDuplicate: false,
    };
  },
});


export const listWaiterConsolidations = query({
  args: {
    sessionToken: v.optional(v.string()),
    waiterUserId: v.optional(v.string()),
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId || args.waiterUserId },
      ["ADMIN_GENERAL", "DUENO", "DEPENDIENTE"],
      { actionDescription: "consultar consolidaciones de dependiente" }
    );

    let consolidations = await ctx.db
      .query("waiter_consolidations")
      .withIndex("by_consolidatedAt")
      .order("desc")
      .collect();

    // Si es un dependiente, ve las suyas por ID o nombre de usuario
    if (user.role === "DEPENDIENTE") {
      const uName = user.username.toLowerCase();
      const fName = user.fullName.toLowerCase();
      consolidations = consolidations.filter(c => 
        c.waiterUserId === user.id || 
        (c.waiterUserName && (c.waiterUserName.toLowerCase() === uName || c.waiterUserName.toLowerCase() === fName))
      );
    }

    if (args.limit) {
      consolidations = consolidations.slice(0, args.limit);
    }
    return consolidations;
  },
});

/**
 * Eliminación irreversible de una consolidación de Dependiente archivada.
 */
export const deleteWaiterConsolidation = mutation({
  args: {
    id: v.string(),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "DEPENDIENTE"],
      { actionDescription: "eliminar consolidación de dependiente" }
    );

    const existing = await ctx.db
      .query("waiter_consolidations")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!existing) throw new Error("Consolidación no encontrada");

    // Solo el propio dependiente o administradores pueden eliminar
    if (auth.user.role === "DEPENDIENTE" && existing.waiterUserId !== auth.user.id) {
       throw new Error("No tienes permiso para eliminar esta consolidación");
    }

    await ctx.db.delete(existing._id);
    return { success: true };
  },
});

export const getWaiterConsolidationById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("waiter_consolidations")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
  },
});



/**
 * Confirmación de cobro conjunto de mesa.
 * Procesa múltiples órdenes asociadas a una solicitud JOINT_TABLE.
 */
export const confirmJointTablePayment = mutation({
  args: {
    paymentRequestId: v.string(),
    cashierUserId: v.string(),
    cashierUserName: v.string(),
    paymentMethod: v.union(
      v.literal("EFECTIVO"),
      v.literal("TRANSFERENCIA"),
      v.literal("MIXTO")
    ),
    mixedCash: v.optional(v.number()),
    mixedTransfer: v.optional(v.number()),
    idempotencyKey: v.string(),
    jornadaId: v.optional(v.string()),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.cashierUserId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO"],
      { requiredPermission: "canConfirmPayments", actionDescription: "confirmar cobro conjunto de mesa" }
    );

    // 1. Verificar idempotencia del pago
    let existingPayment = await ctx.db
      .query("restaurant_payments")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();

    if (!existingPayment && args.paymentRequestId) {
      existingPayment = await ctx.db
        .query("restaurant_payments")
        .withIndex("by_payment_request", (q) => q.eq("paymentRequestId", args.paymentRequestId))
        .first();
    }

    if (existingPayment) return existingPayment;

    // 2. Obtener y validar la solicitud
    const request = await ctx.db
      .query("payment_requests")
      .withIndex("by_custom_id", (q) => q.eq("id", args.paymentRequestId))
      .first();
    
    if (!request) {
      const paymentByReq = await ctx.db
        .query("restaurant_payments")
        .withIndex("by_payment_request", (q) => q.eq("paymentRequestId", args.paymentRequestId))
        .first();
      if (paymentByReq) return paymentByReq;
      throw new Error("Solicitud de cobro no encontrada");
    }

    if (request.requestType !== "JOINT_TABLE") throw new Error("Esta no es una solicitud de cobro conjunto");

    const now = Date.now();
    const orderIds = request.groupedOrders?.map(go => go.orderId) || [];
    if (orderIds.length === 0) throw new Error("La solicitud no contiene órdenes agrupadas");

    // 3. Procesar cada orden incluida
    let totalActualBalance = 0;
    const ordersToPatch = [];

    for (const orderId of orderIds) {
      const order = await ctx.db
        .query("restaurant_orders")
        .withIndex("by_custom_id", (q) => q.eq("id", orderId))
        .first();
      
      if (!order) throw new Error(`Orden ${orderId} no encontrada`);
      if (order.status === "PAGADO") continue; // Ya pagada (posible concurrencia)
      if (order.status === "CANCELADO") throw new Error(`La Orden #${order.orderNumber} está cancelada`);

      // VALIDACIÓN ESTRICTA: Comprobar que todos los productos a cobrar en esta orden estén SERVIDOS
      const pendingItems = order.items.filter(it => it.status !== "PAGADO" && it.status !== "CANCELADO");
      const unservedItems = pendingItems.filter(it => it.status !== "SERVIDO");
      if (unservedItems.length > 0) {
        const names = unservedItems.map(i => `${i.itemName} (${i.status || "NO SERVIDO"})`).join(", ");
        throw new Error(`No se puede confirmar el cobro conjunto: la Orden #${order.orderNumber} en ${order.tableName} tiene productos sin servir (${names}). Deben estar marcados como SERVIDO EN MESA por el Dependiente.`);
      }

      // Identificar ítems para marcar como PAGADO (todos los que no estén cancelados ni pagados)
      const updatedItems = order.items.map(it => {
        if (it.status !== "PAGADO" && it.status !== "CANCELADO") {
          return { ...it, status: "PAGADO" as const };
        }
        return it;
      });

      const orderAmountPaid = updatedItems.filter(it => 
        it.status === "PAGADO" && (order.items.find(oi => oi.id === it.id)?.status !== "PAGADO")
      ).reduce((sum, it) => sum + it.subtotalCup, 0);

      totalActualBalance += orderAmountPaid;

      ordersToPatch.push({
        docId: order._id,
        patch: {
          items: updatedItems,
          status: "PAGADO" as const,
          paidAt: now,
          cashierUserId: auth.user.id,
          cashierUserName: auth.user.fullName || auth.user.username,
          paymentMethod: args.paymentMethod,
          updatedAt: now,
        }
      });
    }

    if (ordersToPatch.length === 0) {
      throw new Error("Todas las órdenes de esta solicitud ya han sido cobradas.");
    }

    // 4. Aplicar cambios atómicos
    for (const op of ordersToPatch) {
      await ctx.db.patch(op.docId, op.patch);
    }

    // Eliminar la solicitud de payment_requests en la misma transacción atómica
    await ctx.db.delete(request._id);

    // 5. Registrar el pago único conjunto con trazabilidad completa
    const dateStr = new Date(now).toISOString().split("T")[0];
    const jornadaId = `jornada-${dateStr}`;

    const requestSnapshot = {
      requestType: request.requestType,
      station: request.station,
      requestedAt: request.requestedAt,
      waiterId: request.waiterId,
      waiterName: request.waiterName,
      pendingBalance: request.pendingBalance,
      previousPayments: request.previousPayments,
    };

    const paymentId = crypto.randomUUID();
    const paymentDoc = {
      id: paymentId,
      tableId: request.tableId,
      tableName: request.tableName,
      paymentRequestId: request.id,
      amount: totalActualBalance,
      method: args.paymentMethod,
      mixedCash: args.mixedCash,
      mixedTransfer: args.mixedTransfer,
      cashierUserId: auth.user.id,
      cashierUserName: auth.user.fullName || auth.user.username,
      timestamp: now,
      isJoint: true,
      orderIds: orderIds,
      items: request.items.map(it => ({
        id: it.id,
        menuItemId: it.id,
        itemName: it.itemName,
        quantity: it.quantity,
        unitPriceCup: it.quantity > 0 ? (it.subtotalCup / it.quantity) : it.subtotalCup,
        subtotalCup: it.subtotalCup,
      })),
      type: "ORDER_PAYMENT" as const,
      isConsolidated: false,
      jornadaId: args.jornadaId || jornadaId,
      requestSnapshot: requestSnapshot,
      idempotencyKey: args.idempotencyKey,
    };

    await ctx.db.insert("restaurant_payments", paymentDoc);

    // 6. Auditoría y Notificaciones
    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: auth.user.id,
      userName: auth.user.fullName || auth.user.username,
      module: "BAR",
      action: "COBRO_CONJUNTO_MESA",
      entityId: request.tableId || "UNKNOWN",
      result: "SUCCESS",
      timestamp: now,
      isOutsideShift: false,
      details: `Cobro conjunto de ${orderIds.length} órdenes en ${request.tableName} por $${totalActualBalance.toFixed(2)} CUP`,
    });

    await ctx.db.insert("notifications", {
      id: crypto.randomUUID(),
      title: "Cobro Realizado",
      message: `Mesa ${request.tableName}: Cobro conjunto de $${totalActualBalance.toFixed(2)} CUP confirmado.`,
      targetRole: "DEPENDIENTE",
      timestamp: now,
      isRead: false,
    });

    return paymentDoc;
  },
});

/**
 * Marca todos los productos de una mesa como SERVIDO EN MESA.
 * Solo se permite si todos los productos pendientes están en estado LISTO.
 */
export const markAllTableItemsAsServed = mutation({
  args: {
    tableId: v.string(),
    waiterId: v.string(),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.waiterId || args.userId },
      ["ADMIN_GENERAL", "DUENO", "DEPENDIENTE"],
      { actionDescription: "marcar todo como servido en mesa" }
    );

    const orders = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();

    const activeOrders = orders.filter(o => o.status !== "PAGADO" && o.status !== "CANCELADO");
    if (activeOrders.length === 0) throw new Error("No hay órdenes activas para esta mesa.");

    const now = Date.now();
    const ordersToUpdate = [];
    const notReadyItems: Array<{ orderNumber: number; itemName: string; status: string; station: string }> = [];

    for (const order of activeOrders) {
      let orderNeedsUpdate = false;
      const updatedItems = order.items.map(it => {
        // Ítems pendientes de servicio
        if (it.status !== "SERVIDO" && it.status !== "PAGADO" && it.status !== "CANCELADO") {
          const isBar = (it.station ?? "COCINA") === "BARTENDER";
          if (isBar || it.status === "LISTO") {
            orderNeedsUpdate = true;
            return { ...it, status: "SERVIDO" as const, servedAt: now, servedByUserId: auth.user.id };
          } else {
            // No está listo (COCINA en NUEVO o EN_PREPARACION)
            notReadyItems.push({ 
              orderNumber: order.orderNumber, 
              itemName: it.itemName, 
              status: it.status || "DESCONOCIDO", 
              station: it.station || "COCINA" 
            });
            return it;
          }
        }
        return it;
      });

      if (orderNeedsUpdate) {
        ordersToUpdate.push({ order, updatedItems });
      }
    }

    if (notReadyItems.length > 0) {
      const details = notReadyItems.map(i => `${i.itemName} (#${i.orderNumber} - ${i.station})`).join(", ");
      throw new Error(`No se puede marcar todo como servido: hay ${notReadyItems.length} productos aún en preparación: ${details}`);
    }

    if (ordersToUpdate.length === 0) {
      throw new Error("No hay productos pendientes de servicio que estén listos para entregar.");
    }

    // Aplicar actualizaciones atómicas
    for (const { order, updatedItems } of ordersToUpdate) {
      // Determinar si la orden completa pasa a SERVIDO
      const allServed = updatedItems.every(it => it.status === "SERVIDO" || it.status === "PAGADO" || it.status === "CANCELADO");
      
      const patch: any = { 
        items: updatedItems, 
        updatedAt: now 
      };
      
      if (allServed) {
        patch.status = "SERVIDO";
        patch.servedAt = now;
        patch.servedByUserId = auth.user.id;
      }

      await ctx.db.patch(order._id, patch);
    }

    return { success: true, updatedOrdersCount: ordersToUpdate.length };
  },
});

/**
 * Marca todos los productos pendientes de una comanda como SERVIDO EN MESA.
 * Solo se permite si todos los productos pendientes de Cocina están en estado LISTO.
 */
export const markOrderServed = mutation({
  args: {
    orderId: v.string(),
    waiterId: v.string(),
    userId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.waiterId || args.userId },
      ["ADMIN_GENERAL", "DUENO", "DEPENDIENTE"],
      { actionDescription: "marcar orden completa como servida en mesa" }
    );

    const order = await ctx.db
      .query("restaurant_orders")
      .withIndex("by_custom_id", (q) => q.eq("id", args.orderId))
      .first();

    if (!order) throw new Error(`Orden con ID ${args.orderId} no encontrada`);

    const pendingItems = order.items.filter(
      it => it.status !== "SERVIDO" && it.status !== "PAGADO" && it.status !== "CANCELADO"
    );

    if (pendingItems.length === 0) {
      throw new Error("Todos los productos de esta orden ya han sido servidos o pagados.");
    }

    const notReadyItems = pendingItems.filter(
      it => (it.station ?? "COCINA") === "COCINA" && it.status !== "LISTO"
    );
    if (notReadyItems.length > 0) {
      const details = notReadyItems.map(i => `${i.itemName} (${i.status || "EN PREPARACIÓN"})`).join(", ");
      throw new Error(`No se puede marcar la orden como servida: hay ${notReadyItems.length} producto(s) de Cocina aún en preparación (${details}).`);
    }

    const now = Date.now();
    const updatedItems = order.items.map(it => {
      if (it.status !== "SERVIDO" && it.status !== "PAGADO" && it.status !== "CANCELADO") {
        return {
          ...it,
          status: "SERVIDO" as const,
          servedAt: now,
          servedByUserId: auth.user.id,
        };
      }
      return it;
    });

    const allServed = updatedItems.every(
      it => it.status === "SERVIDO" || it.status === "PAGADO" || it.status === "CANCELADO"
    );

    const patch: Record<string, any> = {
      items: updatedItems,
      updatedAt: now,
    };

    if (allServed && order.status !== "PAGADO") {
      patch.status = "SERVIDO" as const;
      patch.servedAt = now;
      patch.servedByUserId = auth.user.id;
    }

    await ctx.db.patch(order._id, patch);
    return { success: true, orderId: args.orderId };
  },
});

/**
 * REINICIO INTEGRAL Y SELECTIVO DE ÓRDENES, PAGOS Y CONSOLIDACIONES.
 * Exclusivo para ADMINISTRADOR GENERAL.
 * ELIMINA FÍSICAMENTE:
 * - restaurant_orders
 * - payment_requests
 * - restaurant_payments
 * - cashier_consolidations
 * - waiter_consolidations
 * - kitchen_consolidations
 * - bartender_consolidations
 * - owner_reports
 * - cash_reconciliations
 * - notifications vinculadas a comanda (orderId != null)
 * 
 * LAS RESERVACIONES (restaurant_reservations) Y CLIENTES (restaurant_customers) PERMANECEN INTACTAS.
 */
export const resetOrdersPaymentsAndConsolidations = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken },
      ["ADMIN_GENERAL"],
      { actionDescription: "reiniciar órdenes, pagos y consolidaciones" }
    );

    const now = Date.now();

    // 1. Eliminar comandas / órdenes de restaurante
    const orders = await ctx.db.query("restaurant_orders").collect();
    for (const order of orders) {
      await ctx.db.delete(order._id);
    }

    // 2. Eliminar solicitudes de cobro
    const payReqs = await ctx.db.query("payment_requests").collect();
    for (const req of payReqs) {
      await ctx.db.delete(req._id);
    }

    // 3. Eliminar pagos de restaurante
    const payments = await ctx.db.query("restaurant_payments").collect();
    for (const payment of payments) {
      await ctx.db.delete(payment._id);
    }

    // 4. Eliminar consolidaciones (caja, dependiente, cocina y rol retirado bartender)
    const cashierCons = await ctx.db.query("cashier_consolidations").collect();
    for (const c of cashierCons) {
      await ctx.db.delete(c._id);
    }

    const waiterCons = await ctx.db.query("waiter_consolidations").collect();
    for (const c of waiterCons) {
      await ctx.db.delete(c._id);
    }

    const kitchenCons = await ctx.db.query("kitchen_consolidations").collect();
    for (const c of kitchenCons) {
      await ctx.db.delete(c._id);
    }

    // 5. Eliminar informes de dueño, cuadres de caja y jornadas archivadas
    const ownerReports = await ctx.db.query("owner_reports").collect();
    for (const r of ownerReports) {
      await ctx.db.delete(r._id);
    }

    const cashReconciliations = await ctx.db.query("cash_reconciliations").collect();
    for (const r of cashReconciliations) {
      await ctx.db.delete(r._id);
    }

    const archivedShifts = await ctx.db.query("archived_shifts").collect();
    for (const s of archivedShifts) {
      await ctx.db.delete(s._id);
    }

    // 6. Eliminar ventas y turnos operativos de tienda (Dependiente)
    const shopSales = await ctx.db.query("shop_sales").collect();
    for (const sale of shopSales) {
      await ctx.db.delete(sale._id);
    }

    const shopShifts = await ctx.db.query("shop_shifts").collect();
    for (const shift of shopShifts) {
      await ctx.db.delete(shift._id);
    }

    // 7. Eliminar notificaciones operativas (conservando notificaciones de reservaciones/sistema)
    const notifications = await ctx.db.query("notifications").collect();
    let deletedNotifications = 0;
    for (const n of notifications) {
      if (
        n.orderId ||
        n.targetRole === "COCINA" ||
        n.targetRole === "CAJERO" ||
        n.targetRole === "DEPENDIENTE" ||
        n.targetRole === "BARTENDER" ||
        n.title.includes("Cobro") ||
        n.title.includes("COMANDA")
      ) {
        await ctx.db.delete(n._id);
        deletedNotifications++;
      }
    }

    const totalConsolidations =
      cashierCons.length + waiterCons.length + kitchenCons.length;

    // Auditoría centralizada
    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: auth.user.id,
      userName: auth.user.fullName,
      module: "GENERAL",
      action: "REINICIO_ORDENES_PAGOS_CONSOLIDACIONES",
      entityId: auth.user.id,
      result: "SUCCESS",
      timestamp: now,
      isOutsideShift: false,
      details: `Reinicio operativo: ${orders.length} órdenes, ${payReqs.length} solicitudes, ${payments.length} pagos, ${totalConsolidations} consolidaciones, ${ownerReports.length} informes, ${cashReconciliations.length} cuadres, ${archivedShifts.length} jornadas archivadas, ${shopSales.length} ventas tienda. Reservaciones y datos maestros intactos.`,
    });

    return {
      success: true,
      message: "Reinicio operativo realizado con éxito.",
      counts: {
        orders: orders.length,
        paymentRequests: payReqs.length,
        payments: payments.length,
        consolidations: totalConsolidations,
        ownerReports: ownerReports.length,
        cashReconciliations: cashReconciliations.length,
        archivedShifts: archivedShifts.length,
        shopSales: shopSales.length,
        shopShifts: shopShifts.length,
        notifications: deletedNotifications,
      },
    };
  },
});

