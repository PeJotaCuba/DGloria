import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
    menu_dishes: defineTable({
      name: v.string(),
      description: v.string(),
      imageId: v.optional(v.string()), // Referencia a la imagen (ID de Convex Storage o URL estática)
      imageUrl: v.optional(v.string()), // URL alternativa o directa
      category: v.string(), // Categoría (ej: "Especialidades", "Platos Fuertes", "Entrantes", "Bebidas", "Postres")
      isPublished: v.boolean(), // Estado de publicación (true = visible en la web)
      isFeatured: v.boolean(), // Indicador para destacar en la landing page (máx. 3)
      featuredOrder: v.optional(v.number()), // Orden de prioridad entre los platos destacados (1, 2, 3)
      displayOrder: v.number(), // Orden de aparición dentro de su categoría o carta
      createdAt: v.number(), // Fecha de creación (timestamp en ms)
      updatedAt: v.number(), // Fecha de última actualización (timestamp en ms)
    })
      .index("by_published", ["isPublished", "displayOrder"])
      .index("by_published_category", ["isPublished", "category", "displayOrder"])
      .index("by_featured", ["isPublished", "isFeatured", "featuredOrder"]),
  },
  {
    // Permite la coexistencia flexible con las demás tablas operativas del restaurante gestionadas por Android
    schemaValidation: false,
  }
);
