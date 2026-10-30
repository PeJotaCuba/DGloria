import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertAdminPermission } from "./auth";

/**
 * Estados permitidos para el ciclo de vida de una reservación de Bar Terraza.
 */
export const RESERVATION_STATUSES = ["pending", "confirmed", "rejected", "cancelled"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/**
 * Función pública de registro de solicitudes de reservación desde la web.
 *
 * Requisitos:
 * 1. Valida estrictamente todos los campos enviados.
 * 2. Asigna obligatoriamente el estado 'pending' (pendiente) desde el servidor.
 * 3. Asigna la marca de tiempo createdAt del servidor.
 * 4. Fija el origen como 'web'.
 * 5. No permite que clientes web alteren estados ni suministren campos administrativos.
 */
export const createPublicReservation = mutation({
  args: {
    fullName: v.string(),
    emailOrPhone: v.string(),
    date: v.string(),
    time: v.string(),
    partySize: v.number(),
    seatingArea: v.optional(v.string()),
    specialNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const fullName = args.fullName.trim();
    if (fullName.length < 2) {
      throw new Error("El nombre del cliente debe contener al menos 2 caracteres.");
    }

    const emailOrPhone = args.emailOrPhone.trim();
    if (emailOrPhone.length < 5) {
      throw new Error("Debe proporcionar un teléfono o correo de contacto válido.");
    }

    const date = args.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("El formato de fecha debe ser YYYY-MM-DD.");
    }

    const time = args.time.trim();
    if (!time) {
      throw new Error("El horario de la reservación es obligatorio.");
    }

    const partySize = Math.floor(args.partySize);
    if (isNaN(partySize) || partySize < 1 || partySize > 50) {
      throw new Error("La cantidad de comensales debe ser un número entero entre 1 y 50.");
    }

    const validSeatingAreas = ["terraza", "salon", "indiferente"];
    const seatingArea = args.seatingArea
      ? args.seatingArea.trim().toLowerCase()
      : "terraza";
    const finalSeatingArea = validSeatingAreas.includes(seatingArea) ? seatingArea : "terraza";

    const specialNotes = args.specialNotes ? args.specialNotes.trim() : undefined;

    const now = Date.now();
    const customId = `res-${now}-${Math.random().toString(36).substring(2, 8)}`;

    // Toda solicitud web inicia rigurosamente en estado 'pending'
    const newDocId = await ctx.db.insert("restaurant_reservations", {
      id: customId,
      fullName,
      emailOrPhone,
      date,
      time,
      partySize,
      seatingArea: finalSeatingArea,
      specialNotes,
      status: "pending",
      source: "web",
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      reservationId: newDocId,
      id: customId,
      status: "pending",
      message: "Solicitud de reservación registrada en estado pendiente.",
    };
  },
});

/**
 * Consulta administrativa para que Android (o el panel de administración de Bar Terraza)
 * recupere las reservaciones almacenadas en la tabla compartida `restaurant_reservations`.
 *
 * Protegida con autenticación y verificación de roles administrativos.
 */
export const listReservations = query({
  args: {
    status: v.optional(v.string()),
    date: v.optional(v.string()),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    limit: v.optional(v.number()),
    adminToken: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Validar autorización administrativa obligatoria
    await assertAdminPermission(ctx, args.adminToken, args.sessionToken);

    let reservations;

    if (args.status) {
      reservations = await ctx.db
        .query("restaurant_reservations")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else if (args.date) {
      reservations = await ctx.db
        .query("restaurant_reservations")
        .withIndex("by_date", (q) => q.eq("date", args.date!))
        .collect();
    } else {
      reservations = await ctx.db
        .query("restaurant_reservations")
        .withIndex("by_createdAt")
        .order("desc")
        .collect();
    }

    // Filtros secundarios en memoria para rangos de fecha y fecha exacta si se usó índice de status
    if (args.date && args.status) {
      reservations = reservations.filter((r) => r.date === args.date);
    }

    if (args.fromDate) {
      reservations = reservations.filter((r) => r.date >= args.fromDate!);
    }

    if (args.toDate) {
      reservations = reservations.filter((r) => r.date <= args.toDate!);
    }

    // Ordenar de manera consistente: fecha más próxima y hora, o fecha de creación descendente
    reservations.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (args.limit && args.limit > 0) {
      reservations = reservations.slice(0, args.limit);
    }

    return reservations.map((r) => ({
      ...r,
      _id: r._id,
      id: r.id || r._id,
    }));
  },
});

/**
 * Consulta administrativa para obtener los detalles de una reservación específica.
 */
export const getReservation = query({
  args: {
    id: v.string(),
    adminToken: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(ctx, args.adminToken, args.sessionToken);

    let reservation = null;
    try {
      reservation = await ctx.db.get(args.id as any);
    } catch {
      // id no es Id directo de Convex
    }

    if (!reservation) {
      reservation = await ctx.db
        .query("restaurant_reservations")
        .withIndex("by_custom_id", (q) => q.eq("id", args.id))
        .first();
    }

    return reservation;
  },
});

/**
 * Mutación administrativa protegida para actualizar el estado de una reservación.
 * Permite que Android confirme (`confirmed`), rechace (`rejected`) o cancele (`cancelled`) solicitudes.
 */
export const updateReservationStatus = mutation({
  args: {
    id: v.string(),
    status: v.string(),
    statusReason: v.optional(v.string()),
    adminToken: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Autorización administrativa obligatoria
    const admin = await assertAdminPermission(ctx, args.adminToken, args.sessionToken);

    const targetStatus = args.status.trim().toLowerCase();
    if (!RESERVATION_STATUSES.includes(targetStatus as ReservationStatus)) {
      throw new Error(
        `Estado no válido: "${args.status}". Los estados permitidos son: ${RESERVATION_STATUSES.join(", ")}.`
      );
    }

    // 2. Localizar la reservación por Convex _id o id custom
    let reservation = null;
    try {
      reservation = await ctx.db.get(args.id as any);
    } catch {
      // Ignorar si no es ID directo
    }

    if (!reservation) {
      reservation = await ctx.db
        .query("restaurant_reservations")
        .withIndex("by_custom_id", (q) => q.eq("id", args.id))
        .first();
    }

    if (!reservation) {
      throw new Error(`No se encontró la reservación con identificador: ${args.id}`);
    }

    const now = Date.now();
    const adminId = args.userId || admin.subject || "admin";
    const adminName = admin.name || "Administrador";

    // 3. Aplicar actualización de estado
    await ctx.db.patch(reservation._id, {
      status: targetStatus,
      updatedAt: now,
      statusReason: args.statusReason !== undefined ? args.statusReason.trim() : reservation.statusReason,
      updatedByUserId: adminId,
      updatedByUserName: adminName,
    });

    return {
      success: true,
      id: reservation._id,
      customId: reservation.id || reservation._id,
      previousStatus: reservation.status,
      newStatus: targetStatus,
      updatedAt: now,
    };
  },
});

/**
 * Eliminación administrativa de una reservación (para limpieza o descarte por parte del administrador).
 */
export const deleteReservation = mutation({
  args: {
    id: v.string(),
    adminToken: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminPermission(ctx, args.adminToken, args.sessionToken);

    let reservation = null;
    try {
      reservation = await ctx.db.get(args.id as any);
    } catch {
      // No es un Id nativo directo
    }

    if (!reservation) {
      reservation = await ctx.db
        .query("restaurant_reservations")
        .withIndex("by_custom_id", (q) => q.eq("id", args.id))
        .first();
    }

    if (!reservation) {
      return { success: false, message: "No se encontró la reservación especificada." };
    }

    await ctx.db.delete(reservation._id);
    return { success: true, id: reservation._id };
  },
});

/**
 * Alias de compatibilidad para consultas y mutaciones en el espacio `restaurant` si Android
 * las invoca a través del prefijo `restaurant:*`.
 */
export const submitReservation = createPublicReservation;
export const getReservations = listReservations;

