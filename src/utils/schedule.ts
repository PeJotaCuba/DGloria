/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SessionInfo {
  openTime: string;
  closeTime: string;
  openTimeFormatted: string;
  closeTimeFormatted: string;
}

export interface DayScheduleRecord {
  dayOfWeek: number; // 1 = Lunes, ..., 7 = Domingo
  dayName: string;
  enabled: boolean;
  session1OpenTime?: string;
  session1CloseTime?: string;
  session2Enabled?: boolean;
  session2OpenTime?: string;
  session2CloseTime?: string;
  openTime?: string;
  closeTime?: string;
  openTime2?: string;
  closeTime2?: string;
  sessions?: SessionInfo[];
  closedReason?: string;
  displayText?: string;
}

export interface DayScheduleGroup {
  days: DayScheduleRecord[];
  dayRangeLabel: string;
  enabled: boolean;
  sessions: SessionInfo[];
  closedReason?: string;
}

/**
 * Formatea cadenas de tiempo HH:mm a 12 horas en español con 'a. m.' y 'p. m.'.
 * Maneja correctamente '00:00' -> '12:00 a. m.' y '02:00' -> '2:00 a. m.'.
 */
export function formatTime12h(timeStr?: string): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  if (!trimmed) return '';

  // Si ya contiene la notación AM/PM
  if (/am|pm|a\.\s*m\.|p\.\s*m\./i.test(trimmed)) {
    return trimmed
      .replace(/AM/g, 'a. m.')
      .replace(/PM/g, 'p. m.')
      .replace(/a\.m\./gi, 'a. m.')
      .replace(/p\.m\./gi, 'p. m.');
  }

  const parts = trimmed.split(':');
  const hour = parseInt(parts[0], 10);
  if (isNaN(hour)) return trimmed;

  const minuteStr = parts[1] ? parts[1].padStart(2, '0') : '00';
  const period = hour >= 12 && hour < 24 ? 'p. m.' : 'a. m.';
  const formattedHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${formattedHour}:${minuteStr} ${period}`;
}

/**
 * Extrae estrictamente la primera y segunda sesión de un registro de día de Convex.
 * NUNCA fusiona ambas sesiones en una sola.
 */
export function extractDaySessions(day: DayScheduleRecord): SessionInfo[] {
  if (!day.enabled) return [];

  const resultSessions: SessionInfo[] = [];

  // 1. Extraer Sesión 1
  const s1Open = day.session1OpenTime || day.openTime || (day.sessions && day.sessions[0]?.openTime);
  const s1Close = day.session1CloseTime || day.closeTime || (day.sessions && day.sessions[0]?.closeTime);

  if (s1Open && s1Close) {
    resultSessions.push({
      openTime: s1Open,
      closeTime: s1Close,
      openTimeFormatted: formatTime12h(s1Open),
      closeTimeFormatted: formatTime12h(s1Close),
    });
  }

  // 2. Extraer Sesión 2 si está habilitada
  const isS2Enabled =
    Boolean(day.session2Enabled) ||
    Boolean(day.openTime2 && day.closeTime2) ||
    Boolean(day.session2OpenTime && day.session2CloseTime) ||
    Boolean(day.sessions && day.sessions.length > 1);

  if (isS2Enabled) {
    const s2Open = day.session2OpenTime || day.openTime2 || (day.sessions && day.sessions[1]?.openTime);
    const s2Close = day.session2CloseTime || day.closeTime2 || (day.sessions && day.sessions[1]?.closeTime);

    if (s2Open && s2Close) {
      resultSessions.push({
        openTime: s2Open,
        closeTime: s2Close,
        openTimeFormatted: formatTime12h(s2Open),
        closeTimeFormatted: formatTime12h(s2Close),
      });
    }
  }

  return resultSessions;
}

/**
 * Compara si dos arreglos de sesiones tienen exactamente los mismos horarios.
 */
function areSessionsEqual(s1: SessionInfo[], s2: SessionInfo[]): boolean {
  if (s1.length !== s2.length) return false;
  for (let i = 0; i < s1.length; i++) {
    if (s1[i].openTime !== s2[i].openTime || s1[i].closeTime !== s2[i].closeTime) {
      return false;
    }
  }
  return true;
}

/**
 * Normaliza nombres de días a minúsculas en el segundo término para rangos naturales.
 * Ejemplos: 'Martes a viernes', 'Sábado y domingo', 'Viernes'.
 */
export function formatDayRangeLabel(days: DayScheduleRecord[]): string {
  if (days.length === 0) return '';
  if (days.length === 1) return days[0].dayName;

  const firstDay = days[0].dayName; // Ej: 'Martes', 'Sábado'
  const lastDay = days[days.length - 1].dayName.toLowerCase(); // Ej: 'viernes', 'domingo'

  if (days.length === 2) {
    return `${firstDay} y ${lastDay}`;
  }

  return `${firstDay} a ${lastDay}`;
}

/**
 * Agrupa días consecutivos ordenados por día de la semana (1..7).
 * Separa inmediatamente cualquier día con horarios de sesión o estado diferente.
 */
export function groupWeeklyScheduleStrict(weeklySchedule: DayScheduleRecord[]): DayScheduleGroup[] {
  if (!weeklySchedule || weeklySchedule.length === 0) return [];

  // Ordenar días de Lunes (1) a Domingo (7)
  const sorted = [...weeklySchedule].sort((a, b) => (a.dayOfWeek || 0) - (b.dayOfWeek || 0));

  const groups: DayScheduleGroup[] = [];
  let currentGroupDays: DayScheduleRecord[] = [];
  let currentEnabled: boolean | null = null;
  let currentSessions: SessionInfo[] = [];
  let currentClosedReason: string | undefined = undefined;

  for (const day of sorted) {
    const enabled = Boolean(day.enabled);
    const sessions = extractDaySessions(day);
    const closedReason = enabled ? undefined : day.closedReason || 'Cerrado por descanso';

    if (currentGroupDays.length === 0) {
      currentGroupDays.push(day);
      currentEnabled = enabled;
      currentSessions = sessions;
      currentClosedReason = closedReason;
    } else {
      const isMatch =
        enabled === currentEnabled &&
        (enabled
          ? areSessionsEqual(sessions, currentSessions)
          : closedReason === currentClosedReason);

      if (isMatch) {
        currentGroupDays.push(day);
      } else {
        groups.push({
          days: currentGroupDays,
          dayRangeLabel: formatDayRangeLabel(currentGroupDays),
          enabled: currentEnabled!,
          sessions: currentSessions,
          closedReason: currentClosedReason,
        });

        currentGroupDays = [day];
        currentEnabled = enabled;
        currentSessions = sessions;
        currentClosedReason = closedReason;
      }
    }
  }

  if (currentGroupDays.length > 0) {
    groups.push({
      days: currentGroupDays,
      dayRangeLabel: formatDayRangeLabel(currentGroupDays),
      enabled: currentEnabled!,
      sessions: currentSessions,
      closedReason: currentClosedReason,
    });
  }

  return groups;
}
