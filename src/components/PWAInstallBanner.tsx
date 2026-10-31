/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Download, X, HelpCircle } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { InstallModalIOS } from './InstallModalIOS';

export const PWAInstallBanner: React.FC = () => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isDismissed,
    showIOSGuide,
    setShowIOSGuide,
    promptInstall,
    dismissPrompt,
  } = usePWAInstall();

  // Ocultar completamente si ya está instalada o ejecutándose en modo standalone
  if (isInstalled) {
    return null;
  }

  // Ocultar si el usuario descartó el aviso recientemente
  if (isDismissed) {
    return (
      <InstallModalIOS
        isOpen={showIOSGuide}
        onClose={() => setShowIOSGuide(false)}
      />
    );
  }

  // Si no es instalable y tampoco es iOS, no mostrar el banner flotante espontáneo
  if (!isInstallable) {
    return (
      <InstallModalIOS
        isOpen={showIOSGuide}
        onClose={() => setShowIOSGuide(false)}
      />
    );
  }

  return (
    <>
      <aside
        aria-label="Instalación de la aplicación Doña Gloria"
        className="fixed bottom-5 right-4 left-4 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-[#FFFBF2] text-[#1E1E1E] rounded-2xl shadow-2xl border border-[#E9E2D6] p-4 sm:p-5 transition-all duration-300 animate-slide-up"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#1E1E1E] border border-[#9B1B30]/30 shadow-md p-1 shrink-0 flex items-center justify-center">
              <img
                src="/pwa-192x192.png"
                alt="Doña Gloria"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9B1B30] block">
                Aplicación Web Progresiva
              </span>
              <h4 className="font-serif text-base font-bold text-[#1E1E1E] leading-snug">
                Instalar Doña Gloria
              </h4>
            </div>
          </div>

          <button
            onClick={() => dismissPrompt(7)}
            className="p-1.5 text-[#8A8380] hover:text-[#1E1E1E] hover:bg-[#E9E2D6]/40 rounded-full transition-colors shrink-0"
            aria-label="Cerrar aviso de instalación"
            title="Ahora no"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-2.5 text-xs text-[#8A8380] leading-relaxed">
          Accede rápidamente al menú de tapas, cócteles y solicita reservaciones en modo pantalla completa desde tu pantalla de inicio.
        </p>

        <div className="mt-4 flex items-center gap-2.5">
          <button
            onClick={promptInstall}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FFFBF2] bg-[#9B1B30] hover:bg-[#801426] active:bg-[#68101F] rounded-lg transition-colors shadow-sm"
          >
            {isIOS ? (
              <>
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Cómo instalar</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Instalar App</span>
              </>
            )}
          </button>

          <button
            onClick={() => dismissPrompt(7)}
            className="px-3.5 py-2.5 text-xs font-medium text-[#8A8380] hover:text-[#1E1E1E] hover:bg-[#E9E2D6]/40 rounded-lg transition-colors"
          >
            Ahora no
          </button>
        </div>
      </aside>

      <InstallModalIOS
        isOpen={showIOSGuide}
        onClose={() => setShowIOSGuide(false)}
      />
    </>
  );
};
