import React, { useEffect, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) {
    return null;
  }

  if (showReconnected) {
    return (
      <aside
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl bg-[#1E1E1E]/95 border border-emerald-500/40 px-4 py-2.5 text-xs text-[#FFFBF2] shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <Wifi className="w-4 h-4 text-emerald-400" />
        <span className="font-medium">Conexión restablecida.</span>
      </aside>
    );
  }

  return (
    <aside
      aria-live="assertive"
      className="fixed bottom-5 right-5 z-50 max-w-sm flex items-start gap-3 rounded-xl bg-[#1E1E1E]/95 border border-[#9B1B30]/60 p-3.5 text-xs text-[#FFFBF2] shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="p-1 rounded-lg bg-[#9B1B30]/20 text-[#FFFBF2] shrink-0 mt-0.5">
        <WifiOff className="w-4 h-4 text-[#FFFBF2]" />
      </div>
      <div className="flex-1 space-y-0.5">
        <p className="font-semibold text-[#FFFBF2]">Modo sin conexión</p>
        <p className="text-[#E9E2D6]/80 text-[11px] leading-relaxed">
          Mostrando contenido disponible en el dispositivo. La consulta y registro de reservaciones requieren conexión activa a internet.
        </p>
      </div>
    </aside>
  );
};
