/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MapPin, Clock, MessageSquare, Send, Check } from 'lucide-react';
import { BUSINESS_INFO, WHATSAPP_URL_NUMBER } from '../lib/assets';

export const ContactSection: React.FC = () => {
  const [inquiryName, setInquiryName] = useState('');
  const [inquirySubject, setInquirySubject] = useState('');
  const [inquiryMsg, setInquiryMsg] = useState('');
  const [sent, setSent] = useState(false);

  const getInquiryWhatsAppUrl = () => {
    const message =
      `*Consulta — Doña Gloria Bar-Terraza*\n\n` +
      `👤 *Nombre:* ${inquiryName}\n` +
      (inquirySubject ? `📌 *Asunto:* ${inquirySubject}\n` : '') +
      `💬 *Mensaje:* ${inquiryMsg}\n\n` +
      `Enviado desde la web de Doña Gloria Bar-Terraza.`;
    return `https://wa.me/${WHATSAPP_URL_NUMBER}?text=${encodeURIComponent(message)}`;
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryName || !inquiryMsg) return;
    setSent(true);
    const url = getInquiryWhatsAppUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section id="contacto" className="relative py-24 px-6 sm:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#9B1B30] block mb-3">
            Atención & Localización
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#FFFBF2] mb-6">
            Información Práctica
          </h2>
          <div className="w-16 h-0.5 bg-[#9B1B30] mx-auto mb-6" />
          <p className="text-base text-[#E9E2D6]/85 font-light leading-relaxed">
            Te esperamos en {BUSINESS_INFO.city}, {BUSINESS_INFO.country}. Encuentra a continuación nuestra ubicación y horarios de atención.
          </p>
        </div>

        {/* Practical Info Cards: 2 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Location Card */}
          <div className="glass-panel-dark p-8 rounded-lg flex flex-col justify-between border border-[#E9E2D6]/10">
            <div>
              <div className="w-12 h-12 rounded bg-[#9B1B30]/15 border border-[#9B1B30]/30 text-[#9B1B30] flex items-center justify-center mb-6">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#FFFBF2] mb-2">
                Ubicación
              </h3>
              <p className="text-xs text-[#E9E2D6]/80 font-light leading-relaxed mb-4">
                Instalaciones de terraza al aire libre y salón interior en el centro de Bayamo.
              </p>
            </div>
            <div className="pt-4 border-t border-[#E9E2D6]/10 flex flex-col gap-2">
              <div>
                <span className="text-[11px] text-[#8A8380] uppercase tracking-wider block">
                  Dirección
                </span>
                <span className="text-xs text-[#FFFBF2] font-semibold block leading-snug">
                  {BUSINESS_INFO.address}
                </span>
                <span className="text-xs text-[#E9E2D6]/90 block font-light">
                  {BUSINESS_INFO.city}, {BUSINESS_INFO.country}
                </span>
              </div>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(BUSINESS_INFO.fullAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#9B1B30] hover:text-[#FFFBF2] transition-colors font-medium mt-1"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Abrir en Mapa →</span>
              </a>
            </div>
          </div>

          {/* Schedule Card */}
          <div className="glass-panel-dark p-8 rounded-lg flex flex-col justify-between border border-[#E9E2D6]/10">
            <div>
              <div className="w-12 h-12 rounded bg-[#9B1B30]/15 border border-[#9B1B30]/30 text-[#9B1B30] flex items-center justify-center mb-6">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#FFFBF2] mb-2">
                Horarios de Apertura
              </h3>
              <p className="text-xs text-[#E9E2D6]/80 font-light leading-relaxed mb-4">
                Atención para almuerzos y servicio continuado de bar y cenas en terraza.
              </p>
            </div>
            <div className="pt-4 border-t border-[#E9E2D6]/10 space-y-2.5">
              <div>
                <span className="text-[11px] text-[#8A8380] uppercase tracking-wider block">
                  Martes a Viernes
                </span>
                <span className="text-xs text-[#FFFBF2] font-mono block">
                  11:00 AM — 3:00 PM
                </span>
                <span className="text-xs text-[#FFFBF2] font-mono block">
                  6:00 PM — 12:00 AM
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#8A8380] uppercase tracking-wider block">
                  Sábados y Domingos
                </span>
                <span className="text-xs text-[#FFFBF2] font-mono block">
                  11:00 AM — 3:00 PM
                </span>
                <span className="text-xs text-[#FFFBF2] font-mono block">
                  6:00 PM — 2:00 AM
                </span>
              </div>
              <div className="pt-1 border-t border-[#E9E2D6]/5">
                <span className="text-[11px] text-[#8A8380] italic">
                  Lunes: Cerrado por descanso
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Message Inquiry Box */}
        <div className="glass-panel-dark p-8 sm:p-10 rounded-lg border border-[#E9E2D6]/10">
          <div className="flex items-center gap-3 mb-6">
            <MessageSquare className="w-5 h-5 text-[#9B1B30]" />
            <h3 className="font-serif text-xl font-bold text-[#FFFBF2]">
              Buzón de Consultas y Contacto Rápido
            </h3>
          </div>

          {sent ? (
            <div className="p-6 bg-[#25D366]/15 border border-[#25D366]/30 rounded text-center space-y-3">
              <Check className="w-8 h-8 text-[#25D366] mx-auto" />
              <p className="font-serif text-lg font-bold text-[#FFFBF2]">
                ¡Consulta preparada para WhatsApp!
              </p>
              <p className="text-xs text-[#E9E2D6]/90 font-light max-w-md mx-auto">
                Tu mensaje ha sido formateado para enviarse directamente al chat de WhatsApp de Doña Gloria.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <a
                  href={getInquiryWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider bg-[#25D366] hover:bg-[#20bd5a] text-white rounded shadow"
                >
                  Abrir WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setInquiryName('');
                    setInquirySubject('');
                    setInquiryMsg('');
                  }}
                  className="px-5 py-2.5 text-xs uppercase tracking-wider bg-[#1E1E1E] text-[#E9E2D6] hover:text-[#FFFBF2] border border-[#E9E2D6]/20 rounded font-semibold"
                >
                  Escribir otro mensaje
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#E9E2D6] mb-1.5">
                    Tu Nombre
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre o entidad"
                    value={inquiryName}
                    onChange={(e) => setInquiryName(e.target.value)}
                    className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-2.5 text-sm text-[#FFFBF2] placeholder-[#8A8380] focus:outline-none focus:border-[#9B1B30]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#E9E2D6] mb-1.5">
                    Asunto
                  </label>
                  <input
                    type="text"
                    placeholder="Consulta general / Evento privado"
                    value={inquirySubject}
                    onChange={(e) => setInquirySubject(e.target.value)}
                    className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-2.5 text-sm text-[#FFFBF2] placeholder-[#8A8380] focus:outline-none focus:border-[#9B1B30]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#E9E2D6] mb-1.5">
                  Mensaje o Pregunta
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Escribe tu consulta para el equipo de Doña Gloria..."
                  value={inquiryMsg}
                  onChange={(e) => setInquiryMsg(e.target.value)}
                  className="w-full bg-[#1E1E1E]/90 border border-[#E9E2D6]/20 rounded px-4 py-2.5 text-sm text-[#FFFBF2] placeholder-[#8A8380] focus:outline-none focus:border-[#9B1B30]"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white bg-[#25D366] hover:bg-[#20bd5a] rounded transition-colors whitespace-nowrap shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Consulta</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
