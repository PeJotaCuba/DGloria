import { useEffect, useState, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const STORAGE_KEY = 'dg_browser_dvc_id';

/**
 * Genera un código alfanumérico aleatorio de 6 caracteres (A-Z, 0-9).
 */
function generateRandomCode(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array)
    .map((x) => chars[x % chars.length])
    .join('');
}

export function useDeviceIdentity() {
  const [dvc, setDvc] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const register = useMutation(api.browserDevices.registerBrowserDevice);
  
  // Consulta de estado en tiempo real con manejo de errores implícito
  const statusData = useQuery(
    api.browserDevices.getBrowserDeviceStatus,
    dvc ? { dvcCode: dvc } : "skip"
  );

  const initializeDevice = useCallback(async () => {
    let currentDvc = localStorage.getItem(STORAGE_KEY);

    if (!currentDvc) {
      const randomPart = generateRandomCode(6);
      currentDvc = `DVC-${randomPart}`;
      localStorage.setItem(STORAGE_KEY, currentDvc);
      setDvc(currentDvc);
    }

    try {
      if (register) {
        await register({
          dvcCode: currentDvc,
          userAgent: navigator.userAgent,
        });
      }
    } catch (error) {
      console.error('[DVC] Error registrando dispositivo en Convex:', error);
      // No bloqueamos la ejecución, permitimos que la página siga funcionando
    }
  }, [register]);

  useEffect(() => {
    initializeDevice();
  }, [initializeDevice]);

  return {
    dvc,
    status: statusData?.status || 'UNKNOWN',
    isRegistered: !!statusData,
    refreshRegistration: initializeDevice,
    error: statusData === undefined ? 'LOADING' : (statusData === null ? 'NOT_FOUND' : null)
  };
}
