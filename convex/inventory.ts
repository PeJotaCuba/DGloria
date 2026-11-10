import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authorizeUser } from "./auth";

/**
 * Operaciones para el control de inventario de Tienda:
 * - Consultas de movimientos y auditoría
 * - Mutaciones de ajustes de inventario atómicos (consistencia entre existencias e historial)
 * - Control de acceso y autorización por rol en servidor
 */

// ==========================================
// CONSULTAS: MOVIMIENTOS DE INVENTARIO
// ==========================================

export const listMovements = query({
  args: {
    productId: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("INICIAL"),
        v.literal("ENTRADA"),
        v.literal("VENTA"),
        v.literal("AJUSTE_POSITIVO"),
        v.literal("AJUSTE_NEGATIVO")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    if (args.productId !== undefined) {
      return await ctx.db
        .query("inventory_movements")
        .withIndex("by_product_and_timestamp", (q) =>
          q.eq("productId", args.productId!)
        )
        .order("desc")
        .take(limit);
    }

    if (args.type !== undefined) {
      return await ctx.db
        .query("inventory_movements")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("inventory_movements")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

export const listMovementsByShift = query({
  args: {
    shiftId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("inventory_movements")
      .withIndex("by_shift", (q) => q.eq("shiftId", args.shiftId))
      .collect();
  },
});

export const getMovementById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("inventory_movements")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
  },
});

// ==========================================
// MUTACIONES: AJUSTES Y MOVIMIENTOS
// ==========================================

/**
 * Registro transaccional y atómico de ajuste de inventario manual.
 * Garantiza coherencia absoluta entre el stock del catálogo (shop_products)
 * y el historial de movimientos (inventory_movements).
 */
export const adjustInventory = mutation({
  args: {
    productId: v.string(),
    type: v.union(
      v.literal("INICIAL"),
      v.literal("ENTRADA"),
      v.literal("AJUSTE_POSITIVO"),
      v.literal("AJUSTE_NEGATIVO")
    ),
    quantity: v.number(),
    reason: v.string(),
    userId: v.string(),
    userName: v.string(),
    shiftId: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Autorización estricta por rol en el servidor
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      ["ADMIN_GENERAL", "DUENO"],
      {
        requiredPermission: "canManageInventory",
        actionDescription: "realizar ajustes manuales de inventario",
      }
    );

    const trimmedReason = args.reason.trim();
    if (!trimmedReason) {
      throw new Error("Debe especificar un motivo justificado para el ajuste de inventario");
    }
    if (args.quantity <= 0) {
      throw new Error("La cantidad del ajuste debe ser estrictamente mayor a cero");
    }

    // Prevención de duplicados por idempotencia
    if (args.idempotencyKey) {
      const existingMovement = await ctx.db
        .query("inventory_movements")
        .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey!))
        .first();

      if (existingMovement) {
        return existingMovement;
      }
    }

    // Localizar producto en el catálogo
    const product = await ctx.db
      .query("shop_products")
      .withIndex("by_custom_id", (q) => q.eq("id", args.productId))
      .first();

    if (!product) {
      throw new Error(`Producto con ID ${args.productId} no encontrado en el catálogo`);
    }

    const previousStock = product.currentStock;
    let newStock: number;

    switch (args.type) {
      case "ENTRADA":
      case "AJUSTE_POSITIVO":
        newStock = previousStock + args.quantity;
        break;
      case "AJUSTE_NEGATIVO":
        if (previousStock < args.quantity) {
          throw new Error(
            `No es posible descontar ${args.quantity} ${product.unitOfMeasure}: existencias actuales insuficientes (${previousStock} ${product.unitOfMeasure})`
          );
        }
        newStock = previousStock - args.quantity;
        break;
      case "INICIAL":
        newStock = args.quantity;
        break;
      default:
        throw new Error("Tipo de movimiento no admitido para ajuste manual");
    }

    const now = Date.now();

    // Actualizar existencias del producto
    await ctx.db.patch(product._id, {
      currentStock: newStock,
      updatedAt: now,
    });

    // Registrar asiento en el historial de movimientos vinculado a la identidad autenticada
    const movementId = crypto.randomUUID();
    const movementDoc = {
      id: movementId,
      productId: product.id,
      productName: product.name,
      type: args.type,
      quantity: args.quantity,
      previousStock,
      newStock,
      reason: trimmedReason,
      userId: auth.user.id,
      userName: auth.user.fullName || auth.user.username,
      timestamp: now,
      shiftId: args.shiftId,
      idempotencyKey: args.idempotencyKey,
    };

    const docId = await ctx.db.insert("inventory_movements", movementDoc);
    return { _id: docId, ...movementDoc };
  },
});

/**
 * Registro de movimiento de inventario originado desde la sincronización cliente
 */
export const recordMovement = mutation({
  args: {
    id: v.optional(v.string()),
    productId: v.string(),
    type: v.union(
      v.literal("INICIAL"),
      v.literal("ENTRADA"),
      v.literal("VENTA"),
      v.literal("AJUSTE_POSITIVO"),
      v.literal("AJUSTE_NEGATIVO")
    ),
    quantity: v.number(),
    previousStock: v.number(),
    newStock: v.number(),
    reason: v.string(),
    userId: v.string(),
    userName: v.optional(v.string()),
    timestamp: v.optional(v.number()),
    shiftId: v.optional(v.string()),
    saleId: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Control de autorización según naturaleza del movimiento
    const isSale = args.type === "VENTA";
    const allowedRoles = isSale
      ? ["ADMIN_GENERAL", "DUENO", "CAJERO", "DEPENDIENTE"] as const
      : ["ADMIN_GENERAL", "DUENO"] as const;

    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      allowedRoles as any,
      isSale
        ? { actionDescription: "registrar deducción por venta" }
        : { requiredPermission: "canManageInventory", actionDescription: "registrar movimientos de inventario" }
    );

    const movementId = args.id?.trim() || crypto.randomUUID();

    // Comprobar si ya existe por ID
    const existing = await ctx.db
      .query("inventory_movements")
      .withIndex("by_custom_id", (q) => q.eq("id", movementId))
      .first();

    if (existing) {
      return existing;
    }

    if (args.idempotencyKey) {
      const existingIdem = await ctx.db
        .query("inventory_movements")
        .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey!))
        .first();

      if (existingIdem) {
        return existingIdem;
      }
    }

    const product = await ctx.db
      .query("shop_products")
      .withIndex("by_custom_id", (q) => q.eq("id", args.productId))
      .first();

    const productName = product ? product.name : `Producto ${args.productId}`;

    // Sincronizar el stock del producto si difiere para mantener consistencia
    if (product && product.currentStock !== args.newStock) {
      await ctx.db.patch(product._id, {
        currentStock: args.newStock,
        updatedAt: Date.now(),
      });
    }

    const docData = {
      id: movementId,
      productId: args.productId,
      productName,
      type: args.type,
      quantity: args.quantity,
      previousStock: args.previousStock,
      newStock: args.newStock,
      reason: args.reason.trim(),
      userId: auth.user.id,
      userName: auth.user.fullName || auth.user.username,
      timestamp: args.timestamp ?? Date.now(),
      shiftId: args.shiftId,
      saleId: args.saleId,
      idempotencyKey: args.idempotencyKey,
    };

    const docId = await ctx.db.insert("inventory_movements", docData);
    return { _id: docId, ...docData };
  },
});
