/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Clock, CheckCircle2, XCircle, RotateCcw, AlertTriangle, FileCheck2, LucideIcon } from 'lucide-react';

export interface ReservationStatusMeta {
  label: string;
  badgeClass: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}

/**
 * Helper para renderizar estado público de reservación de forma consistente en toda la web.
 */
export const getReservationStatusMeta = (status?: string): ReservationStatusMeta => {
  const s = (status || '').trim().toLowerCase();
  switch (s) {
    case 'pending':
    case 'pendiente':
      return {
        label: 'Pendiente',
        badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        icon: Clock,
        title: 'Solicitud recibida',
        desc: 'Tu solicitud ha sido registrada correctamente en el sistema. Nuestro equipo está revisando la disponibilidad y confirmará tu reservación a la brevedad.',
      };
    case 'negotiation':
    case 'negociación':
    case 'negociacion':
      return {
        label: 'Negociación',
        badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        icon: AlertTriangle,
        title: 'Propuesta de horario o fecha alternativa',
        desc: 'El establecimiento ha propuesto un ajuste de horario o fecha para poder atenderte en la terraza.',
      };
    case 'confirmed':
    case 'confirmado':
      return {
        label: 'Confirmada',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        icon: CheckCircle2,
        title: '¡Reserva confirmada!',
        desc: 'Tu reservación ha sido aceptada y confirmada en Bar Terraza. ¡Te esperamos!',
      };
    case 'rejected':
    case 'rechazado':
      return {
        label: 'Rechazado',
        badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
        icon: XCircle,
        title: 'Solicitud no disponible',
        desc: 'Lamentablemente no fue posible aceptar la reservación para el horario o fecha indicados.',
      };
    case 'cancelled':
    case 'cancelado':
      return {
        label: 'Cancelada',
        badgeClass: 'bg-zinc-900 text-zinc-400 border-zinc-700',
        icon: XCircle,
        title: 'Reservación Cancelada',
        desc: 'Esta reservación ha sido cancelada.',
      };
    case 'marked':
    case 'marcada':
      return {
        label: 'Marcada',
        badgeClass: 'bg-orange-950/50 text-orange-300 border-orange-500/30',
        icon: AlertTriangle,
        title: 'Marcada',
        desc: 'Esta reservación ha sido marcada por el administrador.',
      };
    case 'consolidated':
    case 'consolidado':
      return {
        label: 'Consolidada',
        badgeClass: 'bg-teal-950/50 text-teal-300 border-teal-500/30',
        icon: FileCheck2,
        title: 'Consolidada',
        desc: 'Tu reservación ha sido consolidada.',
      };
    default:
      return {
        label: 'Desconocido',
        badgeClass: 'bg-gray-800 text-gray-300 border-gray-600',
        icon: AlertTriangle,
        title: 'Estado desconocido',
        desc: 'No pudimos determinar el estado de tu reservación.',
      };
  }
};

export const getReservationButtonMeta = (status?: string) => {
  const s = (status || '').trim().toLowerCase();
  switch (s) {
    case 'pending':
    case 'pendiente':
      return { label: 'Pendiente', badgeClass: 'bg-amber-800 text-amber-100 border border-amber-500' };
    case 'negotiation':
    case 'negociación':
    case 'negociacion':
      return { label: 'Negociación', badgeClass: 'bg-indigo-800 text-indigo-100 border border-indigo-500' };
    case 'confirmed':
    case 'confirmado':
      return { label: 'Confirmada', badgeClass: 'bg-emerald-800 text-emerald-100 border border-emerald-500' };
    case 'rejected':
    case 'rechazado':
      return { label: 'Rechazada', badgeClass: 'bg-red-800 text-red-100 border border-red-500' };
    case 'cancelled':
    case 'cancelado':
      return { label: 'Cancelada', badgeClass: 'bg-zinc-800 text-zinc-200 border border-zinc-600' };
    default:
      return { label: 'Reservar', badgeClass: 'bg-[#9B1B30] text-white border border-[#9B1B30]' };
  }
};
