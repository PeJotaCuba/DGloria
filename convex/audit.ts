import { MutationCtx, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Utilidad para registrar eventos operativos en la tabla 'audit_logs'.
 */
export async function logEvent(
  ctx: MutationCtx,
  user: { id: string; fullName: string },
  module: "GENERAL" | "TIENDA" | "BAR",
  action: string,
  entityId?: string,
  result: "SUCCESS" | "FAILURE" = "SUCCESS",
  isOutsideShift: boolean = false,
  shiftId?: string
) {
  await ctx.db.insert("audit_logs", {
    id: crypto.randomUUID(),
    userId: user.id,
    userName: user.fullName,
    module,
    action,
    entityId,
    result,
    timestamp: Date.now(),
    isOutsideShift,
    shiftId,
  });
}

// Consulta pública para el historial
export const getAuditLogs = query({
  args: {
    module: v.optional(v.union(v.literal("GENERAL"), v.literal("TIENDA"), v.literal("BAR"))),
  },
  handler: async (ctx, args) => {
    if (args.module) {
      return await ctx.db
        .query("audit_logs")
        .withIndex("by_module", (q2) => q2.eq("module", args.module!))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("audit_logs").order("desc").collect();
  },
});
