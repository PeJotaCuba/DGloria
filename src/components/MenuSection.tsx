/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ASSETS, DishItem } from '../lib/assets';
import { Eye, X } from 'lucide-react';

export const MenuSection: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [selectedDish, setSelectedDish] = useState<DishItem | null>(null);

  const categories = [
    { id: 'todos', label: 'Todas las Especialidades' },
    { id: 'Especialidades de Terraza', label: 'Especialidades de Terraza' },
    { id: 'Platos Fuertes', label: 'Platos Fuertes' },
    { id: 'Entrantes & Coctelería', label: 'Entrantes & Coctelería' },
  ];

  const filteredDishes =
    activeCategory === 'todos'
      ? ASSETS.dishes
      : ASSETS.dishes.filter((dish) => dish.category === activeCategory);

  return (
    <section id="menu" className="relative py-24 px-6 sm:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#9B1B30] block mb-3">
            Carta & Gastronomía
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#FFFBF2] mb-6">
            Catálogo de Consulta
          </h2>
          <div className="w-16 h-0.5 bg-[#9B1B30] mx-auto mb-6" />
          <p className="text-base text-[#E9E2D6]/85 font-light leading-relaxed">
            Una muestra representativa de nuestras preparaciones insignia. Cada plato refleja
            el esmero en la cocina y la autenticidad que caracteriza a Doña Gloria Bar-Terraza.
          </p>
        </div>

        {/* Functional Filter Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-4 py-2 text-xs font-medium uppercase tracking-wider rounded transition-all whitespace-nowrap shrink-0 ${
                activeCategory === category.id
                  ? 'bg-[#9B1B30] text-[#FFFBF2] shadow'
                  : 'bg-[#1E1E1E]/80 text-[#E9E2D6]/70 hover:text-[#FFFBF2] hover:bg-[#1E1E1E] border border-[#E9E2D6]/10'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* Catalog Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredDishes.map((dish) => (
            <div
              key={dish.id}
              onClick={() => setSelectedDish(dish)}
              className="group glass-panel-dark rounded-lg overflow-hidden flex flex-col justify-between border border-[#E9E2D6]/15 hover:border-[#9B1B30]/50 transition-all duration-300 cursor-pointer"
            >
              {/* Dish Image Container */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#1E1E1E]">
                <img
                  src={dish.image}
                  alt={dish.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1E1E1E] via-transparent to-transparent opacity-80" />
                <button
                  type="button"
                  aria-label={`Ver detalles de ${dish.title}`}
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
                    <span>{dish.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#E9E2D6]">{dish.tag}</span>
                  </div>

                  <h3 className="font-serif text-xl font-bold text-[#FFFBF2] group-hover:text-[#E9E2D6] transition-colors mb-2">
                    {dish.title}
                  </h3>

                  <p className="text-xs text-[#8A8380] italic mb-3">
                    {dish.subtitle}
                  </p>

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
          ))}
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
              <img
                src={selectedDish.image}
                alt={selectedDish.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#8A8380]">
                <span>{selectedDish.category}</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#9B1B30] font-medium">{selectedDish.tag}</span>
              </div>

              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#FFFBF2]">
                {selectedDish.title}
              </h3>

              <p className="text-sm text-[#8A8380] italic">
                {selectedDish.subtitle}
              </p>

              <p className="text-sm text-[#E9E2D6]/90 font-light leading-relaxed">
                {selectedDish.description}
              </p>

              <div className="pt-4 border-t border-[#E9E2D6]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="text-xs text-[#8A8380]">
                  Disponible para consumo en mesa y terraza.
                </span>
                <a
                  href="#reservas"
                  onClick={() => setSelectedDish(null)}
                  className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FFFBF2] bg-[#9B1B30] hover:bg-[#801426] rounded text-center transition-colors"
                >
                  Reservar para Probarlo
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
