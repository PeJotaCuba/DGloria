import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Utensils, Phone, Clock, MapPin, Sparkles, Sun, Moon, X, Plus, Minus, ShoppingBag, Trash2, CheckCircle, ChevronRight, LayoutGrid, Eye, FileText } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ConvexDish, formatDishPrice, OFFICIAL_CATEGORIES, getOfficialCategoryName } from '../lib/convexClient';
import { ASSETS, BUSINESS_INFO, WHATSAPP_URL_NUMBER } from '../lib/assets';
import { groupWeeklyScheduleStrict, isNightTime } from '../utils/schedule';
import { usePersonalOrder } from '../hooks/usePersonalOrder';
import { PersonalOrderModal } from '../components/PersonalOrderModal';

export const MenuPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDish, setSelectedDish] = useState<ConvexDish | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showWaiterView, setShowWaiterView] = useState(false);

  const {
    orderItems,
    presentedOrder,
    updateQuantity,
    clearOrder,
    presentOrder,
    closePresentedOrder,
    totalUnits,
    totalPrice,
  } = usePersonalOrder();

  // Consulta reactiva en tiempo real a los platos publicados desde Convex
  const publishedDishesQuery = useQuery(api.menuDishes.getPublishedDishes, {});
  const openingHours = useQuery(api.shift.getPublicOpeningHours, {});
  const groupedSchedule = groupWeeklyScheduleStrict(openingHours?.weeklySchedule || []);

  useEffect(() => {
    // Desplazar al inicio al cargar la página
    window.scrollTo(0, 0);

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

  // Obtener las categorías que realmente tienen platos, pero respetando el orden oficial
  const availableCategories = OFFICIAL_CATEGORIES.filter(cat => 
    dishes.some(d => d.category && d.category.trim().toLowerCase() === cat.trim().toLowerCase())
  );

  // Seleccionados en la categoría actual
  const categoryOrderItems = useMemo(() => {
    if (selectedCategory === 'all') return [];
    return orderItems.filter(item => 
      item.category.trim().toLowerCase() === selectedCategory.trim().toLowerCase()
    );
  }, [orderItems, selectedCategory]);

  const categoryTotal = useMemo(() => {
    return categoryOrderItems.reduce((acc, item) => {
      const price = typeof item.priceCup === 'number' ? item.priceCup : 0;
      return acc + (price * item.quantity);
    }, 0);
  }, [categoryOrderItems]);

  return (
    <div className="min-h-screen bg-[#FFFBF2] text-[#1E1E1E] font-sans flex flex-col selection:bg-[#9B1B30] selection:text-[#FFFBF2] pb-24">
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

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-6 text-xs text-[#E9E2D6]/80">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#9B1B30]" />
              <span>{BUSINESS_INFO.address}</span>
            </div>
            {groupedSchedule.length > 0 && (
              <div className="flex flex-col gap-3 max-w-sm mx-auto w-full">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-[#E3B87C]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E3B87C]">Horarios de Hoy y Excepciones</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {groupedSchedule.filter(group => group.enabled).map((group, idx) => (
                    <div key={idx} className="bg-[#2A2A2A]/40 border border-white/5 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                        <span className="text-[10px] font-bold text-[#FFFBF2] uppercase tracking-wider">
                          {group.dayRangeLabel}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                        {group.enabled && group.sessions.length > 0 ? (
                          group.sessions.map((session, sIdx) => {
                            const isNight = isNightTime(session.openTime);
                            const Icon = isNight ? Moon : Sun;
                            return (
                              <div key={sIdx} className="flex items-center gap-2 text-[11px] font-mono bg-black/20 py-1.5 px-2 rounded-lg">
                                <Icon className={`w-3 h-3 shrink-0 ${isNight ? 'text-blue-300' : 'text-amber-400'}`} />
                                <span className="text-[#E9E2D6]">{session.openTimeFormatted} – {session.closeTimeFormatted}</span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="col-span-2 text-center py-1">
                            <span className="text-[10px] text-[#8A8380] italic">
                              {group.closedReason || 'Cerrado'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Category Filter Tabs (Dynamic from Convex but following official order) */}
      <section className="bg-[#F7F0E3] border-b border-[#EADFCB] sticky top-[65px] z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-center gap-2">
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

          {availableCategories.map((cat) => {
            const count = dishes.filter((d) => d.category && d.category.trim().toLowerCase() === cat.trim().toLowerCase()).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 text-xs uppercase font-semibold tracking-wider rounded-md transition-all duration-200 ${
                  selectedCategory.trim().toLowerCase() === cat.trim().toLowerCase()
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
            {filteredDishes.map((dish) => {
              const currentQuantity = orderItems.find(item => item._id === dish._id)?.quantity || 0;

              return (
                <article
                  key={dish._id || dish.id}
                  className="group bg-[#FFFBF2] border border-[#EADFCB] hover:border-[#9B1B30]/40 rounded-lg overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col h-full relative"
                >
                  {/* Photo container - CLICK TO ZOOM */}
                  <div 
                    className="relative h-60 w-full overflow-hidden bg-[#EFE6D5] cursor-zoom-in"
                    onClick={() => (dish.imageUrl || dish.imageId) && setZoomedImage(dish.imageUrl || dish.imageId!)}
                  >
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
                      {getOfficialCategoryName(dish.category)}
                    </div>

                    {/* Featured Badge */}
                    {dish.isFeatured && (
                      <div className="absolute top-3 right-3 bg-[#1E1E1E]/90 text-[#E3B87C] border border-[#E3B87C]/40 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded shadow-xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Destacado</span>
                      </div>
                    )}
                  </div>

                  {/* Content info - CLICK TO MODAL */}
                  <div 
                    className="p-6 flex flex-col flex-1 justify-between space-y-4 cursor-pointer"
                    onClick={() => setSelectedDish(dish)}
                  >
                    <div className="space-y-2">
                      <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1E1E1E] leading-snug group-hover:text-[#9B1B30] transition-colors flex flex-wrap items-baseline gap-x-2">
                        <span>{dish.name}</span>
                        {dish.portion && (
                          <span className="text-xs sm:text-sm font-sans font-normal text-[#8A8380] lowercase italic">
                            ({dish.portion})
                          </span>
                        )}
                      </h2>
                      <p className="text-xs sm:text-sm text-[#5A5350] leading-relaxed line-clamp-3">
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

                  {/* Quantity Controls */}
                  <div className="px-6 pb-6 pt-0 mt-auto">
                    {currentQuantity > 0 ? (
                      <div className="flex items-center justify-between bg-[#1E1E1E] rounded-lg p-1 animate-in zoom-in-95 duration-200">
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateQuantity(dish, -1); }}
                          className="w-10 h-10 flex items-center justify-center text-[#FFFBF2] hover:text-[#9B1B30] transition-colors"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-mono text-sm font-bold text-[#FFFBF2] px-4">
                          {currentQuantity} <span className="text-[10px] text-[#8A8380] uppercase ml-1">und</span>
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
                        className="w-full flex items-center justify-center gap-2 py-3 bg-[#E9E2D6]/40 hover:bg-[#9B1B30] text-[#5A5350] hover:text-[#FFFBF2] border border-transparent hover:border-[#9B1B30] rounded-lg transition-all text-xs font-semibold uppercase tracking-wider group"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar al Pedido</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Category Summary */}
        {!loading && selectedCategory !== 'all' && categoryOrderItems.length > 0 && (
          <div className="mt-16 bg-[#F7F0E3] border border-[#EADFCB] rounded-xl p-6 sm:p-8 max-w-2xl mx-auto shadow-sm animate-in fade-in slide-in-from-bottom-4">
             <div className="flex items-center gap-3 mb-4">
               <div className="p-2 bg-[#9B1B30]/10 rounded-lg text-[#9B1B30]">
                 <LayoutGrid className="w-5 h-5" />
               </div>
               <h3 className="font-serif text-lg font-bold text-[#1E1E1E]">
                 Seleccionado en {getOfficialCategoryName(selectedCategory)}
               </h3>
             </div>
             <div className="space-y-3">
               {categoryOrderItems.map(item => (
                 <div key={item._id} className="flex items-center justify-between text-sm py-1 border-b border-[#EADFCB]/50 last:border-0">
                   <div className="flex items-baseline gap-2">
                     <span className="font-bold text-[#9B1B30]">{item.quantity}×</span>
                     <span className="font-medium">{item.name}</span>
                   </div>
                   <span className="text-[#8A8380] font-mono">${((typeof item.priceCup === 'number' ? item.priceCup : 0) * item.quantity).toLocaleString()}</span>
                 </div>
               ))}
             </div>
             <div className="pt-4 mt-2 border-t border-[#EADFCB] flex justify-between items-center">
               <span className="text-xs uppercase tracking-widest text-[#8A8380] font-bold">Subtotal Categoría</span>
               <span className="font-serif text-xl font-bold text-[#1E1E1E]">${categoryTotal.toLocaleString()} CUP</span>
             </div>
             <button 
               onClick={() => setShowSummary(true)}
               className="w-full mt-6 flex items-center justify-center gap-2 py-3 bg-[#1E1E1E] hover:bg-[#9B1B30] text-[#FFFBF2] rounded-lg transition-colors text-xs font-semibold uppercase tracking-wider"
             >
               <span>Ver Pedido Completo</span>
               <ChevronRight className="w-4 h-4" />
             </button>
          </div>
        )}
      </main>

      {/* Floating Presented Order Badge (if active and no draft order) */}
      {presentedOrder && totalUnits === 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-8 duration-500">
          <div className="bg-[#1E1E1E] text-[#FFFBF2] rounded-2xl shadow-2xl border border-[#E3B87C]/30 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#9B1B30]/20 rounded-xl flex items-center justify-center border border-[#9B1B30]/40 text-[#E3B87C]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#E3B87C] font-bold">
                  Pedido Presentado Activo
                </p>
                <p className="text-xs text-[#E9E2D6]/80 font-mono">
                  {presentedOrder.totalUnits} platos — ${presentedOrder.totalPrice.toLocaleString()} CUP
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowWaiterView(true)}
              className="px-4 py-2.5 bg-[#9B1B30] hover:bg-[#801426] text-[#FFFBF2] rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>Ver Pedido</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Active Draft Order Bar */}
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

      {/* Informative Sheet Modal */}
      {selectedDish && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setSelectedDish(null)}
        >
          <div 
            className="relative max-w-2xl w-full bg-[#FFFBF2] border border-[#EADFCB] rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedDish(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-[#9B1B30] text-[#FFFBF2] rounded-full transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="aspect-[16/10] w-full overflow-hidden bg-[#EFE6D5]">
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

            <div className="p-6 sm:p-8 space-y-5 text-[#1E1E1E]">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#9B1B30] uppercase">
                  <span>{getOfficialCategoryName(selectedDish.category)}</span>
                  {selectedDish.isFeatured && (
                    <>
                      <span aria-hidden="true" className="text-[#8A8380]">·</span>
                      <span className="text-[#E3B87C] bg-[#1E1E1E] px-2 py-0.5 rounded text-[10px]">Destacado</span>
                    </>
                  )}
                </div>

                <h3 className="font-serif text-2xl sm:text-4xl font-bold leading-tight">
                  {selectedDish.name}
                </h3>
              </div>

              <div className="flex items-baseline gap-4">
                {formatDishPrice(selectedDish) && (
                  <span className="font-serif text-3xl font-bold text-[#9B1B30] tracking-tight">
                    {formatDishPrice(selectedDish)}
                  </span>
                )}
                {selectedDish.portion && (
                  <span className="text-sm font-sans text-[#8A8380] italic bg-black/5 px-2.5 py-1 rounded">
                    Gramaje/Volumen: {selectedDish.portion}
                  </span>
                )}
              </div>

              <p className="text-sm sm:text-base text-[#5A5350] leading-relaxed">
                {selectedDish.description}
              </p>

              <div className="pt-4 border-t border-[#EADFCB] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#8A8380] uppercase tracking-widest font-semibold">Disponibilidad</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
                    <span className="text-xs text-[#5A5350]">Producto disponible en local</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Modal Quantity Controls */}
                  {orderItems.find(item => item._id === selectedDish._id) ? (
                    <div className="flex items-center bg-[#1E1E1E] rounded-xl p-1 shadow-lg">
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
                      className="flex items-center gap-2 px-6 py-3 bg-[#1E1E1E] hover:bg-[#9B1B30] text-[#FFFBF2] rounded-xl transition-all text-xs font-bold uppercase tracking-wider"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar al Pedido</span>
                    </button>
                  )}

                  <a
                    href={`https://wa.me/${WHATSAPP_URL_NUMBER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 text-[#9B1B30] hover:bg-[#9B1B30] hover:text-[#FFFBF2] border border-[#9B1B30] rounded-xl transition-all"
                    title="Consultar por WhatsApp"
                  >
                    <Phone className="w-5 h-5" />
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

      {/* Unified Personal Order Modal */}
      <PersonalOrderModal
        isOpen={showSummary || showWaiterView}
        initialMode={showWaiterView ? 'present' : 'review'}
        onClose={() => {
          setShowSummary(false);
          setShowWaiterView(false);
        }}
        orderItems={orderItems}
        presentedOrder={presentedOrder}
        updateQuantity={updateQuantity}
        clearOrder={clearOrder}
        presentOrder={presentOrder}
        closePresentedOrder={closePresentedOrder}
        totalUnits={totalUnits}
        totalPrice={totalPrice}
      />
    </div>
  );
};
