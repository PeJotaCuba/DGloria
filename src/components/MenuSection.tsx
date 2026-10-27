/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Eye, X, Utensils, ArrowRight } from 'lucide-react';
import { getFeaturedDishesFromConvex, ConvexDish } from '../lib/convexClient';

export const MenuSection: React.FC = () => {
  const [featuredDishes, setFeaturedDishes] = useState<ConvexDish[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDish, setSelectedDish] = useState<ConvexDish | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchFeatured = async () => {
      try {
        const dishes = await getFeaturedDishesFromConvex();
        if (isMounted) {
          // Convex ya los devuelve filtrados por isPublished: true, isFeatured: true y ordenados por featuredOrder (máx. 3)
          setFeaturedDishes(dishes);
        }
      } catch (err) {
        console.warn('Error al obtener platos destacados de Convex:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchFeatured();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenFullMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.pushState({}, '', '/menu');
    window.dispatchEvent(new Event('popstate'));
  };

  // Si no está cargando y no hay ningún plato destacado configurado, ocultar la sección
  if (!loading && featuredDishes.length === 0) {
    return null;
  }

  return (
    <section id="menu" className="relative py-24 px-6 sm:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#9B1B30] block mb-3">
            Selección de la Casa
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#FFFBF2] mb-6">
            Especialidades Destacadas
          </h2>
          <div className="w-16 h-0.5 bg-[#9B1B30] mx-auto mb-6" />
          <p className="text-base text-[#E9E2D6]/85 font-light leading-relaxed">
            Una muestra selecta de nuestras creaciones insignia en terraza. 
            Platos escogidos cuidadosamente para brindar la mejor experiencia culinaria de Bayamo.
          </p>
        </div>

        {/* Loading State Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="glass-panel-dark rounded-lg overflow-hidden border border-[#E9E2D6]/10 animate-pulse flex flex-col h-[420px]"
              >
                <div className="aspect-[4/3] w-full bg-[#2A2A2A]" />
                <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-3 w-20 bg-[#333] rounded" />
                    <div className="h-5 w-3/4 bg-[#333] rounded" />
                    <div className="h-3 w-full bg-[#333] rounded" />
                    <div className="h-3 w-4/5 bg-[#333] rounded" />
                  </div>
                  <div className="h-3 w-1/3 bg-[#333] rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Featured Dishes Grid (Exact selection from Android in featuredOrder) */}
        {!loading && featuredDishes.length > 0 && (
          <div
            className={`grid gap-8 mb-12 ${
              featuredDishes.length === 1
                ? 'grid-cols-1 max-w-md mx-auto'
                : featuredDishes.length === 2
                ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {featuredDishes.map((dish, index) => {
              const imageSrc = dish.imageUrl || dish.imageId;

              return (
                <div
                  key={dish._id || dish.id}
                  onClick={() => setSelectedDish(dish)}
                  className="group glass-panel-dark rounded-lg overflow-hidden flex flex-col justify-between border border-[#E9E2D6]/15 hover:border-[#9B1B30]/50 transition-all duration-300 cursor-pointer"
                >
                  {/* Dish Image Container */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#1E1E1E]">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={dish.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#9B1B30]/40">
                        <Utensils className="w-12 h-12" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1E1E1E] via-transparent to-transparent opacity-80" />

                    {/* Featured Order Badge */}
                    <div className="absolute top-3 left-3 bg-[#9B1B30] text-[#FFFBF2] text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded shadow-xs">
                      {dish.category}
                    </div>

                    <button
                      type="button"
                      aria-label={`Ver detalles de ${dish.name}`}
                      className="absolute bottom-3 right-3 p-2 bg-[#1E1E1E]/80 hover:bg-[#9B1B30] text-[#FFFBF2] rounded-full backdrop-blur-sm transition-colors opacity-90 group-hover:opacity-100"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Dish Content */}
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Clean unboxed metadata with typographic separator */}
                      <div className="flex items-center gap-2 text-xs text-[#8A8380] mb-2 font-medium">
                        <span>Destacado #{dish.featuredOrder || index + 1}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#E9E2D6]">Selección Doña Gloria</span>
                      </div>

                      <h3 className="font-serif text-xl font-bold text-[#FFFBF2] group-hover:text-[#E9E2D6] transition-colors mb-2">
                        {dish.name}
                      </h3>

                      <p className="text-xs text-[#E9E2D6]/80 font-light leading-relaxed line-clamp-3">
                        {dish.description}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-[#E9E2D6]/10 flex items-center justify-between text-xs text-[#8A8380]">
                      <span>Elaboración artesanal</span>
                      <span className="text-[#9B1B30] font-medium group-hover:underline">
                        Ver detalle →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Action to View Full Menu on /menu */}
        <div className="text-center pt-4">
          <a
            href="/menu"
            onClick={handleOpenFullMenu}
            className="inline-flex items-center gap-2 px-7 py-3.5 text-xs uppercase font-semibold tracking-wider text-[#FFFBF2] bg-[#9B1B30] hover:bg-[#801426] active:bg-[#68101F] rounded shadow-md transition-all duration-200 group"
          >
            <span>Consultar la Carta Completa</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </div>

      {/* Dish Inspection Modal */}
      {selectedDish && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <div className="relative max-w-2xl w-full bg-[#1E1E1E] border border-[#E9E2D6]/20 rounded-lg overflow-hidden shadow-2xl">
            <button
              onClick={() => setSelectedDish(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-[#9B1B30] text-[#FFFBF2] rounded-full transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="aspect-[16/10] w-full overflow-hidden bg-black">
              {selectedDish.imageUrl || selectedDish.imageId ? (
                <img
                  src={selectedDish.imageUrl || selectedDish.imageId}
                  alt={selectedDish.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#9B1B30]/40">
                  <Utensils className="w-16 h-16" />
                </div>
              )}
            </div>

            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#8A8380]">
                <span>{selectedDish.category}</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#9B1B30] font-medium">
                  Destacado #{selectedDish.featuredOrder || 1}
                </span>
              </div>

              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#FFFBF2]">
                {selectedDish.name}
              </h3>

              <p className="text-sm text-[#E9E2D6]/90 font-light leading-relaxed">
                {selectedDish.description}
              </p>

              <div className="pt-4 border-t border-[#E9E2D6]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="text-xs text-[#8A8380]">
                  Disponible para consumo en mesa y terraza.
                </span>
                <div className="flex items-center gap-3">
                  <a
                    href="#reservas"
                    onClick={() => setSelectedDish(null)}
                    className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FFFBF2] bg-[#9B1B30] hover:bg-[#801426] rounded text-center transition-colors"
                  >
                    Reservar Mesa
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
