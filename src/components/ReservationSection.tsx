/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calendar, Users, Clock, MapPin, CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { ReservationRequest } from '../lib/convex';
import { WHATSAPP_PHONE, WHATSAPP_URL_NUMBER } from '../lib/assets';

export const ReservationSection: React.FC = () => {
  const [formData, setFormData] = useState<ReservationRequest>({
    fullName: '',
    emailOrPhone: '',
    date: '',
    time: '8:00 PM',
    partySize: 2,
    seatingArea: 'terraza',
    specialNotes: '',
  });

  const [submitted, setSubmitted] = useState(false);

  const getWhatsAppMessage = () => {
    return (
      `*Solicitud de Reserva — Doña Gloria Bar-Terraza*\n\n` +
      `👤 *Nombre:* ${formData.fullName}\n` +
      `📞 *Contacto:* ${formData.emailOrPhone}\n` +
      `📅 *Fecha:* ${formData.date}\n` +
      `⏰ *Horario:* ${formData.time} hrs\n` +
      `👥 *Comensales:* ${formData.partySize} ${formData.partySize === 1 ? 'persona' : 'personas'}\n` +
      (formData.specialNotes ? `📝 *Observaciones:* ${formData.specialNotes}\n` : '') +
      `\nEnviado desde la web de Doña Gloria Bar-Terraza.`
    );
  };

  const getWhatsAppUrl = () => {
    return `https://wa.me/${WHATSAPP_URL_NUMBER}?text=${encodeURIComponent(getWhatsAppMessage())}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.emailOrPhone || !formData.date) {
      return;
    }
    setSubmitted(true);
    const url = getWhatsAppUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const resetForm = () => {
    setSubmitted(false);
    setFormData({
      fullName: '',
      emailOrPhone: '',
      date: '',
      time: '20:00',
      partySize: 2,
      seatingArea: 'terraza',
      specialNotes: '',
    });
  };

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
            {submitted ? (
              <div className="text-center py-8 space-y-5">
                <div className="w-14 h-14 rounded-full bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-[#25D366]" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-[#FFFBF2]">
                  ¡Reserva Generada!
                </h3>
                <p className="text-sm text-[#E9E2D6]/90 max-w-md mx-auto font-light leading-relaxed">
                  Los datos de tu reserva para <strong>{formData.fullName}</strong> ({formData.partySize} personas, {formData.date} a las {formData.time} hrs) han sido preparados para WhatsApp.
                </p>

                <div className="p-4 bg-[#1E1E1E]/90 border border-[#E9E2D6]/15 rounded text-xs text-[#E9E2D6]/80 max-w-md mx-auto text-left space-y-2">
                  <div className="flex items-center justify-between text-[#8A8380]">
                    <span>Destino WhatsApp:</span>
                    <strong className="text-[#FFFBF2] font-mono">{WHATSAPP_PHONE} (+53 {WHATSAPP_PHONE})</strong>
                  </div>
                  <div className="text-[11px] text-[#8A8380]">
                    Si tu navegador bloqueó la ventana emergente, pulsa el botón a continuación para abrir WhatsApp manualmente.
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <a
                    href={getWhatsAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white bg-[#25D366] hover:bg-[#20bd5a] rounded transition-colors shadow-lg"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Abrir WhatsApp ({WHATSAPP_PHONE})</span>
                  </a>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full sm:w-auto px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#E9E2D6] hover:text-[#FFFBF2] bg-[#1E1E1E] hover:bg-[#1E1E1E]/80 border border-[#E9E2D6]/20 rounded transition-colors"
                  >
                    Nueva Solicitud
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
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
                      className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-3 text-sm text-[#FFFBF2] placeholder-[#8A8380] focus:outline-none focus:border-[#9B1B30]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-[#E9E2D6] mb-2">
                      Teléfono o Correo
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. contacto@ejemplo.com"
                      value={formData.emailOrPhone}
                      onChange={(e) => setFormData({ ...formData, emailOrPhone: e.target.value })}
                      className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-3 text-sm text-[#FFFBF2] placeholder-[#8A8380] focus:outline-none focus:border-[#9B1B30]"
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
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-3 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30]"
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
                      className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-3 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30]"
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
                      className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-3 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30]"
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
                    className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-3 text-sm text-[#FFFBF2] placeholder-[#8A8380] focus:outline-none focus:border-[#9B1B30]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-4 text-xs font-semibold uppercase tracking-wider text-white bg-[#25D366] hover:bg-[#20bd5a] transition-colors rounded shadow-lg whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-white flex items-center justify-center gap-2"
                  >
                    <span>Enviar</span>
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
