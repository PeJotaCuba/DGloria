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
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { useDeviceIdentity } from './hooks/useDeviceIdentity';

export default function App() {
  // Inicializar identidad del dispositivo (DVC) para identificación de navegador
  useDeviceIdentity();

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

  // Normalización de ruta para permitir /menu, /menu/, /menu.html, /Menu, etc.
  const normalizedPath = currentPath.toLowerCase().replace(/\/+$/, '') || '/';
  const isMenu = normalizedPath === '/menu' || normalizedPath === '/menu/index.html' || normalizedPath === '/menu.html';
  const isConsulta = normalizedPath === '/consulta' || normalizedPath === '/consulta/index.html' || normalizedPath === '/consulta.html';

  // Si la ruta es /menu, renderizar la página exclusiva del menú
  if (isMenu) {
    return (
      <div className="safe-area-pt safe-area-pb">
        <MenuPage />
        <PWAInstallBanner />
        <PWAUpdatePrompt />
        <OfflineIndicator />
      </div>
    );
  }

  // Si la ruta es /consulta, renderizar la página de búsqueda de reservaciones
  if (isConsulta) {
    return (
      <div className="safe-area-pt safe-area-pb">
        <ReservationLookupPage />
        <PWAInstallBanner />
        <PWAUpdatePrompt />
        <OfflineIndicator />
      </div>
    );
  }

  // Página de inicio (Landing Page)
  return (
    <div className="relative min-h-screen bg-[#1E1E1E] text-[#FFFBF2] overflow-x-hidden selection:bg-[#9B1B30] selection:text-[#FFFBF2] safe-area-pb">
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
      <PWAInstallBanner />
      <PWAUpdatePrompt />
      <OfflineIndicator />
    </div>
  );
}
