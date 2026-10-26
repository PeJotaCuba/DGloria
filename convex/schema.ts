import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
    // Tabla del menú público
    menu_dishes: defineTable({
      name: v.string(),
      description: v.string(),
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

    // Tabla de usuarios (Administradores, Camareros, Personal de Caja/Cocina)
    users: defineTable({
      username: v.string(),
      name: v.optional(v.string()),
      role: v.optional(v.string()),
      active: v.optional(v.boolean()),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    })
      .index("by_username", ["username"])
      .index("by_role", ["role"])
      .index("by_active", ["active"]),

    // Tabla de dispositivos autorizados (TPVs, Tablets, Móviles)
    devices: defineTable({
      dvcCode: v.optional(v.string()),
      hardwareId: v.optional(v.string()),
      name: v.optional(v.string()),
      deviceType: v.optional(v.string()),
      authorized: v.optional(v.boolean()),
      registeredAt: v.optional(v.number()),
      lastActiveAt: v.optional(v.number()),
    })
      .index("by_dvcCode", ["dvcCode"])
      .index("by_hardwareId", ["hardwareId"]),

    // Tabla de sesiones de usuarios
    user_sessions: defineTable({
      userId: v.union(v.id("users"), v.string()),
      token: v.string(),
      isActive: v.optional(v.boolean()),
      createdAt: v.optional(v.number()),
    }).index("by_token", ["token"]),
  },
  {
    // Permite la coexistencia flexible con las demás tablas operativas del restaurante gestionadas por Android
    schemaValidation: false,
  }
);
