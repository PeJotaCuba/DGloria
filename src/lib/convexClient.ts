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
  price?: number | string;
  priceCup?: number;
  priceFormatted?: string;
  imageId?: string;
  imageUrl?: string;
  isPublished: boolean;
  isFeatured: boolean;
  featuredOrder?: number;
  displayOrder: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ScheduleSession {
  openTime: string;
  closeTime: string;
  openTimeFormatted: string;
  closeTimeFormatted: string;
}

export interface WeeklyScheduleDay {
  dayOfWeek: number;
  dayName: string;
  enabled: boolean;
  sessions: ScheduleSession[];
  openTime?: string;
  closeTime?: string;
  openTimeFormatted?: string;
  closeTimeFormatted?: string;
  closedReason?: string;
  displayText?: string;
}

export interface PublicOpeningHours {
  isConfigured: boolean;
  timeZone: string;
  updatedAt: number | null;
  weeklySchedule: WeeklyScheduleDay[];
  openDaysSummary: string;
  closedDaysSummary: string;
  todayStatus: {
    dayName: string;
    isOpenNow: boolean;
    isEnabledToday: boolean;
    displayText: string;
  };
}

/**
 * Formatea el precio real guardado en Convex sin inventar importes ficticios.
 */
export function formatDishPrice(dish: ConvexDish): string | null {
  if (dish.priceFormatted && dish.priceFormatted.trim()) {
    return dish.priceFormatted.trim();
  }

  const p = dish.price ?? dish.priceCup;
  if (p !== undefined && p !== null && p !== "") {
    if (typeof p === "number") {
      return `$${p.toLocaleString()} CUP`;
    }
    const pStr = String(p).trim();
    if (pStr) {
      if (pStr.toLowerCase().includes("cup") || pStr.includes("$")) {
        return pStr;
      }
      return `$${pStr} CUP`;
    }
  }

  return null;
}

/**
 * Consulta pública HTTP para obtener la carta de platos publicados.
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

/**
 * Consulta pública HTTP para obtener los días y horarios de apertura de Bar Terraza.
 */
export async function getPublicOpeningHoursFromConvex(): Promise<PublicOpeningHours | null> {
  try {
    const res = await convexHttpClient.query(api.shift.getPublicOpeningHours, {});
    return res as PublicOpeningHours | null;
  } catch (error) {
    console.error("Error al consultar horarios públicos en Convex:", error);
    return null;
  }
}
