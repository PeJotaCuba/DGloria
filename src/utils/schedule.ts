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
  sessions?: SessionInfo[];
  openTime?: string;
  closeTime?: string;
  openTimeFormatted?: string;
  closeTimeFormatted?: string;
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
 * Formatea cadenas de tiempo HH:mm o ya formateadas a formato 12 horas en español (ej. "11:00 a. m.").
 */
export function formatTime12h(timeStr?: string): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  if (!trimmed) return '';

  // Si ya tiene sufijo AM/PM o a. m. / p. m.
  if (/am|pm|a\.\s*m\.|p\.\s*m\./i.test(trimmed)) {
    return trimmed
      .replace(/AM/g, 'a. m.')
      .replace(/PM/g, 'p. m.')
      .replace(/a\.m\./gi, 'a. m.')
      .replace(/p\.m\./gi, 'p. m.');
  }

  const [hourStr, minuteStr] = trimmed.split(':');
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return trimmed;

  const minute = minuteStr ? minuteStr.padStart(2, '0') : '00';
  const period = hour >= 12 ? 'p. m.' : 'a. m.';
  const formattedHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${formattedHour}:${minute} ${period}`;
}

/**
 * Normaliza y extrae las sesiones de un registro diario.
 */
export function getNormalizedSessions(day: DayScheduleRecord): SessionInfo[] {
  if (Array.isArray(day.sessions) && day.sessions.length > 0) {
    return day.sessions.map((s) => ({
      openTime: s.openTime || '',
      closeTime: s.closeTime || '',
      openTimeFormatted: s.openTimeFormatted ? formatTime12h(s.openTimeFormatted) : formatTime12h(s.openTime),
      closeTimeFormatted: s.closeTimeFormatted ? formatTime12h(s.closeTimeFormatted) : formatTime12h(s.closeTime),
    }));
  }

  if (day.openTime && day.closeTime) {
    return [
      {
        openTime: day.openTime,
        closeTime: day.closeTime,
        openTimeFormatted: day.openTimeFormatted ? formatTime12h(day.openTimeFormatted) : formatTime12h(day.openTime),
        closeTimeFormatted: day.closeTimeFormatted ? formatTime12h(day.closeTimeFormatted) : formatTime12h(day.closeTime),
      },
    ];
  }

  return [];
}

/**
 * Compara si dos listas de sesiones son idénticas en horario.
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
 * Genera la etiqueta en español para un rango de días (ej. "Martes a Viernes", "Sábado y Domingo", "Lunes").
 */
export function formatDayRangeLabel(days: DayScheduleRecord[]): string {
  if (days.length === 0) return '';
  if (days.length === 1) return days[0].dayName;

  const firstDay = days[0].dayName;
  const lastDay = days[days.length - 1].dayName;

  if (days.length === 2) {
    return `${firstDay} y ${lastDay}`;
  }

  return `${firstDay} a ${lastDay}`;
}

/**
 * Agrupa días consecutivos con la misma configuración de apertura y sesiones.
 */
export function groupWeeklySchedule(weeklySchedule: DayScheduleRecord[]): DayScheduleGroup[] {
  if (!weeklySchedule || weeklySchedule.length === 0) return [];

  // Ordenar de Lunes (1) a Domingo (7)
  const sorted = [...weeklySchedule].sort((a, b) => (a.dayOfWeek || 0) - (b.dayOfWeek || 0));

  const groups: DayScheduleGroup[] = [];
  let currentGroupDays: DayScheduleRecord[] = [];
  let currentEnabled: boolean | null = null;
  let currentSessions: SessionInfo[] = [];
  let currentClosedReason: string | undefined = undefined;

  for (const day of sorted) {
    const enabled = Boolean(day.enabled);
    const sessions = enabled ? getNormalizedSessions(day) : [];
    const closedReason = enabled ? undefined : day.closedReason || 'Cerrado por descanso';

    if (currentGroupDays.length === 0) {
      currentGroupDays.push(day);
      currentEnabled = enabled;
      currentSessions = sessions;
      currentClosedReason = closedReason;
    } else {
      const isSameStatus =
        enabled === currentEnabled &&
        (enabled
          ? areSessionsEqual(sessions, currentSessions)
          : closedReason === currentClosedReason);

      if (isSameStatus) {
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

/**
 * Genera el resumen en una sola línea para encabezados compactos (HeroSection y MenuPage).
 */
export function formatGroupedScheduleSummary(
  weeklySchedule?: DayScheduleRecord[],
  fallbackText: string = 'Martes a Domingo: Desde las 11:00 a. m.'
): string {
  if (!weeklySchedule || weeklySchedule.length === 0) return fallbackText;

  const groups = groupWeeklySchedule(weeklySchedule);
  const openGroups = groups.filter((g) => g.enabled && g.sessions.length > 0);

  if (openGroups.length === 0) return 'Cerrado temporalmente';

  // Si hay un único grupo abierto (ej. Martes a Domingo)
  return openGroups
    .map((g) => {
      const firstSession = g.sessions[0];
      const lastSession = g.sessions[g.sessions.length - 1];
      const timeSpan =
        g.sessions.length > 1
          ? `${firstSession.openTimeFormatted} – ${lastSession.closeTimeFormatted}`
          : `${firstSession.openTimeFormatted} – ${firstSession.closeTimeFormatted}`;
      return `${g.dayRangeLabel}: ${timeSpan}`;
    })
    .join(' · ');
}
