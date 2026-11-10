import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Comprobación periódica de apertura/cierre de turnos programados en Convex (cada 15 minutos).
// Evita ejecuciones excesivas cada minuto mientras conserva la puntualidad requerida para la jornada laboral.
crons.interval(
  "check-shift-schedule",
  { minutes: 15 },
  internal.shift.checkAndUpdateScheduledShift
);

export default crons;
