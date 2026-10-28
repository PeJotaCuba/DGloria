import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Programar la verificación de turnos con un intervalo de 15 minutos (en lugar de ejecutarse cada 1 minuto).
// Esto reduce de 1.440 ejecuciones diarias a solo 96, eliminando el trabajo redundante y costos innecesarios,
// mientras se conserva la puntualidad requerida para la apertura y cierre automático de jornadas.
crons.interval(
  "check and update scheduled shift",
  { minutes: 15 },
  internal.shift.checkAndUpdateScheduledShift,
  {}
);

export default crons;
