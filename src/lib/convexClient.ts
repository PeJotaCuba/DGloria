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
 */
export async function getPublishedDishesFromConvex(category?: string): Promise<ConvexDish[]> {
  try {
    const dishes = await convexHttpClient.query(api.menuDishes.getPublishedDishes, {
      category: category || undefined,
    });
    return dishes as ConvexDish[];
  } catch (error) {
    console.warn("No se pudieron cargar los platos desde Convex:", error);
    return [];
  }
}

/**
 * Consulta pública HTTP para obtener las categorías activas.
 */
export async function getCategoriesFromConvex(): Promise<string[]> {
  try {
    const categories = await convexHttpClient.query(api.menuDishes.getCategories, {});
    return categories as string[];
  } catch (error) {
    console.warn("No se pudieron cargar las categorías desde Convex:", error);
    return [];
  }
}
