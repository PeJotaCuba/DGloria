/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Convex Client Integration Scaffold
 *
 * This module is prepared to integrate seamlessly with the existing Convex deployment
 * when the dynamic menu and reservations phase is activated.
 *
 * No new deployments or exposed keys are introduced at this stage.
 */

export interface MenuItemData {
  _id?: string;
  name: string;
  description: string;
  category: string;
  price?: number;
  imageUrl?: string;
  available?: boolean;
}

export interface ReservationRequest {
  fullName: string;
  emailOrPhone: string;
  date: string;
  time: string;
  partySize: number;
  seatingArea: 'terraza' | 'salon' | 'indiferente';
  specialNotes?: string;
}

// Environment accessor prepared for Convex URL injection
export const CONVEX_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CONVEX_URL) || '';

export const isConvexConfigured = Boolean(CONVEX_URL);
