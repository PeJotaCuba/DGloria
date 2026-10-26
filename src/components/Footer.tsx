/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ASSETS } from '../lib/assets';
import { ArrowUp } from 'lucide-react';

export const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative border-t border-[#E9E2D6]/10 bg-[#121212]/95 py-16 px-6 sm:px-8 z-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-12 border-b border-[#E9E2D6]/10">
          {/* Brand lockup */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden border border-[#E9E2D6]/20 bg-[#1E1E1E] p-1 shrink-0 shadow-md flex items-center justify-center">
              <img
                src={ASSETS.logoTransparent}
                alt="Logo Doña Gloria Bar-Terraza"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="font-serif text-xl font-bold tracking-tight text-[#FFFBF2] block">
                Doña Gloria
              </span>
              <span className="text-xs text-[#E9E2D6]/80 font-sans block">
                Calle José Antonio Saco, esq. Zenea · Bayamo, Cuba
              </span>
              <span className="text-[11px] uppercase tracking-widest text-[#8A8380] font-sans block mt-0.5">
                Bar — Terraza · WhatsApp: 53431762
              </span>
            </div>
          </div>

          {/* Quick links */}
          <nav className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs uppercase tracking-wider text-[#E9E2D6]/80 font-medium">
            <a href="#inicio" className="hover:text-[#FFFBF2] transition-colors">
              Inicio
            </a>
            <a href="#nosotros" className="hover:text-[#FFFBF2] transition-colors">
              Nosotros
            </a>
            <a href="#menu" className="hover:text-[#FFFBF2] transition-colors">
              Menú
            </a>
            <a href="#reservas" className="hover:text-[#FFFBF2] transition-colors">
              Reservas
            </a>
            <a href="#contacto" className="hover:text-[#FFFBF2] transition-colors">
              Contacto
            </a>
          </nav>

          {/* Back to top */}
          <div>
            <button
              onClick={scrollToTop}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider text-[#E9E2D6]/80 hover:text-[#FFFBF2] bg-[#1E1E1E] hover:bg-[#9B1B30] border border-[#E9E2D6]/15 rounded transition-colors"
            >
              <span>Subir</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bottom copyright & agency attribution */}
        <div className="pt-8 flex flex-col items-center justify-center gap-3 text-xs text-[#8A8380]">
          <p className="text-center">
            © {new Date().getFullYear()} Doña Gloria Bar-Terraza. Todos los derechos reservados.
          </p>

          <div className="flex items-center justify-center gap-2.5 pt-1">
            <span className="text-[11px] uppercase tracking-wider text-[#8A8380] font-sans">
              Desarrollado por
            </span>
            <img
              src={ASSETS.nectysLogo}
              alt="Nectys"
              className="h-6 sm:h-7 w-auto object-contain transition-opacity duration-300 hover:opacity-90"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
