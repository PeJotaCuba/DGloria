import React, { useEffect, useState } from 'react';
import { useScrollProgress } from './hooks/useScrollProgress';
import { ImmersiveBackground } from './components/ImmersiveBackground';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { AboutSection } from './components/AboutSection';
import { MenuSection } from './components/MenuSection';
import { ReservationSection } from './components/ReservationSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { MenuPage } from './pages/MenuPage';
import { ReservationLookupPage } from './pages/ReservationLookupPage';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);
  const { progress, prefersReducedMotion } = useScrollProgress();

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Si la ruta es /menu o /menu/, renderizar la página exclusiva del menú
  if (currentPath === '/menu' || currentPath === '/menu/') {
    return <MenuPage />;
  }

  // Si la ruta es /consulta o /consulta/, renderizar la página de búsqueda de reservaciones
  if (currentPath === '/consulta' || currentPath === '/consulta/') {
    return <ReservationLookupPage />;
  }

  // Página de inicio (Landing Page)
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
