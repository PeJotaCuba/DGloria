import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Esquema de datos de Convex para Doña Gloria (Tienda y Bar-Terraza).
 * Subfase 1.2: Relaciones entre entidades, índices optimizados y soporte de idempotencia/consistencia.
 *
 * Basado estrictamente en los modelos y flujos del proyecto Android:
 * - `com.example.model.Models.kt`
 * - `com.example.data.AppRepository.kt`
 * - Pantallas operativas (`RestaurantScreen.kt`, `TiendaPosScreen.kt`, `AdminScreen.kt`)
 *
 * Principios arquitectónicos aplicados:
 * 1. Independencia modular estricta: 'shop_*' para la tienda y 'restaurant_*'/'menu_*' para el bar-restaurante.
 * 2. Trazabilidad relacional completa: referencias explícitas a usuarios responsables en todas las operaciones.
 * 3. Índices compuestos alineados con las consultas reales (filtrado por estado, mesa, turnos, catálogo activo y orden temporal).
 * 4. Soporte estructural de idempotencia y consistencia en ventas, comandas y ajustes de inventario.
 */
export default defineSchema({
  // ==========================================
  // USUARIOS Y PERMISOS DE ACCESO
  // ==========================================
  users: defineTable({
    id: v.string(), // UUID de usuario generado por el cliente/sistema
    username: v.string(), // Identificador único de inicio de sesión (e.g. "admin", "ana", "cocina")
    fullName: v.string(),
    pin: v.string(), // Código PIN numérico de acceso rápido opcional
    passwordHash: v.optional(v.string()), // Hash criptográfico de contraseña SHA-256 (NUNCA texto claro)
    role: v.union(
      v.literal("ADMIN_GENERAL"),
      v.literal("DUENO"),
      v.literal("CAJERO"),
      v.literal("DEPENDIENTE"),
      v.literal("COCINA"),
      v.literal("BARTENDER"),
      v.literal("DUENO_CAJERO")
    ),
    canOverridePrices: v.optional(v.boolean()),
    canManageInventory: v.optional(v.boolean()),
    canConfirmPayments: v.optional(v.boolean()),
    canManageMenuItems: v.optional(v.boolean()),
    canManageMenuAvailability: v.optional(v.boolean()),
    canManageRestaurantSchedule: v.optional(v.boolean()),
    assignedArea: v.optional(v.string()),
    active: v.boolean(),
    deleted: v.optional(v.boolean()), // Borrado lógico (compatibilidad)
    profileStorageId: v.optional(v.string()), // Referencia a Convex File Storage
    profilePictureUrl: v.optional(v.string()), // URL de visualización persistente
    phone: v.optional(v.string()), // Número de teléfono opcional para inicio de sesión
    linkedDeviceId: v.optional(v.string()), // Relación previa de dispositivo (compatibilidad)
    restrictToAuthorizedDevices: v.optional(v.boolean()), // Política de restricción por usuario
    maxDevicesPerUser: v.optional(v.number()), // Límite de dispositivos (predeterminado: 3)
    createdAt: v.optional(v.number()), // Marca de tiempo de registro para auditoría
    updatedAt: v.optional(v.number()), // Marca de tiempo de última actualización
  })
    .index("by_custom_id", ["id"])
    .index("by_username", ["username"])
    .index("by_role", ["role"])
    .index("by_active", ["active"])
    .index("by_role_and_active", ["role", "active"]),

  // ==========================================
  // TASA DE CAMBIO MONETARIA (USD -> CUP)
  // ==========================================
  exchange_rates: defineTable({
    id: v.string(), // UUID del registro de tasa
    sourceCurrency: v.string(), // Moneda base (e.g. "USD")
    targetCurrency: v.string(), // Moneda de cotización (e.g. "CUP")
    rate: v.number(), // Valor numérico de la tasa (e.g. 360.0 CUP / 1 USD)
    updatedAt: v.number(), // Marca de tiempo epoch en milisegundos
    updatedByUserId: v.string(), // Relación: ID de usuario administrador que fijó la tasa
    updatedByUserName: v.string(),
  })
    .index("by_custom_id", ["id"])
    .index("by_pair", ["sourceCurrency", "targetCurrency"])
    .index("by_pair_and_updatedAt", ["sourceCurrency", "targetCurrency", "updatedAt"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_updatedByUser", ["updatedByUserId"]),

  // ==========================================
  // MÓDULO 1: CATÁLOGO DE PRODUCTOS DE TIENDA
  // ==========================================
  shop_products: defineTable({
    id: v.string(), // UUID del producto
    code: v.string(), // Código único de barras o SKU (e.g. "750101")
    name: v.string(),
    category: v.string(), // "Víveres", "Granos", "Bebidas & Despensa", "Aseo & Limpieza", etc.
    unitOfMeasure: v.string(), // Unidad: "ud", "lb", "kg", "pqte", "lt", "bot", "lata", "bolsa"
    priceMode: v.union(
      v.literal("FIXED_CUP"),
      v.literal("USD_REFERENCE")
    ),
    fixedPriceCup: v.number(), // Precio directo en CUP
    referencePriceUsd: v.number(), // Precio en USD recalculable según tasa activa
    currentStock: v.number(), // Stock físico actual en almacén/estantería
    minStockThreshold: v.number(), // Umbral para advertencias de stock bajo
    active: v.boolean(),
    updatedAt: v.optional(v.number()), // Control de consistencia en modificaciones
  })
    .index("by_custom_id", ["id"])
    .index("by_code", ["code"])
    .index("by_category", ["category"])
    .index("by_active", ["active"])
    .index("by_active_and_category", ["active", "category"]),

  // ==========================================
  // MÓDULO 1: MOVIMIENTOS DE INVENTARIO
  // ==========================================
  inventory_movements: defineTable({
    id: v.string(), // UUID del movimiento
    productId: v.string(), // Relación: ID del producto afectado en shop_products
    productName: v.string(),
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
    reason: v.string(), // Justificación obligatoria para auditoría
    userId: v.string(), // Relación: ID del usuario responsable del movimiento
    userName: v.string(),
    timestamp: v.number(),
    // Estructuras de soporte para consistencia, relaciones e idempotencia
    shiftId: v.optional(v.string()), // Relación opcional con shop_shifts para cierres de turno
    saleId: v.optional(v.string()), // Relación opcional con shop_sales si deriva de una venta POS
    idempotencyKey: v.optional(v.string()), // Soporte de idempotencia para ajustes automáticos o por lotes
  })
    .index("by_custom_id", ["id"])
    .index("by_product", ["productId"])
    .index("by_product_and_timestamp", ["productId", "timestamp"])
    .index("by_timestamp", ["timestamp"])
    .index("by_type", ["type"])
    .index("by_user", ["userId"])
    .index("by_shift", ["shiftId"])
    .index("by_sale", ["saleId"])
    .index("by_idempotency", ["idempotencyKey"]),

  // ==========================================
  // MÓDULO 1: TURNOS DE VENTA (JORNADAS)
  // ==========================================
  shop_shifts: defineTable({
    id: v.string(), // UUID de la jornada
    openedAt: v.number(),
    closedAt: v.optional(v.number()),
    openedByUserId: v.string(), // Relación: Usuario que inició la jornada
    openedByUserName: v.string(),
    closedByUserId: v.optional(v.string()), // Relación: Usuario que cerró y cuadró inventario
    closedByUserName: v.optional(v.string()),
    isActive: v.boolean(),
    notes: v.string(),
  })
    .index("by_custom_id", ["id"])
    .index("by_active", ["isActive"])
    .index("by_openedAt", ["openedAt"])
    .index("by_openedByUser", ["openedByUserId"])
    .index("by_closedByUser", ["closedByUserId"]),

  // ==========================================
  // PROGRAMACIÓN Y CONFIGURACIÓN DE JORNADAS
  // ==========================================
  shift_schedules: defineTable({
    id: v.string(), // "default"
    timeZone: v.string(), // "America/Havana"
    weeklySchedule: v.array(
      v.object({
        dayOfWeek: v.number(), // 1 = Lunes, ..., 7 = Domingo
        dayName: v.string(),
        enabled: v.boolean(),
        openTime: v.optional(v.string()),
        closeTime: v.optional(v.string()),
        session1OpenTime: v.optional(v.string()),
        session1CloseTime: v.optional(v.string()),
        session2Enabled: v.optional(v.boolean()),
        session2OpenTime: v.optional(v.string()),
        session2CloseTime: v.optional(v.string()),
        openTime2: v.optional(v.string()),
        closeTime2: v.optional(v.string()),
        sessions: v.optional(v.any()),
      })
    ),
    manualOverride: v.optional(
      v.object({
        overrideType: v.union(v.literal("MANUAL_OPEN"), v.literal("MANUAL_CLOSE")),
        overrideAt: v.number(),
        overrideByUserId: v.string(),
        overrideByUserName: v.string(),
      })
    ),
    updatedAt: v.number(),
    updatedByUserId: v.string(),
    updatedByUserName: v.string(),
  }).index("by_custom_id", ["id"]),

  // ==========================================
  // MÓDULO 1: VENTAS DE TIENDA (POS)
  // ==========================================
  shop_sales: defineTable({
    id: v.string(), // UUID de la venta
    shiftId: v.string(), // Relación: Turno de tienda activo bajo el que se efectuó
    timestamp: v.number(),
    userId: v.string(), // Relación: Usuario dependiente o cajero que atendió
    userName: v.string(),
    items: v.array(
      v.object({
        productId: v.string(), // Relación: ID del producto en shop_products
        productCode: v.string(),
        productName: v.string(),
        quantity: v.number(),
        unitPriceCup: v.number(), // Precio unitario congelado al momento exacto de la venta
        rateApplied: v.number(), // Tasa USD/CUP congelada al momento de la venta
        subtotalCup: v.number(),
      })
    ),
    totalCup: v.number(),
    paymentMethod: v.union(
      v.literal("EFECTIVO"),
      v.literal("TRANSFERENCIA"),
      v.literal("MIXTO")
    ),
    idempotencyKey: v.string(), // Clave de idempotencia para prevenir dobles cobros y reintentos de red
  })
    .index("by_custom_id", ["id"])
    .index("by_idempotency", ["idempotencyKey"])
    .index("by_shift", ["shiftId"])
    .index("by_shift_and_timestamp", ["shiftId", "timestamp"])
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_paymentMethod", ["paymentMethod"]),

  // ==========================================
  // MÓDULO 2: MESAS DEL BAR-RESTAURANTE
  // ==========================================
  restaurant_tables: defineTable({
    id: v.string(), // UUID de la mesa
    number: v.number(), // Número identificador único de la mesa o barra
    name: v.string(), // Denominación: "Mesa 1", "Barra A", "Terraza 1"
    capacity: v.number(),
    active: v.boolean(),
  })
    .index("by_custom_id", ["id"])
    .index("by_number", ["number"])
    .index("by_active", ["active"]),

  // ==========================================
  // MÓDULO 2: MENÚ / CARTA DEL BAR-RESTAURANTE
  // ==========================================
  menu_items: defineTable({
    id: v.string(), // UUID del plato o bebida
    code: v.optional(v.string()), // Código de carta (e.g. "BAR-01", "PLA-01")
    name: v.string(),
    category: v.string(), // "Bebidas & Coctelería", "Tapas & Entrantes", "Platos Principales", "Postres"
    description: v.optional(v.string()),
    portion: v.optional(v.string()), // Gramaje o volumen (e.g. "50g", "330ml", "1.5L")
    priceCup: v.optional(v.number()),
    available: v.optional(v.boolean()),
    isPublished: v.optional(v.boolean()),
    storageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isFeatured: v.optional(v.boolean()),
    displayOrder: v.optional(v.number()),
    featuredOrder: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()), // Control de consistencia en actualizaciones de precios/platos
  })
    .index("by_custom_id", ["id"])
    .index("by_code", ["code"])
    .index("by_category", ["category"])
    .index("by_available", ["available"])
    .index("by_published", ["isPublished", "displayOrder"])
    .index("by_published_category", ["isPublished", "category", "displayOrder"])
    .index("by_featured", ["isPublished", "isFeatured", "featuredOrder"]),

  // ==========================================
  // MÓDULO 2: RESERVACIONES DEL BAR-RESTAURANTE (FASE 6)
  // ==========================================
  restaurant_reservations: defineTable({
    id: v.string(), // Identificador único (e.g. "res-1793354645285-xob5fo")
    fullName: v.string(), // Nombre completo del cliente solicitante
    emailOrPhone: v.string(), // Contacto directo (email o teléfono)
    email: v.optional(v.string()), // Email opcional
    phone: v.optional(v.string()), // Teléfono opcional
    partySize: v.number(), // Cantidad de comensales / personas
    seatingArea: v.optional(v.string()), // Área solicitada (e.g. "terraza", "interior", "barra")
    specialNotes: v.optional(v.string()), // Observaciones, alergias o solicitudes especiales
    notes: v.optional(v.string()), // Alias para notas
    source: v.optional(v.string()), // Canal de origen ("web", "android", "presencial")
    date: v.string(), // Fecha solicitada (YYYY-MM-DD)
    time: v.string(), // Hora solicitada (e.g. "8:00 PM", "20:00")
    requestedDate: v.optional(v.string()), // Respaldo de fecha original
    requestedTime: v.optional(v.string()), // Respaldo de hora original
    tableId: v.optional(v.string()), // Relación: ID de mesa asignada en restaurant_tables
    assignedTableId: v.optional(v.string()), // Alias de mesa asignada
    tableNumber: v.optional(v.number()), // Número de mesa asignada
    assignedTableNumber: v.optional(v.number()), // Alias número de mesa
    status: v.union(
      v.literal("Pendiente"),
      v.literal("Negociación"),
      v.literal("Confirmado"),
      v.literal("Consolidado"),
      v.literal("Rechazado"),
      v.literal("Marcada")
    ),
    alternativeDate: v.optional(v.string()), // Fecha alternativa propuesta en negociación
    alternativeTime: v.optional(v.string()), // Hora alternativa propuesta en negociación
    alternativeNotes: v.optional(v.string()), // Motivo o nota de la propuesta alternativa
    negotiationNotes: v.optional(v.string()), // Alias notas de negociación
    proposedAt: v.optional(v.number()), // Marca de tiempo de la propuesta alternativa
    proposedByUserId: v.optional(v.string()), // Usuario que propuso la alternativa
    acceptedAlternativeAt: v.optional(v.number()), // Marca de tiempo de aceptación de alternativa
    acceptedByUserId: v.optional(v.string()), // Usuario que aceptó/registró la alternativa
    confirmedAt: v.optional(v.number()), // Marca de tiempo de confirmación
    confirmedByUserId: v.optional(v.string()), // Usuario que confirmó la reservación
    rejectionReason: v.optional(v.string()), // Motivo de rechazo o cancelación
    rejectedAt: v.optional(v.number()), // Marca de tiempo de rechazo
    rejectedByUserId: v.optional(v.string()), // Usuario que rechazó
    consolidatedAt: v.optional(v.number()), // Marca de tiempo de llegada y consolidación
    consolidatedByUserId: v.optional(v.string()), // Usuario que consolidó
    markedAt: v.optional(v.number()), // Marca de tiempo de marcado
    markedByUserId: v.optional(v.string()), // Administrador responsable que marcó la reservación
    markedByUserName: v.optional(v.string()), // Nombre del administrador responsable
    customerId: v.optional(v.string()), // Relación opcional con cliente
    trackingCodeHash: v.optional(v.string()), // Respaldo de hash de código de seguimiento web
    createdAt: v.number(), // Marca de tiempo de creación
    updatedAt: v.number(), // Marca de tiempo de última actualización
  })
    .index("by_custom_id", ["id"])
    .index("by_status", ["status"])
    .index("by_date", ["date"])
    .index("by_createdAt", ["createdAt"])
    .index("by_tableId", ["tableId"])
    .index("by_status_and_date", ["status", "date"])
    .index("by_status_and_createdAt", ["status", "createdAt"])
    .index("by_customer", ["customerId"])
    .index("by_source", ["source"]),

  // ==========================================
  // MÓDULO 2: CLIENTES DEL BAR-RESTAURANTE
  // ==========================================
  restaurant_customers: defineTable({
    id: v.string(), // UUID del cliente
    fullName: v.string(),
    phone: v.optional(v.string()), // Teléfono de contacto normalizado
    email: v.optional(v.string()), // Correo electrónico de contacto
    notes: v.optional(v.string()),
    totalVisits: v.number(), // Número total de visitas consolidadas
    lastVisitAt: v.optional(v.number()), // Marca de tiempo de la última visita consolidada
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_custom_id", ["id"])
    .index("by_phone", ["phone"])
    .index("by_email", ["email"])
    .index("by_totalVisits", ["totalVisits"])
    .index("by_lastVisitAt", ["lastVisitAt"]),



  // ==========================================
  // MÓDULO 2: COMANDAS / ÓRDENES DEL BAR-RESTAURANTE
  // ==========================================
  restaurant_orders: defineTable({
    id: v.string(), // UUID de la orden
    tableId: v.string(), // Relación: ID de la mesa asociada en restaurant_tables
    tableName: v.string(),
    orderNumber: v.number(), // Número secuencial visible de la comanda
    waiterId: v.string(), // Relación: Dependiente que creó la comanda
    waiterName: v.string(),
    createdAt: v.number(),
    items: v.array(
      v.object({
        id: v.string(), // Identificador único de la línea de comanda
        menuItemId: v.string(), // Relación: ID del ítem en menu_items
        itemName: v.string(),
        quantity: v.number(),
        unitPriceCup: v.number(),
        subtotalCup: v.number(),
        notes: v.string(), // Observaciones específicas para cocina
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
      })
    ),
    generalNotes: v.string(),
    totalCup: v.number(),
    status: v.union(
      v.literal("NUEVO"),
      v.literal("EN_PREPARACION"),
      v.literal("LISTO"),
      v.literal("ENTREGADO"),
      v.literal("SERVIDO"),
      v.literal("PENDIENTE_COBRO"),
      v.literal("PAGADO"),
      v.literal("CANCELADO")
    ),
    // Trazabilidad de preparación en cocina
    prepStartedAt: v.optional(v.number()),
    cookUserId: v.optional(v.string()), // Relación: Cocinero que tomó la preparación
    cookUserName: v.optional(v.string()),
    readyAt: v.optional(v.number()),
    deliveredToWaiterAt: v.optional(v.number()),
    // Trazabilidad de entrega en mesa
    servedAt: v.optional(v.number()),
    servedByUserId: v.optional(v.string()), // Relación: Dependiente que entregó los platos
    // Trazabilidad de cobro (integrada directamente en la orden sin tablas redundantes)
    paymentRequestedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    cashierUserId: v.optional(v.string()), // Relación: Cajero o Administrador que confirmó el cobro
    cashierUserName: v.optional(v.string()),
    paymentMethod: v.optional(
      v.union(
        v.literal("EFECTIVO"),
        v.literal("TRANSFERENCIA"),
        v.literal("MIXTO")
      )
    ),
    // Trazabilidad de anulación
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(v.string()),
    cancelledByUserId: v.optional(v.string()), // Relación: Administrador o Dueño que autorizó la cancelación
    // Soporte de idempotencia y control de concurrencia
    idempotencyKey: v.string(), // Clave de idempotencia para creación y confirmación de pago
    isConsolidated: v.optional(v.boolean()),
    cashierConsolidationId: v.optional(v.string()),
    kitchenConsolidationId: v.optional(v.string()),
    waiterConsolidationId: v.optional(v.string()),
    bartenderConsolidationId: v.optional(v.string()),
    jornadaId: v.optional(v.string()), // Identificador de la jornada operativa actual
    updatedAt: v.optional(v.number()), // Marca de tiempo para control de concurrencia optimista
  })
    .index("by_custom_id", ["id"])
    .index("by_idempotency", ["idempotencyKey"])
    .index("by_table", ["tableId"])
    .index("by_table_and_status", ["tableId", "status"]) // Búsqueda de órdenes activas de una mesa específica
    .index("by_status", ["status"])
    .index("by_status_and_createdAt", ["status", "createdAt"]) // Cola cronológica para Cocina y Caja
    .index("by_waiter_and_status", ["waiterId", "status"]) // Vista de órdenes activas por dependiente
    .index("by_waiter_and_createdAt", ["waiterId", "createdAt"])
    .index("by_orderNumber", ["orderNumber"])
    .index("by_createdAt", ["createdAt"])
    .index("by_paidAt", ["paidAt"]) // Reportes y liquidaciones de ingresos confirmados
    .index("by_cashier_and_paidAt", ["cashierUserId", "paidAt"]) // Auditoría de cobros por cajero
    .index("by_kitchenConsolidation", ["kitchenConsolidationId"])
    .index("by_waiterConsolidation", ["waiterConsolidationId"])
    .index("by_bartenderConsolidation", ["bartenderConsolidationId"])
    .index("by_active_jornada", ["isConsolidated", "jornadaId"]),

  // ==========================================
  // SOLICITUDES DE COBRO (PARCIALES O TOTALES)
  // ==========================================
  payment_requests: defineTable({
    id: v.string(), // UUID de la solicitud
    orderId: v.optional(v.string()), // Relación: ID de la orden original (opcional para conjunta)
    orderNumber: v.optional(v.number()), // Opcional para conjunta
    tableId: v.optional(v.string()), // ID de la mesa
    tableName: v.string(),
    station: v.union(v.literal("COCINA"), v.literal("BARTENDER"), v.literal("TOTAL")),
    requestType: v.union(v.literal("PARCIAL"), v.literal("TOTAL"), v.literal("JOINT_TABLE")),
    items: v.array(
      v.object({
        id: v.string(),
        itemName: v.string(),
        quantity: v.number(),
        subtotalCup: v.number(),
        orderId: v.optional(v.string()), // Referencia a orden origen si es conjunta
      })
    ),
    groupedOrders: v.optional(v.array(v.object({
      orderId: v.string(),
      orderNumber: v.number(),
      amountRequested: v.number(),
      previousPayments: v.number(),
      pendingBalance: v.number(),
    }))),
    amountRequested: v.number(),
    requestedAmount: v.optional(v.number()),
    previousPayments: v.number(),
    pendingBalance: v.number(),
    waiterId: v.string(),
    waiterName: v.string(),
    requestedAt: v.number(),
    status: v.union(v.literal("PENDIENTE"), v.literal("CONFIRMADO"), v.literal("CANCELADO")),
    updatedAt: v.optional(v.number()),
    cashierConsolidationId: v.optional(v.string()), // Referencia a la consolidación de jornada
    isConsolidated: v.optional(v.boolean()),
    jornadaId: v.optional(v.string()), // Identificador de la jornada de Caja activa
    idempotencyKey: v.string(),
  })
    .index("by_custom_id", ["id"])
    .index("by_order", ["orderId"])
    .index("by_status", ["status"])
    .index("by_waiter", ["waiterId"])
    .index("by_consolidation", ["cashierConsolidationId"])
    .index("by_idempotency", ["idempotencyKey"])
    .index("by_status_and_requestedAt", ["status", "requestedAt"])
    .index("by_active_jornada", ["isConsolidated", "jornadaId"]),

  // ==========================================
  // REGISTRO DE PAGOS (TRANSACCIONES REALES)
  // ==========================================
  restaurant_payments: defineTable({
    id: v.string(), // UUID del pago
    orderId: v.optional(v.string()), // Relación: ID de la orden original (opcional para conjunta)
    orderNumber: v.optional(v.number()), // Opcional para conjunta
    tableId: v.optional(v.string()), // Relación: ID de la mesa (si es conjunta)
    tableName: v.string(),
    paymentRequestId: v.optional(v.string()), // Referencia a la solicitud si existe
    amount: v.number(), // Importe pagado en esta transacción
    method: v.union(v.literal("EFECTIVO"), v.literal("TRANSFERENCIA"), v.literal("MIXTO")),
    mixedCash: v.optional(v.number()),
    mixedTransfer: v.optional(v.number()),
    cashierUserId: v.string(),
    cashierUserName: v.string(),
    timestamp: v.number(),
    isJoint: v.optional(v.boolean()), // Flag para identificar cobro total de mesa
    orderIds: v.optional(v.array(v.string())), // Lista de IDs de órdenes agrupadas (para conjunta)
    type: v.optional(v.union(v.literal("ORDER_PAYMENT"), v.literal("DIRECT_BAR_SALE"))),
    items: v.optional(v.array(v.object({
      id: v.string(),
      menuItemId: v.string(),
      itemName: v.string(),
      quantity: v.number(),
      unitPriceCup: v.number(),
      subtotalCup: v.number(),
    }))),
    cashierConsolidationId: v.optional(v.string()), // Referencia a la consolidación de jornada
    isConsolidated: v.optional(v.boolean()),
    jornadaId: v.optional(v.string()), // Identificador de la jornada de Caja activa
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
    idempotencyKey: v.string(),
  })
    .index("by_custom_id", ["id"])
    .index("by_order", ["orderId"])
    .index("by_cashier", ["cashierUserId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_consolidation", ["cashierConsolidationId"])
    .index("by_idempotency", ["idempotencyKey"])
    .index("by_payment_request", ["paymentRequestId"])
    .index("by_jornada", ["jornadaId"])
    .index("by_jornada_and_consolidated", ["jornadaId", "isConsolidated"]),

  // ==========================================
  // NOTIFICACIONES OPERATIVAS EN TIEMPO REAL
  // ==========================================
  notifications: defineTable({
    id: v.string(), // UUID de la notificación
    title: v.string(),
    message: v.string(),
    targetRole: v.optional(
      v.union(
        v.literal("ADMIN_GENERAL"),
        v.literal("DUENO"),
        v.literal("CAJERO"),
        v.literal("DEPENDIENTE"),
        v.literal("COCINA"),
        v.literal("BARTENDER"),
        v.literal("DUENO_CAJERO")
      )
    ),
    targetUserId: v.optional(v.string()), // Relación opcional con users.id
    timestamp: v.number(),
    orderId: v.optional(v.string()), // Relación opcional con restaurant_orders.id
    isRead: v.boolean(),
  })
    .index("by_custom_id", ["id"])
    .index("by_targetRole", ["targetRole"])
    .index("by_targetRole_and_isRead", ["targetRole", "isRead"])
    .index("by_targetUser", ["targetUserId"])
    .index("by_targetUser_and_isRead", ["targetUserId", "isRead"])
    .index("by_orderId", ["orderId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_isRead", ["isRead"]),

  // ==========================================
  // SESIONES DE USUARIO Y AUTENTICACIÓN
  // ==========================================
  user_sessions: defineTable({
    token: v.string(), // Token criptográfico opaco (UUID v4)
    userId: v.optional(v.string()), // Relación: users.id
    username: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("ADMIN_GENERAL"),
        v.literal("DUENO"),
        v.literal("CAJERO"),
        v.literal("DEPENDIENTE"),
        v.literal("COCINA"),
        v.literal("BARTENDER"),
        v.literal("DUENO_CAJERO")
      )
    ),
    deviceInfo: v.optional(v.string()), // Identificador de dispositivo (e.g. DVC-XXXX)
    createdAt: v.number(),
    lastActiveAt: v.optional(v.number()),
    isActive: v.boolean(),
    closedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_token_and_active", ["token", "isActive"])
    .index("by_user", ["userId"])
    .index("by_user_and_active", ["userId", "isActive"]),

  // ==========================================
  // SOLICITUDES DE RECUPERACIÓN DE CONTRASEÑA
  // ==========================================
  password_resets: defineTable({
    id: v.string(),
    userId: v.string(),
    username: v.string(),
    code: v.string(), // Código de 6 caracteres (A-Z, 0-9)
    expiresAt: v.number(), // Expiración a 3 minutos
    used: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_custom_id", ["id"])
    .index("by_user", ["userId"])
    .index("by_code", ["code"])
    .index("by_expiresAt", ["expiresAt"]),

  // ==========================================
  // DISPOSITIVOS REGISTRADOS (DVC)
  // ==========================================
  devices: defineTable({
    id: v.optional(v.string()),
    hardwareId: v.string(),
    dvcCode: v.string(),
    status: v.optional(v.string()), // PENDING, ACTIVE, INACTIVE
    createdAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    authorized: v.optional(v.boolean()),
    deviceType: v.optional(v.string()),
    name: v.optional(v.string()),
    registeredAt: v.optional(v.number()),
    lastActiveAt: v.optional(v.number()),
  })
    .index("by_custom_id", ["id"])
    .index("by_hardwareId", ["hardwareId"])
    .index("by_dvcCode", ["dvcCode"])
    .index("by_status", ["status"]),

  // ==========================================
  // DISPOSITIVOS VINCULADOS POR USUARIO (MULTIDISPOSITIVO)
  // ==========================================
  user_devices: defineTable({
    id: v.optional(v.string()),
    userId: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    dvcCode: v.optional(v.string()),
    authorized: v.optional(v.boolean()),
    registeredAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_custom_id", ["id"])
    .index("by_user", ["userId"])
    .index("by_device", ["deviceId"])
    .index("by_user_and_device", ["userId", "deviceId"])
    .index("by_user_and_dvc", ["userId", "dvcCode"])
    .index("by_dvcCode", ["dvcCode"])
    .index("by_authorized", ["authorized"]),

  // ==========================================
  // REGISTRO CENTRALIZADO DE ACCIONES (AUDITORÍA)
  // ==========================================
  audit_logs: defineTable({
    id: v.string(),
    userId: v.string(),
    userName: v.string(),
    module: v.union(v.literal("GENERAL"), v.literal("TIENDA"), v.literal("BAR")),
    action: v.string(),
    entityId: v.optional(v.string()), // ID del objeto afectado
    result: v.union(v.literal("SUCCESS"), v.literal("FAILURE")),
    timestamp: v.number(),
    isOutsideShift: v.boolean(),
    shiftId: v.optional(v.string()),
    details: v.optional(v.string()),
  })
    .index("by_module", ["module"])
    .index("by_timestamp", ["timestamp"])
    .index("by_module_and_timestamp", ["module", "timestamp"])
    .index("by_user", ["userId"])
    .index("by_shift", ["shiftId"]),

  // ==========================================
  // JORNADAS ARCHIVADAS (HISTÓRICO)
  // ==========================================
  archived_shifts: defineTable({
    id: v.string(), // UUID de la jornada original
    openedAt: v.number(),
    closedAt: v.number(),
    openedByUserId: v.string(),
    openedByUserName: v.string(),
    closedByUserId: v.string(),
    closedByUserName: v.string(),
    notes: v.string(),
    events: v.array(v.any()), // Historial completo de eventos de la jornada
    exportedAt: v.number(),
  })
    .index("by_custom_id", ["id"])
    .index("by_closedAt", ["closedAt"]),

  // ==========================================
  // CONSOLIDACIONES DE JORNADA DE COCINA (PROMPT 3.3)
  // ==========================================
  kitchen_consolidations: defineTable({
    id: v.string(), // UUID de la consolidación
    jornadaId: v.string(), // Identificador estable de la jornada (e.g. "jornada-2026-11-03")
    dateStr: v.string(), // Fecha en formato YYYY-MM-DD
    consolidatedAt: v.number(), // Epoch ms
    cookUserId: v.string(), // ID del usuario de cocina responsable
    cookUserName: v.string(), // Nombre del usuario de cocina responsable
    totalOrdersReceived: v.number(),
    totalAmountReceived: v.number(),
    totalOrdersDelivered: v.number(),
    totalAmountDelivered: v.number(),
    totalOrdersPending: v.number(),
    totalAmountPending: v.number(),
    totalOrdersCancelled: v.number(),
    totalAmountCancelled: v.number(),
    orders: v.array(v.any()), // Snapshot completo de las órdenes clasificadas
    aggregatedDishes: v.array(
      v.object({
        menuItemId: v.string(),
        itemName: v.string(),
        quantity: v.number(),
        totalCup: v.number(),
      })
    ),
    idempotencyKey: v.string(), // Clave de idempotencia única
    notes: v.optional(v.string()),
  })
    .index("by_custom_id", ["id"])
    .index("by_jornadaId", ["jornadaId"])
    .index("by_dateStr", ["dateStr"])
    .index("by_consolidatedAt", ["consolidatedAt"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  // ==========================================
  // CONSOLIDACIONES DE JORNADA DE CAJA (PROMPT 5.5)
  // ==========================================
  cashier_consolidations: defineTable({
    id: v.string(), // UUID de la consolidación
    jornadaId: v.string(), // Identificador estable de la jornada (e.g. "jornada-2026-11-03")
    dateStr: v.string(), // Fecha en formato YYYY-MM-DD
    consolidatedAt: v.number(), // Epoch ms
    periodStart: v.optional(v.number()), // Primer cobro o inicio de periodo
    periodEnd: v.optional(v.number()), // Último cobro o fin de periodo
    cashierUserId: v.string(), // ID del usuario cajero o dueño responsable
    cashierUserName: v.string(), // Nombre del usuario responsable
    cashierRole: v.optional(v.string()), // "CAJERO" o "DUENO_CAJERO"

    // Totales económicos efectivamente cobrados
    totalOrdersPaid: v.number(),
    totalAmountPaid: v.number(),
    totalCashCup: v.number(),
    totalTransferCup: v.number(),
    totalOtherCup: v.number(),

    // Desglose de órdenes pagadas con detalle completo
    ordersPaid: v.array(v.any()),

    // Órdenes pendientes de cobro o en elaboración (separadas estrictamente, no sumadas a los cobros)
    pendingOrders: v.array(v.any()),
    totalOrdersPending: v.number(),
    totalAmountPending: v.number(),

    // Órdenes canceladas
    cancelledOrders: v.array(v.any()),
    totalOrdersCancelled: v.number(),
    totalAmountCancelled: v.number(),

    // Movimientos de efectivo (si aplican)
    cashMovements: v.optional(v.array(v.any())),
    totalCashInCup: v.optional(v.number()),
    totalCashOutCup: v.optional(v.number()),

    // Archivo íntegro de los documentos de cobro registrados en la jornada
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

    idempotencyKey: v.string(), // Clave de idempotencia única
    notes: v.optional(v.string()),
  })
    .index("by_custom_id", ["id"])
    .index("by_jornadaId", ["jornadaId"])
    .index("by_dateStr", ["dateStr"])
    .index("by_consolidatedAt", ["consolidatedAt"])
    .index("by_cashierUserId", ["cashierUserId"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  // ==========================================
  // CONSOLIDACIONES DE JORNADA DE BARTENDER (ETAPA 6.4)
  // ==========================================
  bartender_consolidations: defineTable({
    id: v.string(), // UUID de la consolidación
    jornadaId: v.string(), // Identificador estable de la jornada (e.g. "jornada-2026-11-03")
    dateStr: v.string(), // Fecha en formato YYYY-MM-DD
    consolidatedAt: v.number(), // Epoch ms
    bartenderUserId: v.string(), // ID del usuario bartender responsable
    bartenderUserName: v.string(), // Nombre del usuario responsable
    totalOrdersReceived: v.number(),
    totalAmountReceived: v.number(),
    totalOrdersDelivered: v.number(),
    totalAmountDelivered: v.number(),
    totalOrdersPending: v.number(),
    totalAmountPending: v.number(),
    totalOrdersCancelled: v.number(),
    totalAmountCancelled: v.number(),
    orders: v.array(v.any()), // Snapshot completo de las órdenes clasificadas (solo ítems de barra)
    aggregatedDishes: v.array(
      v.object({
        menuItemId: v.string(),
        itemName: v.string(),
        quantity: v.number(),
        totalCup: v.number(),
      })
    ),
    idempotencyKey: v.string(), // Clave de idempotencia única
    notes: v.optional(v.string()),
  })
    .index("by_custom_id", ["id"])
    .index("by_jornadaId", ["jornadaId"])
    .index("by_dateStr", ["dateStr"])
    .index("by_consolidatedAt", ["consolidatedAt"])
    .index("by_bartenderUserId", ["bartenderUserId"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  // ==========================================
  // CONSOLIDACIONES DE JORNADA DE DEPENDIENTE
  // ==========================================
  waiter_consolidations: defineTable({
    id: v.string(), // UUID de la consolidación
    jornadaId: v.string(), // Identificador de la jornada (e.g. "jornada-2026-11-05")
    dateStr: v.string(), // Fecha YYYY-MM-DD
    consolidatedAt: v.number(), // Epoch ms
    waiterUserId: v.string(), // ID del dependiente responsable
    waiterUserName: v.string(), // Nombre del dependiente
    assignedArea: v.optional(v.string()), // "BAR_TERRAZA", "TIENDA", "BAR_RESTAURANTE", etc.
    totalOrders: v.number(),
    totalAmount: v.number(),
    totalKitchenItems: v.number(),
    totalBartenderItems: v.number(),
    totalPendingOrders: v.number(),
    totalDeliveredOrders: v.number(),
    totalCancelledOrders: v.number(),
    totalPaidOrders: v.number(),
    orders: v.array(v.any()), // Listado de órdenes reales creadas/gestionadas por este dependiente
    itemsSummary: v.array(
      v.object({
        menuItemId: v.string(),
        itemName: v.string(),
        destination: v.string(), // "COCINA" o "BAR"
        quantity: v.number(),
        totalCup: v.number(),
      })
    ),
    idempotencyKey: v.string(),
    notes: v.optional(v.string()),
    reportText: v.optional(v.string()),
  })
    .index("by_custom_id", ["id"])
    .index("by_jornadaId", ["jornadaId"])
    .index("by_dateStr", ["dateStr"])
    .index("by_consolidatedAt", ["consolidatedAt"])
    .index("by_waiterUserId", ["waiterUserId"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  // ==========================================
  // BANDEJA DE INFORMES PARA AUDITORÍA DEL DUEÑO (PROMPT 3.3)
  // ==========================================
  owner_reports: defineTable({
    id: v.string(), // UUID del informe
    reportType: v.union(
      v.literal("COCINA"),
      v.literal("BARTENDER"),
      v.literal("DEPENDIENTE_BAR"),
      v.literal("DEPENDIENTE_TIENDA"),
      v.literal("CAJERO"),
      v.literal("DEPENDIENTE")
    ),
    targetAudience: v.string(), // "DUEÑO"
    targetOwnerUserId: v.optional(v.string()), // ID de cuenta del Dueño (e.g. "u-dueno")
    targetOwnerUserName: v.optional(v.string()), // "Dueno"
    sourceModule: v.string(), // "COCINA" o "CAJERO"
    sourceUserId: v.string(),
    sourceUserName: v.string(),
    jornadaId: v.string(),
    dateStr: v.string(),
    createdAt: v.number(),
    status: v.union(
      v.literal("PENDIENTE_REVISION"),
      v.literal("AUDITADO"),
      v.literal("CERRADO")
    ),
    reviewedAt: v.optional(v.number()),
    reviewedByUserId: v.optional(v.string()),
    summary: v.object({
      totalOrdersReceived: v.number(),
      totalAmountReceived: v.number(),
      totalOrdersDelivered: v.number(),
      totalAmountDelivered: v.number(),
      totalOrdersPending: v.number(),
      totalAmountPending: v.number(),
      totalOrdersCancelled: v.number(),
      totalAmountCancelled: v.number(),
      totalOrdersPaid: v.optional(v.number()),
      totalAmountPaid: v.optional(v.number()),
      totalCashCup: v.optional(v.number()),
      totalTransferCup: v.optional(v.number()),
      totalOtherCup: v.optional(v.number()),
    }),
    details: v.any(), // Estructura con detalle de órdenes y platos para auditoría
    idempotencyKey: v.string(),
  })
    .index("by_custom_id", ["id"])
    .index("by_reportType", ["reportType"])
    .index("by_targetAudience", ["targetAudience"])
    .index("by_targetOwnerUserId", ["targetOwnerUserId"])
    .index("by_jornadaId", ["jornadaId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  // ==========================================
  // TOKENS FCM PARA NOTIFICACIONES PUSH DE COCINA (PROMPT 3.4)
  // ==========================================
  fcm_tokens: defineTable({
    id: v.string(), // UUID del registro de token
    userId: v.string(), // Relación: users.id (rol COCINA)
    username: v.string(),
    fcmToken: v.string(), // Token FCM del dispositivo
    deviceInfo: v.string(), // Identificador de dispositivo (e.g. DVC-XXXX)
    updatedAt: v.number(),
    active: v.boolean(),
  })
    .index("by_custom_id", ["id"])
    .index("by_userId", ["userId"])
    .index("by_fcmToken", ["fcmToken"])
    .index("by_active", ["active"]),

  // ==========================================
  // CUADRE DE CAJA Y RECONCILIACIÓN (ETAPA 4)
  // ==========================================
  cash_reconciliations: defineTable({
    id: v.string(), // UUID del cuadre
    shiftId: v.string(), // ID de la jornada ("jornada-YYYY-MM-DD")
    dateStr: v.string(),
    initialFloatCup: v.number(),
    expectedCashCup: v.number(),
    countedCashCup: v.number(),
    cashInCup: v.number(),
    cashOutCup: v.number(),
    differenceCup: v.number(),
    nonCashTotalCup: v.number(),
    resultStatus: v.string(), // "CUADRADO", "SOBRANTE", "FALTANTE"
    confirmedByUserId: v.string(),
    confirmedByUserName: v.string(),
    confirmedAt: v.number(),
    updatedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_custom_id", ["id"])
    .index("by_shiftId", ["shiftId"])
    .index("by_dateStr", ["dateStr"]),

  // ==========================================
  // TOKENS PUSHY PARA NOTIFICACIONES PUSH (MQTT INDEPENDIENTE)
  // ==========================================
  pushy_tokens: defineTable({
    id: v.string(), // UUID del registro de token
    userId: v.string(), // Relación: users.id
    username: v.string(),
    pushyToken: v.string(), // Token Pushy del dispositivo
    deviceInfo: v.string(), // Identificador de dispositivo (e.g. DVC-XXXX)
    updatedAt: v.number(),
    active: v.boolean(),
  })
    .index("by_custom_id", ["id"])
    .index("by_userId", ["userId"])
    .index("by_pushyToken", ["pushyToken"])
    .index("by_active", ["active"]),

  // ==========================================
  // DISPOSITIVOS DE NAVEGADOR WEB (PARA GESTIÓN WEB)
  // ==========================================
  browser_devices: defineTable({
    id: v.optional(v.string()), 
    userAgent: v.string(),
    dvcCode: v.string(),
    status: v.union(
      v.literal("PENDIENTE"),
      v.literal("ACTIVE"),
      v.literal("INACTIVE"),
      v.literal("PENDING") // Added PENDING to match existing data
    ),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    registeredAt: v.optional(v.number()), // Match existing data
    lastActiveAt: v.optional(v.number()), // Match existing data
  })
    .index("by_custom_id", ["id"])
    .index("by_dvcCode", ["dvcCode"])
    .index("by_status", ["status"]),
});
