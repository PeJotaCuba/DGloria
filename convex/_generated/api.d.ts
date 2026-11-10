/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as browserDevices from "../browserDevices.js";
import type * as crons from "../crons.js";
import type * as devices from "../devices.js";
import type * as exchange from "../exchange.js";
import type * as files from "../files.js";
import type * as inventory from "../inventory.js";
import type * as menuDishes from "../menuDishes.js";
import type * as notifications from "../notifications.js";
import type * as reservations from "../reservations.js";
import type * as restaurant from "../restaurant.js";
import type * as shift from "../shift.js";
import type * as shop from "../shop.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  audit: typeof audit;
  auth: typeof auth;
  browserDevices: typeof browserDevices;
  crons: typeof crons;
  devices: typeof devices;
  exchange: typeof exchange;
  files: typeof files;
  inventory: typeof inventory;
  menuDishes: typeof menuDishes;
  notifications: typeof notifications;
  reservations: typeof reservations;
  restaurant: typeof restaurant;
  shift: typeof shift;
  shop: typeof shop;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
