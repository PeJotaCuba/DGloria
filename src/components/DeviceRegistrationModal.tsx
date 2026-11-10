import React, { useState } from 'react';
import { X, Copy, Check, ShieldAlert, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DeviceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  dvc: string;
  status: string;
  error?: string | null;
}

export const DeviceRegistrationModal: React.FC<DeviceRegistrationModalProps> = ({
  isOpen,
  onClose,
  dvc,
  status,
  error,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const codeToCopy = dvc.startsWith('DVC-') ? dvc.replace('DVC-', '') : dvc;
    navigator.clipboard.writeText(codeToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const isInactive = status === 'INACTIVE';
  const isPending = status === 'PENDING' || status === 'UNKNOWN';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md overflow-hidden glass-panel-dark rounded-2xl p-8"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-[#E9E2D6]/50 hover:text-[#FFFBF2] transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-[#9B1B30]/20 flex items-center justify-center text-[#9B1B30]">
              {isInactive ? <ShieldAlert size={32} /> : <Monitor size={32} />}
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-bold text-[#FFFBF2]">
                Identidad del Navegador
              </h2>
              <p className="text-[#E9E2D6]/70 text-sm">
                Este identificador único permite al administrador autorizar este navegador para la gestión de reservaciones.
              </p>
            </div>

            <div className="w-full bg-black/40 rounded-xl p-4 border border-[#E9E2D6]/10 flex items-center justify-between group">
              <span className="font-mono text-xl tracking-wider text-[#FFFBF2] font-bold">
                {dvc}
              </span>
              <button
                onClick={handleCopy}
                className="p-2 bg-[#9B1B30]/80 hover:bg-[#9B1B30] text-white rounded-lg transition-all flex items-center gap-2 text-sm"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <div className="w-full space-y-4">
              <div className="flex items-center justify-between text-sm py-2 border-b border-[#E9E2D6]/10">
                <span className="text-[#E9E2D6]/50">Estado actual:</span>
                <span className={`font-bold px-3 py-1 rounded-full text-xs ${
                  isInactive ? 'bg-red-500/20 text-red-400' : 
                  isPending ? 'bg-yellow-500/20 text-yellow-400' : 
                  'bg-green-500/20 text-green-400'
                }`}>
                  {status === 'UNKNOWN' ? 'REGISTRANDO...' : status}
                </span>
              </div>

              {error === 'LOADING' && (
                <div className="text-xs text-[#E9E2D6]/40 italic animate-pulse">
                  Verificando estado en Convex...
                </div>
              )}

              {error === 'NOT_FOUND' && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-orange-300 text-xs text-left">
                  Este dispositivo aún no ha terminado de registrarse en la nube. Reintente en unos segundos.
                </div>
              )}

              {isInactive ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-300 text-sm">
                  Este dispositivo ha sido desactivado por el administrador. Contacte con soporte para reactivarlo.
                </div>
              ) : isPending ? (
                <div className="bg-[#9B1B30]/10 border border-[#9B1B30]/20 rounded-lg p-4 text-[#E9E2D6]/80 text-sm">
                  Facilite este código al administrador de Doña Gloria para autorizar el acceso desde este navegador.
                </div>
              ) : null}
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 text-[#E9E2D6] font-medium hover:text-[#FFFBF2] transition-colors"
            >
              Cerrar panel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
