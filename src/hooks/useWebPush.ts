import { useState, useEffect, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { convexHttpClient } from '../lib/convexClient';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function serializeSubscription(sub: PushSubscription) {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!sub.endpoint || !p256dh || !auth) {
    return null;
  }
  return {
    endpoint: sub.endpoint,
    expirationTime: sub.expirationTime ?? null,
    keys: {
      p256dh,
      auth,
    },
  };
}

export function useWebPush(dvcCode: string | null) {
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const [permission, setPermission] = useState<NotificationPermission>(() =>
    isSupported ? Notification.permission : 'default'
  );
  const [pushConfig, setPushConfig] = useState<{
    configured: boolean;
    vapidPublicKey: string | null;
  } | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upsertPushSub = useMutation(api.browserDevices.upsertBrowserPushSubscription);
  const removePushSub = useMutation(api.browserDevices.removeBrowserPushSubscription);

  const loadConfigStatus = useCallback(async () => {
    setConfigError(null);
    try {
      const res = await convexHttpClient.query(
        api.browserDevices.getWebPushConfigStatus,
        {}
      );
      setPushConfig(res);
      setConfigLoaded(true);
    } catch (err: any) {
      console.warn('[WebPush] No se pudo consultar getWebPushConfigStatus:', err);
      setPushConfig({ configured: false, vapidPublicKey: null });
      setConfigLoaded(true);
      setConfigError(
        'Las notificaciones Push no están disponibles temporalmente en el servidor.'
      );
    }
  }, []);

  useEffect(() => {
    loadConfigStatus();
  }, [loadConfigStatus]);

  const vapidPublicKey =
    pushConfig?.vapidPublicKey ||
    (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ||
    null;

  const isConfigured = Boolean(pushConfig?.configured && vapidPublicKey);

  // Sincronización silenciosa de suscripción existente (sin solicitar permiso automáticamente)
  useEffect(() => {
    if (!isSupported || !dvcCode || !configLoaded) return;

    const currentPerm = Notification.permission;
    setPermission(currentPerm);

    let cancelled = false;
    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        if (cancelled) return;

        if (currentPerm === 'denied') {
          setIsSubscribed(false);
          if (existingSub) {
            await existingSub.unsubscribe().catch(() => {});
          }
          await upsertPushSub({
            dvcCode,
            userAgent: navigator.userAgent,
            permission: 'denied',
          }).catch(() => {});
          return;
        }

        if (currentPerm === 'granted' && existingSub) {
          const serialized = serializeSubscription(existingSub);
          if (serialized) {
            setIsSubscribed(true);
            await upsertPushSub({
              dvcCode,
              userAgent: navigator.userAgent,
              permission: 'granted',
              subscription: serialized,
            }).catch(() => {});
            return;
          }
        }

        setIsSubscribed(Boolean(existingSub));
      } catch {
        // Ignorar si el Service Worker aún no está listo o si la función aún no está desplegada
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSupported, dvcCode, configLoaded, upsertPushSub]);

  const enableNotifications = useCallback(async () => {
    if (!isSupported || !dvcCode) return false;
    setError(null);

    if (!vapidPublicKey) {
      setError('Falta configurar la clave pública VAPID en Convex.');
      return false;
    }

    setIsSubscribing(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        setIsSubscribed(false);
        await upsertPushSub({
          dvcCode,
          userAgent: navigator.userAgent,
          permission: result,
        }).catch(() => {});
        if (result === 'denied') {
          setError('Permiso de notificaciones denegado en el navegador.');
        }
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const appServerKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey.buffer as ArrayBuffer,
        });
      }

      const serialized = serializeSubscription(subscription);
      if (!serialized) {
        throw new Error('No se pudieron obtener las claves de suscripción Push.');
      }

      const res = await upsertPushSub({
        dvcCode,
        userAgent: navigator.userAgent,
        permission: 'granted',
        subscription: serialized,
      });

      if (res && res.success === false) {
        throw new Error(
          res.message || 'No se pudo asociar la suscripción al dispositivo DVC.'
        );
      }

      setIsSubscribed(true);
      return true;
    } catch (err: any) {
      console.error('Error al activar notificaciones Web Push:', err);
      setError(
        err?.message?.replace(/^Uncaught Error:\s*/i, '').trim() ||
          'No se pudieron activar las notificaciones. Puedes reintentar.'
      );
      return false;
    } finally {
      setIsSubscribing(false);
    }
  }, [isSupported, dvcCode, vapidPublicKey, upsertPushSub]);

  const disableNotifications = useCallback(async () => {
    if (!isSupported || !dvcCode) return;
    setIsSubscribing(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      const endpoint = existingSub?.endpoint;
      if (existingSub) {
        await existingSub.unsubscribe();
      }
      await removePushSub({ dvcCode, endpoint }).catch(() => {});
      setIsSubscribed(false);
    } catch (err: any) {
      setError(err?.message || 'Error al desactivar las notificaciones.');
    } finally {
      setIsSubscribing(false);
    }
  }, [isSupported, dvcCode, removePushSub]);

  return {
    isSupported,
    isConfigured,
    configLoaded,
    configError,
    retryConfig: loadConfigStatus,
    permission,
    isSubscribed,
    isSubscribing,
    error,
    enableNotifications,
    disableNotifications,
  };
}
