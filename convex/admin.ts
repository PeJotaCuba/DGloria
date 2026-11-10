import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authorizeUser } from "./auth";

/**
 * Módulo de Administración Avanzada para Doña Gloria.
 * Proporciona funcionalidades de mantenimiento y limpieza integral de datos operativos por usuario.
 */

// ==========================================
// CONSULTA: VISTA PREVIA DE REINICIO
// ==========================================

export const getResetPreview = query({
  args: {
    userId: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Validar que el solicitante sea ADMIN_GENERAL mediante token de sesión activo
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken },
      ["ADMIN_GENERAL"],
      { actionDescription: "ver vista previa de reinicio de datos operativos" }
    );

    const user = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", args.userId))
      .first();

    if (!user) throw new Error("Usuario no encontrado");

    // Protección absoluta: No permitir reiniciar al propio administrador ni a roles directivos
    if (user.id === auth.user.id) {
      throw new Error("Protección de seguridad: No puedes reiniciar tu propia cuenta de Administrador");
    }

    if (user.role === "ADMIN_GENERAL" || user.role === "DUENO" || user.role === "DUENO_CAJERO") {
      throw new Error("Protección de seguridad: No se pueden reiniciar datos operativos de roles directivos (ADMIN_GENERAL o DUENO)");
    }

    const allowedRoles = ["DEPENDIENTE", "COCINA", "CAJERO"];
    if (!allowedRoles.includes(user.role)) {
      throw new Error(`El rol '${user.role}' no admite reinicio operativo`);
    }

    const counts = {
      orders: 0,
      sales: 0,
      consolidations: 0,
      reports: 0,
      notifications: 0,
      prepAssignments: 0,
      paymentRequests: 0,
      payments: 0,
      activeSessions: 0,
    };

    // Recopilar estadísticas según el rol
    if (user.role === "DEPENDIENTE") {
      const orders = await ctx.db
        .query("restaurant_orders")
        .withIndex("by_waiter_and_createdAt", (q) => q.eq("waiterId", user.id))
        .collect();
      counts.orders = orders.length;

      const sales = await ctx.db
        .query("shop_sales")
        .withIndex("by_user", (q) => q.eq("userId", user.id))
        .collect();
      counts.sales = sales.length;

      const consolidations = await ctx.db
        .query("waiter_consolidations")
        .withIndex("by_waiterUserId", (q) => q.eq("waiterUserId", user.id))
        .collect();
      counts.consolidations = consolidations.length;

      const payReqs = await ctx.db
        .query("payment_requests")
        .withIndex("by_waiter", (q) => q.eq("waiterId", user.id))
        .collect();
      counts.paymentRequests = payReqs.length;
    }

    if (user.role === "COCINA") {
      const kitchenCons = await ctx.db
        .query("kitchen_consolidations")
        .collect();
      counts.consolidations = kitchenCons.filter((c) => c.cookUserId === user.id).length;

      const allOrders = await ctx.db.query("restaurant_orders").collect();
      for (const order of allOrders) {
        counts.prepAssignments += order.items.filter((item) => item.cookUserId === user.id).length;
      }
    }

    if (user.role === "CAJERO") {
      const cashierCons = await ctx.db
        .query("cashier_consolidations")
        .withIndex("by_cashierUserId", (q) => q.eq("cashierUserId", user.id))
        .collect();
      counts.consolidations = cashierCons.length;

      const payments = await ctx.db
        .query("restaurant_payments")
        .withIndex("by_cashier", (q) => q.eq("cashierUserId", user.id))
        .collect();
      counts.payments = payments.length;

      const pendingPayReqs = await ctx.db
        .query("payment_requests")
        .collect();
      counts.paymentRequests = pendingPayReqs.length;

      const paidOrders = await ctx.db
        .query("restaurant_orders")
        .withIndex("by_cashier_and_paidAt", (q) => q.eq("cashierUserId", user.id))
        .collect();
      counts.orders = paidOrders.length;
    }

    // Comunes para todos los roles reseteables
    const reports = await ctx.db.query("owner_reports").collect();
    counts.reports = reports.filter((r) => r.sourceUserId === user.id).length;

    const notifs = await ctx.db
      .query("notifications")
      .withIndex("by_targetUser", (q) => q.eq("targetUserId", user.id))
      .collect();
    counts.notifications = notifs.length;

    const sessions = await ctx.db
      .query("user_sessions")
      .withIndex("by_user_and_active", (q) => q.eq("userId", user.id).eq("isActive", true))
      .collect();
    counts.activeSessions = sessions.length;

    return {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      counts,
    };
  },
});

// ==========================================
// MUTACIÓN: EJECUTAR REINICIO OPERATIVO
// ==========================================

export const performUserReset = mutation({
  args: {
    userId: v.string(),
    confirmationText: v.string(), // Debe ser exactamente "REINICIAR"
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Validar que el solicitante sea ADMIN_GENERAL mediante token de sesión activo
    const auth = await authorizeUser(
      ctx,
      { sessionToken: args.sessionToken },
      ["ADMIN_GENERAL"],
      { actionDescription: "reiniciar datos operativos de usuario" }
    );

    if (args.confirmationText.trim().toUpperCase() !== "REINICIAR") {
      throw new Error("Texto de confirmación incorrecto: Debe escribir exactamente 'REINICIAR'");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_custom_id", (q) => q.eq("id", args.userId))
      .first();

    if (!user) throw new Error("Usuario no encontrado");

    // Protección absoluta: No permitir reiniciar al propio administrador ni a roles directivos
    if (user.id === auth.user.id) {
      throw new Error("Protección de seguridad: No puedes reiniciar tus propios datos operativos como Administrador");
    }

    if (user.role === "ADMIN_GENERAL" || user.role === "DUENO" || user.role === "DUENO_CAJERO") {
      throw new Error("Protección de seguridad: No se pueden reiniciar datos operativos de roles directivos (ADMIN_GENERAL o DUENO)");
    }

    const allowedRoles = ["DEPENDIENTE", "COCINA", "CAJERO"];
    if (!allowedRoles.includes(user.role)) {
      throw new Error(`El rol '${user.role}' no admite reinicio operativo`);
    }

    const now = Date.now();
    let deletedOrders = 0;
    let deletedSales = 0;
    let deletedConsolidations = 0;
    let deletedPaymentRequests = 0;
    let deletedPayments = 0;
    let deletedReconciliations = 0;
    let resetPrepItems = 0;
    let deletedReports = 0;
    let deletedNotifications = 0;
    let invalidatedSessions = 0;

    // 2. Limpieza operativa específica según el rol

    if (user.role === "DEPENDIENTE") {
      // a. Eliminar órdenes creadas por este dependiente y sus registros derivados
      const orders = await ctx.db
        .query("restaurant_orders")
        .withIndex("by_waiter_and_createdAt", (q) => q.eq("waiterId", user.id))
        .collect();

      for (const order of orders) {
        // Notificaciones asociadas a la orden
        const orderNotifs = await ctx.db
          .query("notifications")
          .withIndex("by_orderId", (q) => q.eq("orderId", order.id))
          .collect();
        for (const n of orderNotifs) {
          await ctx.db.delete(n._id);
          deletedNotifications++;
        }

        // Solicitudes de cobro asociadas a la orden
        const payReqs = await ctx.db
          .query("payment_requests")
          .withIndex("by_order", (q) => q.eq("orderId", order.id))
          .collect();
        for (const pr of payReqs) {
          await ctx.db.delete(pr._id);
          deletedPaymentRequests++;
        }

        // Pagos asociados a la orden
        const payments = await ctx.db
          .query("restaurant_payments")
          .withIndex("by_order", (q) => q.eq("orderId", order.id))
          .collect();
        for (const p of payments) {
          await ctx.db.delete(p._id);
          deletedPayments++;
        }

        await ctx.db.delete(order._id);
        deletedOrders++;
      }

      // b. Eliminar solicitudes de cobro huérfanas creadas por este dependiente
      const waiterPayReqs = await ctx.db
        .query("payment_requests")
        .withIndex("by_waiter", (q) => q.eq("waiterId", user.id))
        .collect();
      for (const pr of waiterPayReqs) {
        await ctx.db.delete(pr._id);
        deletedPaymentRequests++;
      }

      // c. Eliminar ventas de tienda realizadas por él
      const sales = await ctx.db
        .query("shop_sales")
        .withIndex("by_user", (q) => q.eq("userId", user.id))
        .collect();
      for (const sale of sales) {
        await ctx.db.delete(sale._id);
        deletedSales++;
      }

      // d. Eliminar consolidaciones de jornada de dependiente
      const waiterCons = await ctx.db
        .query("waiter_consolidations")
        .withIndex("by_waiterUserId", (q) => q.eq("waiterUserId", user.id))
        .collect();
      for (const c of waiterCons) {
        await ctx.db.delete(c._id);
        deletedConsolidations++;
      }
    }

    if (user.role === "COCINA") {
      // a. Eliminar consolidaciones de cocina
      const kitchenCons = await ctx.db
        .query("kitchen_consolidations")
        .collect();
      for (const c of kitchenCons) {
        if (c.cookUserId === user.id) {
          await ctx.db.delete(c._id);
          deletedConsolidations++;
        }
      }

      // b. Liberar asignaciones de preparación en órdenes activas
      const allOrders = await ctx.db.query("restaurant_orders").collect();
      for (const order of allOrders) {
        let changed = false;
        const newItems = order.items.map((item) => {
          if (item.cookUserId === user.id || item.station === "COCINA") {
            changed = true;
            resetPrepItems++;
            return {
              ...item,
              status: "NUEVO" as const,
              prepStartedAt: undefined,
              readyAt: undefined,
              cookUserId: undefined,
              cookUserName: undefined,
            };
          }
          return item;
        });

        if (changed || order.cookUserId === user.id) {
          const isPrepOrReady = order.status === "EN_PREPARACION" || order.status === "LISTO";
          await ctx.db.patch(order._id, {
            items: newItems,
            status: isPrepOrReady ? "NUEVO" : order.status,
            cookUserId: undefined,
            cookUserName: undefined,
            prepStartedAt: undefined,
            readyAt: undefined,
          });
        }
      }
    }



    if (user.role === "CAJERO") {
      // a. Eliminar TODAS las solicitudes de cobro activas o confirmadas para vaciar el panel de Caja
      const allPayReqs = await ctx.db.query("payment_requests").collect();
      for (const pr of allPayReqs) {
        await ctx.db.delete(pr._id);
        deletedPaymentRequests++;
      }

      // b. Eliminar TODOS los pagos registrados por este cajero
      const cashierPayments = await ctx.db
        .query("restaurant_payments")
        .withIndex("by_cashier", (q) => q.eq("cashierUserId", user.id))
        .collect();
      for (const p of cashierPayments) {
        await ctx.db.delete(p._id);
        deletedPayments++;
      }

      // c. Eliminar consolidaciones de caja de este cajero
      const cashierCons = await ctx.db
        .query("cashier_consolidations")
        .withIndex("by_cashierUserId", (q) => q.eq("cashierUserId", user.id))
        .collect();
      for (const c of cashierCons) {
        await ctx.db.delete(c._id);
        deletedConsolidations++;
      }

      // d. Eliminar cuadres y reconciliaciones de caja
      const reconciliations = await ctx.db.query("cash_reconciliations").collect();
      for (const r of reconciliations) {
        if (r.confirmedByUserId === user.id) {
          await ctx.db.delete(r._id);
          deletedReconciliations++;
        }
      }

      // e. Limpiar trazabilidad de cobro en las órdenes para eliminar cobros o solicitudes de caja
      const allOrders = await ctx.db.query("restaurant_orders").collect();
      for (const order of allOrders) {
        if (
          order.cashierUserId === user.id ||
          order.status === "PENDIENTE_COBRO" ||
          order.status === "PAGADO" ||
          order.paymentRequestedAt !== undefined ||
          order.paidAt !== undefined
        ) {
          const resetItems = order.items.map((item) => {
            if (item.status === "PAGADO") {
              return { ...item, status: "SERVIDO" as const };
            }
            return item;
          });

          const newOrderStatus = order.status === "PAGADO" || order.status === "PENDIENTE_COBRO"
            ? "SERVIDO"
            : order.status;

          await ctx.db.patch(order._id, {
            status: newOrderStatus,
            items: resetItems,
            paymentRequestedAt: undefined,
            paidAt: undefined,
            cashierUserId: undefined,
            cashierUserName: undefined,
            paymentMethod: undefined,
          });
        }
      }
    }

    // 3. Limpieza común para todos los roles autorizados

    // Eliminar informes enviados al dueño originados por este usuario o su rol
    const reports = await ctx.db.query("owner_reports").collect();
    for (const r of reports) {
      if (
        r.sourceUserId === user.id ||
        (user.role === "CAJERO" && r.reportType === "CAJERO") ||
        (user.role === "COCINA" && r.reportType === "COCINA") ||
        (user.role === "DEPENDIENTE" && (r.reportType === "DEPENDIENTE" || r.reportType === "DEPENDIENTE_BAR" || r.reportType === "DEPENDIENTE_TIENDA"))
      ) {
        await ctx.db.delete(r._id);
        deletedReports++;
      }
    }

    // Eliminar notificaciones dirigidas al usuario o su rol
    const notifications = await ctx.db.query("notifications").collect();
    for (const n of notifications) {
      if (n.targetUserId === user.id || n.targetRole === user.role) {
        await ctx.db.delete(n._id);
        deletedNotifications++;
      }
    }

    // Invalidar y eliminar sesiones activas para forzar relogin y evitar que estados en caché revivan datos
    const sessions = await ctx.db
      .query("user_sessions")
      .withIndex("by_user", (q) => q.eq("userId", user.id))
      .collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
      invalidatedSessions++;
    }

    // NOTA: La identidad del usuario (id, username, pin, passwordHash, role, permissions) y
    // sus dispositivos registrados en 'user_devices' se conservan intactos.

    // 4. Registro formal de auditoría de la acción
    await ctx.db.insert("audit_logs", {
      id: crypto.randomUUID(),
      userId: auth.user.id,
      userName: auth.user.fullName,
      module: "GENERAL",
      action: `REINICIO_OPERATIVO: Eliminación física integral de datos operativos de ${user.fullName} (@${user.username}) con rol ${user.role}`,
      entityId: user.id,
      result: "SUCCESS",
      timestamp: now,
      isOutsideShift: false,
    });

    return {
      success: true,
      message: `Datos operativos de ${user.fullName} (@${user.username}) reiniciados físicamente con éxito.`,
      deleted: {
        orders: deletedOrders,
        sales: deletedSales,
        consolidations: deletedConsolidations,
        paymentRequests: deletedPaymentRequests,
        payments: deletedPayments,
        reconciliations: deletedReconciliations,
        prepAssignments: resetPrepItems,
        reports: deletedReports,
        notifications: deletedNotifications,
        sessions: invalidatedSessions,
      },
    };
  },
});
