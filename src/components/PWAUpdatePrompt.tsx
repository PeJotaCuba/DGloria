import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Sparkles, CheckCircle2 } from 'lucide-react';

export const PWAUpdatePrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Periodic check for SW update (e.g., every 60 minutes)
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('PWA service worker registration failed:', error);
    },
  });

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  const handleDismissOfflineReady = () => {
    setOfflineReady(false);
  };

  // If there's an update waiting
  if (needRefresh) {
    return (
      <aside
        aria-live="polite"
        className="fixed top-5 right-5 z-50 max-w-sm w-[calc(100%-2.5rem)] sm:w-auto p-4 rounded-xl bg-[#1E1E1E]/95 border border-[#9B1B30] text-[#FFFBF2] shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-300"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[#9B1B30]/20 text-[#FFFBF2] shrink-0 mt-0.5">
            <RefreshCw className="w-5 h-5 text-[#E3B87C] animate-spin-slow" />
          </div>

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-serif text-sm font-bold text-[#FFFBF2] flex items-center gap-1.5">
                <span>Nueva Versión Disponible</span>
                <Sparkles className="w-3.5 h-3.5 text-[#E3B87C]" />
              </h4>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-[#8A8380] hover:text-[#FFFBF2] p-1 rounded-md transition-colors"
                aria-label="Cerrar notificación de actualización"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#E9E2D6]/80 font-light leading-relaxed">
              Hay una actualización disponible de Doña Gloria con mejoras en el menú y servicios.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleUpdate}
                className="px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#FFFBF2] bg-[#9B1B30] hover:bg-[#801426] rounded-lg transition-all shadow-md active:scale-95"
              >
                Actualizar ahora
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-[#E9E2D6]/70 hover:text-[#FFFBF2] transition-colors"
              >
                Más tarde
              </button>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // If offline caching is ready for the first time
  if (offlineReady) {
    return (
      <aside
        aria-live="polite"
        className="fixed top-5 right-5 z-50 max-w-sm flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#1E1E1E]/95 border border-emerald-500/40 text-[#FFFBF2] shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-300"
      >
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs text-[#E9E2D6] font-light">
            Doña Gloria lista para navegación sin conexión.
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismissOfflineReady}
          className="text-[#8A8380] hover:text-[#FFFBF2] p-1 rounded-md transition-colors"
          aria-label="Cerrar mensaje"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </aside>
    );
  }

  return null;
};
