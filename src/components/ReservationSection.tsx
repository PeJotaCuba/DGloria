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
  Send,
  Loader2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  WifiOff,
  Bell,
  BellOff,
} from 'lucide-react';
import { ReservationRequest } from '../lib/convex';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getReservationStatusMeta } from '../utils/reservations';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useDeviceIdentity } from '../hooks/useDeviceIdentity';
import { useWebPush } from '../hooks/useWebPush';

const LAST_RES_ID_KEY = 'dg_last_public_res_id';

export const ReservationSection: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { dvc } = useDeviceIdentity();
  const {
    isSupported: pushSupported,
    isConfigured: pushConfigured,
    configError: pushConfigError,
    retryConfig: retryPushConfig,
    permission: pushPermission,
    isSubscribed: pushSubscribed,
    isSubscribing: pushSubscribing,
    error: pushError,
    enableNotifications,
  } = useWebPush(dvc);
  const createReservation = useMutation(api.reservations.createPublicReservation);

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
  const [activeReservationId, setActiveReservationId] = useState<string | null>(() =>
    localStorage.getItem(LAST_RES_ID_KEY)
  );

  // Consulta reactiva en tiempo real del estado de la solicitud enviada
  const liveReservation = useQuery(
    api.reservations.getPublicReservationStatus,
    activeReservationId ? { id: activeReservationId } : 'skip'
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
        clientDvcCode: dvc || undefined,
      });

      const resId = result?.id || result?._id;
      if (resId) {
        localStorage.setItem(LAST_RES_ID_KEY, String(resId));
        setActiveReservationId(String(resId));
      }
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
    localStorage.removeItem(LAST_RES_ID_KEY);
    setActiveReservationId(null);
    setErrorMessage(null);
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
            Anticipa tu llegada y asegura un lugar privilegiado en nuestra terraza. Al enviar tu solicitud, verás el estado de tu reservación actualizado en tiempo real aquí mismo.
          </p>
        </div>

        {/* Reservation Box Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Main Card Column */}
          <div className="lg:col-span-7 glass-panel-dark p-8 sm:p-10 rounded-lg">
            {activeReservationId ? (
              liveReservation === undefined ? (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#E3B87C] mx-auto" />
                  <p className="text-xs text-[#E9E2D6]/80">
                    Consultando el estado de tu reservación...
                  </p>
                </div>
              ) : liveReservation === null ? (
                <div className="text-center py-8 space-y-4">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-sm text-[#E9E2D6]/85">
                    No pudimos encontrar el registro de esta reservación.
                  </p>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white bg-[#9B1B30] hover:bg-[#801426] rounded"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Nueva Solicitud</span>
                  </button>
                </div>
              ) : (
                (() => {
                  const statusMeta = getReservationStatusMeta(liveReservation.status);
                  const StatusIcon = statusMeta.icon;
                  return (
                    <div className="space-y-6">
                      <div className="text-center space-y-3">
                        <div
                          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wider ${statusMeta.badgeClass}`}
                        >
                          <StatusIcon className="w-4 h-4 shrink-0" />
                          <span>{statusMeta.label}</span>
                        </div>
                        <h3 className="font-serif text-2xl font-bold text-[#FFFBF2]">
                          {statusMeta.title}
                        </h3>
                        <p className="text-sm text-[#E9E2D6]/90 max-w-md mx-auto font-light leading-relaxed">
                          {statusMeta.desc}
                        </p>
                      </div>

                      {liveReservation.tableNumber && (
                        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs text-emerald-200 flex items-center gap-2.5 max-w-md mx-auto">
                          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>
                            <strong>Mesa asignada:</strong> Mesa #{liveReservation.tableNumber}
                          </span>
                        </div>
                      )}

                      {(liveReservation.alternativeDate || liveReservation.alternativeTime) && (
                        <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-lg text-xs text-indigo-200 max-w-md mx-auto space-y-1">
                          <span className="font-semibold block uppercase tracking-wider text-[11px] text-indigo-300">
                            Propuesta Alternativa del Local:
                          </span>
                          <p>
                            {liveReservation.alternativeDate && `Fecha: ${liveReservation.alternativeDate}`}
                            {liveReservation.alternativeTime && ` · Horario: ${liveReservation.alternativeTime}`}
                          </p>
                          {liveReservation.alternativeNotes && (
                            <p className="text-indigo-200/80">{liveReservation.alternativeNotes}</p>
                          )}
                        </div>
                      )}

                      {liveReservation.rejectionReason && (
                        <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-200 max-w-md mx-auto">
                          <strong className="block font-semibold mb-0.5">Detalle:</strong>
                          <span>{liveReservation.rejectionReason}</span>
                        </div>
                      )}

                      <div className="p-4 bg-[#1E1E1E]/90 border border-[#E9E2D6]/15 rounded-lg text-xs text-[#E9E2D6]/85 max-w-md mx-auto grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] uppercase text-[#8A8380] block">Titular</span>
                          <strong className="text-[#FFFBF2]">{liveReservation.fullName}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-[#8A8380] block">Personas</span>
                          <strong className="text-[#FFFBF2]">{liveReservation.partySize} personas</strong>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-[#8A8380] block">Fecha</span>
                          <strong className="text-[#FFFBF2]">{liveReservation.date}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-[#8A8380] block">Horario</span>
                          <strong className="text-[#FFFBF2]">{liveReservation.time}</strong>
                        </div>
                      </div>

                      {/* Notificaciones Push de estado para el cliente (interacción explícita) */}
                      {pushSupported && (pushConfigured || pushConfigError) && (
                        <div className="max-w-md mx-auto">
                          {pushConfigError ? (
                            <div className="p-3 rounded-lg bg-[#1E1E1E]/80 border border-[#E9E2D6]/15 text-[11px] text-[#E9E2D6]/75 flex items-center justify-between gap-2">
                              <span>{pushConfigError}</span>
                              <button
                                type="button"
                                onClick={retryPushConfig}
                                className="px-2.5 py-1 rounded bg-[#2A2A2A] hover:bg-[#333333] text-[#E3B87C] font-semibold shrink-0"
                              >
                                Reintentar
                              </button>
                            </div>
                          ) : pushSubscribed ? (
                            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/25 text-xs text-emerald-200 flex items-center justify-center gap-2">
                              <Bell className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>Notificaciones activadas para cambios de estado</span>
                            </div>
                          ) : pushPermission === 'denied' ? (
                            <div className="p-3 rounded-lg bg-[#1E1E1E]/80 border border-[#E9E2D6]/10 text-[11px] text-[#8A8380] flex items-center justify-center gap-2">
                              <BellOff className="w-3.5 h-3.5 shrink-0" />
                              <span>Notificaciones bloqueadas en el navegador. El estado se actualiza aquí en tiempo real.</span>
                            </div>
                          ) : (
                            <div className="text-center space-y-1.5">
                              <button
                                type="button"
                                onClick={enableNotifications}
                                disabled={pushSubscribing}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#E3B87C] hover:text-[#FFFBF2] bg-[#1E1E1E] hover:bg-[#2A2A2A] border border-[#E3B87C]/35 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {pushSubscribing ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Bell className="w-3.5 h-3.5" />
                                )}
                                <span>Avisarme por notificación cuando cambie el estado</span>
                              </button>
                              {pushError && (
                                <p className="text-[11px] text-red-300">{pushError}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={resetForm}
                          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#E9E2D6] hover:text-[#FFFBF2] bg-[#1E1E1E] hover:bg-[#2A2A2A] border border-[#E9E2D6]/20 rounded transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Realizar otra solicitud</span>
                        </button>
                      </div>
                    </div>
                  );
                })()
              )
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
                    <strong className="text-[#FFFBF2]">Seguimiento en Tiempo Real:</strong> Al enviar tu solicitud, el estado de tu reservación se actualiza automáticamente en esta misma pantalla.
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
