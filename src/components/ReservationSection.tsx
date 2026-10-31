/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Calendar,
  Users,
  Clock,
  MapPin,
  CheckCircle2,
  Send,
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
  ArrowRight,
  WifiOff,
} from 'lucide-react';
import { ReservationRequest } from '../lib/convex';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getReservationStatusMeta } from '../utils/reservations';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const ReservationSection: React.FC = () => {
  const isOnline = useOnlineStatus();
  const createReservation = useMutation(api.reservations.createPublicReservation);

  const [activeTab, setActiveTab] = useState<'create' | 'lookup'>('create');

  // Form State
  const [formData, setFormData] = useState<ReservationRequest>({
    fullName: '',
    emailOrPhone: '',
    date: '',
    time: '8:00 PM',
    partySize: 2,
    seatingArea: 'terraza',
    specialNotes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<{
    id?: string;
    fullName: string;
    emailOrPhone: string;
    date: string;
    time: string;
    partySize: number;
    seatingArea: string;
    trackingCode?: string;
  } | null>(null);

  const [codeCopied, setCodeCopied] = useState(false);

  // Lookup State
  const [lookupInput, setLookupInput] = useState('');
  const [activeQueryCode, setActiveQueryCode] = useState<string | null>(null);

  // Reactive query for tracking code status
  const lookupResult = useQuery(
    api.reservations.getPublicReservationStatus,
    activeQueryCode ? { trackingCode: activeQueryCode } : 'skip'
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!isOnline) {
      setErrorMessage('No hay conexión a internet. Conéctate a una red para registrar tu reservación en tiempo real.');
      return;
    }

    const trimmedName = formData.fullName.trim();
    const trimmedContact = formData.emailOrPhone.trim();
    const trimmedDate = formData.date.trim();

    if (!trimmedName || !trimmedContact || !trimmedDate) {
      setErrorMessage('Por favor completa los campos obligatorios (nombre, contacto y fecha).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await createReservation({
        fullName: trimmedName,
        emailOrPhone: trimmedContact,
        date: trimmedDate,
        time: formData.time.trim(),
        partySize: Number(formData.partySize) || 2,
        seatingArea: formData.seatingArea || 'terraza',
        specialNotes: formData.specialNotes?.trim() || undefined,
      });

      setSubmittedData({
        id: result?.id || result?.reservationId,
        fullName: trimmedName,
        emailOrPhone: trimmedContact,
        date: trimmedDate,
        time: formData.time.trim(),
        partySize: Number(formData.partySize) || 2,
        seatingArea: formData.seatingArea || 'terraza',
        trackingCode: result?.trackingCode,
      });
    } catch (err: any) {
      console.error('Error al registrar la reservación en Convex:', err);
      const friendlyMsg =
        err?.message?.replace(/Uncaught Error:\s*/i, '') ||
        'Ocurrió un error al registrar tu solicitud. Por favor, verifica tu conexión e inténtalo de nuevo.';
      setErrorMessage(friendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmittedData(null);
    setErrorMessage(null);
    setCodeCopied(false);
    setFormData({
      fullName: '',
      emailOrPhone: '',
      date: '',
      time: '8:00 PM',
      partySize: 2,
      seatingArea: 'terraza',
      specialNotes: '',
    });
  };

  const handleCopyTrackingCode = (code?: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 3000);
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = lookupInput.trim().toUpperCase();
    if (!cleaned) return;
    setActiveQueryCode(cleaned);
  };

  const handleCheckCodeNow = (code?: string) => {
    if (!code) return;
    const url = `/consulta?code=${code}`;
    window.history.pushState({ path: url }, '', url);
    window.dispatchEvent(new Event('popstate'));
  };

  const todayStr = new Date().toISOString().split('T')[0];



  return (
    <section id="reservas" className="relative py-24 px-6 sm:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#9B1B30] block mb-3">
            Planifica Tu Visita
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#FFFBF2] mb-6">
            Módulo de Reservas
          </h2>
          <div className="w-16 h-0.5 bg-[#9B1B30] mx-auto mb-6" />
          <p className="text-base text-[#E9E2D6]/85 font-light leading-relaxed">
            Anticipa tu llegada y asegura un lugar privilegiado en nuestra terraza, o consulta en tiempo real el estado de tu solicitud con tu código privado.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="max-w-md mx-auto mb-10 p-1.5 bg-[#121212]/90 border border-[#E9E2D6]/15 rounded-xl flex items-center justify-between gap-1 shadow-lg">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-3 px-4 text-xs uppercase font-semibold tracking-wider rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'create'
                ? 'bg-[#9B1B30] text-[#FFFBF2] shadow-md'
                : 'text-[#E9E2D6]/70 hover:text-[#FFFBF2] hover:bg-[#1E1E1E]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Solicitar Reserva</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lookup')}
            className={`flex-1 py-3 px-4 text-xs uppercase font-semibold tracking-wider rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'lookup'
                ? 'bg-[#9B1B30] text-[#FFFBF2] shadow-md'
                : 'text-[#E9E2D6]/70 hover:text-[#FFFBF2] hover:bg-[#1E1E1E]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Consulta tu Reservación</span>
          </button>
        </div>

        {/* Reservation Box Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Main Card Column */}
          <div className="lg:col-span-7 glass-panel-dark p-8 sm:p-10 rounded-lg">
            {activeTab === 'create' ? (
              submittedData ? (
                <div className="text-center py-6 space-y-6">
                  <div className="w-14 h-14 rounded-full bg-[#E3B87C]/20 text-[#E3B87C] border border-[#E3B87C]/40 flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-8 h-8 text-[#E3B87C]" />
                  </div>

                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E3B87C]/15 border border-[#E3B87C]/30 text-[#E3B87C] text-xs font-semibold uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Solicitud Recibida — Pendiente de Revisión</span>
                    </div>
                    <h3 className="font-serif text-2xl font-bold text-[#FFFBF2]">
                      ¡Hemos recibido tu solicitud!
                    </h3>
                  </div>

                  <p className="text-sm text-[#E9E2D6]/90 max-w-md mx-auto font-light leading-relaxed">
                    Gracias por elegirnos, <strong>{submittedData.fullName}</strong>. Tu solicitud para{' '}
                    <strong>{submittedData.partySize} personas</strong> el día <strong>{submittedData.date}</strong> a las{' '}
                    <strong>{submittedData.time}</strong> ha quedado registrada en nuestro sistema de atención.
                  </p>

                  {/* Tracking Code Highlight Box */}
                  {submittedData.trackingCode && (
                    <div className="p-5 bg-[#1E1E1E] border border-[#E3B87C]/40 rounded-lg shadow-inner text-center space-y-3 max-w-md mx-auto">
                      <span className="text-[11px] uppercase tracking-widest text-[#E3B87C] font-semibold block flex items-center justify-center gap-1">
                        <ShieldCheck className="w-4 h-4 text-[#E3B87C]" />
                        <span>Código Privado de Seguimiento</span>
                      </span>

                      <div className="flex items-center justify-center gap-3">
                        <span className="font-mono text-2xl font-bold tracking-widest text-[#FFFBF2] bg-[#121212] px-4 py-2 rounded border border-[#E3B87C]/30">
                          {submittedData.trackingCode}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleCopyTrackingCode(submittedData.trackingCode)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs uppercase font-semibold tracking-wider text-[#E9E2D6] bg-[#2A2A2A] hover:bg-[#333333] border border-[#E9E2D6]/20 rounded transition-all"
                          title="Copiar código al portapapeles"
                        >
                          {codeCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                          <span>{codeCopied ? '¡Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>

                      <p className="text-[11px] text-[#8A8380] leading-relaxed">
                        Conserva este código privado para consultar el estado actualizado de tu solicitud en cualquier momento sin exponer tus datos personales.
                      </p>
                    </div>
                  )}

                  <div className="p-4 bg-[#1E1E1E]/90 border border-[#E9E2D6]/15 rounded text-xs text-[#E9E2D6]/80 max-w-md mx-auto text-left space-y-2">
                    <div className="flex items-center justify-between text-[#8A8380] border-b border-[#E9E2D6]/10 pb-2">
                      <span>Estado actual:</span>
                      <span className="text-[#E3B87C] font-semibold uppercase tracking-wider text-[11px]">
                        Pendiente de Confirmación
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[#8A8380]">
                      <span>Medio de contacto:</span>
                      <strong className="text-[#FFFBF2] font-mono">{submittedData.emailOrPhone}</strong>
                    </div>
                    <p className="text-[11px] text-[#8A8380] pt-1 leading-normal border-t border-[#E9E2D6]/10">
                      * Nuestro equipo revisará la disponibilidad de mesas y te contactará para confirmar tu reserva. Recibir esta solicitud no garantiza de forma inmediata la mesa.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                    {submittedData.trackingCode && (
                      <button
                        type="button"
                        onClick={() => handleCheckCodeNow(submittedData.trackingCode)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white bg-[#9B1B30] hover:bg-[#801426] rounded transition-colors shadow-lg"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Consultar Estado Ahora</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={resetForm}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#E9E2D6] hover:text-[#FFFBF2] bg-[#1E1E1E] hover:bg-[#2A2A2A] border border-[#E9E2D6]/20 rounded transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Realizar otra solicitud</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Reservation Creation Form */
                <form onSubmit={handleCreateSubmit} className="space-y-6">
                  {errorMessage && (
                    <div className="p-4 bg-red-900/30 border border-red-500/40 rounded text-xs text-red-200 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-red-100 font-semibold mb-0.5">
                          No se pudo enviar la solicitud
                        </strong>
                        <span>{errorMessage}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-[#E9E2D6] mb-2">
                        Nombre y Apellidos
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Carlos Mendoza"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        disabled={isSubmitting}
                        className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-3 text-sm text-[#FFFBF2] placeholder-[#8A8380] focus:outline-none focus:border-[#9B1B30] disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-[#E9E2D6] mb-2">
                        Teléfono o Correo
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. contacto@ejemplo.com o +53 55555555"
                        value={formData.emailOrPhone}
                        onChange={(e) => setFormData({ ...formData, emailOrPhone: e.target.value })}
                        disabled={isSubmitting}
                        className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-3 text-sm text-[#FFFBF2] placeholder-[#8A8380] focus:outline-none focus:border-[#9B1B30] disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-[#E9E2D6] mb-2 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#9B1B30]" />
                        <span>Fecha</span>
                      </label>
                      <input
                        type="date"
                        required
                        min={todayStr}
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        disabled={isSubmitting}
                        className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-3 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30] disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-[#E9E2D6] mb-2 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#9B1B30]" />
                        <span>Horario</span>
                      </label>
                      <select
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        disabled={isSubmitting}
                        className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-3 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30] disabled:opacity-60"
                      >
                        <optgroup label="Turno Almuerzo (11:00 AM — 3:00 PM)">
                          <option value="11:00 AM">11:00 AM</option>
                          <option value="12:00 PM">12:00 PM</option>
                          <option value="1:00 PM">1:00 PM</option>
                          <option value="2:00 PM">2:00 PM</option>
                        </optgroup>
                        <optgroup label="Turno Cena & Noche (6:00 PM — Cierre)">
                          <option value="6:00 PM">6:00 PM</option>
                          <option value="7:00 PM">7:00 PM</option>
                          <option value="8:00 PM">8:00 PM</option>
                          <option value="9:00 PM">9:00 PM</option>
                          <option value="10:00 PM">10:00 PM</option>
                          <option value="11:00 PM">11:00 PM</option>
                          <option value="12:00 AM">12:00 AM</option>
                          <option value="1:00 AM">1:00 AM (Fines de semana)</option>
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-[#E9E2D6] mb-2 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#9B1B30]" />
                        <span>Personas</span>
                      </label>
                      <select
                        value={formData.partySize}
                        onChange={(e) => setFormData({ ...formData, partySize: Number(e.target.value) })}
                        disabled={isSubmitting}
                        className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-3 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30] disabled:opacity-60"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((num) => (
                          <option key={num} value={num}>
                            {num} {num === 1 ? 'persona' : 'personas'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-[#E9E2D6] mb-2">
                      Observaciones o Peticiones Especiales
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Celebración, alergias o solicitudes para tu visita..."
                      value={formData.specialNotes}
                      onChange={(e) => setFormData({ ...formData, specialNotes: e.target.value })}
                      disabled={isSubmitting}
                      className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-3 text-sm text-[#FFFBF2] placeholder-[#8A8380] focus:outline-none focus:border-[#9B1B30] disabled:opacity-60"
                    />
                  </div>

                  <div className="pt-2 space-y-3">
                    {!isOnline && (
                      <div className="p-3 bg-[#121212] border border-[#9B1B30]/40 rounded-lg text-xs text-[#E9E2D6] flex items-center gap-2.5">
                        <WifiOff className="w-4 h-4 text-[#E3B87C] shrink-0" />
                        <span>Sin conexión. Conéctate a internet para enviar tu solicitud de reservación.</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting || !isOnline}
                      className="w-full py-4 text-xs font-semibold uppercase tracking-wider text-white bg-[#9B1B30] hover:bg-[#801426] disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded shadow-lg whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFBF2] flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#FFFBF2]" />
                          <span>Registrando solicitud...</span>
                        </>
                      ) : !isOnline ? (
                        <>
                          <WifiOff className="w-3.5 h-3.5" />
                          <span>Requiere Conexión</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar Solicitud</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )
            ) : (
              /* Reservation Lookup Experience */
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[#E3B87C] text-xs font-semibold uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Consulta Privada de Estado</span>
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-[#FFFBF2]">
                    Verifica el estado de tu reservación
                  </h3>
                  <p className="text-xs text-[#E9E2D6]/80 font-light leading-relaxed">
                    Ingresa el código privado de seguimiento recibido al enviar tu solicitud (ejemplo:{' '}
                    <span className="font-mono text-[#E3B87C]">DG-8X2K9M</span>).
                  </p>
                </div>

                <form onSubmit={handleLookupSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-[#E9E2D6] mb-2">
                      Código Privado de Seguimiento
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Ej. DG-8X2K9M"
                        value={lookupInput}
                        onChange={(e) => setLookupInput(e.target.value.toUpperCase())}
                        className="flex-1 bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-3 text-sm text-[#FFFBF2] placeholder-[#8A8380] uppercase font-mono tracking-wider focus:outline-none focus:border-[#9B1B30]"
                      />
                      <button
                        type="submit"
                        disabled={!isOnline}
                        className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white bg-[#9B1B30] hover:bg-[#801426] disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
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
                      <p className="text-[11px] text-[#E3B87C] mt-2 flex items-center gap-1.5 font-light">
                        <WifiOff className="w-3.5 h-3.5 shrink-0" />
                        <span>La consulta en tiempo real del registro en Convex requiere conexión a internet.</span>
                      </p>
                    )}
                  </div>
                </form>

                {/* Lookup Results Display */}
                {activeQueryCode && (
                  <div className="pt-4 border-t border-[#E9E2D6]/15">
                    {lookupResult === undefined ? (
                      <div className="py-8 text-center space-y-3">
                        <Loader2 className="w-6 h-6 animate-spin text-[#E3B87C] mx-auto" />
                        <span className="text-xs text-[#E9E2D6]/70 block font-light">
                          Consultando registro en Convex...
                        </span>
                      </div>
                    ) : !lookupResult?.found ? (
                      <div className="p-5 bg-amber-900/20 border border-amber-500/30 rounded-lg text-xs space-y-2">
                        <div className="flex items-center gap-2 text-amber-300 font-semibold uppercase tracking-wider">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>Código no encontrado</span>
                        </div>
                        <p className="text-[#E9E2D6]/90 font-light leading-relaxed">
                          {lookupResult?.message ||
                            'No se encontró ninguna reservación con el código ingresado.'}
                        </p>
                        <p className="text-[11px] text-[#8A8380] pt-1 leading-normal border-t border-amber-500/20">
                          * Nota: Las reservaciones anteriores a la habilitación de códigos privados de seguimiento o tomadas telefónicamente no disponen de consulta digital por código.
                        </p>
                      </div>
                    ) : (
                      (() => {
                        const statusMeta = getReservationStatusMeta(lookupResult.status);
                        const StatusIcon = statusMeta.icon;

                        return (
                          <div className="p-6 bg-[#1E1E1E]/95 border border-[#E9E2D6]/15 rounded-lg space-y-5 shadow-lg">
                            {/* Status Header Badge */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E2D6]/10 pb-4">
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase tracking-widest text-[#8A8380] block font-semibold">
                                  Estado Actual
                                </span>
                                <div
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wider uppercase ${statusMeta.badgeClass}`}
                                >
                                  <StatusIcon className="w-4 h-4 shrink-0" />
                                  <span>{statusMeta.label}</span>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-[10px] uppercase tracking-widest text-[#8A8380] block">
                                  Código
                                </span>
                                <span className="font-mono text-xs font-bold text-[#FFFBF2]">
                                  {activeQueryCode}
                                </span>
                              </div>
                            </div>

                            {/* Status Explanation */}
                            <div className="space-y-2">
                              <h4 className="font-serif text-lg font-bold text-[#FFFBF2]">
                                {statusMeta.title}
                              </h4>
                              <p className="text-xs text-[#E9E2D6]/90 font-light leading-relaxed">
                                {statusMeta.desc}
                              </p>

                              {/* Negotiation proposed details */}
                              {(lookupResult.proposedDate || lookupResult.proposedTime) && (
                                <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded text-xs text-indigo-200 mt-2 space-y-1">
                                  <span className="font-semibold block uppercase tracking-wider text-[11px] text-indigo-300">
                                    Propuesta del Establecimiento:
                                  </span>
                                  <span>
                                    {lookupResult.proposedDate && `Fecha: ${lookupResult.proposedDate}`}
                                    {lookupResult.proposedTime && ` · Horario: ${lookupResult.proposedTime}`}
                                  </span>
                                </div>
                              )}

                              {/* Confirmed table assignment */}
                              {lookupResult.assignedTable && (
                                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-xs text-emerald-200 mt-2 flex items-center gap-2">
                                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                                  <span>
                                    <strong>Mesa asignada:</strong> {lookupResult.assignedTable}
                                  </span>
                                </div>
                              )}

                              {/* Rejection reason */}
                              {lookupResult.statusReason && (
                                <div className="p-3 bg-red-950/40 border border-red-500/30 rounded text-xs text-red-200 mt-2">
                                  <strong className="block font-semibold mb-0.5">Detalle:</strong>
                                  <span>{lookupResult.statusReason}</span>
                                </div>
                              )}
                            </div>

                            {/* Reservation Details Summary */}
                            <div className="pt-4 border-t border-[#E9E2D6]/10 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs text-[#E9E2D6]/80">
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-[#8A8380] block">
                                  Titular
                                </span>
                                <strong className="text-[#FFFBF2]">{lookupResult.fullName}</strong>
                              </div>

                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-[#8A8380] block">
                                  Fecha Solicitada
                                </span>
                                <strong className="text-[#FFFBF2]">{lookupResult.date}</strong>
                              </div>

                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-[#8A8380] block">
                                  Horario
                                </span>
                                <strong className="text-[#FFFBF2]">{lookupResult.time}</strong>
                              </div>

                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-[#8A8380] block">
                                  Comensales
                                </span>
                                <strong className="text-[#FFFBF2]">{lookupResult.partySize} personas</strong>
                              </div>

                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-[#8A8380] block">
                                  Área
                                </span>
                                <strong className="text-[#FFFBF2] capitalize">{lookupResult.seatingArea}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Guidelines & Reservation Notes Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel-dark p-8 rounded-lg">
              <h3 className="font-serif text-xl font-bold text-[#FFFBF2] mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#9B1B30]" />
                <span>Atención y Disfrute</span>
              </h3>
              <p className="text-xs sm:text-sm text-[#E9E2D6]/80 font-light leading-relaxed mb-6">
                Para brindarte el servicio distinguido que mereces, asignamos las ubicaciones respetando
                el orden de solicitud y las condiciones climáticas en la terraza.
              </p>

              <div className="space-y-4 text-xs text-[#8A8380] border-t border-[#E9E2D6]/10 pt-6">
                <div className="flex items-start gap-3">
                  <span className="text-[#9B1B30] font-bold text-sm">·</span>
                  <div>
                    <strong className="text-[#FFFBF2]">Código Privado:</strong> Al solicitar tu reserva, se genera un código privado de seguimiento. Guárdalo para consultar el estado en cualquier momento.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-[#9B1B30] font-bold text-sm">·</span>
                  <div>
                    <strong className="text-[#FFFBF2]">Grupos y Celebraciones:</strong> Se recomienda
                    solicitar con suficiente antelación para eventos familiares o reuniones de amigos.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-[#9B1B30] font-bold text-sm">·</span>
                  <div>
                    <strong className="text-[#FFFBF2]">Margen de Tolerancia:</strong> Las mesas se reservan con
                    un margen de cortesía de 15 minutos respecto al horario indicado.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-[#9B1B30] font-bold text-sm">·</span>
                  <div>
                    <strong className="text-[#FFFBF2]">Sincronización en Tiempo Real:</strong> La consulta refleja directamente la gestión aprobada por el administrador.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
