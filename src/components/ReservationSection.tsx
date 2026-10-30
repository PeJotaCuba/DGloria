/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calendar, Users, Clock, MapPin, CheckCircle2, Send, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { ReservationRequest } from '../lib/convex';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export const ReservationSection: React.FC = () => {
  const createReservation = useMutation(api.reservations.createPublicReservation);

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
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

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
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#9B1B30] block mb-3">
            Planifica Tu Visita
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#FFFBF2] mb-6">
            Módulo de Reservas
          </h2>
          <div className="w-16 h-0.5 bg-[#9B1B30] mx-auto mb-6" />
          <p className="text-base text-[#E9E2D6]/85 font-light leading-relaxed">
            Anticipa tu llegada y asegura un lugar privilegiado en nuestra terraza.
          </p>
        </div>

        {/* Reservation Box Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Form Column */}
          <div className="lg:col-span-7 glass-panel-dark p-8 sm:p-10 rounded-lg">
            {submittedData ? (
              <div className="text-center py-6 space-y-5">
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

                <div className="p-4 bg-[#1E1E1E]/90 border border-[#E9E2D6]/15 rounded text-xs text-[#E9E2D6]/80 max-w-md mx-auto text-left space-y-2.5">
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
                  {submittedData.id && (
                    <div className="flex items-center justify-between text-[#8A8380]">
                      <span>Identificador:</span>
                      <span className="text-[#8A8380] font-mono text-[11px]">{submittedData.id}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-[#8A8380] pt-1 leading-normal border-t border-[#E9E2D6]/10">
                    * Nuestro equipo revisará la disponibilidad de mesas y te contactará para confirmar tu reserva. Recibir esta solicitud no garantiza de forma inmediata la mesa.
                  </p>
                </div>

                <div className="pt-3">
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
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {errorMessage && (
                  <div className="p-4 bg-red-900/30 border border-red-500/40 rounded text-xs text-red-200 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-red-100 font-semibold mb-0.5">No se pudo enviar la solicitud</strong>
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

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 text-xs font-semibold uppercase tracking-wider text-white bg-[#9B1B30] hover:bg-[#801426] disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded shadow-lg whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFBF2] flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#FFFBF2]" />
                        <span>Registrando solicitud...</span>
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
                    <strong className="text-[#FFFBF2]">Confirmación Directa:</strong> El canal de validación es automático al sistema de gestión del bar.
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
