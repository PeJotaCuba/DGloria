import React, { useState } from 'react';
import { X, Lock, User, KeyRound, Loader2, AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WebAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  dvc: string;
  onLogin: (username: string, password: string) => Promise<unknown>;
  isLoggingIn: boolean;
  authError: string | null;
  onClearError: () => void;
}

export const WebAuthModal: React.FC<WebAuthModalProps> = ({
  isOpen,
  onClose,
  dvc,
  onLogin,
  isLoggingIn,
  authError,
  onClearError,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    try {
      await onLogin(username, password);
      setUsername('');
      setPassword('');
    } catch {
      // Error is handled via authError prop
    }
  };

  const handleClose = () => {
    setUsername('');
    setPassword('');
    onClearError();
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md overflow-hidden glass-panel-dark rounded-2xl p-8 shadow-2xl border border-[#E9E2D6]/15"
        >
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-[#E9E2D6]/50 hover:text-[#FFFBF2] transition-colors"
            aria-label="Cerrar panel de autenticación"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col items-center text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-[#9B1B30]/20 border border-[#9B1B30]/40 flex items-center justify-center text-[#9B1B30]">
              <Lock size={26} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-serif font-bold text-[#FFFBF2]">
                Acceso de Gestión WEB
              </h2>
              <p className="text-[#E9E2D6]/70 text-xs leading-relaxed">
                Ingresa tus credenciales de Dueño o Administrador para gestionar las reservaciones de Doña Gloria.
              </p>
            </div>

            {/* Referencia opcional del DVC autorizado */}
            <div className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                <ShieldCheck size={14} />
                <span>Navegador Autorizado</span>
              </span>
              <span className="font-mono font-semibold text-[#FFFBF2]">{dvc}</span>
            </div>

            {authError && (
              <div className="w-full p-3.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 text-xs text-left flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="w-full space-y-4 text-left">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#E9E2D6]/80 mb-1.5">
                  Nombre de usuario
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#8A8380] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="Ej. admin o dueno"
                    value={username}
                    onChange={(e) => {
                      if (authError) onClearError();
                      setUsername(e.target.value);
                    }}
                    disabled={isLoggingIn}
                    className="w-full bg-[#121212]/90 border border-[#E9E2D6]/20 rounded-lg pl-10 pr-4 py-3 text-sm text-[#FFFBF2] placeholder-[#8A8380] focus:outline-none focus:border-[#9B1B30] disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#E9E2D6]/80 mb-1.5">
                  PIN o contraseña
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#8A8380] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => {
                      if (authError) onClearError();
                      setPassword(e.target.value);
                    }}
                    disabled={isLoggingIn}
                    className="w-full bg-[#121212]/90 border border-[#E9E2D6]/20 rounded-lg pl-10 pr-10 py-3 text-sm text-[#FFFBF2] placeholder-[#8A8380] focus:outline-none focus:border-[#9B1B30] disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8380] hover:text-[#FFFBF2]"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  type="submit"
                  disabled={isLoggingIn || !username.trim() || !password.trim()}
                  className="w-full py-3.5 rounded-lg bg-[#9B1B30] hover:bg-[#801426] disabled:opacity-50 disabled:cursor-not-allowed text-[#FFFBF2] text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <span>Entrar</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoggingIn}
                  className="w-full py-2.5 rounded-lg bg-transparent hover:bg-[#E9E2D6]/5 text-[#E9E2D6]/70 hover:text-[#FFFBF2] text-xs font-medium uppercase tracking-wider transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
