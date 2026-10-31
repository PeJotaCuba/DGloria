/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Share, PlusSquare, Sparkles } from 'lucide-react';

interface InstallModalIOSProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallModalIOS: React.FC<InstallModalIOSProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
    >
      <div className="relative w-full max-w-md bg-[#FFFBF2] text-[#1E1E1E] rounded-2xl shadow-2xl border border-[#E9E2D6] overflow-hidden p-6 sm:p-7">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#8A8380] hover:text-[#1E1E1E] hover:bg-[#E9E2D6]/40 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9B1B30]"
          aria-label="Cerrar instrucciones"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Icon Header */}
        <div className="flex items-center gap-4 mb-5 pr-8">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#1E1E1E] border border-[#9B1B30]/30 shadow-md p-1.5 shrink-0 flex items-center justify-center">
            <img
              src="/pwa-192x192.png"
              alt="Icono Doña Gloria"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#9B1B30] mb-0.5">
              <Sparkles className="w-3 h-3" />
              Aplicación Doña Gloria
            </span>
            <h3 id="ios-install-title" className="font-serif text-lg sm:text-xl font-bold tracking-tight text-[#1E1E1E]">
              Instalar en iPhone o iPad
            </h3>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#8A8380] mb-6 leading-relaxed">
          En dispositivos Apple iOS, la instalación se realiza mediante Safari en pocos segundos para acceder a pantalla completa sin barra de navegación:
        </p>

        {/* Steps List */}
        <div className="space-y-4 mb-6">
          {/* Step 1 */}
          <div className="flex items-start gap-3.5 p-3 rounded-xl bg-[#E9E2D6]/30 border border-[#E9E2D6]/60">
            <div className="w-8 h-8 rounded-lg bg-[#9B1B30] text-[#FFFBF2] flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Share className="w-4 h-4" />
            </div>
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-[#1E1E1E]">
                1. Pulsa el botón Compartir
              </p>
              <p className="text-[#8A8380] text-xs mt-0.5">
                Ubicado en la barra de herramientas inferior de Safari (icono con cuadrado y flecha hacia arriba).
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3.5 p-3 rounded-xl bg-[#E9E2D6]/30 border border-[#E9E2D6]/60">
            <div className="w-8 h-8 rounded-lg bg-[#1E1E1E] text-[#FFFBF2] flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <PlusSquare className="w-4 h-4" />
            </div>
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-[#1E1E1E]">
                2. Selecciona «Añadir a pantalla de inicio»
              </p>
              <p className="text-[#8A8380] text-xs mt-0.5">
                Desplaza la lista de opciones hacia abajo hasta encontrar el icono de suma.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3.5 p-3 rounded-xl bg-[#E9E2D6]/30 border border-[#E9E2D6]/60">
            <div className="w-8 h-8 rounded-lg bg-[#E9E2D6] text-[#9B1B30] font-bold text-sm flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              3
            </div>
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-[#1E1E1E]">
                3. Toca «Añadir» arriba a la derecha
              </p>
              <p className="text-[#8A8380] text-xs mt-0.5">
                El icono oficial de Doña Gloria quedará listo en tu pantalla de inicio para abrir como app independiente.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#FFFBF2] bg-[#9B1B30] hover:bg-[#801426] active:bg-[#68101F] transition-colors shadow-sm text-center"
        >
          Entendido
        </button>
      </div>
    </div>
  );
};
