/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ASSETS } from '../lib/assets';
import { Menu, X, Calendar, Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { InstallModalIOS } from './InstallModalIOS';

interface NavbarProps {
  onNavigate?: (sectionId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {
    isInstallable,
    isInstalled,
    isIOS,
    showIOSGuide,
    setShowIOSGuide,
    promptInstall,
  } = usePWAInstall();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Inicio', href: '#inicio' },
    { label: 'Nosotros', href: '#nosotros' },
    { label: 'Menú', href: '#menu' },
    { label: 'Reservas', href: '#reservas' },
    { label: 'Contacto', href: '#contacto' },
  ];

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const targetElement = document.querySelector(href);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth' });
    }
    if (onNavigate) {
      onNavigate(href.replace('#', ''));
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'glass-panel-dark border-b border-[#E9E2D6]/10 py-3 shadow-lg shadow-black/40'
            : 'bg-gradient-to-b from-[#1E1E1E]/90 to-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Single Brand Element with Commercial Logo */}
          <a
            href="#inicio"
            onClick={(e) => handleLinkClick(e, '#inicio')}
            className="flex items-center gap-3 group shrink-0 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9B1B30] rounded-sm"
          >
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full overflow-hidden border border-[#E9E2D6]/20 bg-[#1E1E1E] flex items-center justify-center p-1 shadow-sm transition-transform group-hover:scale-105">
              <img
                src={ASSETS.logoTransparent}
                alt="Logo Doña Gloria Bar-Terraza"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg sm:text-xl font-bold tracking-tight text-[#FFFBF2] group-hover:text-[#E9E2D6] transition-colors">
                Doña Gloria
              </span>
              <span className="text-[10px] tracking-widest uppercase text-[#8A8380] font-sans">
                Bar — Terraza
              </span>
            </div>
          </a>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#E9E2D6]/80">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleLinkClick(e, item.href)}
                className="hover:text-[#FFFBF2] transition-colors whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#9B1B30]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Zone 3: Actions */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {!isInstalled && (isInstallable || isIOS) && (
              <button
                onClick={promptInstall}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-[#E9E2D6] hover:text-[#FFFBF2] bg-[#1E1E1E]/80 hover:bg-[#2A2A2A] border border-[#E9E2D6]/20 hover:border-[#9B1B30]/60 rounded transition-all shadow-sm whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9B1B30]"
                title={isIOS ? 'Cómo instalar en iPhone / iPad' : 'Instalar Doña Gloria en tu dispositivo'}
              >
                <Download className="w-3.5 h-3.5 text-[#9B1B30]" />
                <span>Instalar App</span>
              </button>
            )}

            <a
              href="#reservas"
              onClick={(e) => handleLinkClick(e, '#reservas')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FFFBF2] bg-[#9B1B30] hover:bg-[#801426] active:bg-[#68101F] rounded transition-colors shadow-sm whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFBF2]"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Reservar Mesa</span>
            </a>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            {!isInstalled && (isInstallable || isIOS) && (
              <button
                onClick={promptInstall}
                className="p-1.5 text-[#E9E2D6] hover:text-[#FFFBF2] bg-[#1E1E1E]/80 border border-[#E9E2D6]/20 rounded transition-colors"
                title={isIOS ? 'Cómo instalar en iPhone/iPad' : 'Instalar App'}
                aria-label="Instalar aplicación"
              >
                <Download className="w-4 h-4 text-[#9B1B30]" />
              </button>
            )}
            <a
              href="#reservas"
              onClick={(e) => handleLinkClick(e, '#reservas')}
              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#FFFBF2] bg-[#9B1B30] rounded"
            >
              Reservar
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#FFFBF2] hover:text-[#E9E2D6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9B1B30] rounded"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-[#1E1E1E]/95 backdrop-blur-xl pt-24 px-6 flex flex-col justify-between pb-8">
          <nav className="flex flex-col gap-6 text-lg font-serif">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleLinkClick(e, item.href)}
                className="text-[#FFFBF2] hover:text-[#9B1B30] border-b border-[#E9E2D6]/10 pb-3 transition-colors flex items-center justify-between"
              >
                <span>{item.label}</span>
                <span className="text-xs font-sans text-[#8A8380]">→</span>
              </a>
            ))}
          </nav>

          <div className="pt-6 border-t border-[#E9E2D6]/10 flex flex-col gap-3">
            {!isInstalled && (isInstallable || isIOS) && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  promptInstall();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-[#FFFBF2] bg-[#2A2A2A] hover:bg-[#333333] border border-[#E9E2D6]/20 rounded transition-colors shadow-sm"
              >
                <Download className="w-4 h-4 text-[#9B1B30]" />
                <span>{isIOS ? 'Cómo instalar en iPhone / iPad' : 'Instalar Doña Gloria'}</span>
              </button>
            )}

            <a
              href="#reservas"
              onClick={(e) => handleLinkClick(e, '#reservas')}
              className="w-full text-center py-3 text-xs font-semibold uppercase tracking-wider text-[#FFFBF2] bg-[#9B1B30] rounded shadow"
            >
              Solicitar Reserva
            </a>
            <p className="text-center text-xs text-[#8A8380]">
              Doña Gloria Bar-Terraza · Experiencia culinaria
            </p>
          </div>
        </div>
      )}

      {/* iOS Safari Installation Guide Modal */}
      <InstallModalIOS
        isOpen={showIOSGuide}
        onClose={() => setShowIOSGuide(false)}
      />
    </>
  );
};
