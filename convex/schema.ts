import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
    // Tabla del menú público para la web y Android
    menu_dishes: defineTable({
      name: v.string(),
      description: v.string(),
      price: v.optional(v.union(v.number(), v.string())),
      priceCup: v.optional(v.number()),
      priceFormatted: v.optional(v.string()),
      imageId: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      category: v.string(),
      isPublished: v.boolean(),
      isFeatured: v.boolean(),
      featuredOrder: v.optional(v.number()),
      displayOrder: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_published", ["isPublished", "displayOrder"])
      .index("by_published_category", ["isPublished", "category", "displayOrder"])
      .index("by_featured", ["isPublished", "isFeatured", "featuredOrder"]),

    // Tabla de usuarios
    users: defineTable({
      id: v.optional(v.string()),
      username: v.string(),
      name: v.optional(v.string()),
      role: v.optional(v.string()),
      active: v.optional(v.boolean()),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    })
      .index("by_username", ["username"])
      .index("by_role", ["role"])
      .index("by_active", ["active"])
      .index("by_custom_id", ["id"])
      .index("by_role_and_active", ["role", "active"]),

    // Tabla de dispositivos
    devices: defineTable({
      id: v.optional(v.string()),
      dvcCode: v.optional(v.string()),
      hardwareId: v.optional(v.string()),
      name: v.optional(v.string()),
      deviceType: v.optional(v.string()),
      authorized: v.optional(v.boolean()),
      registeredAt: v.optional(v.number()),
      lastActiveAt: v.optional(v.number()),
    })
      .index("by_dvcCode", ["dvcCode"])
      .index("by_hardwareId", ["hardwareId"])
      .index("by_custom_id", ["id"]),

    // Dispositivos asociados a usuarios
    user_devices: defineTable({
      id: v.optional(v.string()),
      userId: v.optional(v.string()),
      deviceId: v.optional(v.string()),
      dvcCode: v.optional(v.string()),
      authorized: v.optional(v.boolean()),
    })
      .index("by_user_and_device", ["userId", "deviceId"])
      .index("by_dvcCode", ["dvcCode"])
      .index("by_device", ["deviceId"])
      .index("by_user_and_dvc", ["userId", "dvcCode"])
      .index("by_authorized", ["authorized"])
      .index("by_user", ["userId"])
      .index("by_custom_id", ["id"]),

    // Sesiones de usuarios
    user_sessions: defineTable({
      userId: v.optional(v.union(v.id("users"), v.string())),
      token: v.string(),
      isActive: v.optional(v.boolean()),
      createdAt: v.optional(v.number()),
    })
      .index("by_token", ["token"])
      .index("by_user", ["userId"])
      .index("by_token_and_active", ["token", "isActive"])
      .index("by_user_and_active", ["userId", "isActive"]),

    // Items del menú del TPV / restaurante
    menu_items: defineTable({
      id: v.optional(v.string()),
      code: v.optional(v.string()),
      name: v.string(),
      description: v.string(),
      price: v.optional(v.union(v.number(), v.string())),
      priceCup: v.optional(v.number()),
      priceFormatted: v.optional(v.string()),
      category: v.string(),
      imageId: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      isPublished: v.boolean(),
      isFeatured: v.boolean(),
      featuredOrder: v.optional(v.number()),
      displayOrder: v.number(),
      available: v.optional(v.boolean()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_available", ["available"])
      .index("by_published", ["isPublished", "displayOrder"])
      .index("by_published_category", ["isPublished", "category", "displayOrder"])
      .index("by_featured", ["isPublished", "isFeatured", "featuredOrder"])
      .index("by_custom_id", ["id"])
      .index("by_code", ["code"])
      .index("by_category", ["category"]),

    // Registros de auditoría
    audit_logs: defineTable({
      shiftId: v.optional(v.string()),
      userId: v.optional(v.string()),
      module: v.optional(v.string()),
      timestamp: v.optional(v.number()),
    })
      .index("by_shift", ["shiftId"])
      .index("by_timestamp", ["timestamp"])
      .index("by_module_and_timestamp", ["module", "timestamp"])
      .index("by_module", ["module"])
      .index("by_user", ["userId"]),

    // Tipos de cambio
    exchange_rates: defineTable({
      id: v.optional(v.string()),
      sourceCurrency: v.optional(v.string()),
      targetCurrency: v.optional(v.string()),
      updatedAt: v.optional(v.number()),
      updatedByUserId: v.optional(v.string()),
    })
      .index("by_pair_and_updatedAt", ["sourceCurrency", "targetCurrency", "updatedAt"])
      .index("by_updatedAt", ["updatedAt"])
      .index("by_custom_id", ["id"])
      .index("by_updatedByUser", ["updatedByUserId"])
      .index("by_pair", ["sourceCurrency", "targetCurrency"]),

    // Pedidos de restaurante
    restaurant_orders: defineTable({
      id: v.optional(v.string()),
      status: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      waiterId: v.optional(v.string()),
      tableId: v.optional(v.string()),
      cashierUserId: v.optional(v.string()),
      paidAt: v.optional(v.number()),
      idempotencyKey: v.optional(v.string()),
      orderNumber: v.optional(v.number()),
    })
      .index("by_status", ["status"])
      .index("by_createdAt", ["createdAt"])
      .index("by_waiter_and_createdAt", ["waiterId", "createdAt"])
      .index("by_table", ["tableId"])
      .index("by_table_and_status", ["tableId", "status"])
      .index("by_cashier_and_paidAt", ["cashierUserId", "paidAt"])
      .index("by_idempotency", ["idempotencyKey"])
      .index("by_orderNumber", ["orderNumber"])
      .index("by_status_and_createdAt", ["status", "createdAt"])
      .index("by_waiter_and_status", ["waiterId", "status"])
      .index("by_paidAt", ["paidAt"])
      .index("by_custom_id", ["id"]),

    // Mesas de restaurante
    restaurant_tables: defineTable({
      id: v.optional(v.string()),
      number: v.optional(v.number()),
      active: v.optional(v.boolean()),
    })
      .index("by_active", ["active"])
      .index("by_custom_id", ["id"])
      .index("by_number", ["number"]),

    // Recuperación de contraseñas
    password_resets: defineTable({
      id: v.optional(v.string()),
      userId: v.optional(v.string()),
      code: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
    })
      .index("by_expiresAt", ["expiresAt"])
      .index("by_user", ["userId"])
      .index("by_code", ["code"])
      .index("by_custom_id", ["id"]),

    // Productos de tienda / bar
    shop_products: defineTable({
      id: v.optional(v.string()),
      code: v.optional(v.string()),
      category: v.optional(v.string()),
      active: v.optional(v.boolean()),
    })
      .index("by_category", ["category"])
      .index("by_active", ["active"])
      .index("by_custom_id", ["id"])
      .index("by_code", ["code"])
      .index("by_active_and_category", ["active", "category"]),

    // Jornadas / turnos de tienda y restaurante
    shop_shifts: defineTable({
      id: v.optional(v.string()),
      isActive: v.optional(v.boolean()),
      openedAt: v.optional(v.number()),
      openedByUserId: v.optional(v.string()),
      openedByUserName: v.optional(v.string()),
      closedAt: v.optional(v.number()),
      closedByUserId: v.optional(v.string()),
      closedByUserName: v.optional(v.string()),
      notes: v.optional(v.string()),
    })
      .index("by_closedByUser", ["closedByUserId"])
      .index("by_openedByUser", ["openedByUserId"])
      .index("by_custom_id", ["id"])
      .index("by_openedAt", ["openedAt"])
      .index("by_active", ["isActive"]),

    // Ventas de tienda / bar
    shop_sales: defineTable({
      id: v.optional(v.string()),
      shiftId: v.optional(v.string()),
      userId: v.optional(v.string()),
      paymentMethod: v.optional(v.string()),
      timestamp: v.optional(v.number()),
      idempotencyKey: v.optional(v.string()),
    })
      .index("by_custom_id", ["id"])
      .index("by_idempotency", ["idempotencyKey"])
      .index("by_paymentMethod", ["paymentMethod"])
      .index("by_user", ["userId"])
      .index("by_timestamp", ["timestamp"])
      .index("by_shift", ["shiftId"])
      .index("by_shift_and_timestamp", ["shiftId", "timestamp"]),

    // Movimientos de inventario
    inventory_movements: defineTable({
      id: v.optional(v.string()),
      productId: v.optional(v.string()),
      shiftId: v.optional(v.string()),
      userId: v.optional(v.string()),
      saleId: v.optional(v.string()),
      type: v.optional(v.string()),
      timestamp: v.optional(v.number()),
      idempotencyKey: v.optional(v.string()),
    })
      .index("by_product", ["productId"])
      .index("by_type", ["type"])
      .index("by_custom_id", ["id"])
      .index("by_shift", ["shiftId"])
      .index("by_user", ["userId"])
      .index("by_sale", ["saleId"])
      .index("by_idempotency", ["idempotencyKey"])
      .index("by_product_and_timestamp", ["productId", "timestamp"])
      .index("by_timestamp", ["timestamp"]),

    // Notificaciones
    notifications: defineTable({
      id: v.optional(v.string()),
      isRead: v.optional(v.boolean()),
      targetRole: v.optional(v.string()),
      targetUserId: v.optional(v.string()),
      orderId: v.optional(v.string()),
      timestamp: v.optional(v.number()),
    })
      .index("by_isRead", ["isRead"])
      .index("by_targetRole", ["targetRole"])
      .index("by_targetRole_and_isRead", ["targetRole", "isRead"])
      .index("by_targetUser_and_isRead", ["targetUserId", "isRead"])
      .index("by_timestamp", ["timestamp"])
      .index("by_targetUser", ["targetUserId"])
      .index("by_orderId", ["orderId"])
      .index("by_custom_id", ["id"]),

    // Turnos archivados
    archived_shifts: defineTable({
      id: v.optional(v.string()),
      closedAt: v.optional(v.number()),
      openedAt: v.optional(v.number()),
      openedByUserId: v.optional(v.string()),
      openedByUserName: v.optional(v.string()),
      closedByUserId: v.optional(v.string()),
      closedByUserName: v.optional(v.string()),
      notes: v.optional(v.string()),
      exportedAt: v.optional(v.number()),
      events: v.optional(v.any()),
    })
      .index("by_closedAt", ["closedAt"])
      .index("by_custom_id", ["id"]),

    // Horarios programados de turnos
    shift_schedules: defineTable({
      id: v.optional(v.string()),
      timeZone: v.optional(v.string()),
      weeklySchedule: v.optional(v.any()),
      manualOverride: v.optional(v.any()),
      updatedAt: v.optional(v.number()),
      updatedByUserId: v.optional(v.string()),
      updatedByUserName: v.optional(v.string()),
    }).index("by_custom_id", ["id"]),

    // Reservaciones de Bar Terraza (compartidas entre Web y Android)
    restaurant_reservations: defineTable({
      id: v.optional(v.string()),
      fullName: v.string(),
      emailOrPhone: v.string(),
      date: v.string(),
      time: v.string(),
      partySize: v.number(),
      seatingArea: v.optional(v.string()),
      specialNotes: v.optional(v.string()),
      status: v.string(),
      source: v.string(),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
      statusReason: v.optional(v.string()),
      updatedByUserId: v.optional(v.string()),
      updatedByUserName: v.optional(v.string()),
      // Campos para consulta privada de estado y gestión administrativa
      trackingCodeHash: v.optional(v.string()),
      assignedTable: v.optional(v.string()),
      proposedDate: v.optional(v.string()),
      proposedTime: v.optional(v.string()),
    })
      .index("by_status", ["status"])
      .index("by_date", ["date"])
      .index("by_createdAt", ["createdAt"])
      .index("by_status_and_date", ["status", "date"])
      .index("by_status_and_createdAt", ["status", "createdAt"])
      .index("by_tracking_code_hash", ["trackingCodeHash"])
      .index("by_custom_id", ["id"]),
  },
  {
    schemaValidation: false,
  }
);
