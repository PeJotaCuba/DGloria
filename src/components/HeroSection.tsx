/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ASSETS } from '../lib/assets';
import { ArrowDown, UtensilsCrossed, Calendar, Sun, Moon } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { groupWeeklyScheduleStrict } from '../utils/schedule';

export const HeroSection: React.FC = () => {
  const openingHours = useQuery(api.shift.getPublicOpeningHours, {});
  const groupedSchedule = groupWeeklyScheduleStrict(openingHours?.weeklySchedule || []);

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 px-6 sm:px-8 text-center"
    >
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        {/* Subtle Brand Kicker */}
        <div className="flex items-center gap-3 text-xs sm:text-sm font-medium tracking-[0.25em] uppercase text-[#E9E2D6]/80 mb-6">
          <span>Bar</span>
          <span aria-hidden="true" className="text-[#9B1B30]">·</span>
          <span>Terraza</span>
          <span aria-hidden="true" className="text-[#9B1B30]">·</span>
          <span>Cocina Auténtica</span>
        </div>

        {/* Commercial Logo - Complete, Transparent Background, Much Larger */}
        <div className="w-full max-w-sm sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto mb-4 flex justify-center">
          <img
            src={ASSETS.logoTransparent}
            alt="Doña Gloria Bar-Terraza"
            className="w-full h-auto max-h-[340px] sm:max-h-[420px] md:max-h-[480px] object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.7)]"
            loading="eager"
            fetchPriority="high"
          />
        </div>

        {/* Slogan - Business name is NOT repeated because it is prominently on the logo */}
        <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-normal italic text-[#FFFBF2] mb-6 leading-tight">
          El auténtico encuentro en la terraza
        </h1>

        {/* Introduction text */}
        <p
          className="text-base sm:text-lg md:text-xl text-[#E9E2D6]/90 max-w-2xl mx-auto font-sans font-light leading-relaxed mb-10"
          style={{ textWrap: 'balance' }}
        >
          Una experiencia gastronómica que combina sabores criollos seleccionados, 
          cócteles de autor y una atmósfera fresca pensada para compartir momentos memorables.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <a
            href="#menu"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#1E1E1E] bg-[#FFFBF2] hover:bg-[#E9E2D6] transition-colors rounded shadow-lg whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9B1B30]"
          >
            <UtensilsCrossed className="w-4 h-4 text-[#9B1B30]" />
            <span>Explorar Menú</span>
          </a>

          <a
            href="#reservas"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#FFFBF2] bg-[#9B1B30] hover:bg-[#801426] transition-colors rounded shadow-lg whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFBF2]"
          >
            <Calendar className="w-4 h-4" />
            <span>Solicitar Reserva</span>
          </a>
        </div>

        {/* Verified Attributes Strip */}
        <div className="mt-14 pt-8 border-t border-[#E9E2D6]/15 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center w-full max-w-3xl">
          <div>
            <span className="block font-serif text-lg sm:text-xl font-bold text-[#FFFBF2] mb-1">Ubicación</span>
            <span className="text-xs text-[#8A8380] uppercase tracking-wider">José A. Saco esq. Zenea</span>
          </div>
          <div>
            <span className="block font-serif text-lg sm:text-xl font-bold text-[#FFFBF2] mb-1">Ambiente</span>
            <span className="text-xs text-[#8A8380] uppercase tracking-wider">Terraza al Aire Libre</span>
          </div>
          <div>
            <span className="block font-serif text-lg sm:text-xl font-bold text-[#FFFBF2] mb-2">Horario</span>
            {groupedSchedule.length > 0 ? (
              <div className="space-y-3">
                {groupedSchedule.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-1">
                    <span className="block text-xs font-semibold text-[#E3B87C]">
                      {group.dayRangeLabel}
                    </span>
                    {group.enabled && group.sessions.length > 0 ? (
                      <div className="space-y-0.5">
                        {group.sessions.map((session, sIdx) => {
                          const Icon = sIdx === 0 ? Sun : Moon;
                          return (
                            <div key={sIdx} className="inline-flex items-center justify-center gap-1.5 text-xs text-[#E9E2D6] font-mono block">
                              <Icon className={`w-3.5 h-3.5 shrink-0 ${sIdx === 0 ? 'text-amber-400' : 'text-blue-300'}`} />
                              <span>{session.openTimeFormatted} – {session.closeTimeFormatted}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-[#8A8380] italic block">
                        {group.closedReason || 'Cerrado por descanso'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-[#8A8380] uppercase tracking-wider block">
                Martes a domingo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Scroll Down Indicator */}
      <a
        href="#nosotros"
        className="mt-12 inline-flex flex-col items-center text-[#E9E2D6]/70 hover:text-[#FFFBF2] transition-colors text-xs uppercase tracking-widest gap-2 group"
      >
        <span>Desplazar para descubrir</span>
        <ArrowDown className="w-4 h-4 animate-bounce text-[#9B1B30]" />
      </a>
    </section>
  );
};
