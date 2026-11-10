import { mutation, query, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { authorizeUser } from "./auth";
import { logEvent } from "./audit";

/**
 * Operaciones del módulo de Tienda:
 * - Consultas de catálogo, jornadas y ventas POS
 * - Mutaciones para creación, actualización y control de productos
 */

// ==========================================
// CONSULTAS: PRODUCTOS DE TIENDA
// ==========================================

export const listProducts = query({
  args: {
    category: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { category, activeOnly } = args;

    if (activeOnly !== undefined && category !== undefined) {
      return await ctx.db
        .query("shop_products")
        .withIndex("by_active_and_category", (q) =>
          q.eq("active", activeOnly).eq("category", category)
        )
        .collect();
    }

    if (activeOnly !== undefined) {
      return await ctx.db
        .query("shop_products")
        .withIndex("by_active", (q) => q.eq("active", activeOnly))
        .collect();
    }

    if (category !== undefined) {
      return await ctx.db
        .query("shop_products")
        .withIndex("by_category", (q) => q.eq("category", category))
        .collect();
    }

    return await ctx.db.query("shop_products").collect();
  },
});

export const getProductById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shop_products")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
  },
});

export const getProductByCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shop_products")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

// ==========================================
// CONSULTAS: JORNADAS / TURNOS DE TIENDA
// ==========================================

export const getActiveShift = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("shop_shifts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();
  },
});

export const listShifts = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("shop_shifts")
      .withIndex("by_openedAt")
      .order("desc")
      .take(limit);
  },
});

export const getShiftById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shop_shifts")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
  },
});

// ==========================================
// CONSULTAS: VENTAS DE TIENDA (POS)
// ==========================================

export const listSales = query({
  args: {
    shiftId: v.optional(v.string()),
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.shiftId !== undefined) {
      return await ctx.db
        .query("shop_sales")
        .withIndex("by_shift_and_timestamp", (q) => q.eq("shiftId", args.shiftId!))
        .order("desc")
        .take(limit);
    }

    if (args.userId !== undefined) {
      return await ctx.db
        .query("shop_sales")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("shop_sales")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

export const getSaleById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shop_sales")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
  },
});

// ==========================================
// MUTACIONES: GESTIÓN DE PRODUCTOS DE TIENDA
// ==========================================

/**
 * Creación o actualización de producto sincronizada desde cliente o administración.
 * Soporta idempotencia y previene colisión de códigos SKU.
 */
export const upsertProduct = mutation({
  args: {
    id: v.optional(v.string()),
    code: v.string(),
    name: v.string(),
    category: v.string(),
    unitOfMeasure: v.optional(v.string()),
    priceMode: v.union(v.literal("FIXED_CUP"), v.literal("USD_REFERENCE")),
    fixedPriceCup: v.number(),
    referencePriceUsd: v.number(),
    currentStock: v.number(),
    minStockThreshold: v.optional(v.number()),
    active: v.boolean(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE"],
      { actionDescription: "crear o modificar productos de tienda" }
    );

    const trimmedName = args.name.trim();
    const trimmedCode = args.code.trim();

    if (!trimmedName) {
      throw new Error("El nombre del producto no puede estar vacío");
    }
    if (!trimmedCode) {
      throw new Error("El código de producto no puede estar vacío");
    }
    if (args.fixedPriceCup < 0 || args.referencePriceUsd < 0) {
      throw new Error("Los precios del producto no pueden ser negativos");
    }
    if (args.currentStock < 0) {
      throw new Error("Las existencias del producto no pueden ser negativas");
    }

    const productId = args.id?.trim() || crypto.randomUUID();

    const existing = await ctx.db
      .query("shop_products")
      .withIndex("by_custom_id", (q) => q.eq("id", productId))
      .first();

    const codeCheck = await ctx.db
      .query("shop_products")
      .withIndex("by_code", (q) => q.eq("code", trimmedCode))
      .first();

    if (codeCheck && codeCheck.id !== productId) {
      throw new Error(`Ya existe otro producto con el código '${trimmedCode}' (${codeCheck.name})`);
    }

    const now = Date.now();
    const docData = {
      id: productId,
      code: trimmedCode,
      name: trimmedName,
      category: args.category.trim(),
      unitOfMeasure: args.unitOfMeasure?.trim() || "ud",
      priceMode: args.priceMode,
      fixedPriceCup: args.fixedPriceCup,
      referencePriceUsd: args.referencePriceUsd,
      currentStock: args.currentStock,
      minStockThreshold: args.minStockThreshold !== undefined && args.minStockThreshold >= 0 ? args.minStockThreshold : 5.0,
      active: args.active,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, docData);
      await logEvent(ctx, { id: auth.user.id, fullName: auth.user.fullName || auth.user.username }, "TIENDA", "Producto actualizado", productId);
      return { ...existing, ...docData };
    } else {
      const docId = await ctx.db.insert("shop_products", docData);
      await logEvent(ctx, { id: auth.user.id, fullName: auth.user.fullName || auth.user.username }, "TIENDA", "Producto creado", productId);
      return { _id: docId, ...docData };
    }
  },
});

/**
 * Creación explícita de un nuevo producto con validación de código único
 */
export const createProduct = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    category: v.string(),
    unitOfMeasure: v.optional(v.string()),
    priceMode: v.union(v.literal("FIXED_CUP"), v.literal("USD_REFERENCE")),
    fixedPriceCup: v.number(),
    referencePriceUsd: v.number(),
    initialStock: v.optional(v.number()),
    minStockThreshold: v.optional(v.number()),
    active: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO"],
      { actionDescription: "crear productos de tienda" }
    );

    const trimmedName = args.name.trim();
    const trimmedCode = args.code.trim();

    if (!trimmedName) {
      throw new Error("El nombre del producto no puede estar vacío");
    }
    if (!trimmedCode) {
      throw new Error("El código de producto no puede estar vacío");
    }
    if (args.fixedPriceCup < 0 || args.referencePriceUsd < 0) {
      throw new Error("Los precios no pueden ser negativos");
    }

    const existingCode = await ctx.db
      .query("shop_products")
      .withIndex("by_code", (q) => q.eq("code", trimmedCode))
      .first();

    if (existingCode) {
      throw new Error(`El código '${trimmedCode}' ya está asignado a '${existingCode.name}'`);
    }

    const id = crypto.randomUUID();
    const currentStock = args.initialStock !== undefined && args.initialStock >= 0 ? args.initialStock : 0;
    const now = Date.now();

    const docData = {
      id,
      code: trimmedCode,
      name: trimmedName,
      category: args.category.trim(),
      unitOfMeasure: args.unitOfMeasure?.trim() || "ud",
      priceMode: args.priceMode,
      fixedPriceCup: args.fixedPriceCup,
      referencePriceUsd: args.referencePriceUsd,
      currentStock,
      minStockThreshold: args.minStockThreshold !== undefined && args.minStockThreshold >= 0 ? args.minStockThreshold : 5.0,
      active: args.active ?? true,
      updatedAt: now,
    };

    const docId = await ctx.db.insert("shop_products", docData);
    return { _id: docId, ...docData };
  },
});

/**
 * Actualización granular de un producto existente
 */
export const updateProduct = mutation({
  args: {
    id: v.string(),
    code: v.optional(v.string()),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    unitOfMeasure: v.optional(v.string()),
    priceMode: v.optional(v.union(v.literal("FIXED_CUP"), v.literal("USD_REFERENCE"))),
    fixedPriceCup: v.optional(v.number()),
    referencePriceUsd: v.optional(v.number()),
    minStockThreshold: v.optional(v.number()),
    active: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO"],
      { actionDescription: "actualizar producto de tienda" }
    );

    const existing = await ctx.db
      .query("shop_products")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!existing) {
      throw new Error(`Producto con ID ${args.id} no encontrado`);
    }

    const patch: Record<string, any> = { updatedAt: Date.now() };

    if (args.code !== undefined) {
      const trimmedCode = args.code.trim();
      if (!trimmedCode) throw new Error("El código no puede estar vacío");
      const codeCheck = await ctx.db
        .query("shop_products")
        .withIndex("by_code", (q) => q.eq("code", trimmedCode))
        .first();
      if (codeCheck && codeCheck.id !== args.id) {
        throw new Error(`El código '${trimmedCode}' ya está en uso por '${codeCheck.name}'`);
      }
      patch.code = trimmedCode;
    }

    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (!trimmedName) throw new Error("El nombre no puede estar vacío");
      patch.name = trimmedName;
    }

    if (args.category !== undefined) patch.category = args.category.trim();
    if (args.unitOfMeasure !== undefined) patch.unitOfMeasure = args.unitOfMeasure.trim();
    if (args.priceMode !== undefined) patch.priceMode = args.priceMode;

    if (args.fixedPriceCup !== undefined) {
      if (args.fixedPriceCup < 0) throw new Error("El precio en CUP no puede ser negativo");
      patch.fixedPriceCup = args.fixedPriceCup;
    }

    if (args.referencePriceUsd !== undefined) {
      if (args.referencePriceUsd < 0) throw new Error("El precio en USD no puede ser negativo");
      patch.referencePriceUsd = args.referencePriceUsd;
    }

    if (args.minStockThreshold !== undefined) {
      if (args.minStockThreshold < 0) throw new Error("El umbral de stock mínimo no puede ser negativo");
      patch.minStockThreshold = args.minStockThreshold;
    }

    if (args.active !== undefined) patch.active = args.active;

    await ctx.db.patch(existing._id, patch);
    return { ...existing, ...patch };
  },
});

/**
 * Activación o desactivación rápida de producto en catálogo
 */
export const setProductStatus = mutation({
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
      { actionDescription: "cambiar estado de producto en catálogo" }
    );

    const existing = await ctx.db
      .query("shop_products")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();

    if (!existing) {
      throw new Error(`Producto con ID ${args.id} no encontrado`);
    }

    await ctx.db.patch(existing._id, {
      active: args.active,
      updatedAt: Date.now(),
    });

    return { success: true, id: args.id, active: args.active };
  },
});

// ==========================================
// MUTACIONES: GESTIÓN DE JORNADAS / TURNOS
// ==========================================

/**
 * Apertura de una nueva jornada de tienda.
 * Si ya existe una jornada activa, la devuelve.
 */
export const openShift = mutation({
  args: {
    id: v.optional(v.string()),
    openedByUserId: v.string(),
    openedByUserName: v.string(),
    notes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.openedByUserId },
      ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE"],
      { actionDescription: "abrir jornada de tienda" }
    );

    const activeShift = await ctx.db
      .query("shop_shifts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();

    if (activeShift) {
      return activeShift;
    }

    const shiftId = args.id?.trim() || crypto.randomUUID();
    const now = Date.now();

    const docData = {
      id: shiftId,
      openedAt: now,
      openedByUserId: auth.user.id,
      openedByUserName: auth.user.fullName || auth.user.username,
      isActive: true,
      notes: args.notes?.trim() || "",
    };

    const docId = await ctx.db.insert("shop_shifts", docData);
    return { _id: docId, ...docData };
  },
});

/**
 * Cierre de la jornada activa de tienda con arqueo y notas de cierre
 */
export const closeShift = mutation({
  args: {
    shiftId: v.string(),
    closedByUserId: v.string(),
    closedByUserName: v.string(),
    notes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.closedByUserId },
      ["ADMIN_GENERAL", "DUENO"],
      { actionDescription: "cerrar jornada de tienda" }
    );

    const shift = await ctx.db
      .query("shop_shifts")
      .withIndex("by_custom_id", (q) => q.eq("id", args.shiftId))
      .first();

    if (!shift) {
      throw new Error(`Jornada con ID ${args.shiftId} no encontrada`);
    }

    if (!shift.isActive) {
      return shift;
    }

    const now = Date.now();
    const patch = {
      isActive: false,
      closedAt: now,
      closedByUserId: auth.user.id,
      closedByUserName: auth.user.fullName || auth.user.username,
      notes: args.notes !== undefined ? args.notes.trim() : shift.notes,
    };

    await ctx.db.patch(shift._id, patch);
    return { ...shift, ...patch };
  },
});

// ==========================================
// MUTACIONES CRÍTICAS: VENTAS DE TIENDA (POS)
// ==========================================

const SaleItemValidator = v.object({
  productId: v.string(),
  productCode: v.string(),
  productName: v.string(),
  quantity: v.number(),
  unitPriceCup: v.number(),
  rateApplied: v.number(),
  subtotalCup: v.number(),
});

/**
 * Mutación crítica de confirmación de venta en tienda (POS).
 * 
 * Reglas de consistencia e integridad:
 * 1. Control de acceso: Solo operadores autorizados (ADMIN_GENERAL, DUENO_CAJERO, DEPENDIENTE). Rol COCINA estrictamente bloqueado.
 * 2. Idempotencia estricta: Previene dobles cobros y deducciones ante fallos de red o pulsaciones múltiples.
 * 3. Validación de jornada: Requiere que la jornada esté abierta y activa.
 * 4. Validación de existencias: Verifica stock suficiente de todos los productos antes de realizar cualquier cambio.
 * 5. Deducción atómica: Actualiza `shop_products.currentStock` y registra el movimiento `VENTA` en `inventory_movements`.
 * 6. Registro inmutable: Inserta la venta en `shop_sales` con precios y tasas congeladas.
 */
export const confirmSale = mutation({
  args: {
    id: v.optional(v.string()),
    shiftId: v.string(),
    userId: v.string(),
    userName: v.optional(v.string()),
    items: v.array(SaleItemValidator),
    totalCup: v.number(),
    paymentMethod: v.union(
      v.literal("EFECTIVO"),
      v.literal("TRANSFERENCIA"),
      v.literal("MIXTO")
    ),
    idempotencyKey: v.string(),
    timestamp: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await executeConfirmSale(ctx, args);
  },
});

/**
 * Función central de ejecución de venta con control de idempotencia y consistencia
 */
async function executeConfirmSale(
  ctx: MutationCtx,
  args: {
    id?: string;
    shiftId: string;
    userId: string;
    userName?: string;
    items: Array<{
      productId: string;
      productCode: string;
      productName: string;
      quantity: number;
      unitPriceCup: number;
      rateApplied: number;
      subtotalCup: number;
    }>;
    totalCup: number;
    paymentMethod: "EFECTIVO" | "TRANSFERENCIA" | "MIXTO";
    idempotencyKey: string;
    timestamp?: number;
    sessionToken?: string;
  }
) {
  // 1. Autorización estricta de servidor: solo ADMIN_GENERAL, DUENO_CAJERO o DEPENDIENTE (COCINA queda denegado)
  const auth = await authorizeUser(
    ctx,
    { sessionToken: args.sessionToken, userId: args.userId },
    ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE"],
    { actionDescription: "registrar ventas en tienda" }
  );
  const operatorUserId = auth.user.id;
  const operatorUserName = auth.user.fullName || auth.user.username;

  const { idempotencyKey } = args;
  if (!idempotencyKey || !idempotencyKey.trim()) {
    throw new Error("La clave de idempotencia es obligatoria para confirmar ventas");
  }

  // 2. Verificación de Idempotencia: ¿Ya se procesó esta venta?
  const existingByIdempotency = await ctx.db
    .query("shop_sales")
    .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
    .first();

  if (existingByIdempotency) {
    return existingByIdempotency;
  }

  const saleId = args.id?.trim() || crypto.randomUUID();
  const existingById = await ctx.db
    .query("shop_sales")
    .withIndex("by_custom_id", (q) => q.eq("id", saleId))
    .first();

  if (existingById) {
    return existingById;
  }

  // 3. Validación de artículos de venta
  if (!args.items || args.items.length === 0) {
    throw new Error("El ticket de venta debe contener al menos un producto");
  }

  for (const item of args.items) {
    if (item.quantity <= 0) {
      throw new Error(`Cantidad inválida para '${item.productName}': debe ser mayor a cero`);
    }
    if (item.unitPriceCup < 0 || item.subtotalCup < 0) {
      throw new Error(`Importe inválido para '${item.productName}': los precios no pueden ser negativos`);
    }
  }

  if (args.totalCup < 0) {
    throw new Error("El importe total de la venta no puede ser negativo");
  }

  // 4. Validación de Jornada Activa
  let effectiveShiftId = args.shiftId;
  const shift = await ctx.db
    .query("shop_shifts")
    .withIndex("by_custom_id", (q) => q.eq("id", args.shiftId))
    .first();

  if (!shift) {
    const activeShift = await ctx.db
      .query("shop_shifts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();

    if (!activeShift) {
      throw new Error("No hay una jornada abierta en la tienda. Debe abrir una jornada para registrar ventas.");
    }
    effectiveShiftId = activeShift.id;
  } else if (!shift.isActive) {
    throw new Error("La jornada de tienda especificada ya está cerrada. No se pueden registrar ventas.");
  }

  // 5. Verificación previa de existencias de todos los productos (Falla rápida sin mutaciones parciales)
  const productDocs: Array<{
    item: (typeof args.items)[0];
    doc: Doc<"shop_products">;
  }> = [];

  for (const item of args.items) {
    const product = await ctx.db
      .query("shop_products")
      .withIndex("by_custom_id", (q) => q.eq("id", item.productId))
      .first();

    if (!product) {
      throw new Error(`Producto '${item.productName}' (ID: ${item.productId}) no encontrado en el catálogo`);
    }

    if (product.currentStock < item.quantity) {
      throw new Error(
        `Existencia insuficiente para '${product.name}'. Disponible: ${product.currentStock} ${product.unitOfMeasure}, solicitado: ${item.quantity} ${product.unitOfMeasure}`
      );
    }

    productDocs.push({ item, doc: product });
  }

  const now = args.timestamp ?? Date.now();

  // 6. Deducción atómica de existencias y registro de asientos de movimiento vinculados al operador autenticado
  for (const { item, doc } of productDocs) {
    const previousStock = doc.currentStock;
    const newStock = previousStock - item.quantity;

    await ctx.db.patch(doc._id, {
      currentStock: newStock,
      updatedAt: now,
    });

    const movementId = crypto.randomUUID();
    await ctx.db.insert("inventory_movements", {
      id: movementId,
      productId: doc.id,
      productName: doc.name,
      type: "VENTA",
      quantity: item.quantity,
      previousStock,
      newStock,
      reason: `Venta en tienda (Ticket ${saleId})`,
      userId: operatorUserId,
      userName: operatorUserName,
      timestamp: now,
      shiftId: effectiveShiftId,
      saleId: saleId,
      idempotencyKey: `${idempotencyKey}_p_${doc.id}`,
    });
  }

  // 7. Registro de la venta en shop_sales con identidad inmutable de operador
  const saleDoc = {
    id: saleId,
    shiftId: effectiveShiftId,
    timestamp: now,
    userId: operatorUserId,
    userName: operatorUserName,
    items: args.items,
    totalCup: args.totalCup,
    paymentMethod: args.paymentMethod,
    idempotencyKey,
  };

  const docId = await ctx.db.insert("shop_sales", saleDoc);
  await logEvent(ctx, { id: operatorUserId, fullName: operatorUserName }, "TIENDA", "Venta registrada", saleId, "SUCCESS", false, effectiveShiftId);
  return { _id: docId, ...saleDoc };
}

/**
 * Alias de sincronización de venta directa para compatibilidad con el cliente Android (AppRepository: syncSaleToConvex).
 */
export const recordSale = mutation({
  args: {
    id: v.optional(v.string()),
    shiftId: v.string(),
    userId: v.string(),
    userName: v.optional(v.string()),
    items: v.array(SaleItemValidator),
    totalCup: v.number(),
    paymentMethod: v.union(
      v.literal("EFECTIVO"),
      v.literal("TRANSFERENCIA"),
      v.literal("MIXTO")
    ),
    idempotencyKey: v.optional(v.string()),
    timestamp: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const idempotencyKey = args.idempotencyKey || args.id || crypto.randomUUID();
    return await executeConfirmSale(ctx, {
      ...args,
      idempotencyKey,
    });
  },
});
