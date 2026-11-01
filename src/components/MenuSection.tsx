/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Eye, X, Utensils, ArrowRight, Plus, Minus, ShoppingBag, Phone, ChevronRight, Trash2, ArrowLeft } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ConvexDish, formatDishPrice, getOfficialCategoryName, OFFICIAL_CATEGORIES } from '../lib/convexClient';
import { usePersonalOrder } from '../hooks/usePersonalOrder';
import { WHATSAPP_URL_NUMBER } from '../lib/assets';

export const MenuSection: React.FC = () => {
  const [selectedDish, setSelectedDish] = useState<ConvexDish | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showWaiterView, setShowWaiterView] = useState(false);
  
  const { orderItems, updateQuantity, clearOrder, totalUnits, totalPrice } = usePersonalOrder();

  // Consulta reactiva en tiempo real a los platos destacados desde Convex
  const featuredQuery = useQuery(api.menuDishes.getFeaturedDishes);

  const loading = featuredQuery === undefined;
  const featuredDishes = (featuredQuery || []) as ConvexDish[];

  const handleOpenFullMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.pushState({}, '', '/menu');
    window.dispatchEvent(new Event('popstate'));
  };

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedDish(null);
        setZoomedImage(null);
        setShowSummary(false);
        setShowWaiterView(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Si no está cargando y no hay ningún plato destacado configurado o publicado, ocultar la sección
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
                  className="group glass-panel-dark rounded-lg overflow-hidden flex flex-col justify-between border border-[#E9E2D6]/15 hover:border-[#9B1B30]/50 transition-all duration-300"
                >
                  {/* Dish Image Container - CLICK TO ZOOM */}
                  <div 
                    className="relative aspect-[4/3] w-full overflow-hidden bg-[#1E1E1E] cursor-zoom-in"
                    onClick={() => imageSrc && setZoomedImage(imageSrc)}
                  >
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
                      {getOfficialCategoryName(dish.category)}
                    </div>

                    <div className="absolute bottom-3 right-3 p-2 bg-[#1E1E1E]/80 text-[#FFFBF2] rounded-full backdrop-blur-sm opacity-90 group-hover:bg-[#9B1B30] transition-colors">
                      <Eye className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Dish Content - CLICK TO INFO */}
                  <div 
                    className="p-6 flex-1 flex flex-col justify-between cursor-pointer"
                    onClick={() => setSelectedDish(dish)}
                  >
                    <div>
                      {/* Clean unboxed metadata with typographic separator */}
                      <div className="flex items-center gap-2 text-xs text-[#8A8380] mb-2 font-medium">
                        <span>Destacado #{dish.featuredOrder || index + 1}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#E9E2D6]">Selección Doña Gloria</span>
                      </div>

                      <h3 className="font-serif text-xl font-bold text-[#FFFBF2] group-hover:text-[#E9E2D6] transition-colors mb-2 flex flex-wrap items-baseline gap-x-2">
                        <span>{dish.name}</span>
                        {dish.portion && (
                          <span className="text-xs font-sans font-normal text-[#8A8380] lowercase italic">
                            ({dish.portion})
                          </span>
                        )}
                      </h3>

                      <p className="text-xs text-[#E9E2D6]/80 font-light leading-relaxed line-clamp-3">
                        {dish.description}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-[#E9E2D6]/10 flex items-center justify-between text-xs">
                      <span className="text-[#8A8380] italic">Elaboración artesanal</span>
                      {formatDishPrice(dish) && (
                        <span className="font-serif font-bold text-[#E3B87C] text-sm tracking-wide bg-[#1E1E1E] px-2.5 py-1 rounded border border-[#E3B87C]/30">
                          {formatDishPrice(dish)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="px-6 pb-6 pt-0 mt-auto">
                    {orderItems.find(item => item._id === dish._id) ? (
                      <div className="flex items-center justify-between bg-[#1E1E1E] border border-white/10 rounded-lg p-1 animate-in zoom-in-95 duration-200">
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateQuantity(dish, -1); }}
                          className="w-10 h-10 flex items-center justify-center text-[#FFFBF2] hover:text-[#9B1B30] transition-colors"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-mono text-sm font-bold text-[#FFFBF2] px-4">
                          {orderItems.find(item => item._id === dish._id)?.quantity} <span className="text-[10px] text-[#8A8380] uppercase ml-1">und</span>
                        </span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateQuantity(dish, 1); }}
                          className="w-10 h-10 flex items-center justify-center text-[#FFFBF2] hover:text-[#9B1B30] transition-colors"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); updateQuantity(dish, 1); }}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-[#1E1E1E]/50 hover:bg-[#9B1B30] text-[#E9E2D6] hover:text-[#FFFBF2] border border-white/5 hover:border-[#9B1B30] rounded-lg transition-all text-[10px] font-semibold uppercase tracking-widest group/btn"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar al Pedido</span>
                      </button>
                    )}
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

      {/* Informative Sheet Modal */}
      {selectedDish && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setSelectedDish(null)}
        >
          <div 
            className="relative max-w-2xl w-full bg-[#1E1E1E] border border-[#E9E2D6]/20 rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
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

            <div className="p-6 sm:p-8 space-y-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#9B1B30] uppercase">
                  <span>{getOfficialCategoryName(selectedDish.category)}</span>
                  <span aria-hidden="true" className="text-[#8A8380]">·</span>
                  <span className="text-[#8A8380] font-normal">Destacado #{selectedDish.featuredOrder || 1}</span>
                </div>

                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#FFFBF2] leading-tight">
                  {selectedDish.name}
                </h3>
              </div>

              <div className="flex items-baseline gap-4">
                {formatDishPrice(selectedDish) && (
                  <span className="font-serif text-3xl font-bold text-[#E3B87C] tracking-tight">
                    {formatDishPrice(selectedDish)}
                  </span>
                )}
                {selectedDish.portion && (
                  <span className="text-sm font-sans text-[#8A8380] italic bg-white/5 px-2.5 py-1 rounded">
                    Gramaje/Volumen: {selectedDish.portion}
                  </span>
                )}
              </div>

              <p className="text-sm sm:text-base text-[#E9E2D6]/90 font-light leading-relaxed">
                {selectedDish.description}
              </p>

              <div className="pt-4 border-t border-[#E9E2D6]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#8A8380] uppercase tracking-widest font-semibold">Estado</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-[#E9E2D6]">Disponible para consumo en mesa</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Modal Quantity Controls */}
                  {orderItems.find(item => item._id === selectedDish._id) ? (
                    <div className="flex items-center bg-black/40 rounded-xl p-1 border border-white/10 shadow-lg">
                      <button 
                        onClick={() => updateQuantity(selectedDish, -1)}
                        className="w-10 h-10 flex items-center justify-center text-[#FFFBF2] hover:text-[#9B1B30] transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-mono text-sm font-bold text-[#FFFBF2] px-4 min-w-[3rem] text-center">
                        {orderItems.find(item => item._id === selectedDish._id)?.quantity}
                      </span>
                      <button 
                        onClick={() => updateQuantity(selectedDish, 1)}
                        className="w-10 h-10 flex items-center justify-center text-[#FFFBF2] hover:text-[#9B1B30] transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => updateQuantity(selectedDish, 1)}
                      className="flex items-center gap-2 px-6 py-3 bg-[#9B1B30] hover:bg-[#801426] text-[#FFFBF2] rounded-xl transition-all text-xs font-bold uppercase tracking-wider"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar al Pedido</span>
                    </button>
                  )}

                  <a
                    href="/menu"
                    onClick={handleOpenFullMenu}
                    className="p-3 text-[#E3B87C] hover:bg-[#E3B87C] hover:text-[#1E1E1E] border border-[#E3B87C]/30 rounded-xl transition-all"
                    title="Ver carta completa"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-4 md:p-8 animate-in fade-in duration-300"
          onClick={() => setZoomedImage(null)}
        >
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-6 right-6 z-10 p-2 bg-white/10 hover:bg-[#9B1B30] text-[#FFFBF2] rounded-full backdrop-blur-md transition-colors"
            aria-label="Cerrar ampliación"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={zoomedImage}
            alt="Ampliación de plato"
            className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Detailed Order Modals Consistency */}
      {showSummary && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300"
          onClick={() => setShowSummary(false)}
        >
           <div 
             className="bg-[#FFFBF2] text-[#1E1E1E] w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#EADFCB]"
             onClick={e => e.stopPropagation()}
           >
              <div className="p-6 border-b border-[#EADFCB] flex items-center justify-between bg-white/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#9B1B30]/10 rounded-lg text-[#9B1B30]">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold">Revisar Pedido</h3>
                    <p className="text-[10px] text-[#8A8380] uppercase tracking-widest font-bold">Edita cantidades y confirma tu selección</p>
                  </div>
                </div>
                <button onClick={() => setShowSummary(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors text-[#8A8380]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 bg-[#FFFBF2]">
                {orderItems.length === 0 ? (
                  <div className="text-center py-20">
                    <ShoppingBag className="w-16 h-16 text-[#EADFCB] mx-auto mb-4 opacity-50" />
                    <p className="text-[#8A8380] font-medium">Aún no has agregado nada al pedido.</p>
                  </div>
                ) : (
                  OFFICIAL_CATEGORIES.filter(cat => orderItems.some(i => i.category.trim().toLowerCase() === cat.trim().toLowerCase())).map(category => (
                    <div key={category} className="space-y-4">
                      <h4 className="text-[11px] font-bold tracking-[0.25em] text-[#9B1B30] uppercase border-b border-[#EADFCB] pb-1.5 opacity-80">{category}</h4>
                      <div className="space-y-3">
                        {orderItems.filter(i => i.category.trim().toLowerCase() === category.trim().toLowerCase()).map(item => {
                          const unitPrice = typeof item.priceCup === 'number' ? item.priceCup : 0;
                          const lineTotal = unitPrice * item.quantity;
                          
                          return (
                            <div key={item._id} className="flex items-center gap-4 bg-white/40 p-3 rounded-xl border border-[#EADFCB]/40 hover:border-[#EADFCB] transition-all group">
                               <div className="flex items-center gap-4 flex-1 min-w-0">
                                 <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-[#EFE6D5] overflow-hidden shrink-0 border border-[#EADFCB]/60 shadow-sm">
                                   {item.imageUrl || item.imageId ? (
                                     <img src={item.imageUrl || item.imageId} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.name} />
                                   ) : (
                                     <div className="w-full h-full flex items-center justify-center text-[#9B1B30]/30">
                                       <Utensils className="w-8 h-8" />
                                     </div>
                                   )}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                   <p className="font-serif font-bold text-base sm:text-lg leading-tight text-[#1E1E1E] truncate">{item.name}</p>
                                   {item.portion && (
                                     <p className="text-[10px] sm:text-xs text-[#8A8380] italic mt-0.5">{item.portion}</p>
                                   )}
                                   <p className="text-[10px] sm:text-xs font-mono font-medium text-[#9B1B30] mt-1.5 bg-[#9B1B30]/5 inline-block px-2 py-0.5 rounded uppercase tracking-wide">
                                     Unit: ${unitPrice.toLocaleString()} CUP
                                   </p>
                                 </div>
                               </div>
                               <div className="flex flex-col items-end gap-3 shrink-0">
                                 <div className="flex items-center bg-[#1E1E1E] rounded-lg p-0.5 shadow-sm">
                                   <button onClick={() => updateQuantity(item, -1)} className="p-1.5 text-white hover:text-[#9B1B30] transition-colors"><Minus className="w-4 h-4" /></button>
                                   <span className="px-3 font-mono font-bold text-white text-sm min-w-[2.5rem] text-center">{item.quantity}</span>
                                   <button onClick={() => updateQuantity(item, 1)} className="p-1.5 text-white hover:text-[#9B1B30] transition-colors"><Plus className="w-4 h-4" /></button>
                                 </div>
                                 <div className="text-right">
                                   <p className="font-mono text-base sm:text-lg font-bold text-[#1E1E1E] leading-none">${lineTotal.toLocaleString()}</p>
                                   <button onClick={() => updateQuantity(item, -item.quantity)} className="text-[9px] uppercase font-black text-[#8A8380] hover:text-red-600 flex items-center gap-1 mt-1.5 transition-colors tracking-tighter">
                                     <Trash2 className="w-3 h-3" />
                                     <span>Quitar</span>
                                   </button>
                                 </div>
                               </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {orderItems.length > 0 && (
                <div className="p-6 bg-white border-t border-[#EADFCB]">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[#8A8380] font-black">Total Estimado</span>
                      <p className="text-[10px] text-[#8A8380] mt-0.5 uppercase tracking-wide font-medium">{totalUnits} platos seleccionados</p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-3xl font-bold text-[#1E1E1E] leading-none tracking-tighter">${totalPrice.toLocaleString()} <span className="text-xs font-sans text-[#9B1B30]">CUP</span></p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={clearOrder} className="flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8380] border border-[#EADFCB] rounded-xl">Limpiar</button>
                    <button onClick={() => { setShowSummary(false); setShowWaiterView(true); }} className="flex-[3] py-4 bg-[#9B1B30] text-[#FFFBF2] rounded-xl text-xs font-bold uppercase tracking-[0.2em]">Presentar Pedido</button>
                  </div>
                </div>
              )}
           </div>
        </div>
      )}

      {showWaiterView && (
        <div className="fixed inset-0 z-[70] bg-[#1E1E1E] flex flex-col animate-in fade-in duration-300 overflow-hidden">
           <header className="p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/40 backdrop-blur-sm">
             <button onClick={() => setShowWaiterView(false)} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[#8A8380]"><ArrowLeft className="w-4 h-4" /><span>Regresar</span></button>
             <div className="text-center">
               <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#FFFBF2]">Resumen del Pedido</h3>
               <p className="text-[10px] text-[#E3B87C] uppercase tracking-[0.2em] font-bold mt-0.5">Presenta esta pantalla al dependiente</p>
             </div>
             <div className="w-20 hidden sm:block" />
           </header>

           <div className="flex-1 overflow-y-auto p-4 sm:p-10">
              <div className="max-w-3xl mx-auto space-y-12 pb-24">
                 {OFFICIAL_CATEGORIES.filter(cat => orderItems.some(i => i.category.trim().toLowerCase() === cat.trim().toLowerCase())).map(category => (
                    <div key={category} className="space-y-6">
                       <h4 className="text-[11px] font-bold tracking-[0.3em] text-[#9B1B30] uppercase border-l-4 border-[#9B1B30] pl-4">{category}</h4>
                       <div className="grid grid-cols-1 gap-4">
                          {orderItems.filter(i => i.category.trim().toLowerCase() === category.trim().toLowerCase()).map(item => {
                            const unitPrice = typeof item.priceCup === 'number' ? item.priceCup : 0;
                            const lineTotal = unitPrice * item.quantity;
                            return (
                               <div key={item._id} className="bg-white/5 rounded-2xl p-4 sm:p-5 flex items-center gap-5 border border-white/10">
                                  <div className="flex items-center gap-5 flex-1 min-w-0">
                                     <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-black/40 overflow-hidden shrink-0 border border-white/5">
                                        {item.imageUrl || item.imageId ? <img src={item.imageUrl || item.imageId} className="w-full h-full object-cover opacity-90" alt={item.name} /> : <div className="w-full h-full flex items-center justify-center text-white/10"><Utensils className="w-10 h-10" /></div>}
                                     </div>
                                     <div className="flex-1 min-w-0">
                                        <h5 className="font-serif font-bold text-lg sm:text-2xl text-white leading-tight truncate">{item.name}</h5>
                                        {item.portion && <p className="text-[11px] sm:text-xs text-[#8A8380] uppercase tracking-wider mt-1 font-medium">{item.portion}</p>}
                                        <p className="text-[10px] sm:text-xs font-mono font-semibold text-[#E3B87C] mt-2 inline-flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full"><span>Precio:</span><span className="text-white">${unitPrice.toLocaleString()} CUP</span></p>
                                     </div>
                                  </div>
                                  <div className="text-right shrink-0 border-l border-white/10 pl-6 ml-1">
                                     <div className="flex flex-col items-end">
                                        <div className="flex items-baseline gap-1.5 mb-1"><span className="text-[#8A8380] text-xs font-bold uppercase tracking-widest">Cant.</span><span className="text-4xl sm:text-5xl font-serif font-black text-[#9B1B30]">{item.quantity}</span></div>
                                        <p className="font-mono text-lg sm:text-2xl font-bold text-white tracking-tighter">${lineTotal.toLocaleString()}</p>
                                     </div>
                                  </div>
                               </div>
                            );
                          })}
                       </div>
                    </div>
                 ))}
                 <div className="pt-16 border-t border-white/10 mt-12 text-center">
                    <p className="text-[#8A8380] text-[10px] uppercase tracking-[0.3em] font-black mb-4">Importe Total del Pedido</p>
                    <div className="inline-block bg-[#9B1B30] rounded-[2.5rem] px-12 py-10 shadow-2xl border border-white/10">
                       <p className="font-serif text-6xl sm:text-7xl font-black text-white leading-none tracking-tighter">${totalPrice.toLocaleString()}</p>
                       <p className="text-sm sm:text-base font-sans font-bold text-[#E3B87C] mt-4 uppercase tracking-[0.25em]">Pesos Cubanos (CUP)</p>
                    </div>
                 </div>
              </div>
           </div>

           <footer className="p-6 bg-black/60 border-t border-white/10 backdrop-blur-md shrink-0 flex items-center justify-center gap-4">
             <button onClick={() => setShowWaiterView(false)} className="flex-1 max-w-sm py-4.5 bg-white/5 text-white border border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em]">Regresar</button>
             <button onClick={() => { clearOrder(); setShowWaiterView(false); }} className="flex-1 max-w-sm py-4.5 bg-white text-[#1E1E1E] rounded-2xl text-[10px] font-black uppercase tracking-[0.2em]">Finalizar</button>
           </footer>
        </div>
      )}

      {/* Floating Order Bar Consistency */}
      {totalUnits > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl animate-in slide-in-from-bottom-8 duration-500">
          <div className="bg-[#1E1E1E] text-[#FFFBF2] rounded-2xl shadow-2xl border border-white/10 p-4 flex items-center justify-between overflow-hidden relative">
             <div className="absolute top-0 left-0 w-1 h-full bg-[#9B1B30]" />
             
             <div className="flex items-center gap-4 ml-2">
               <div className="relative">
                 <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                   <ShoppingBag className="w-5 h-5 text-[#E3B87C]" />
                 </div>
                 <span className="absolute -top-1.5 -right-1.5 bg-[#9B1B30] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#1E1E1E]">
                   {totalUnits}
                 </span>
               </div>
               <div>
                 <p className="text-[10px] uppercase tracking-widest text-[#8A8380] font-bold">Importe Estimado</p>
                 <p className="font-serif text-xl font-bold">${totalPrice.toLocaleString()} <span className="text-[10px] font-sans">CUP</span></p>
               </div>
             </div>

             <div className="flex gap-2">
               <button 
                 onClick={() => setShowSummary(true)}
                 className="px-6 py-3 bg-[#2A2A2A] hover:bg-[#333333] text-[#FFFBF2] rounded-xl transition-all text-xs font-bold uppercase tracking-wider border border-white/5"
               >
                 Revisar
               </button>
               <button 
                 onClick={() => setShowWaiterView(true)}
                 className="px-6 py-3 bg-[#9B1B30] hover:bg-[#801426] text-[#FFFBF2] rounded-xl transition-all text-xs font-bold uppercase tracking-wider shadow-lg shadow-[#9B1B30]/20"
               >
                 Presentar
               </button>
             </div>
          </div>
        </div>
      )}
    </section>
  );
};
