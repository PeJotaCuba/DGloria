/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useScrollProgress } from './hooks/useScrollProgress';
import { ImmersiveBackground } from './components/ImmersiveBackground';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { AboutSection } from './components/AboutSection';
import { MenuSection } from './components/MenuSection';
import { ReservationSection } from './components/ReservationSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';

export default function App() {
  const { progress, prefersReducedMotion } = useScrollProgress();

  return (
    <div className="relative min-h-screen bg-[#1E1E1E] text-[#FFFBF2] overflow-x-hidden selection:bg-[#9B1B30] selection:text-[#FFFBF2]">
      {/* Permanent Immersive Photographic Background with Smooth Scroll Zoom */}
      <ImmersiveBackground
        progress={progress}
        prefersReducedMotion={prefersReducedMotion}
      />

      {/* Top Navigation Bar with 3-Zone Contract */}
      <Navbar />

      {/* Structured Sections Layer */}
      <main className="relative z-10 flex flex-col">
        {/* 1. Portada / Hero */}
        <HeroSection />

        {/* 2. Presentación del Negocio / Concepto Bar-Terraza */}
        <AboutSection />

        {/* 3. Menú / Catálogo de Consulta */}
        <MenuSection />

        {/* 4. Reservas / Solicitud */}
        <ReservationSection />

        {/* 5. Información Práctica & Contacto */}
        <ContactSection />
      </main>

      {/* 6. Pie de Página */}
      <Footer />
    </div>
  );
}
