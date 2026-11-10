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
        label: 'Confirmado',
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
        label: 'Cancelado',
        badgeClass: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
        icon: RotateCcw,
        title: 'Solicitud cancelada',
        desc: 'Esta solicitud de reservación ha sido cancelada.',
      };
    case 'marcada':
    case 'marked':
      return {
        label: 'Marcada (Inasistencia)',
        badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
        icon: AlertTriangle,
        title: 'Inasistencia registrada',
        desc: 'La reservación fue marcada como inasistencia.',
      };
    case 'consolidated':
    case 'consolidado':
    case 'completed':
    case 'fulfilled':
      return {
        label: 'Consolidado',
        badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
        icon: FileCheck2,
        title: 'Visita realizada',
        desc: 'La visita ha sido registrada exitosamente en Bar Terraza. ¡Gracias por compartir con nosotros!',
      };
    default:
      return {
        label: 'Estado Desconocido',
        badgeClass: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
        icon: Clock,
        title: 'Estado de solicitud',
        desc: 'La solicitud se encuentra en proceso.',
      };
  }
};
