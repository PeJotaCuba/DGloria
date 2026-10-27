import { ConvexHttpClient } from "convex/browser";
import { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";

const CONVEX_URL =
  import.meta.env.VITE_CONVEX_URL || "https://unique-wolf-577.convex.cloud";

export const convexReactClient = new ConvexReactClient(CONVEX_URL);
export const convexHttpClient = new ConvexHttpClient(CONVEX_URL);

export interface ConvexDish {
  id: string;
  _id: string;
  name: string;
  description: string;
  category: string;
  imageId?: string;
  imageUrl?: string;
  isPublished: boolean;
  isFeatured: boolean;
  featuredOrder?: number;
  displayOrder: number;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Consulta pública HTTP para obtener la carta de platos publicados.
 * Propaga errores para que la interfaz maneje adecuadamente los estados de conexión y reintento.
 */
export async function getPublishedDishesFromConvex(category?: string): Promise<ConvexDish[]> {
  try {
    const dishes = await convexHttpClient.query(api.menuDishes.getPublishedDishes, {
      category: category || undefined,
    });
    return (dishes || []) as ConvexDish[];
  } catch (error) {
    console.error("Error al consultar platos publicados en Convex:", error);
    throw error;
  }
}

/**
 * Consulta pública HTTP para obtener las categorías activas.
 */
export async function getCategoriesFromConvex(): Promise<string[]> {
  try {
    const categories = await convexHttpClient.query(api.menuDishes.getCategories, {});
    return (categories || []) as string[];
  } catch (error) {
    console.warn("Advertencia al obtener categorías en Convex:", error);
    return [];
  }
}

/**
 * Consulta pública HTTP para obtener los platos destacados para la portada (máx. 3).
 * Propaga errores para que el componente identifique fallos reales de red.
 */
export async function getFeaturedDishesFromConvex(): Promise<ConvexDish[]> {
  try {
    const dishes = await convexHttpClient.query(api.menuDishes.getFeaturedDishes, {});
    return (dishes || []) as ConvexDish[];
  } catch (error) {
    console.error("Error al consultar platos destacados en Convex:", error);
    throw error;
  }
}
