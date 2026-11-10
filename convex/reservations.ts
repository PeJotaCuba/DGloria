import { mutation, query, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { authorizeUser, authorizeOwnerOrAdmin, authorizeWebReservationAdmin } from "./auth";

/**
 * Módulo de Reservaciones para Doña Gloria (Bar-Terraza) - Fase 6.
 *
 * Características:
 * 1. Tabla única compartida `restaurant_reservations` entre la Web pública y la app Android.
 * 2. Creación pública desde la web o Android con estado inicial forzado a "Pendiente".
 * 3. Estados únicos y oficiales en español:
 *    - "Pendiente": Solicitud recibida, a la espera de revisión.
 *    - "Negociación": Propuesta de fecha/hora alternativa enviada al cliente.
 *    - "Confirmado": Aceptada y con asignación opcional de mesa en restaurant_tables.
 *    - "Rechazado": Declinada por disponibilidad o aforo.
 *    - "Cancelado": Anulada por el cliente o el local.
 *    - "Consolidado": Clientes recibidos y comanda/consumo abierto.
 * 4. Trazabilidad completa (usuario, marcas de tiempo, notas y motivos de rechazo/negociación).
 * 5. Consultas y mutaciones protegidas para operadores con roles ADMIN_GENERAL y DUENO_CAJERO.
 */

// ==========================================
// CREACIÓN PÚBLICA DE RESERVACIONES (WEB / CLIENTE)
// ==========================================

export const createPublicReservation = mutation({
  args: {
    fullName: v.string(),
    emailOrPhone: v.string(),
    date: v.string(),
    time: v.string(),
    partySize: v.number(),
    seatingArea: v.optional(v.string()),
    specialNotes: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanFullName = args.fullName.trim();
    const cleanContact = args.emailOrPhone.trim();
    const cleanDate = args.date.trim();
    const cleanTime = args.time.trim();

    if (!cleanFullName) {
      throw new Error("El nombre del titular de la reservación es obligatorio.");
    }
    if (!cleanContact) {
      throw new Error("Debe proporcionar un medio de contacto (teléfono o correo electrónico).");
    }
    if (!cleanDate) {
      throw new Error("Debe seleccionar una fecha para la reservación.");
    }
    if (!cleanTime) {
      throw new Error("Debe seleccionar un horario para la reservación.");
    }

    const partySizeNumber = Math.round(Number(args.partySize));
    if (isNaN(partySizeNumber) || partySizeNumber < 1) {
      throw new Error("La cantidad de personas debe ser al menos 1.");
    }

    const now = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const reservationId = `res-${now}-${randomSuffix}`;

    const reservationDoc = {
      id: reservationId,
      fullName: cleanFullName,
      emailOrPhone: cleanContact,
      email: args.email?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      partySize: partySizeNumber,
      seatingArea: args.seatingArea?.trim() || "terraza",
      specialNotes: args.specialNotes?.trim() || undefined,
      notes: args.specialNotes?.trim() || undefined,
      source: args.source?.trim() || "web",
      date: cleanDate,
      time: cleanTime,
      requestedDate: cleanDate,
      requestedTime: cleanTime,
      status: "Pendiente" as const,
      createdAt: now,
      updatedAt: now,
    };

    const insertedId = await ctx.db.insert("restaurant_reservations", reservationDoc);

    // Emitir notificaciones operativas para Administrador y Dueño
    try {
      const notifMessage = `Nueva solicitud de reservación de ${cleanFullName} para el ${cleanDate} a las ${cleanTime} (${partySizeNumber} comensales).`;
      await ctx.db.insert("notifications", {
        id: `notif-res-adm-${now}-${Math.random().toString(36).substring(2, 6)}`,
        title: "Nueva Reservación Recibida",
        message: notifMessage,
        targetRole: "ADMIN_GENERAL",
        timestamp: now,
        isRead: false,
      });

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
      const ownerUserId = ownerUser ? ownerUser.id : "u-dueno";

      await ctx.db.insert("notifications", {
        id: `notif-res-due-${now}-${Math.random().toString(36).substring(2, 6)}`,
        title: "Nueva Reservación Recibida",
        message: notifMessage,
        targetUserId: ownerUserId,
        timestamp: now,
        isRead: false,
      });

      // Enviar notificación push externa a través del servicio Pushy de forma asíncrona
      await ctx.scheduler.runAfter(0, internal.notifications.sendPushyNotification, {
        title: "Nueva Reservación Recibida",
        message: notifMessage,
        type: "RESERVACION",
        reservationId: reservationId,
      });
    } catch (e) {
      console.error("Error al registrar notificación de reservación:", e);
    }

    return {
      _id: insertedId,
      ...reservationDoc,
    };
  },
});

/**
 * Alias público para compatibilidad exacta con clientes web existentes.
 */
export const submitReservation = createPublicReservation;

// ==========================================
// CONSULTAS ADMINISTRATIVAS (ANDROID & PANEL)
// ==========================================

export const listReservations = query({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    status: v.optional(v.string()),
    date: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "consultar reservaciones" }
    );

    let queryBuilder = ctx.db.query("restaurant_reservations");

    let results = await queryBuilder.collect();

    // Filtro por estado
    if (args.status && args.status.trim() !== "") {
      const targetStatus = args.status.trim();
      results = results.filter((r) => r.status === targetStatus);
    }

    // Filtro por fecha puntual
    if (args.date && args.date.trim() !== "") {
      const targetDate = args.date.trim();
      results = results.filter((r) => r.date === targetDate);
    }

    // Filtro por rango de fechas
    if (args.startDate && args.startDate.trim() !== "") {
      const start = args.startDate.trim();
      results = results.filter((r) => r.date >= start);
    }
    if (args.endDate && args.endDate.trim() !== "") {
      const end = args.endDate.trim();
      results = results.filter((r) => r.date <= end);
    }

    // Orden cronológico inverso (las más recientes primero)
    results.sort((a, b) => b.createdAt - a.createdAt);

    if (args.limit && args.limit > 0) {
      results = results.slice(0, args.limit);
    }

    return results.map((r) => ({
      _id: r._id,
      id: r.id,
      fullName: r.fullName,
      emailOrPhone: r.emailOrPhone || "",
      email: r.email || null,
      phone: r.phone || null,
      partySize: r.partySize || 2,
      seatingArea: r.seatingArea || "terraza",
      specialNotes: r.specialNotes || r.notes || null,
      notes: r.notes || r.specialNotes || null,
      source: r.source || "web",
      date: r.date,
      time: r.time,
      requestedDate: r.requestedDate || r.date,
      requestedTime: r.requestedTime || r.time,
      tableId: r.tableId || r.assignedTableId || null,
      assignedTableId: r.assignedTableId || r.tableId || null,
      tableNumber: r.tableNumber ?? r.assignedTableNumber ?? null,
      assignedTableNumber: r.assignedTableNumber ?? r.tableNumber ?? null,
      status: r.status,
      alternativeDate: r.alternativeDate || null,
      alternativeTime: r.alternativeTime || null,
      alternativeNotes: r.alternativeNotes || r.negotiationNotes || null,
      rejectionReason: r.rejectionReason || null,
      rejectedAt: r.rejectedAt || null,
      rejectedByUserId: r.rejectedByUserId || null,
      consolidatedAt: r.consolidatedAt || null,
      consolidatedByUserId: r.consolidatedByUserId || null,
      markedAt: r.markedAt || null,
      markedByUserId: r.markedByUserId || null,
      markedByUserName: r.markedByUserName || null,
      customerId: r.customerId || null,
      createdAt: r.createdAt ?? r._creationTime,
      updatedAt: r.updatedAt,
    }));
  },
});

/**
 * Alias administrativo para listReservations
 */
export const getReservations = listReservations;

export const getReservation = query({
  args: {
    id: v.optional(v.string()),
    reservationId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lookupId = (args.id || args.reservationId || "").trim();
    if (!lookupId) {
      throw new Error("Debe proporcionar un ID de reservación.");
    }

    if (args.sessionToken || args.userId) {
      await authorizeOwnerOrAdmin(
        ctx,
        { sessionToken: args.sessionToken, userId: args.userId },
        { actionDescription: "consultar detalle de reservación" }
      );
    }

    const byCustomId = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_custom_id", (q) => q.eq("id", lookupId))
      .first();

    if (byCustomId) {
      return byCustomId;
    }

    // Si lookupId es un Id de Convex
    try {
      const byDocId = await ctx.db.get(lookupId as any);
      if (byDocId && "status" in byDocId) {
        return byDocId;
      }
    } catch {
      // Ignorar si no es un Id válido de Convex
    }

    return null;
  },
});

export const getReservationById = getReservation;

/**
 * Consulta pública del estado de una reservación para la web y clientes.
 * Permite verificar el estado mediante ID, código de seguimiento o datos de contacto.
 */
export const getPublicReservationStatus = query({
  args: {
    id: v.optional(v.string()),
    reservationId: v.optional(v.string()),
    trackingCode: v.optional(v.string()),
    code: v.optional(v.string()),
    emailOrPhone: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetId = args.id?.trim() || args.reservationId?.trim() || args.code?.trim() || args.trackingCode?.trim();
    const contactInput = args.emailOrPhone?.trim() || args.phone?.trim();

    if (!targetId && !contactInput) {
      throw new Error("Debe proporcionar un ID de reservación, código de seguimiento o teléfono de contacto.");
    }

    let reservationDoc = null;

    if (targetId) {
      reservationDoc = await ctx.db
        .query("restaurant_reservations")
        .withIndex("by_custom_id", (q) => q.eq("id", targetId))
        .first();

      if (!reservationDoc) {
        try {
          const docById = await ctx.db.get(targetId as any);
          if (docById && "fullName" in docById && "status" in docById) {
            reservationDoc = docById;
          }
        } catch {
          // Ignorar
        }
      }
    }

    if (!reservationDoc && contactInput) {
      const allRes = await ctx.db.query("restaurant_reservations").collect();
      reservationDoc = allRes.find((r) =>
        r.emailOrPhone.toLowerCase() === contactInput.toLowerCase() ||
        (r.phone && r.phone.toLowerCase() === contactInput.toLowerCase()) ||
        (r.email && r.email.toLowerCase() === contactInput.toLowerCase())
      ) || null;
    }

    if (!reservationDoc) {
      return null;
    }

    return {
      id: reservationDoc.id,
      fullName: reservationDoc.fullName,
      date: reservationDoc.date,
      time: reservationDoc.time,
      partySize: reservationDoc.partySize,
      status: reservationDoc.status,
      tableNumber: reservationDoc.tableNumber || reservationDoc.assignedTableNumber || null,
      seatingArea: reservationDoc.seatingArea || "terraza",
      alternativeDate: reservationDoc.alternativeDate || null,
      alternativeTime: reservationDoc.alternativeTime || null,
      alternativeNotes: reservationDoc.alternativeNotes || null,
      rejectionReason: reservationDoc.rejectionReason || null,
      createdAt: reservationDoc.createdAt,
      updatedAt: reservationDoc.updatedAt,
    };
  },
});

// ==========================================
// MUTACIONES ADMINISTRATIVAS (GESTIÓN DE ESTADOS)
// ==========================================

export const updateReservationStatus = mutation({
  args: {
    id: v.string(), // ID o customId de la reservación
    status: v.union(
      v.literal("Pendiente"),
      v.literal("Negociación"),
      v.literal("Confirmado"),
      v.literal("Rechazado"),
      v.literal("Consolidado"),
      v.literal("Marcada")
    ),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    tableId: v.optional(v.string()),
    tableNumber: v.optional(v.number()),
    assignedTableId: v.optional(v.string()),
    assignedTableNumber: v.optional(v.number()),
    alternativeDate: v.optional(v.string()),
    alternativeTime: v.optional(v.string()),
    alternativeNotes: v.optional(v.string()),
    negotiationNotes: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    notes: v.optional(v.string()),
    specialNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "actualizar estado de reservación" }
    );

    const lookupId = args.id.trim();
    let reservation = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_custom_id", (q) => q.eq("id", lookupId))
      .first();

    if (!reservation) {
      try {
        const byDocId = await ctx.db.get(lookupId as any);
        if (byDocId && "status" in byDocId) {
          reservation = byDocId as any;
        }
      } catch {
        // Ignorar
      }
    }

    if (!reservation) {
      throw new Error(`Reservación con identificador '${lookupId}' no encontrada.`);
    }

    // Validar transición de estado
    if (reservation.status === "Consolidado" && args.status !== "Consolidado") {
      throw new Error("No es posible modificar el estado de una reservación ya consolidada.");
    }

    const now = Date.now();
    const patch: Record<string, any> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.status === "Confirmado") {
      patch.confirmedAt = now;
      patch.confirmedByUserId = auth.user.id;
      const assignedTId = args.tableId?.trim() || args.assignedTableId?.trim();
      if (assignedTId) {
        patch.tableId = assignedTId;
        patch.assignedTableId = assignedTId;
      }
      const assignedTNum = args.tableNumber ?? args.assignedTableNumber;
      if (assignedTNum !== undefined) {
        patch.tableNumber = assignedTNum;
        patch.assignedTableNumber = assignedTNum;
      }
    } else if (args.status === "Negociación") {
      if (args.alternativeDate?.trim()) {
        patch.alternativeDate = args.alternativeDate.trim();
      }
      if (args.alternativeTime?.trim()) {
        patch.alternativeTime = args.alternativeTime.trim();
      }
      const altNotes = (args.alternativeNotes || args.negotiationNotes)?.trim();
      if (altNotes) {
        patch.alternativeNotes = altNotes;
        patch.negotiationNotes = altNotes;
      }
      patch.proposedAt = now;
      patch.proposedByUserId = auth.user.id;
    } else if (args.status === "Rechazado") {
      patch.rejectionReason = args.rejectionReason?.trim() || "Capacidad no disponible";
      patch.rejectedAt = now;
      patch.rejectedByUserId = auth.user.id;
    } else if (args.status === "Consolidado") {
      patch.consolidatedAt = now;
      patch.consolidatedByUserId = auth.user.id;
    } else if (args.status === "Marcada") {
      patch.markedAt = now;
      patch.markedByUserId = auth.user.id;
      patch.markedByUserName = auth.user.fullName;
    }

    if (args.notes?.trim()) {
      patch.notes = args.notes.trim();
    }
    if (args.specialNotes?.trim()) {
      patch.specialNotes = args.specialNotes.trim();
    }

    await ctx.db.patch(reservation._id, patch);

    return {
      ...reservation,
      ...patch,
    };
  },
});

export const deleteReservation = mutation({
  args: {
    id: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "eliminar reservación" }
    );

    const lookupId = args.id.trim();
    let reservation = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_custom_id", (q) => q.eq("id", lookupId))
      .first();

    if (!reservation) {
      try {
        const byDocId = await ctx.db.get(lookupId as any);
        if (byDocId && "status" in byDocId) {
          reservation = byDocId as any;
        }
      } catch {
        // Ignorar
      }
    }

    if (!reservation) {
      throw new Error(`Reservación con identificador '${lookupId}' no encontrada.`);
    }

    await ctx.db.delete(reservation._id);

    if (reservation.customerId) {
      await recalculateCustomerStats(ctx, reservation.customerId);
    }

    return { success: true, id: lookupId };
  },
});

// ==========================================
// CONSOLIDACIÓN DE LLEGADAS Y CLIENTES (FASE 6.7)
// ==========================================

export async function recalculateCustomerStats(ctx: any, customerId: string) {
  if (!customerId) return;
  const customer = await ctx.db
    .query("restaurant_customers")
    .withIndex("by_custom_id", (q: any) => q.eq("id", customerId))
    .first();

  if (!customer) return;

  const consolidatedRes = await ctx.db
    .query("restaurant_reservations")
    .withIndex("by_customer", (q: any) => q.eq("customerId", customerId))
    .collect();

  const activeConsolidated = consolidatedRes.filter((r: any) => r.status === "Consolidado");
  const totalVisits = activeConsolidated.length;
  let lastVisitAt: number | undefined = undefined;

  if (activeConsolidated.length > 0) {
    const dates = activeConsolidated.map((r: any) => r.consolidatedAt || r.updatedAt || r.createdAt);
    lastVisitAt = Math.max(...dates);
  }

  await ctx.db.patch(customer._id, {
    totalVisits,
    lastVisitAt: lastVisitAt || customer.lastVisitAt,
    updatedAt: Date.now(),
  });
}

export const consolidateReservation = mutation({
  args: {
    reservationId: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "consolidar reservación" }
    );

    const lookupId = args.reservationId.trim();
    let reservation = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_custom_id", (q) => q.eq("id", lookupId))
      .first();

    if (!reservation) {
      try {
        const byDocId = await ctx.db.get(lookupId as any);
        if (byDocId && "status" in byDocId) {
          reservation = byDocId as any;
        }
      } catch (_) {}
    }

    if (!reservation) {
      throw new Error(`Reservación con identificador '${lookupId}' no encontrada.`);
    }

    if (reservation.status !== "Confirmado" && reservation.status !== "Consolidado") {
      throw new Error(`Sólo las reservaciones en estado 'Confirmado' se pueden consolidar (Estado actual: '${reservation.status}').`);
    }

    const now = Date.now();

    // Normalizar datos de contacto del cliente
    const rawPhone = reservation.phone || reservation.emailOrPhone;
    const cleanPhone = rawPhone.replace(/[^\d+]/g, "").trim();
    const cleanEmail = reservation.email?.trim().toLowerCase() || (reservation.emailOrPhone.includes("@") ? reservation.emailOrPhone.trim().toLowerCase() : undefined);

    let customerDoc: any = null;

    if (cleanPhone) {
      customerDoc = await ctx.db
        .query("restaurant_customers")
        .withIndex("by_phone", (q) => q.eq("phone", cleanPhone))
        .first();
    }

    if (!customerDoc && cleanEmail) {
      customerDoc = await ctx.db
        .query("restaurant_customers")
        .withIndex("by_email", (q) => q.eq("email", cleanEmail))
        .first();
    }

    if (!customerDoc) {
      const newCustId = `cust-${now}-${Math.random().toString(36).substring(2, 8)}`;
      const newDoc = {
        id: newCustId,
        fullName: reservation.fullName.trim(),
        phone: cleanPhone || undefined,
        email: cleanEmail || undefined,
        notes: reservation.specialNotes?.trim() || undefined,
        totalVisits: 0,
        lastVisitAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const insertedId = await ctx.db.insert("restaurant_customers", newDoc);
      customerDoc = { _id: insertedId, ...newDoc };
    }

    const patch: Record<string, any> = {
      status: "Consolidado" as const,
      consolidatedAt: reservation.consolidatedAt || now,
      consolidatedByUserId: auth.user.id,
      customerId: customerDoc.id,
      updatedAt: now,
    };

    if (args.notes?.trim()) {
      patch.notes = args.notes.trim();
    }

    await ctx.db.patch(reservation._id, patch);

    // Recalcular estadísticas del cliente de forma idempotente
    await recalculateCustomerStats(ctx, customerDoc.id);

    return {
      ...reservation,
      ...patch,
      customerName: customerDoc.fullName,
    };
  },
});

export const markReservationAsNoShow = mutation({
  args: {
    reservationId: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "marcar inasistencia" }
    );

    const lookupId = args.reservationId.trim();
    let reservation = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_custom_id", (q) => q.eq("id", lookupId))
      .first();

    if (!reservation) {
      try {
        const byDocId = await ctx.db.get(lookupId as any);
        if (byDocId && "status" in byDocId) {
          reservation = byDocId as any;
        }
      } catch (_) {}
    }

    if (!reservation) {
      throw new Error(`Reservación con identificador '${lookupId}' no encontrada.`);
    }

    if (reservation.status !== "Confirmado" && reservation.status !== "Marcada") {
      throw new Error(`Sólo las reservaciones en estado 'Confirmado' se pueden marcar como no asistencia (Estado actual: '${reservation.status}').`);
    }

    const now = Date.now();

    // Normalizar datos de contacto del cliente para vinculación (opcional pero recomendada para el historial)
    const rawPhone = reservation.phone || reservation.emailOrPhone;
    const cleanPhone = rawPhone.replace(/[^\d+]/g, "").trim();
    const cleanEmail = reservation.email?.trim().toLowerCase() || (reservation.emailOrPhone.includes("@") ? reservation.emailOrPhone.trim().toLowerCase() : undefined);

    let customerDoc: any = null;

    if (cleanPhone) {
      customerDoc = await ctx.db
        .query("restaurant_customers")
        .withIndex("by_phone", (q) => q.eq("phone", cleanPhone))
        .first();
    }

    if (!customerDoc && cleanEmail) {
      customerDoc = await ctx.db
        .query("restaurant_customers")
        .withIndex("by_email", (q) => q.eq("email", cleanEmail))
        .first();
    }

    // Si no existe el cliente, lo creamos para tener el registro del "no show" asociado a su identidad
    if (!customerDoc) {
      const newCustId = `cust-${now}-${Math.random().toString(36).substring(2, 8)}`;
      const newDoc = {
        id: newCustId,
        fullName: reservation.fullName.trim(),
        phone: cleanPhone || undefined,
        email: cleanEmail || undefined,
        notes: reservation.specialNotes?.trim() || undefined,
        totalVisits: 0,
        lastVisitAt: undefined,
        createdAt: now,
        updatedAt: now,
      };
      const insertedId = await ctx.db.insert("restaurant_customers", newDoc);
      customerDoc = { _id: insertedId, ...newDoc };
    }

    const patch: Record<string, any> = {
      status: "Marcada" as const,
      markedAt: reservation.markedAt || now,
      markedByUserId: auth.user.id,
      markedByUserName: auth.user.fullName,
      customerId: customerDoc.id,
      updatedAt: now,
    };

    if (args.notes?.trim()) {
      patch.notes = args.notes.trim();
    }

    await ctx.db.patch(reservation._id, patch);

    // Recalcular estadísticas del cliente (asegura que las visitas sigan siendo 0 si es nuevo)
    await recalculateCustomerStats(ctx, customerDoc.id);

    return {
      ...reservation,
      ...patch,
      customerName: customerDoc.fullName,
    };
  },
});

export const listCustomers = query({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "consultar clientes" }
    );

    let customers = await ctx.db.query("restaurant_customers").collect();

    if (args.searchQuery && args.searchQuery.trim() !== "") {
      const q = args.searchQuery.trim().toLowerCase();
      customers = customers.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }

    customers.sort((a, b) => (b.lastVisitAt || 0) - (a.lastVisitAt || 0));
    return customers;
  },
});

export const getCustomerDetails = query({
  args: {
    customerId: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "consultar detalle de cliente" }
    );

    const lookupId = args.customerId.trim();
    const customer = await ctx.db
      .query("restaurant_customers")
      .withIndex("by_custom_id", (q) => q.eq("id", lookupId))
      .first();

    if (!customer) {
      throw new Error(`Cliente con ID '${lookupId}' no encontrado.`);
    }

    const reservations = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_customer", (q) => q.eq("customerId", lookupId))
      .collect();

    reservations.sort((a, b) => b.createdAt - a.createdAt);

    return {
      customer,
      reservations,
      totalVisits: reservations.filter((r) => r.status === "Consolidado").length,
    };
  },
});

export const getBarTerrazaStats = query({
  args: {
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "consultar estadísticas de Bar Terraza" }
    );

    const allReservations = await ctx.db.query("restaurant_reservations").collect();
    const allCustomers = await ctx.db.query("restaurant_customers").collect();

    const totalConsolidated = allReservations.filter((r) => r.status === "Consolidado").length;
    const totalPending = allReservations.filter((r) => r.status === "Pendiente").length;
    const totalConfirmed = allReservations.filter((r) => r.status === "Confirmado").length;
    const totalNegotiation = allReservations.filter((r) => r.status === "Negociación").length;

    const recurringCustomers = allCustomers.filter((c) => c.totalVisits > 1).length;

    return {
      totalConsolidatedVisits: totalConsolidated,
      totalUniqueCustomers: allCustomers.length,
      recurringCustomersCount: recurringCustomers,
      totalPendingReservations: totalPending,
      totalConfirmedReservations: totalConfirmed,
      totalNegotiationReservations: totalNegotiation,
    };
  },
});

// ==========================================
// MIGRACIÓN DE DATOS PREVIOS / LEGACY
// ==========================================

export const migrateExistingReservationStatuses = mutation({
  args: {},
  handler: async (ctx) => {
    const reservations = await ctx.db.query("restaurant_reservations").collect();
    let updatedCount = 0;

    for (const r of reservations) {
      let newStatus: "Pendiente" | "Negociación" | "Confirmado" | "Consolidado" | "Rechazado" | "Marcada" | null = null;
      const raw = String(r.status || "").trim().toLowerCase();

      if (raw === "pending" || raw === "pendiente") {
        newStatus = "Pendiente";
      } else if (raw === "propuesta enviada" || raw === "negotiation" || raw === "negociacion" || raw === "negociación") {
        newStatus = "Negociación";
      } else if (raw === "confirmed" || raw === "confirmado" || raw === "confirmada") {
        newStatus = "Confirmado";
      } else if (raw === "rejected" || raw === "rechazado" || raw === "rechazada" || raw === "cancelled" || raw === "cancelado" || raw === "cancelada") {
        newStatus = "Rechazado";
      } else if (raw === "consolidated" || raw === "consolidado" || raw === "consolidada") {
        newStatus = "Consolidado";
      } else if (raw === "marked" || raw === "marcado" || raw === "marcada") {
        newStatus = "Marcada";
      }

      if (newStatus && newStatus !== r.status) {
        await ctx.db.patch(r._id, {
          status: newStatus,
          updatedAt: Date.now(),
        });
        updatedCount++;
      }
    }

    return {
      total: reservations.length,
      updatedCount,
    };
  },
});

// ==========================================
// CÁLCULO DE INTERVALOS Y HORARIOS DE OPERACIÓN (FASE 6.3)
// ==========================================

export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const clean = timeStr.trim();

  // Formato 12 horas con AM/PM: e.g. "8:00 PM", "08:30 am", "12:15 PM"
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const meridiem = match12[3].toUpperCase();
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (meridiem === "AM") {
      if (hours === 12) hours = 0;
    } else {
      if (hours !== 12) hours += 12;
    }
    return hours * 60 + minutes;
  }

  // Formato 24 horas: e.g. "20:00", "08:30", "00:00", "23:59"
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
    if (hours === 24 && minutes === 0) return 1440;
    return hours * 60 + minutes;
  }

  return null;
}

export function parseDateToDayIndex(dateStr: string): number | null {
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export function getAbsoluteMinutes(dateStr: string, timeStr: string): number | null {
  const dayIndex = parseDateToDayIndex(dateStr);
  const timeMinutes = parseTimeToMinutes(timeStr);
  if (dayIndex === null || timeMinutes === null) return null;
  return dayIndex * 1440 + timeMinutes;
}

export function doIntervalsOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  // Intervalo semiabierto [Inicio, Fin): no hay conflicto si e1 == s2 o e2 == s1
  return s1 < e2 && s2 < e1;
}

/**
 * Valida si una fecha y hora solicitada cae dentro del horario de apertura del local.
 */
export async function checkEstablishmentSchedule(
  ctx: any,
  dateStr: string,
  timeStr: string
): Promise<{ isOpen: boolean; reason?: string }> {
  const dateMatch = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    return { isOpen: false, reason: "Formato de fecha inválido (debe ser YYYY-MM-DD)." };
  }
  const timeMin = parseTimeToMinutes(timeStr);
  if (timeMin === null) {
    return { isOpen: false, reason: "Formato de hora inválido." };
  }

  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const day = parseInt(dateMatch[3], 10);
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const jsDay = utcDate.getUTCDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;

  const scheduleDoc = await ctx.db
    .query("shift_schedules")
    .withIndex("by_custom_id", (q: any) => q.eq("id", "default"))
    .first();

  const weeklySchedule = scheduleDoc?.weeklySchedule || [];
  const dayConfig = weeklySchedule.find((d: any) => d.dayOfWeek === dayOfWeek);

  if (!dayConfig || !dayConfig.enabled) {
    const dayName = dayConfig?.dayName || "el día seleccionado";
    return {
      isOpen: false,
      reason: `El Bar-Terraza se encuentra cerrado los días ${dayName}.`,
    };
  }

  // Sesión 1
  const s1OpenStr = dayConfig.session1OpenTime || dayConfig.openTime || "";
  const s1CloseStr = dayConfig.session1CloseTime || dayConfig.closeTime || "";
  const s1Open = parseTimeToMinutes(s1OpenStr);
  const s1Close = parseTimeToMinutes(s1CloseStr);

  let inSession1 = false;
  if (s1Open !== null && s1Close !== null) {
    if (s1Close >= s1Open) {
      inSession1 = timeMin >= s1Open && timeMin <= s1Close;
    } else {
      inSession1 = timeMin >= s1Open || timeMin <= s1Close;
    }
  }

  // Sesión 2
  let inSession2 = false;
  if (dayConfig.session2Enabled) {
    const s2OpenStr = dayConfig.session2OpenTime || dayConfig.openTime2 || "";
    const s2CloseStr = dayConfig.session2CloseTime || dayConfig.closeTime2 || "";
    const s2Open = parseTimeToMinutes(s2OpenStr);
    const s2Close = parseTimeToMinutes(s2CloseStr);

    if (s2Open !== null && s2Close !== null) {
      if (s2Close === 0 || s2Close === 1440) {
        inSession2 = timeMin >= s2Open;
      } else if (s2Close > s2Open) {
        inSession2 = timeMin >= s2Open && timeMin <= s2Close;
      } else {
        // Cierre post-medianoche (e.g. 18:00 a 02:00)
        inSession2 = timeMin >= s2Open || timeMin <= s2Close;
      }
    }
  }

  // Verificación si la hora temprana pertenece al turno nocturno del día anterior
  if (!inSession1 && !inSession2 && timeMin <= 360) {
    const prevDayOfWeek = dayOfWeek === 1 ? 7 : dayOfWeek - 1;
    const prevConfig = weeklySchedule.find((d: any) => d.dayOfWeek === prevDayOfWeek);
    if (prevConfig?.enabled && prevConfig?.session2Enabled) {
      const prevCloseStr = prevConfig.session2CloseTime || prevConfig.closeTime2 || "";
      const prevOpenStr = prevConfig.session2OpenTime || prevConfig.openTime2 || "";
      const prevClose = parseTimeToMinutes(prevCloseStr);
      const prevOpen = parseTimeToMinutes(prevOpenStr);
      if (prevClose !== null && prevOpen !== null && prevClose < prevOpen) {
        if (timeMin <= prevClose) {
          inSession2 = true;
        }
      }
    }
  }

  if (!inSession1 && !inSession2) {
    return {
      isOpen: false,
      reason: `El horario solicitado (${timeStr}) está fuera de las sesiones de apertura configuradas para el ${dayConfig.dayName}.`,
    };
  }

  return { isOpen: true };
}

// ==========================================
// CONSULTA DE DISPONIBILIDAD DE MESAS (FASE 6.3)
// ==========================================

export const checkTableAvailability = query({
  args: {
    reservationId: v.optional(v.string()),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    partySize: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let targetDate = args.date?.trim() || "";
    let targetTime = args.time?.trim() || "";
    let targetPartySize = args.partySize !== undefined && args.partySize > 0 ? Math.round(args.partySize) : 0;
    let excludeResId: string | null = null;

    if (args.reservationId && args.reservationId.trim() !== "") {
      const lookupId = args.reservationId.trim();
      let resDoc = await ctx.db
        .query("restaurant_reservations")
        .withIndex("by_custom_id", (q) => q.eq("id", lookupId))
        .first();

      if (!resDoc) {
        try {
          const byDocId = await ctx.db.get(lookupId as any);
          if (byDocId && "status" in byDocId) {
            resDoc = byDocId as any;
          }
        } catch (_) {}
      }

      if (resDoc) {
        excludeResId = resDoc.id;
        if (!targetDate) targetDate = resDoc.date;
        if (!targetTime) targetTime = resDoc.time;
        if (targetPartySize <= 0) targetPartySize = resDoc.partySize;
      }
    }

    if (!targetDate) {
      throw new Error("Debe especificar una fecha para comprobar disponibilidad.");
    }
    if (!targetTime) {
      throw new Error("Debe especificar una hora para comprobar disponibilidad.");
    }
    if (targetPartySize <= 0) {
      targetPartySize = 2;
    }

    const requestedAbsMinutes = getAbsoluteMinutes(targetDate, targetTime);
    if (requestedAbsMinutes === null) {
      throw new Error("La fecha u hora proporcionadas no son válidas.");
    }

    // Regla de margen de 2 horas antes y 2 horas después
    const reqStart = requestedAbsMinutes - 120;
    const reqEnd = requestedAbsMinutes + 120;

    // Validación de horario de apertura
    const scheduleCheck = await checkEstablishmentSchedule(ctx, targetDate, targetTime);

    // Consulta de todas las mesas del restaurante
    const allTables = await ctx.db.query("restaurant_tables").collect();
    allTables.sort((a, b) => a.number - b.number);

    // Consulta de todas las reservaciones activas (Confirmado o Consolidado)
    const allConfirmed = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_status", (q) => q.eq("status", "Confirmado"))
      .collect();

    const allConsolidated = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_status", (q) => q.eq("status", "Consolidado"))
      .collect();

    const blockingReservations = [...allConfirmed, ...allConsolidated].filter((r) => {
      if (excludeResId && (r.id === excludeResId || (r as any)._id === excludeResId)) {
        return false;
      }
      return true;
    });

    const availableTables: any[] = [];
    const unavailableTables: any[] = [];

    for (const table of allTables) {
      // 1. Estado de habilitación de la mesa
      if (!table.active) {
        unavailableTables.push({
          id: table.id,
          number: table.number,
          name: table.name,
          capacity: table.capacity,
          active: false,
          reason: "Mesa deshabilitada para servicio",
        });
        continue;
      }

      // 2. Capacidad suficiente
      if (table.capacity < targetPartySize) {
        unavailableTables.push({
          id: table.id,
          number: table.number,
          name: table.name,
          capacity: table.capacity,
          active: true,
          reason: `Capacidad insuficiente (${table.capacity} comensales para grupo de ${targetPartySize})`,
        });
        continue;
      }

      // 3. Verificación de conflictos de superposición en [T - 2h, T + 2h)
      const tableReservations = blockingReservations.filter((r) => {
        const matchesTableId = r.tableId === table.id || r.assignedTableId === table.id;
        const matchesTableNum = r.tableNumber === table.number || r.assignedTableNumber === table.number;
        return matchesTableId || matchesTableNum;
      });

      let conflictFound: any = null;
      for (const res of tableReservations) {
        const resAbsMinutes = getAbsoluteMinutes(res.date, res.time);
        if (resAbsMinutes === null) continue;
        const resStart = resAbsMinutes - 120;
        const resEnd = resAbsMinutes + 120;

        if (doIntervalsOverlap(reqStart, reqEnd, resStart, resEnd)) {
          conflictFound = res;
          break;
        }
      }

      if (conflictFound) {
        unavailableTables.push({
          id: table.id,
          number: table.number,
          name: table.name,
          capacity: table.capacity,
          active: true,
          reason: `Ocupada por reservación confirmada de '${conflictFound.fullName}' a las ${conflictFound.time} (${conflictFound.date})`,
          conflictingReservation: {
            id: conflictFound.id,
            fullName: conflictFound.fullName,
            date: conflictFound.date,
            time: conflictFound.time,
            status: conflictFound.status,
            partySize: conflictFound.partySize,
          },
        });
      } else {
        availableTables.push({
          id: table.id,
          number: table.number,
          name: table.name,
          capacity: table.capacity,
          active: true,
        });
      }
    }

    return {
      requestedDate: targetDate,
      requestedTime: targetTime,
      partySize: targetPartySize,
      isStoreOpen: scheduleCheck.isOpen,
      storeOpenReason: scheduleCheck.isOpen ? null : scheduleCheck.reason,
      availableTables,
      unavailableTables,
      totalTables: allTables.length,
    };
  },
});

// ==========================================
// ASIGNACIÓN SEGURA Y ATÓMICA DE MESA (FASE 6.3)
// ==========================================

export const assignTableAndConfirmReservation = mutation({
  args: {
    reservationId: v.string(),
    tableId: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    forceOverrideSchedule: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "asignar mesa y confirmar reservación" }
    );

    const lookupResId = args.reservationId.trim();
    let reservation = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_custom_id", (q) => q.eq("id", lookupResId))
      .first();

    if (!reservation) {
      try {
        const byDocId = await ctx.db.get(lookupResId as any);
        if (byDocId && "status" in byDocId) {
          reservation = byDocId as any;
        }
      } catch (_) {}
    }

    if (!reservation) {
      throw new Error(`Reservación con identificador '${lookupResId}' no encontrada.`);
    }

    // 1. Validar estado asignable
    if (reservation.status === "Consolidado") {
      throw new Error("No es posible reasignar mesa a una reservación ya consolidada.");
    }
    if ((reservation.status as string) === "Cancelado" || reservation.status === "Rechazado") {
      throw new Error(`No es posible asignar mesa a una reservación en estado '${reservation.status}'.`);
    }

    // Determinación de fecha y hora efectivas (si proviene de Negociación, usar la propuesta aceptada)
    const effectiveDate = (reservation.status === "Negociación" && reservation.alternativeDate?.trim())
      ? reservation.alternativeDate.trim()
      : reservation.date;

    const effectiveTime = (reservation.status === "Negociación" && reservation.alternativeTime?.trim())
      ? reservation.alternativeTime.trim()
      : reservation.time;

    // 2. Validar horario de apertura del local para la fecha/hora efectiva
    const scheduleCheck = await checkEstablishmentSchedule(ctx, effectiveDate, effectiveTime);
    if (!scheduleCheck.isOpen && !args.forceOverrideSchedule) {
      throw new Error(`No se puede confirmar la reservación: ${scheduleCheck.reason}`);
    }

    // 3. Obtener y validar la mesa en restaurant_tables
    const lookupTableId = args.tableId.trim();
    let table = await ctx.db
      .query("restaurant_tables")
      .withIndex("by_custom_id", (q) => q.eq("id", lookupTableId))
      .first();

    if (!table) {
      try {
        const byDocId = await ctx.db.get(lookupTableId as any);
        if (byDocId && "number" in byDocId) {
          table = byDocId as any;
        }
      } catch (_) {}
    }

    if (!table) {
      throw new Error(`Mesa con identificador '${lookupTableId}' no encontrada.`);
    }

    if (!table.active) {
      throw new Error(`La mesa '${table.name}' (#${table.number}) está deshabilitada.`);
    }

    if (table.capacity < reservation.partySize) {
      throw new Error(
        `La mesa '${table.name}' tiene capacidad para ${table.capacity} personas, pero la reservación solicita espacio para ${reservation.partySize} comensales.`
      );
    }

    // 4. Verificación atómica de prevención de conflictos en el intervalo [T - 2h, T + 2h)
    const targetAbsMinutes = getAbsoluteMinutes(effectiveDate, effectiveTime);
    if (targetAbsMinutes === null) {
      throw new Error("La fecha u hora de la reservación no tienen un formato válido.");
    }

    const reqStart = targetAbsMinutes - 120;
    const reqEnd = targetAbsMinutes + 120;

    // Buscar reservaciones confirmadas o consolidadas asociadas a esta mesa
    const confirmedOnTable = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_tableId", (q) => q.eq("tableId", table.id))
      .collect();

    const otherReservations = confirmedOnTable.filter(
      (r) =>
        (r.status === "Confirmado" || r.status === "Consolidado") &&
        r._id !== reservation._id &&
        r.id !== reservation.id
    );

    // También comprobar por tableNumber para consistencia histórica
    const allByStatus = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_status", (q) => q.eq("status", "Confirmado"))
      .collect();
    const allConsolidated = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_status", (q) => q.eq("status", "Consolidado"))
      .collect();

    const extraChecks = [...allByStatus, ...allConsolidated].filter(
      (r) =>
        (r.tableNumber === table.number || r.assignedTableNumber === table.number) &&
        r._id !== reservation._id &&
        r.id !== reservation.id &&
        !otherReservations.some((o) => o._id === r._id)
    );

    const candidates = [...otherReservations, ...extraChecks];

    for (const conflict of candidates) {
      const conflictAbsMinutes = getAbsoluteMinutes(conflict.date, conflict.time);
      if (conflictAbsMinutes === null) continue;
      const conflictStart = conflictAbsMinutes - 120;
      const conflictEnd = conflictAbsMinutes + 120;

      if (doIntervalsOverlap(reqStart, reqEnd, conflictStart, conflictEnd)) {
        throw new Error(
          `Conflicto de asignación: La mesa '${table.name}' (#${table.number}) ya se encuentra reservada por '${conflict.fullName}' a las ${conflict.time} (${conflict.date}). Se debe respetar un margen de 2 horas antes y 2 horas después de cada reservación.`
        );
      }
    }

    // 5. Asignación atómica segura y confirmación
    const now = Date.now();
    const patch: Record<string, any> = {
      date: effectiveDate,
      time: effectiveTime,
      tableId: table.id,
      tableNumber: table.number,
      assignedTableId: table.id,
      assignedTableNumber: table.number,
      status: "Confirmado" as const,
      confirmedAt: now,
      confirmedByUserId: auth.user.id,
      updatedAt: now,
    };

    await ctx.db.patch(reservation._id, patch);

    return {
      ...reservation,
      ...patch,
      tableName: table.name,
      tableCapacity: table.capacity,
    };
  },
});

export const assignAndConfirmReservation = assignTableAndConfirmReservation;

// ==========================================
// BUSQUEDA DE HORARIOS ALTERNATIVOS Y ACEPTACIÓN (FASE 6.4)
// ==========================================

export const findAlternativeSlots = query({
  args: {
    reservationId: v.optional(v.string()),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    partySize: v.optional(v.number()),
    daysAhead: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let targetDate = args.date?.trim() || "";
    let targetTime = args.time?.trim() || "";
    let targetPartySize = args.partySize !== undefined && args.partySize > 0 ? Math.round(args.partySize) : 0;
    let excludeResId: string | null = null;

    if (args.reservationId && args.reservationId.trim() !== "") {
      const lookupId = args.reservationId.trim();
      let resDoc = await ctx.db
        .query("restaurant_reservations")
        .withIndex("by_custom_id", (q) => q.eq("id", lookupId))
        .first();

      if (!resDoc) {
        try {
          const byDocId = await ctx.db.get(lookupId as any);
          if (byDocId && "status" in byDocId) {
            resDoc = byDocId as any;
          }
        } catch (_) {}
      }

      if (resDoc) {
        excludeResId = resDoc.id;
        if (!targetDate) targetDate = resDoc.date;
        if (!targetTime) targetTime = resDoc.time;
        if (targetPartySize <= 0) targetPartySize = resDoc.partySize;
      }
    }

    if (!targetDate) {
      targetDate = new Date().toISOString().split("T")[0];
    }
    if (targetPartySize <= 0) {
      targetPartySize = 2;
    }

    const maxDays = Math.min(Math.max(args.daysAhead || 4, 1), 7);
    const allTables = await ctx.db.query("restaurant_tables").collect();
    const activeTables = allTables.filter((t) => t.active && t.capacity >= targetPartySize);

    if (activeTables.length === 0) {
      return {
        requestedDate: targetDate,
        requestedTime: targetTime,
        partySize: targetPartySize,
        alternativeSlots: [],
        message: `No existen mesas activas con capacidad para ${targetPartySize} personas.`,
      };
    }

    const allConfirmed = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_status", (q) => q.eq("status", "Confirmado"))
      .collect();

    const allConsolidated = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_status", (q) => q.eq("status", "Consolidado"))
      .collect();

    const blockingReservations = [...allConfirmed, ...allConsolidated].filter((r) => {
      if (excludeResId && (r.id === excludeResId || (r as any)._id === excludeResId)) {
        return false;
      }
      return true;
    });

    const candidateSlots: Array<{
      date: string;
      time: string;
      availableTableCount: number;
      sampleTableName: string;
    }> = [];

    const baseDayIndex = parseDateToDayIndex(targetDate);
    if (baseDayIndex === null) {
      return {
        requestedDate: targetDate,
        requestedTime: targetTime,
        partySize: targetPartySize,
        alternativeSlots: [],
        message: "Fecha base inválida.",
      };
    }

    // Horarios candidatos en incrementos de 30 minutos entre 12:00 y 23:30
    const timeCandidates: string[] = [];
    for (let h = 12; h <= 23; h++) {
      const hStr = h.toString().padStart(2, "0");
      timeCandidates.push(`${hStr}:00`);
      timeCandidates.push(`${hStr}:30`);
    }

    for (let d = 0; d < maxDays; d++) {
      const dayIdx = baseDayIndex + d;
      const dateObj = new Date(dayIdx * 86400000);
      const year = dateObj.getUTCFullYear();
      const month = (dateObj.getUTCMonth() + 1).toString().padStart(2, "0");
      const day = dateObj.getUTCDate().toString().padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      for (const timeStr of timeCandidates) {
        // Ignorar el horario exacto originalmente solicitado en el día 0
        if (d === 0 && timeStr === targetTime) {
          continue;
        }

        const candAbsMin = getAbsoluteMinutes(dateStr, timeStr);
        if (candAbsMin === null) continue;

        // Comprobar si el local está abierto
        const scheduleCheck = await checkEstablishmentSchedule(ctx, dateStr, timeStr);
        if (!scheduleCheck.isOpen) continue;

        const reqStart = candAbsMin - 120;
        const reqEnd = candAbsMin + 120;

        let freeTablesForSlot: typeof activeTables = [];

        for (const table of activeTables) {
          const tableReservations = blockingReservations.filter((r) => {
            const matchesTableId = r.tableId === table.id || r.assignedTableId === table.id;
            const matchesTableNum = r.tableNumber === table.number || r.assignedTableNumber === table.number;
            return matchesTableId || matchesTableNum;
          });

          let conflictFound = false;
          for (const res of tableReservations) {
            const resAbsMinutes = getAbsoluteMinutes(res.date, res.time);
            if (resAbsMinutes === null) continue;
            const resStart = resAbsMinutes - 120;
            const resEnd = resAbsMinutes + 120;

            if (doIntervalsOverlap(reqStart, reqEnd, resStart, resEnd)) {
              conflictFound = true;
              break;
            }
          }

          if (!conflictFound) {
            freeTablesForSlot.push(table);
          }
        }

        if (freeTablesForSlot.length > 0) {
          candidateSlots.push({
            date: dateStr,
            time: timeStr,
            availableTableCount: freeTablesForSlot.length,
            sampleTableName: freeTablesForSlot[0].name,
          });
        }

        if (candidateSlots.length >= 16) break;
      }
      if (candidateSlots.length >= 16) break;
    }

    return {
      requestedDate: targetDate,
      requestedTime: targetTime,
      partySize: targetPartySize,
      alternativeSlots: candidateSlots,
      message: candidateSlots.length > 0 ? null : "No se encontraron franjas libres cercanas.",
    };
  },
});

export const acceptProposedAlternative = mutation({
  args: {
    reservationId: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeOwnerOrAdmin(
      ctx,
      { sessionToken: args.sessionToken, userId: args.userId },
      { actionDescription: "aceptar propuesta de horario alternativo" }
    );

    const lookupResId = args.reservationId.trim();
    let reservation = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_custom_id", (q) => q.eq("id", lookupResId))
      .first();

    if (!reservation) {
      try {
        const byDocId = await ctx.db.get(lookupResId as any);
        if (byDocId && "status" in byDocId) {
          reservation = byDocId as any;
        }
      } catch (_) {}
    }

    if (!reservation) {
      throw new Error(`Reservación con identificador '${lookupResId}' no encontrada.`);
    }

    const proposedDate = reservation.alternativeDate || (reservation as any).proposedDate;
    const proposedTime = reservation.alternativeTime || (reservation as any).proposedTime;

    if (!proposedDate || !proposedTime) {
      throw new Error("La reservación no tiene una propuesta de fecha u hora alternativa registrada.");
    }

    const now = Date.now();
    const patch = {
      date: proposedDate,
      time: proposedTime,
      status: "Pendiente" as const, // Regresa a pendiente con la nueva fecha/hora acordada para ser confirmada/asignada
      acceptedAlternativeAt: now,
      acceptedByUserId: auth.user.id,
      updatedAt: now,
    };

    await ctx.db.patch(reservation._id, patch);

    return {
      ...reservation,
      ...patch,
    };
  },
});

// ==========================================
// OPERACIONES ADMINISTRATIVAS WEB (DVC ACTIVE + SESIÓN + ROL)
// ==========================================

async function findReservationByAnyId(ctx: any, rawId: string) {
  const lookupId = rawId.trim();
  let reservation = await ctx.db
    .query("restaurant_reservations")
    .withIndex("by_custom_id", (q: any) => q.eq("id", lookupId))
    .first();

  if (!reservation) {
    try {
      const byDocId = await ctx.db.get(lookupId as any);
      if (byDocId && "status" in byDocId) {
        reservation = byDocId as any;
      }
    } catch (_) {}
  }

  return reservation;
}

export const webListReservations = query({
  args: {
    sessionToken: v.string(),
    dvcCode: v.string(),
    status: v.optional(v.string()),
    date: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await authorizeWebReservationAdmin(
      ctx,
      { sessionToken: args.sessionToken, dvcCode: args.dvcCode },
      { actionDescription: "consultar reservaciones desde WEB" }
    );

    let results = await ctx.db.query("restaurant_reservations").collect();

    if (args.status && args.status.trim() !== "") {
      const targetStatus = args.status.trim();
      results = results.filter((r) => r.status === targetStatus);
    }

    if (args.date && args.date.trim() !== "") {
      const targetDate = args.date.trim();
      results = results.filter((r) => r.date === targetDate);
    }

    results.sort((a, b) => (b.createdAt ?? b._creationTime) - (a.createdAt ?? a._creationTime));

    if (args.limit && args.limit > 0) {
      results = results.slice(0, args.limit);
    }

    return results.map((r) => ({
      _id: r._id,
      id: r.id || r._id,
      fullName: r.fullName,
      emailOrPhone: r.emailOrPhone || "",
      email: r.email || null,
      phone: r.phone || null,
      partySize: r.partySize || 2,
      seatingArea: r.seatingArea || "terraza",
      specialNotes: r.specialNotes || r.notes || null,
      notes: r.notes || r.specialNotes || null,
      source: r.source || "web",
      date: r.date,
      time: r.time,
      requestedDate: r.requestedDate || r.date,
      requestedTime: r.requestedTime || r.time,
      tableId: r.tableId || r.assignedTableId || null,
      assignedTableId: r.assignedTableId || r.tableId || null,
      tableNumber: r.tableNumber ?? r.assignedTableNumber ?? null,
      assignedTableNumber: r.assignedTableNumber ?? r.tableNumber ?? null,
      status: r.status,
      alternativeDate: r.alternativeDate || (r as any).proposedDate || null,
      alternativeTime: r.alternativeTime || (r as any).proposedTime || null,
      alternativeNotes: r.alternativeNotes || r.negotiationNotes || null,
      rejectionReason: r.rejectionReason || (r as any).statusReason || null,
      rejectedAt: r.rejectedAt || null,
      rejectedByUserId: r.rejectedByUserId || null,
      cancelledAt: (r as any).cancelledAt || null,
      cancelledByUserId: (r as any).cancelledByUserId || null,
      consolidatedAt: r.consolidatedAt || null,
      consolidatedByUserId: r.consolidatedByUserId || null,
      markedAt: r.markedAt || null,
      markedByUserId: r.markedByUserId || null,
      markedByUserName: r.markedByUserName || null,
      customerId: r.customerId || null,
      createdAt: r.createdAt ?? r._creationTime,
      updatedAt: r.updatedAt,
    }));
  },
});

export const webGetBarTerrazaStats = query({
  args: {
    sessionToken: v.string(),
    dvcCode: v.string(),
  },
  handler: async (ctx, args) => {
    await authorizeWebReservationAdmin(
      ctx,
      { sessionToken: args.sessionToken, dvcCode: args.dvcCode },
      { actionDescription: "consultar métricas de reservaciones WEB" }
    );

    const allReservations = await ctx.db.query("restaurant_reservations").collect();
    const allCustomers = await ctx.db.query("restaurant_customers").collect();

    return {
      totalPending: allReservations.filter((r) => r.status === "Pendiente").length,
      totalConfirmed: allReservations.filter((r) => r.status === "Confirmado").length,
      totalNegotiation: allReservations.filter((r) => r.status === "Negociación").length,
      totalCancelled: allReservations.filter(
        (r) => r.status === "Rechazado" || (r.status as string) === "Cancelado"
      ).length,
      totalMarked: allReservations.filter((r) => r.status === "Marcada").length,
      totalConsolidated: allReservations.filter((r) => r.status === "Consolidado").length,
      totalUniqueCustomers: allCustomers.length,
      recurringCustomersCount: allCustomers.filter((c) => (c.totalVisits || 0) > 1).length,
    };
  },
});

export const webCheckTableAvailability = query({
  args: {
    sessionToken: v.string(),
    dvcCode: v.string(),
    reservationId: v.optional(v.string()),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    partySize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await authorizeWebReservationAdmin(
      ctx,
      { sessionToken: args.sessionToken, dvcCode: args.dvcCode },
      { actionDescription: "consultar disponibilidad de mesas WEB" }
    );

    let targetDate = args.date?.trim() || "";
    let targetTime = args.time?.trim() || "";
    let targetPartySize = args.partySize !== undefined && args.partySize > 0 ? Math.round(args.partySize) : 0;
    let excludeResId: string | null = null;

    if (args.reservationId && args.reservationId.trim() !== "") {
      const resDoc = await findReservationByAnyId(ctx, args.reservationId);
      if (resDoc) {
        excludeResId = resDoc.id || resDoc._id;
        if (!targetDate) targetDate = resDoc.date;
        if (!targetTime) targetTime = resDoc.time;
        if (targetPartySize <= 0) targetPartySize = resDoc.partySize;
      }
    }

    if (!targetDate || !targetTime) {
      throw new Error("Debe especificar fecha y hora para comprobar disponibilidad.");
    }
    if (targetPartySize <= 0) targetPartySize = 2;

    const requestedAbsMinutes = getAbsoluteMinutes(targetDate, targetTime);
    if (requestedAbsMinutes === null) {
      throw new Error("La fecha u hora proporcionadas no son válidas.");
    }

    const reqStart = requestedAbsMinutes - 120;
    const reqEnd = requestedAbsMinutes + 120;
    const scheduleCheck = await checkEstablishmentSchedule(ctx, targetDate, targetTime);

    const allTables = await ctx.db.query("restaurant_tables").collect();
    allTables.sort((a, b) => (a.number || 0) - (b.number || 0));

    const allConfirmed = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_status", (q) => q.eq("status", "Confirmado"))
      .collect();
    const allConsolidated = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_status", (q) => q.eq("status", "Consolidado"))
      .collect();

    const blockingReservations = [...allConfirmed, ...allConsolidated].filter((r) => {
      if (excludeResId && (r.id === excludeResId || r._id === excludeResId)) return false;
      return true;
    });

    const availableTables: any[] = [];
    const unavailableTables: any[] = [];

    for (const table of allTables) {
      if (!table.active) {
        unavailableTables.push({
          id: table.id || table._id,
          number: table.number,
          name: table.name,
          capacity: table.capacity,
          active: false,
          reason: "Mesa deshabilitada para servicio",
        });
        continue;
      }

      if ((table.capacity || 0) < targetPartySize) {
        unavailableTables.push({
          id: table.id || table._id,
          number: table.number,
          name: table.name,
          capacity: table.capacity,
          active: true,
          reason: `Capacidad insuficiente (${table.capacity} para ${targetPartySize} personas)`,
        });
        continue;
      }

      const tableReservations = blockingReservations.filter((r) => {
        const matchesTableId = r.tableId === table.id || r.assignedTableId === table.id;
        const matchesTableNum = r.tableNumber === table.number || r.assignedTableNumber === table.number;
        return matchesTableId || matchesTableNum;
      });

      let conflictFound: any = null;
      for (const res of tableReservations) {
        const resAbsMinutes = getAbsoluteMinutes(res.date, res.time);
        if (resAbsMinutes === null) continue;
        if (doIntervalsOverlap(reqStart, reqEnd, resAbsMinutes - 120, resAbsMinutes + 120)) {
          conflictFound = res;
          break;
        }
      }

      if (conflictFound) {
        unavailableTables.push({
          id: table.id || table._id,
          number: table.number,
          name: table.name,
          capacity: table.capacity,
          active: true,
          reason: `Ocupada por '${conflictFound.fullName}' a las ${conflictFound.time} (${conflictFound.date})`,
        });
      } else {
        availableTables.push({
          id: table.id || table._id,
          number: table.number,
          name: table.name,
          capacity: table.capacity,
          active: true,
        });
      }
    }

    return {
      requestedDate: targetDate,
      requestedTime: targetTime,
      partySize: targetPartySize,
      isStoreOpen: scheduleCheck.isOpen,
      storeOpenReason: scheduleCheck.isOpen ? null : scheduleCheck.reason,
      availableTables,
      unavailableTables,
      totalTables: allTables.length,
    };
  },
});

export const webFindAlternativeSlots = query({
  args: {
    sessionToken: v.string(),
    dvcCode: v.string(),
    reservationId: v.optional(v.string()),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    partySize: v.optional(v.number()),
    daysAhead: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await authorizeWebReservationAdmin(
      ctx,
      { sessionToken: args.sessionToken, dvcCode: args.dvcCode },
      { actionDescription: "buscar horarios alternativos WEB" }
    );

    let targetDate = args.date?.trim() || "";
    let targetTime = args.time?.trim() || "";
    let targetPartySize = args.partySize !== undefined && args.partySize > 0 ? Math.round(args.partySize) : 0;
    let excludeResId: string | null = null;

    if (args.reservationId && args.reservationId.trim() !== "") {
      const resDoc = await findReservationByAnyId(ctx, args.reservationId);
      if (resDoc) {
        excludeResId = resDoc.id || resDoc._id;
        if (!targetDate) targetDate = resDoc.date;
        if (!targetTime) targetTime = resDoc.time;
        if (targetPartySize <= 0) targetPartySize = resDoc.partySize;
      }
    }

    if (!targetDate) targetDate = new Date().toISOString().split("T")[0];
    if (targetPartySize <= 0) targetPartySize = 2;

    const maxDays = Math.min(Math.max(args.daysAhead || 4, 1), 7);
    const allTables = await ctx.db.query("restaurant_tables").collect();
    const activeTables = allTables.filter((t) => t.active && (t.capacity || 0) >= targetPartySize);

    if (activeTables.length === 0) {
      return {
        requestedDate: targetDate,
        requestedTime: targetTime,
        partySize: targetPartySize,
        alternativeSlots: [],
        message: `No existen mesas activas con capacidad para ${targetPartySize} personas.`,
      };
    }

    const allConfirmed = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_status", (q) => q.eq("status", "Confirmado"))
      .collect();
    const allConsolidated = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_status", (q) => q.eq("status", "Consolidado"))
      .collect();

    const blockingReservations = [...allConfirmed, ...allConsolidated].filter((r) => {
      if (excludeResId && (r.id === excludeResId || r._id === excludeResId)) return false;
      return true;
    });

    const candidateSlots: Array<{
      date: string;
      time: string;
      availableTableCount: number;
      sampleTableName: string;
    }> = [];

    const baseDayIndex = parseDateToDayIndex(targetDate);
    if (baseDayIndex === null) {
      return {
        requestedDate: targetDate,
        requestedTime: targetTime,
        partySize: targetPartySize,
        alternativeSlots: [],
        message: "Fecha base inválida.",
      };
    }

    const timeCandidates: string[] = [];
    for (let h = 12; h <= 23; h++) {
      const hStr = h.toString().padStart(2, "0");
      timeCandidates.push(`${hStr}:00`);
      timeCandidates.push(`${hStr}:30`);
    }

    for (let d = 0; d < maxDays; d++) {
      const dayIdx = baseDayIndex + d;
      const dateObj = new Date(dayIdx * 86400000);
      const dateStr = `${dateObj.getUTCFullYear()}-${(dateObj.getUTCMonth() + 1).toString().padStart(2, "0")}-${dateObj.getUTCDate().toString().padStart(2, "0")}`;

      for (const timeStr of timeCandidates) {
        if (d === 0 && timeStr === targetTime) continue;
        const candAbsMin = getAbsoluteMinutes(dateStr, timeStr);
        if (candAbsMin === null) continue;
        const scheduleCheck = await checkEstablishmentSchedule(ctx, dateStr, timeStr);
        if (!scheduleCheck.isOpen) continue;

        const reqStart = candAbsMin - 120;
        const reqEnd = candAbsMin + 120;
        const freeTablesForSlot: typeof activeTables = [];

        for (const table of activeTables) {
          const tableReservations = blockingReservations.filter((r) => {
            const matchesTableId = r.tableId === table.id || r.assignedTableId === table.id;
            const matchesTableNum = r.tableNumber === table.number || r.assignedTableNumber === table.number;
            return matchesTableId || matchesTableNum;
          });

          let conflictFound = false;
          for (const res of tableReservations) {
            const resAbsMinutes = getAbsoluteMinutes(res.date, res.time);
            if (resAbsMinutes === null) continue;
            if (doIntervalsOverlap(reqStart, reqEnd, resAbsMinutes - 120, resAbsMinutes + 120)) {
              conflictFound = true;
              break;
            }
          }
          if (!conflictFound) freeTablesForSlot.push(table);
        }

        if (freeTablesForSlot.length > 0) {
          candidateSlots.push({
            date: dateStr,
            time: timeStr,
            availableTableCount: freeTablesForSlot.length,
            sampleTableName: freeTablesForSlot[0].name || `Mesa ${freeTablesForSlot[0].number}`,
          });
        }
        if (candidateSlots.length >= 16) break;
      }
      if (candidateSlots.length >= 16) break;
    }

    return {
      requestedDate: targetDate,
      requestedTime: targetTime,
      partySize: targetPartySize,
      alternativeSlots: candidateSlots,
      message: candidateSlots.length > 0 ? null : "No se encontraron franjas libres cercanas.",
    };
  },
});

export const webAssignTableAndConfirmReservation = mutation({
  args: {
    sessionToken: v.string(),
    dvcCode: v.string(),
    reservationId: v.string(),
    tableId: v.string(),
    forceOverrideSchedule: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeWebReservationAdmin(
      ctx,
      { sessionToken: args.sessionToken, dvcCode: args.dvcCode },
      { actionDescription: "asignar mesa y confirmar reservación desde WEB" }
    );

    const reservation = await findReservationByAnyId(ctx, args.reservationId);
    if (!reservation) {
      throw new Error(`Reservación '${args.reservationId}' no encontrada.`);
    }

    if (reservation.status === "Consolidado") {
      throw new Error("No es posible reasignar mesa a una reservación ya consolidada.");
    }
    if ((reservation.status as string) === "Cancelado" || reservation.status === "Rechazado") {
      throw new Error(`No es posible asignar mesa a una reservación en estado '${reservation.status}'.`);
    }

    const effectiveDate =
      reservation.status === "Negociación" && reservation.alternativeDate?.trim()
        ? reservation.alternativeDate.trim()
        : reservation.date;
    const effectiveTime =
      reservation.status === "Negociación" && reservation.alternativeTime?.trim()
        ? reservation.alternativeTime.trim()
        : reservation.time;

    const scheduleCheck = await checkEstablishmentSchedule(ctx, effectiveDate, effectiveTime);
    if (!scheduleCheck.isOpen && !args.forceOverrideSchedule) {
      throw new Error(`No se puede confirmar la reservación: ${scheduleCheck.reason}`);
    }

    const lookupTableId = args.tableId.trim();
    let table = await ctx.db
      .query("restaurant_tables")
      .withIndex("by_custom_id", (q) => q.eq("id", lookupTableId))
      .first();

    if (!table) {
      try {
        const byDocId = await ctx.db.get(lookupTableId as any);
        if (byDocId && "number" in byDocId) table = byDocId as any;
      } catch (_) {}
    }

    if (!table) throw new Error(`Mesa '${lookupTableId}' no encontrada.`);
    if (!table.active) throw new Error(`La mesa '${table.name}' (#${table.number}) está deshabilitada.`);
    if ((table.capacity || 0) < reservation.partySize) {
      throw new Error(
        `La mesa '${table.name}' tiene capacidad para ${table.capacity} personas (se requieren ${reservation.partySize}).`
      );
    }

    const targetAbsMinutes = getAbsoluteMinutes(effectiveDate, effectiveTime);
    if (targetAbsMinutes === null) {
      throw new Error("La fecha u hora de la reservación no tienen un formato válido.");
    }

    const reqStart = targetAbsMinutes - 120;
    const reqEnd = targetAbsMinutes + 120;

    const allConfirmed = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_status", (q) => q.eq("status", "Confirmado"))
      .collect();
    const allConsolidated = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_status", (q) => q.eq("status", "Consolidado"))
      .collect();

    const candidates = [...allConfirmed, ...allConsolidated].filter(
      (r) =>
        (r.tableId === table!.id ||
          r.assignedTableId === table!.id ||
          r.tableNumber === table!.number ||
          r.assignedTableNumber === table!.number) &&
        r._id !== reservation._id &&
        r.id !== reservation.id
    );

    for (const conflict of candidates) {
      const conflictAbsMinutes = getAbsoluteMinutes(conflict.date, conflict.time);
      if (conflictAbsMinutes === null) continue;
      if (doIntervalsOverlap(reqStart, reqEnd, conflictAbsMinutes - 120, conflictAbsMinutes + 120)) {
        throw new Error(
          `Conflicto de asignación: La mesa '${table.name}' (#${table.number}) ya está reservada por '${conflict.fullName}' a las ${conflict.time} (${conflict.date}). Margen mínimo de 2 horas.`
        );
      }
    }

    const now = Date.now();
    const patch: Record<string, any> = {
      date: effectiveDate,
      time: effectiveTime,
      tableId: table.id,
      tableNumber: table.number,
      assignedTableId: table.id,
      assignedTableNumber: table.number,
      status: "Confirmado" as const,
      confirmedAt: now,
      confirmedByUserId: auth.user.id,
      updatedAt: now,
    };

    await ctx.db.patch(reservation._id, patch);

    return {
      ...reservation,
      ...patch,
      tableName: table.name,
      tableCapacity: table.capacity,
    };
  },
});

export const webUpdateReservationStatus = mutation({
  args: {
    sessionToken: v.string(),
    dvcCode: v.string(),
    id: v.string(),
    status: v.union(
      v.literal("Pendiente"),
      v.literal("Negociación"),
      v.literal("Confirmado"),
      v.literal("Rechazado"),
      v.literal("Cancelado"),
      v.literal("Consolidado"),
      v.literal("Marcada")
    ),
    alternativeDate: v.optional(v.string()),
    alternativeTime: v.optional(v.string()),
    alternativeNotes: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeWebReservationAdmin(
      ctx,
      { sessionToken: args.sessionToken, dvcCode: args.dvcCode },
      { actionDescription: "actualizar estado de reservación desde WEB" }
    );

    const reservation = await findReservationByAnyId(ctx, args.id);
    if (!reservation) {
      throw new Error(`Reservación '${args.id}' no encontrada.`);
    }

    if (reservation.status === "Consolidado" && args.status !== "Consolidado") {
      throw new Error("No es posible modificar el estado de una reservación ya consolidada.");
    }

    const now = Date.now();
    const patch: Record<string, any> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.status === "Negociación") {
      if (args.alternativeDate?.trim()) patch.alternativeDate = args.alternativeDate.trim();
      if (args.alternativeTime?.trim()) patch.alternativeTime = args.alternativeTime.trim();
      if (args.alternativeNotes?.trim()) {
        patch.alternativeNotes = args.alternativeNotes.trim();
        patch.negotiationNotes = args.alternativeNotes.trim();
      }
      patch.proposedAt = now;
      patch.proposedByUserId = auth.user.id;
    } else if (args.status === "Rechazado") {
      patch.rejectionReason = args.rejectionReason?.trim() || "Capacidad no disponible";
      patch.rejectedAt = now;
      patch.rejectedByUserId = auth.user.id;
    } else if (args.status === "Cancelado") {
      if (args.rejectionReason?.trim()) {
        patch.rejectionReason = args.rejectionReason.trim();
      }
      patch.cancelledAt = now;
      patch.cancelledByUserId = auth.user.id;
    } else if (args.status === "Consolidado") {
      patch.consolidatedAt = now;
      patch.consolidatedByUserId = auth.user.id;
    } else if (args.status === "Marcada") {
      patch.markedAt = now;
      patch.markedByUserId = auth.user.id;
      patch.markedByUserName = auth.user.fullName;
    }

    if (args.notes?.trim()) {
      patch.notes = args.notes.trim();
    }

    await ctx.db.patch(reservation._id, patch);
    return { ...reservation, ...patch };
  },
});

export const webAcceptProposedAlternative = mutation({
  args: {
    sessionToken: v.string(),
    dvcCode: v.string(),
    reservationId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeWebReservationAdmin(
      ctx,
      { sessionToken: args.sessionToken, dvcCode: args.dvcCode },
      { actionDescription: "aceptar propuesta alternativa desde WEB" }
    );

    const reservation = await findReservationByAnyId(ctx, args.reservationId);
    if (!reservation) {
      throw new Error(`Reservación '${args.reservationId}' no encontrada.`);
    }

    const proposedDate = reservation.alternativeDate || (reservation as any).proposedDate;
    const proposedTime = reservation.alternativeTime || (reservation as any).proposedTime;
    if (!proposedDate || !proposedTime) {
      throw new Error("La reservación no tiene una propuesta de fecha u hora alternativa.");
    }

    const now = Date.now();
    const patch = {
      date: proposedDate,
      time: proposedTime,
      status: "Pendiente" as const,
      acceptedAlternativeAt: now,
      acceptedByUserId: auth.user.id,
      updatedAt: now,
    };

    await ctx.db.patch(reservation._id, patch);
    return { ...reservation, ...patch };
  },
});

export const webConsolidateReservation = mutation({
  args: {
    sessionToken: v.string(),
    dvcCode: v.string(),
    reservationId: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeWebReservationAdmin(
      ctx,
      { sessionToken: args.sessionToken, dvcCode: args.dvcCode },
      { actionDescription: "consolidar reservación desde WEB" }
    );

    const reservation = await findReservationByAnyId(ctx, args.reservationId);
    if (!reservation) {
      throw new Error(`Reservación '${args.reservationId}' no encontrada.`);
    }
    if (reservation.status !== "Confirmado" && reservation.status !== "Consolidado") {
      throw new Error(
        `Sólo las reservaciones en estado 'Confirmado' se pueden consolidar (Estado actual: '${reservation.status}').`
      );
    }

    const now = Date.now();
    const rawPhone = reservation.phone || reservation.emailOrPhone || "";
    const cleanPhone = rawPhone.replace(/[^\d+]/g, "").trim();
    const cleanEmail =
      reservation.email?.trim().toLowerCase() ||
      (reservation.emailOrPhone?.includes("@")
        ? reservation.emailOrPhone.trim().toLowerCase()
        : undefined);

    let customerDoc: any = null;
    if (cleanPhone) {
      customerDoc = await ctx.db
        .query("restaurant_customers")
        .withIndex("by_phone", (q) => q.eq("phone", cleanPhone))
        .first();
    }
    if (!customerDoc && cleanEmail) {
      customerDoc = await ctx.db
        .query("restaurant_customers")
        .withIndex("by_email", (q) => q.eq("email", cleanEmail))
        .first();
    }

    if (!customerDoc) {
      const newCustId = `cust-${now}-${Math.random().toString(36).substring(2, 8)}`;
      const newDoc = {
        id: newCustId,
        fullName: reservation.fullName.trim(),
        phone: cleanPhone || undefined,
        email: cleanEmail || undefined,
        notes: reservation.specialNotes?.trim() || undefined,
        totalVisits: 0,
        lastVisitAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const insertedId = await ctx.db.insert("restaurant_customers", newDoc);
      customerDoc = { _id: insertedId, ...newDoc };
    }

    const patch: Record<string, any> = {
      status: "Consolidado" as const,
      consolidatedAt: reservation.consolidatedAt || now,
      consolidatedByUserId: auth.user.id,
      customerId: customerDoc.id,
      updatedAt: now,
    };
    if (args.notes?.trim()) patch.notes = args.notes.trim();

    await ctx.db.patch(reservation._id, patch);
    await recalculateCustomerStats(ctx, customerDoc.id);

    return {
      ...reservation,
      ...patch,
      customerName: customerDoc.fullName,
    };
  },
});

export const webMarkReservationAsNoShow = mutation({
  args: {
    sessionToken: v.string(),
    dvcCode: v.string(),
    reservationId: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorizeWebReservationAdmin(
      ctx,
      { sessionToken: args.sessionToken, dvcCode: args.dvcCode },
      { actionDescription: "marcar inasistencia desde WEB" }
    );

    const reservation = await findReservationByAnyId(ctx, args.reservationId);
    if (!reservation) {
      throw new Error(`Reservación '${args.reservationId}' no encontrada.`);
    }
    if (reservation.status !== "Confirmado" && reservation.status !== "Marcada") {
      throw new Error(
        `Sólo las reservaciones en estado 'Confirmado' se pueden marcar como no asistencia (Estado actual: '${reservation.status}').`
      );
    }

    const now = Date.now();
    const rawPhone = reservation.phone || reservation.emailOrPhone || "";
    const cleanPhone = rawPhone.replace(/[^\d+]/g, "").trim();
    const cleanEmail =
      reservation.email?.trim().toLowerCase() ||
      (reservation.emailOrPhone?.includes("@")
        ? reservation.emailOrPhone.trim().toLowerCase()
        : undefined);

    let customerDoc: any = null;
    if (cleanPhone) {
      customerDoc = await ctx.db
        .query("restaurant_customers")
        .withIndex("by_phone", (q) => q.eq("phone", cleanPhone))
        .first();
    }
    if (!customerDoc && cleanEmail) {
      customerDoc = await ctx.db
        .query("restaurant_customers")
        .withIndex("by_email", (q) => q.eq("email", cleanEmail))
        .first();
    }

    if (!customerDoc) {
      const newCustId = `cust-${now}-${Math.random().toString(36).substring(2, 8)}`;
      const newDoc = {
        id: newCustId,
        fullName: reservation.fullName.trim(),
        phone: cleanPhone || undefined,
        email: cleanEmail || undefined,
        notes: reservation.specialNotes?.trim() || undefined,
        totalVisits: 0,
        lastVisitAt: undefined,
        createdAt: now,
        updatedAt: now,
      };
      const insertedId = await ctx.db.insert("restaurant_customers", newDoc);
      customerDoc = { _id: insertedId, ...newDoc };
    }

    const patch: Record<string, any> = {
      status: "Marcada" as const,
      markedAt: reservation.markedAt || now,
      markedByUserId: auth.user.id,
      markedByUserName: auth.user.fullName,
      customerId: customerDoc.id,
      updatedAt: now,
    };
    if (args.notes?.trim()) patch.notes = args.notes.trim();

    await ctx.db.patch(reservation._id, patch);
    await recalculateCustomerStats(ctx, customerDoc.id);

    return {
      ...reservation,
      ...patch,
      customerName: customerDoc.fullName,
    };
  },
});

export const webDeleteReservation = mutation({
  args: {
    sessionToken: v.string(),
    dvcCode: v.string(),
    id: v.string(),
  },
  handler: async (ctx, args) => {
    await authorizeWebReservationAdmin(
      ctx,
      { sessionToken: args.sessionToken, dvcCode: args.dvcCode },
      { actionDescription: "eliminar reservación desde WEB" }
    );

    const reservation = await findReservationByAnyId(ctx, args.id);
    if (!reservation) {
      throw new Error(`Reservación '${args.id}' no encontrada.`);
    }

    if (reservation.status === "Consolidado") {
      throw new Error("No se puede eliminar una reservación ya consolidada.");
    }

    await ctx.db.delete(reservation._id);
    if (reservation.customerId) {
      await recalculateCustomerStats(ctx, reservation.customerId);
    }

    return { success: true, id: args.id };
  },
});

export const webListCustomers = query({
  args: {
    sessionToken: v.string(),
    dvcCode: v.string(),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeWebReservationAdmin(
      ctx,
      { sessionToken: args.sessionToken, dvcCode: args.dvcCode },
      { actionDescription: "consultar clientes desde WEB" }
    );

    let customers = await ctx.db.query("restaurant_customers").collect();

    if (args.searchQuery && args.searchQuery.trim() !== "") {
      const q = args.searchQuery.trim().toLowerCase();
      customers = customers.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }

    customers.sort((a, b) => (b.lastVisitAt || 0) - (a.lastVisitAt || 0));
    return customers;
  },
});

export const webGetCustomerDetails = query({
  args: {
    sessionToken: v.string(),
    dvcCode: v.string(),
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    await authorizeWebReservationAdmin(
      ctx,
      { sessionToken: args.sessionToken, dvcCode: args.dvcCode },
      { actionDescription: "consultar detalle de cliente desde WEB" }
    );

    const lookupId = args.customerId.trim();
    const customer = await ctx.db
      .query("restaurant_customers")
      .withIndex("by_custom_id", (q) => q.eq("id", lookupId))
      .first();

    if (!customer) {
      throw new Error(`Cliente '${lookupId}' no encontrado.`);
    }

    const reservations = await ctx.db
      .query("restaurant_reservations")
      .withIndex("by_customer", (q) => q.eq("customerId", lookupId))
      .collect();

    reservations.sort((a, b) => (b.createdAt ?? b._creationTime) - (a.createdAt ?? a._creationTime));

    return {
      customer,
      reservations,
      totalVisits: reservations.filter((r) => r.status === "Consolidado").length,
    };
  },
});

export const webCreateStaffReservation = mutation({
  args: {
    sessionToken: v.string(),
    dvcCode: v.string(),
    fullName: v.string(),
    emailOrPhone: v.string(),
    date: v.string(),
    time: v.string(),
    partySize: v.number(),
    seatingArea: v.optional(v.string()),
    specialNotes: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeWebReservationAdmin(
      ctx,
      { sessionToken: args.sessionToken, dvcCode: args.dvcCode },
      { actionDescription: "registrar solicitud de reservación desde panel WEB" }
    );

    const cleanFullName = args.fullName.trim();
    const cleanContact = args.emailOrPhone.trim();
    const cleanDate = args.date.trim();
    const cleanTime = args.time.trim();

    if (!cleanFullName || !cleanContact || !cleanDate || !cleanTime) {
      throw new Error("Complete nombre, contacto, fecha y hora.");
    }

    const partySizeNumber = Math.max(1, Math.round(Number(args.partySize) || 1));
    const now = Date.now();
    const reservationId = `res-${now}-${Math.random().toString(36).substring(2, 8)}`;

    const reservationDoc = {
      id: reservationId,
      fullName: cleanFullName,
      emailOrPhone: cleanContact,
      partySize: partySizeNumber,
      seatingArea: args.seatingArea?.trim() || "terraza",
      specialNotes: args.specialNotes?.trim() || undefined,
      notes: args.specialNotes?.trim() || undefined,
      source: args.source?.trim() || "telefono",
      date: cleanDate,
      time: cleanTime,
      requestedDate: cleanDate,
      requestedTime: cleanTime,
      status: "Pendiente" as const,
      createdAt: now,
      updatedAt: now,
    };

    const insertedId = await ctx.db.insert("restaurant_reservations", reservationDoc);

    try {
      const notifMessage = `Nueva reservación (${reservationDoc.source}) de ${cleanFullName} para el ${cleanDate} a las ${cleanTime} (${partySizeNumber} comensales).`;
      await ctx.db.insert("notifications", {
        id: `notif-res-adm-${now}-${Math.random().toString(36).substring(2, 6)}`,
        title: "Nueva Reservación Recibida",
        message: notifMessage,
        targetRole: "ADMIN_GENERAL",
        timestamp: now,
        isRead: false,
      });
    } catch (e) {
      console.error("Error registrando notificación:", e);
    }

    return {
      _id: insertedId,
      ...reservationDoc,
    };
  },
});


