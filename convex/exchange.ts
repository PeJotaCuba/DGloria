import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authorizeUser } from "./auth";

/**
 * Operaciones para tasas de cambio monetario:
 * - Consultas de tasa activa USD/CUP e historial
 * - Mutación para actualización autorizada de la tasa de cambio protegida por rol
 */

// ==========================================
// CONSULTAS: TASAS DE CAMBIO
// ==========================================

export const getLatestRate = query({
  args: {
    sourceCurrency: v.optional(v.string()),
    targetCurrency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const source = args.sourceCurrency ?? "USD";
    const target = args.targetCurrency ?? "CUP";

    const latest = await ctx.db
      .query("exchange_rates")
      .withIndex("by_pair_and_updatedAt", (q) =>
        q.eq("sourceCurrency", source).eq("targetCurrency", target)
      )
      .order("desc")
      .first();

    if (latest) {
      return latest;
    }

    // Si aún no se ha registrado ninguna en la base de datos, fallback por defecto
    return {
      id: "default-rate",
      sourceCurrency: source,
      targetCurrency: target,
      rate: 360.0,
      updatedAt: Date.now(),
      updatedByUserId: "system",
      updatedByUserName: "Sistema Doña Gloria",
    };
  },
});

export const getRateHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    return await ctx.db
      .query("exchange_rates")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(limit);
  },
});

export const getRateById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("exchange_rates")
      .withIndex("by_custom_id", (q) => q.eq("id", args.id))
      .first();
  },
});

// ==========================================
// MUTACIONES: FIJACIÓN DE TASA DE CAMBIO
// ==========================================

/**
 * Actualiza la tasa de cambio vigente y preserva el registro de auditoría.
 * Protegido: Solo ADMIN_GENERAL o DUENO con permiso canOverridePrices.
 */
export const setRate = mutation({
  args: {
    rate: v.number(),
    sourceCurrency: v.optional(v.string()),
    targetCurrency: v.optional(v.string()),
    updatedByUserId: v.optional(v.string()),
    updatedByUserName: v.optional(v.string()),
    timestamp: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken, userId: args.updatedByUserId },
      ["ADMIN_GENERAL", "DUENO"],
      {
        requiredPermission: "canOverridePrices",
        actionDescription: "modificar la tasa de cambio",
      }
    );

    if (args.rate <= 0) {
      throw new Error("La tasa de cambio monetaria debe ser estrictamente mayor a 0");
    }

    const source = args.sourceCurrency?.trim() || "USD";
    const target = args.targetCurrency?.trim() || "CUP";
    const now = args.timestamp ?? Date.now();
    const id = crypto.randomUUID();

    const docData = {
      id,
      sourceCurrency: source,
      targetCurrency: target,
      rate: args.rate,
      updatedAt: now,
      updatedByUserId: auth.user.id,
      updatedByUserName: auth.user.fullName,
    };

    const docId = await ctx.db.insert("exchange_rates", docData);
    return { _id: docId, ...docData };
  },
});

export const setExchangeRate = setRate;
