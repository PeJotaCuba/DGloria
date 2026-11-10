"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import * as webpush from "web-push";

function getVapidConfig() {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    process.env.VITE_VAPID_PUBLIC_KEY?.trim() ||
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ||
    "";
  const privateKey =
    process.env.VAPID_PRIVATE_KEY?.trim() ||
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ||
    "";
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:admin@donagloria.cu";

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

export const notifyActiveBrowsersNewReservation = internalAction({
  args: {
    reservationId: v.string(),
    date: v.string(),
    time: v.string(),
    partySize: v.number(),
  },
  handler: async (ctx, args) => {
    const vapid = getVapidConfig();
    if (!vapid) {
      console.warn(
        "[WebPush] Claves VAPID no configuradas en Convex (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY). Notificación omitida."
      );
      return { sent: 0, skipped: true, reason: "MISSING_VAPID_KEYS" };
    }

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    const targets = await ctx.runQuery(
      internal.browserDevices.listActiveAdminPushSubscriptions,
      {}
    );

    if (!targets.length) {
      return { sent: 0, skipped: false, reason: "NO_ACTIVE_SUBSCRIPTIONS" };
    }

    const payload = JSON.stringify({
      title: "Nueva solicitud de reservación",
      body: `Ha llegado una nueva solicitud para el ${args.date} a las ${args.time} (${args.partySize} personas).`,
      url: "/?openGestion=1#reservas",
      openGestion: true,
      tag: `dg-new-res-${args.reservationId}`,
    });

    let sent = 0;
    let expiredRemoved = 0;

    await Promise.all(
      targets.map(async (target) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: target.subscription.endpoint,
              expirationTime: target.subscription.expirationTime ?? null,
              keys: target.subscription.keys,
            },
            payload
          );
          sent += 1;
        } catch (err: any) {
          const statusCode = err?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            expiredRemoved += 1;
            await ctx.runMutation(
              internal.browserDevices.clearExpiredPushSubscription,
              {
                deviceId: target.deviceId,
                endpoint: target.subscription.endpoint,
              }
            );
          } else {
            console.error(
              `[WebPush] Error enviando a dispositivo ${target.dvcCode}:`,
              err?.message || err
            );
          }
        }
      })
    );

    return { sent, expiredRemoved, skipped: false };
  },
});

export const notifyClientReservationStatusChanged = internalAction({
  args: {
    dvcCode: v.string(),
    reservationId: v.string(),
    newStatus: v.union(v.literal("Negociación"), v.literal("Confirmado")),
    tableNumber: v.optional(v.number()),
    alternativeDate: v.optional(v.string()),
    alternativeTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const vapid = getVapidConfig();
    if (!vapid) {
      console.warn(
        "[WebPush] Claves VAPID no configuradas en Convex (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY). Notificación al cliente omitida."
      );
      return { sent: 0, skipped: true, reason: "MISSING_VAPID_KEYS" };
    }

    const target = await ctx.runQuery(
      internal.browserDevices.getClientPushSubscriptionByDvc,
      { dvcCode: args.dvcCode }
    );

    if (!target) {
      return { sent: 0, skipped: true, reason: "NO_CLIENT_SUBSCRIPTION" };
    }

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    let title = "Actualización de tu reservación";
    let body = "El estado de tu reservación en Doña Gloria ha cambiado.";

    if (args.newStatus === "Confirmado") {
      title = "Reservación confirmada";
      body = args.tableNumber
        ? `Tu reservación en Doña Gloria ha sido confirmada (Mesa #${args.tableNumber}).`
        : "Tu reservación en Doña Gloria ha sido confirmada.";
    } else if (args.newStatus === "Negociación") {
      title = "Propuesta alternativa disponible";
      body =
        args.alternativeDate || args.alternativeTime
          ? `Doña Gloria propone una alternativa para tu reservación: ${[
              args.alternativeDate,
              args.alternativeTime,
            ]
              .filter(Boolean)
              .join(" a las ")}.`
          : "Doña Gloria ha enviado una propuesta alternativa para tu reservación.";
    }

    const payload = JSON.stringify({
      title,
      body,
      url: "/#reservas",
      openGestion: false,
      tag: `dg-res-status-${args.reservationId}`,
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: target.subscription.endpoint,
          expirationTime: target.subscription.expirationTime ?? null,
          keys: target.subscription.keys,
        },
        payload
      );
      return { sent: 1, skipped: false };
    } catch (err: any) {
      const statusCode = err?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await ctx.runMutation(
          internal.browserDevices.clearExpiredPushSubscription,
          {
            deviceId: target.deviceId,
            endpoint: target.subscription.endpoint,
          }
        );
        return { sent: 0, expiredRemoved: 1, skipped: false };
      }
      console.error(
        `[WebPush] Error notificando al cliente ${args.dvcCode}:`,
        err?.message || err
      );
      return { sent: 0, error: err?.message || "UNKNOWN_ERROR" };
    }
  },
});
