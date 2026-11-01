/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';

const DISMISS_STORAGE_KEY = 'dona_gloria_pwa_dismiss_timestamp';
const DEFAULT_DISMISS_DAYS = 7;

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * Detecta si la aplicación se está ejecutando en modo independiente (standalone)
 * según los estándares W3C, iOS Safari y Android TWA/referrer.
 */
export function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isNavigatorStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isDisplayStandalone || isNavigatorStandalone;
}

/**
 * Detecta si el dispositivo es iOS (iPhone, iPad, iPod o iPadOS en modo escritorio).
 */
export function checkIsIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isIosDevice = /iphone|ipad|ipod/.test(ua);
  const isIPadOSDesktop = navigator.maxTouchPoints > 1 && /macintosh/.test(ua);
  return isIosDevice || isIPadOSDesktop;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.__pwaInstallPrompt) {
      return window.__pwaInstallPrompt;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsStandalone());
  const [isIOS, setIsIOS] = useState<boolean>(() => checkIsIOS());
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (!stored) return false;
      const timestamp = parseInt(stored, 10);
      return !isNaN(timestamp) && Date.now() < timestamp;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Escuchar cambios de visualización a standalone
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    } else {
      mediaQuery.addListener(handleDisplayModeChange);
    }

    // Interceptar beforeinstallprompt en Chromium / Android / Edge / Desktop
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__pwaInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    // Escuchar cuando la app ha sido instalada exitosamente por el sistema
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__pwaInstallPrompt = undefined;
      try {
        localStorage.removeItem(DISMISS_STORAGE_KEY);
      } catch {
        // Ignorar errores de almacenamiento
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      } else {
        mediaQuery.removeListener(handleDisplayModeChange);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  /**
   * Invoca la instalación:
   * - En navegadores compatibles, ejecuta prompt() nativo.
   * - En iOS, abre el modal con instrucciones guiadas.
   */
  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'ios_guide' | 'unavailable'> => {
    let promptEvent = deferredPrompt || (typeof window !== 'undefined' ? window.__pwaInstallPrompt : null);

    // Si aún no está listo el evento nativo en Android/Chrome, esperar hasta 1500ms
    if (!promptEvent && !isIOS && typeof window !== 'undefined') {
      promptEvent = await new Promise<BeforeInstallPromptEvent | null>((resolve) => {
        let resolved = false;
        const handler = (e: Event) => {
          if (!resolved) {
            resolved = true;
            window.removeEventListener('beforeinstallprompt', handler);
            resolve(e as BeforeInstallPromptEvent);
          }
        };
        window.addEventListener('beforeinstallprompt', handler);
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            window.removeEventListener('beforeinstallprompt', handler);
            resolve(window.__pwaInstallPrompt || null);
          }
        }, 1500);
      });
    }

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          window.__pwaInstallPrompt = undefined;
          return 'accepted';
        }
        return 'dismissed';
      } catch (err) {
        console.error('Error al solicitar instalación PWA:', err);
        return 'unavailable';
      }
    }

    if (isIOS) {
      setShowIOSGuide(true);
      return 'ios_guide';
    }

    return 'unavailable';
  }, [deferredPrompt, isIOS]);

  /**
   * Recuerda la preferencia del usuario para no insistir continuamente con el aviso
   */
  const dismissPrompt = useCallback((days: number = DEFAULT_DISMISS_DAYS) => {
    setIsDismissed(true);
    try {
      const until = Date.now() + days * 24 * 60 * 60 * 1000;
      localStorage.setItem(DISMISS_STORAGE_KEY, until.toString());
    } catch {
      // Ignorar errores de almacenamiento local
    }
  }, []);

  const hasPrompt = !!deferredPrompt || (typeof window !== 'undefined' && !!window.__pwaInstallPrompt);
  const isInstallable = !isInstalled && (hasPrompt || isIOS);

  return {
    isInstallable,
    hasNativePrompt: hasPrompt,
    isInstalled,
    isIOS,
    isDismissed,
    showIOSGuide,
    setShowIOSGuide,
    promptInstall,
    dismissPrompt,
  };
}
