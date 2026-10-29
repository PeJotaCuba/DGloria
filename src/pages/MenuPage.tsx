import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Utensils, Phone, Clock, MapPin, Sparkles } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ConvexDish, formatDishPrice } from '../lib/convexClient';
import { ASSETS, BUSINESS_INFO, WHATSAPP_URL_NUMBER } from '../lib/assets';
import { formatGroupedScheduleSummary } from '../utils/schedule';

export const MenuPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Consulta reactiva en tiempo real a los platos publicados desde Convex
  const publishedDishesQuery = useQuery(api.menuDishes.getPublishedDishes, {});
  const openingHours = useQuery(api.shift.getPublicOpeningHours, {});
  const scheduleSummaryText = formatGroupedScheduleSummary(openingHours?.weeklySchedule, openingHours?.openDaysSummary);

  useEffect(() => {
    // Desplazar al inicio al cargar la página
    window.scrollTo(0, 0);
  }, []);

  const loading = publishedDishesQuery === undefined;
  const dishes = (publishedDishesQuery || []) as ConvexDish[];

  // Filtrar por categoría seleccionada de forma segura y consistente
  const filteredDishes = selectedCategory === 'all'
    ? dishes
    : dishes.filter(
        (d) => d.category && d.category.trim().toLowerCase() === selectedCategory.trim().toLowerCase()
      );

  const handleGoHome = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new Event('popstate'));
  };

  return (
    <div className="min-h-screen bg-[#FFFBF2] text-[#1E1E1E] font-sans flex flex-col selection:bg-[#9B1B30] selection:text-[#FFFBF2]">
      {/* Top Header & Branding Bar */}
      <header className="sticky top-0 z-40 bg-[#1E1E1E]/95 backdrop-blur-md border-b border-[#333333] transition-shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs uppercase tracking-wider font-medium text-[#FFFBF2] hover:text-[#E3B87C] bg-[#2A2A2A] hover:bg-[#333333] border border-[#444] rounded transition-all duration-200"
            title="Volver a la portada principal"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver a Inicio</span>
            <span className="sm:hidden">Inicio</span>
          </button>

          <div className="flex items-center gap-3 text-center">
            <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-[#1E1E1E] border border-[#E3B87C]/40 flex items-center justify-center p-1 shadow-md">
              <img
                src={ASSETS.logoTransparent}
                alt="Logo Doña Gloria"
                className="w-full h-full object-contain scale-110"
              />
            </div>
            <div className="text-left hidden xs:block">
              <span className="block font-serif text-base sm:text-lg font-bold text-[#FFFBF2] leading-tight tracking-tight">
                Doña Gloria
              </span>
              <span className="block text-[10px] uppercase tracking-widest text-[#E3B87C] font-semibold">
                Bar — Terraza
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Hero Banner section for Menu */}
      <section className="relative bg-[#1E1E1E] text-[#FFFBF2] py-14 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#9B1B30]/20 via-transparent to-[#1E1E1E] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#9B1B30]/30 border border-[#9B1B30]/50 text-[#FFFBF2] text-xs font-semibold tracking-wider uppercase">
            <Utensils className="w-3.5 h-3.5 text-[#E3B87C]" />
            <span>Carta Oficial & Especialidades</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-[#FFFBF2]">
            Nuestra Carta Digital
          </h1>

          <p className="text-sm sm:text-base text-[#E9E2D6]/80 max-w-2xl mx-auto font-light leading-relaxed">
            Descubre las creaciones culinarias de nuestra cocina y coctelería de autor. 
            Preparadas al momento en la terraza gastronómica de Bayamo.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-6 text-xs text-[#E9E2D6]/70">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#9B1B30]" />
              <span>{BUSINESS_INFO.address}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#9B1B30]" />
              <span>{scheduleSummaryText}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Category Filter Tabs (Dynamic from Convex) */}
      <section className="bg-[#F7F0E3] border-b border-[#EADFCB] sticky top-[65px] z-30 shadow-xs">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 text-xs uppercase font-semibold tracking-wider rounded-md transition-all duration-200 ${
              selectedCategory === 'all'
                ? 'bg-[#9B1B30] text-[#FFFBF2] shadow-sm'
                : 'bg-[#FFFBF2]/70 text-[#5A5350] hover:text-[#1E1E1E] hover:bg-[#FFFBF2] border border-[#E5DAC6]'
            }`}
          >
            Todas ({dishes.length})
          </button>

          {Array.from(new Set(dishes.map((d) => d.category).filter(Boolean))).map((cat) => {
            const count = dishes.filter((d) => d.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 text-xs uppercase font-semibold tracking-wider rounded-md transition-all duration-200 ${
                  selectedCategory === cat
                    ? 'bg-[#9B1B30] text-[#FFFBF2] shadow-sm'
                    : 'bg-[#FFFBF2]/70 text-[#5A5350] hover:text-[#1E1E1E] hover:bg-[#FFFBF2] border border-[#E5DAC6]'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Loading State Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="bg-[#FFFBF2] border border-[#E8DEC9] rounded-lg overflow-hidden shadow-xs animate-pulse flex flex-col h-full"
              >
                <div className="h-56 bg-[#EFE6D5]" />
                <div className="p-6 space-y-3 flex-1">
                  <div className="h-4 w-24 bg-[#EFE6D5] rounded" />
                  <div className="h-6 w-3/4 bg-[#EFE6D5] rounded" />
                  <div className="h-4 w-full bg-[#EFE6D5] rounded" />
                  <div className="h-4 w-5/6 bg-[#EFE6D5] rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredDishes.length === 0 && (
          <div className="max-w-md mx-auto text-center py-16 px-6 bg-[#F7F0E3] border border-[#EADFCB] rounded-lg shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#9B1B30]/10 flex items-center justify-center mx-auto text-[#9B1B30]">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-bold text-[#1E1E1E]">
              La carta se encuentra en actualización
            </h3>
            <p className="text-xs text-[#6A6360] leading-relaxed">
              En este momento no hay platos disponibles en esta categoría. 
              Consulta directamente con nuestro equipo de atención por WhatsApp para conocer la disponibilidad de hoy.
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_URL_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FFFBF2] bg-[#9B1B30] hover:bg-[#801426] rounded transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Consultar Disponibilidad</span>
            </a>
          </div>
        )}

        {/* Dishes Grid */}
        {!loading && filteredDishes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredDishes.map((dish) => (
              <article
                key={dish._id || dish.id}
                className="group bg-[#FFFBF2] border border-[#EADFCB] hover:border-[#9B1B30]/40 rounded-lg overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col h-full"
              >
                {/* Photo container */}
                <div className="relative h-60 w-full overflow-hidden bg-[#EFE6D5]">
                  {dish.imageUrl || dish.imageId ? (
                    <img
                      src={dish.imageUrl || dish.imageId}
                      alt={dish.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#9B1B30]/40">
                      <Utensils className="w-12 h-12" />
                    </div>
                  )}

                  {/* Category Tag */}
                  <div className="absolute top-3 left-3 bg-[#9B1B30] text-[#FFFBF2] text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded shadow-xs">
                    {dish.category}
                  </div>

                  {/* Featured Badge */}
                  {dish.isFeatured && (
                    <div className="absolute top-3 right-3 bg-[#1E1E1E]/90 text-[#E3B87C] border border-[#E3B87C]/40 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded shadow-xs flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Destacado</span>
                    </div>
                  )}
                </div>

                {/* Content info */}
                <div className="p-6 flex flex-col flex-1 justify-between space-y-4">
                  <div className="space-y-2">
                    <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1E1E1E] leading-snug group-hover:text-[#9B1B30] transition-colors">
                      {dish.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#5A5350] leading-relaxed line-clamp-4">
                      {dish.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#EADFCB]/60 flex items-center justify-between text-xs">
                    <span className="italic font-serif text-[#8A8380]">Doña Gloria Terraza</span>
                    {formatDishPrice(dish) && (
                      <span className="font-serif font-bold text-[#9B1B30] text-sm tracking-wide bg-[#F7F0E3] px-2.5 py-1 rounded border border-[#9B1B30]/20">
                        {formatDishPrice(dish)}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#1E1E1E] text-[#FFFBF2] border-t border-[#333333] mt-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[#8A8380]">
          <div className="flex items-center gap-3">
            <img
              src={ASSETS.logoTransparent}
              alt="Doña Gloria"
              className="h-8 w-auto object-contain opacity-90"
            />
            <div>
              <span className="block font-serif text-sm font-bold text-[#FFFBF2]">
                Doña Gloria Bar-Terraza
              </span>
              <span>{BUSINESS_INFO.fullAddress}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[#8A8380]">
              Desarrollado por
            </span>
            <img
              src={ASSETS.nectysLogo}
              alt="Nectys"
              className="h-6 w-auto object-contain"
            />
          </div>
        </div>
      </footer>
    </div>
  );
};
