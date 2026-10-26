/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, HeartHandshake, Compass } from 'lucide-react';

export const AboutSection: React.FC = () => {
  return (
    <section id="nosotros" className="relative py-24 px-6 sm:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#9B1B30] block mb-3">
            Nuestra Esencia
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#FFFBF2] mb-6">
            La Experiencia Doña Gloria
          </h2>
          <div className="w-16 h-0.5 bg-[#9B1B30] mx-auto mb-6" />
          <p className="text-base text-[#E9E2D6]/85 font-light leading-relaxed">
            Un espacio concebido para el disfrute distendido, donde cada receta rinde tributo
            al buen gusto y la brisa de nuestra terraza invita a quedarse.
          </p>
        </div>

        {/* Content Layout: Full-Width Editorial Feature Card */}
        <div className="glass-panel-dark p-8 sm:p-12 rounded-lg max-w-5xl mx-auto space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <h3 className="font-serif text-2xl sm:text-3xl md:text-4xl font-semibold text-[#FFFBF2] leading-snug">
              Sabor tradicional, hospitalidad sincera y el encanto de la noche.
            </h3>
            <div className="space-y-4">
              <p className="text-sm sm:text-base text-[#E9E2D6]/85 leading-relaxed font-light">
                En Doña Gloria Bar-Terraza cada detalle está pensado para transformar cualquier ocasión
                en un recuerdo especial. Desde nuestros bocados emblemáticos hasta nuestras bebidas
                refrescantes, buscamos que cada visitante se sienta en casa mientras disfruta de una
                propuesta culinaria cuidada y honesta.
              </p>
              <p className="text-sm sm:text-base text-[#E9E2D6]/85 leading-relaxed font-light">
                Nuestra terraza ofrece el escenario idóneo para celebraciones íntimas, conversaciones entre
                amigos o una cena relajada tras una intensa jornada en Bayamo.
              </p>
            </div>
          </div>

          {/* Core Values Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-8 border-t border-[#E9E2D6]/10">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded bg-[#9B1B30]/15 border border-[#9B1B30]/30 shrink-0">
                <Compass className="w-5 h-5 text-[#9B1B30]" />
              </div>
              <div>
                <h4 className="font-serif text-base font-bold text-[#FFFBF2]">Ambiente Único</h4>
                <p className="text-xs text-[#8A8380] mt-1 leading-relaxed">Confortable terraza bajo las luces nocturnas de la ciudad.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded bg-[#9B1B30]/15 border border-[#9B1B30]/30 shrink-0">
                <Sparkles className="w-5 h-5 text-[#9B1B30]" />
              </div>
              <div>
                <h4 className="font-serif text-base font-bold text-[#FFFBF2]">Sabor Cuidado</h4>
                <p className="text-xs text-[#8A8380] mt-1 leading-relaxed">Ingredientes selectos y preparación artesanal al momento.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded bg-[#9B1B30]/15 border border-[#9B1B30]/30 shrink-0">
                <HeartHandshake className="w-5 h-5 text-[#9B1B30]" />
              </div>
              <div>
                <h4 className="font-serif text-base font-bold text-[#FFFBF2]">Hospitalidad</h4>
                <p className="text-xs text-[#8A8380] mt-1 leading-relaxed">Atención cercana y dedicada para que disfrutes cada instante.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
