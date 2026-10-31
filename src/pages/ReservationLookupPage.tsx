/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RotateCcw,
  Search,
  Copy,
  Check,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  FileCheck2,
  Sparkles,
  ArrowLeft,
  WifiOff,
} from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ASSETS, BUSINESS_INFO } from '../lib/assets';
import { getReservationStatusMeta } from '../utils/reservations';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const ReservationLookupPage: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [lookupInput, setLookupInput] = useState('');
  const [activeQueryCode, setActiveQueryCode] = useState<string | null>(null);

  // Check for code in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      const cleaned = code.trim().toUpperCase();
      setLookupInput(cleaned);
      setActiveQueryCode(cleaned);
    }
  }, []);

  const lookupResult = useQuery(
    api.reservations.getPublicReservationStatus,
    activeQueryCode ? { trackingCode: activeQueryCode } : 'skip'
  );

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = lookupInput.trim().toUpperCase();
    if (!cleaned) return;
    setActiveQueryCode(cleaned);
    // Update URL without reloading
    const newUrl = `${window.location.pathname}?code=${cleaned}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleGoHome = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new Event('popstate'));
  };

  const handleCopyTrackingCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="min-h-screen bg-[#FFFBF2] text-[#1E1E1E] font-sans flex flex-col selection:bg-[#9B1B30] selection:text-[#FFFBF2]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#1E1E1E]/95 backdrop-blur-md border-b border-[#333333] transition-shadow shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2">
          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] sm:text-xs uppercase tracking-wider font-medium text-[#FFFBF2] hover:text-[#E3B87C] bg-[#2A2A2A] hover:bg-[#333333] border border-[#444] rounded transition-all duration-200 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Inicio</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3 text-center min-w-0">
            <div className="h-8 sm:h-12 w-8 sm:w-12 rounded-full bg-[#1E1E1E] border border-[#E3B87C]/40 flex items-center justify-center p-0.5 sm:p-1 shadow-md shrink-0">
              <img
                src={ASSETS.logoTransparent}
                alt="Logo Doña Gloria"
                className="w-full h-full object-contain scale-110"
              />
            </div>
            <div className="text-left truncate">
              <span className="block font-serif text-sm sm:text-lg font-bold text-[#FFFBF2] leading-none tracking-tight truncate">
                Doña Gloria
              </span>
              <span className="block text-[8px] sm:text-[10px] uppercase tracking-[0.15em] text-[#E3B87C] font-semibold">
                Bar — Terraza
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center py-16 px-6 sm:px-8 bg-[#1E1E1E] text-[#FFFBF2] relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#9B1B30]/10 via-transparent to-[#1E1E1E] pointer-events-none" />

        <div className="relative max-w-2xl w-full space-y-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#9B1B30]/30 border border-[#9B1B30]/50 text-[#FFFBF2] text-xs font-semibold tracking-wider uppercase">
              <ShieldCheck className="w-3.5 h-3.5 text-[#E3B87C]" />
              <span>Consulta de Reservaciones</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-[#FFFBF2]">
              Verifica tu Estado
            </h1>
            <p className="text-sm sm:text-base text-[#E9E2D6]/80 max-w-lg mx-auto font-light leading-relaxed">
              Ingresa tu código privado de seguimiento DG-XXXXXX para conocer la disponibilidad de tu mesa en tiempo real.
            </p>
          </div>

          <div className="glass-panel-dark p-8 rounded-2xl border border-[#E9E2D6]/15 shadow-2xl">
            <form onSubmit={handleLookupSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-[#E9E2D6] ml-1">
                  Código de Seguimiento
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Ej. DG-7K2M9P"
                    value={lookupInput}
                    onChange={(e) => setLookupInput(e.target.value.toUpperCase())}
                    className="flex-1 bg-[#121212]/90 border border-[#E9E2D6]/20 rounded-xl px-5 py-4 text-base text-[#FFFBF2] placeholder-[#8A8380] uppercase font-mono tracking-[0.2em] focus:outline-none focus:border-[#9B1B30] focus:ring-1 focus:ring-[#9B1B30] transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!isOnline}
                    className="px-8 py-4 text-xs font-semibold uppercase tracking-wider text-[#FFFBF2] bg-[#9B1B30] hover:bg-[#801426] disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all rounded-xl shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {isOnline ? (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Consultar Estado</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-4 h-4" />
                        <span>Sin Conexión</span>
                      </>
                    )}
                  </button>
                </div>
                {!isOnline && (
                  <p className="text-xs text-[#E3B87C] pt-2 flex items-center gap-2 font-light">
                    <WifiOff className="w-3.5 h-3.5 shrink-0" />
                    <span>Se requiere conexión a internet para consultar el estado en tiempo real.</span>
                  </p>
                )}
              </div>
            </form>

            {/* Result Area */}
            {activeQueryCode && (
              <div className="mt-8 pt-8 border-t border-[#E9E2D6]/10">
                {!isOnline && lookupResult === undefined ? (
                  <div className="py-10 text-center space-y-3">
                    <WifiOff className="w-8 h-8 text-[#E3B87C] mx-auto opacity-80" />
                    <span className="text-sm text-[#E9E2D6] font-medium block">
                      Esperando conexión a internet...
                    </span>
                    <span className="text-xs text-[#8A8380] block font-light">
                      La consulta se actualizará automáticamente tan pronto se restablezca la conexión.
                    </span>
                  </div>
                ) : lookupResult === undefined ? (
                  <div className="py-12 text-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-[#E3B87C] mx-auto" />
                    <span className="text-sm text-[#E9E2D6]/70 block font-light">
                      Conectando con el servidor de Convex...
                    </span>
                  </div>
                ) : !lookupResult?.found ? (
                  <div className="p-6 bg-amber-900/20 border border-amber-500/30 rounded-xl text-sm space-y-3">
                    <div className="flex items-center gap-3 text-amber-300 font-bold uppercase tracking-wider">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>No se encontró el registro</span>
                    </div>
                    <p className="text-[#E9E2D6]/90 font-light leading-relaxed">
                      {lookupResult?.message}
                    </p>
                    <p className="text-[11px] text-[#8A8380] pt-2 leading-normal border-t border-amber-500/20">
                      * Si realizaste tu reservación recientemente, espera unos minutos a que el sistema la procese. Si fue hace tiempo, consulta directamente por WhatsApp.
                    </p>
                  </div>
                ) : (
                  (() => {
                    const statusMeta = getReservationStatusMeta(lookupResult.status);
                    const StatusIcon = statusMeta.icon;

                    return (
                      <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Main Status Display */}
                        <div className="text-center space-y-4">
                          <div
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold tracking-widest uppercase ${statusMeta.badgeClass}`}
                          >
                            <StatusIcon className="w-5 h-5 shrink-0" />
                            <span>{statusMeta.label}</span>
                          </div>
                          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#FFFBF2]">
                            {statusMeta.title}
                          </h2>
                          <p className="text-sm text-[#E9E2D6]/80 font-light leading-relaxed">
                            {statusMeta.desc}
                          </p>
                        </div>

                        {/* Extra state details */}
                        <div className="space-y-3">
                          {(lookupResult.proposedDate || lookupResult.proposedTime) && (
                            <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-sm text-indigo-200 space-y-2">
                              <span className="font-bold block uppercase tracking-widest text-[10px] text-indigo-300">
                                Propuesta de Cambio:
                              </span>
                              <div className="flex items-center gap-4">
                                {lookupResult.proposedDate && (
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 opacity-70" />
                                    <span>{lookupResult.proposedDate}</span>
                                  </div>
                                )}
                                {lookupResult.proposedTime && (
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 opacity-70" />
                                    <span>{lookupResult.proposedTime}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {lookupResult.assignedTable && (
                            <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-sm text-emerald-200 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/20 rounded-lg">
                                  <Sparkles className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                  <span className="block text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
                                    Lugar Confirmado
                                  </span>
                                  <span className="text-base font-semibold">{lookupResult.assignedTable}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {lookupResult.statusReason && (
                            <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-sm text-red-200 space-y-1">
                              <span className="font-bold block uppercase tracking-widest text-[10px] text-red-400">
                                Nota del Establecimiento:
                              </span>
                              <p className="font-light">{lookupResult.statusReason}</p>
                            </div>
                          )}
                        </div>

                        {/* Summary Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-[#121212]/50 border border-[#E9E2D6]/10 rounded-xl">
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase tracking-widest text-[#8A8380] block font-bold">
                              Titular
                            </span>
                            <span className="text-xs font-medium text-[#FFFBF2] block truncate">
                              {lookupResult.fullName}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase tracking-widest text-[#8A8380] block font-bold">
                              Fecha
                            </span>
                            <span className="text-xs font-medium text-[#FFFBF2] block">
                              {lookupResult.date}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase tracking-widest text-[#8A8380] block font-bold">
                              Horario
                            </span>
                            <span className="text-xs font-medium text-[#FFFBF2] block">
                              {lookupResult.time}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase tracking-widest text-[#8A8380] block font-bold">
                              Personas
                            </span>
                            <span className="text-xs font-medium text-[#FFFBF2] block">
                              {lookupResult.partySize}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1E1E1E] text-[#FFFBF2] border-t border-[#333333] py-10 px-6 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[#8A8380]">
          <div className="flex items-center gap-3">
            <img
              src={ASSETS.logoTransparent}
              alt="Doña Gloria"
              className="h-8 w-auto object-contain opacity-90"
            />
            <div>
              <span className="block font-serif text-sm font-bold text-[#FFFBF2]">
                Doña Gloria Bar-Terraza
              </span>
              <span>{BUSINESS_INFO.city}, {BUSINESS_INFO.country}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[#8A8380]">
              Bar-Terraza & Experiencia Culinaria
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
