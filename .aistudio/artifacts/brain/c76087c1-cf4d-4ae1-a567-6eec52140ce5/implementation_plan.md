# Adaptación y Agrupamiento Inteligente de Horarios de Bar Terraza

Implementación de la lectura, agrupación automática por días consecutivos y presentación elegante con doble sesión (sol/luna) de los horarios de Bar Terraza en el encabezado principal, la sección «Información práctica» y la página del menú web de Doña Gloria.

> [!IMPORTANT] Decisiones Confirmadas por el Usuario
> - **Resumen en encabezados compactos**: Mostrar el resumen completo de los grupos de días activos.
> - **Formato de rangos de días**: Formato natural en español (ej. *Martes a Viernes*, *Sábado y Domingo*, *Lunes*).

---

### 1. Visión General del Cambio

- **Objetivo**: Conectar la web a la fuente única de verdad en Convex (`shift_schedules.weeklySchedule`), procesando los datos para agrupar días consecutivos con horarios e impulsos de apertura idénticos, soportando hasta dos sesiones diarias con iconos temáticos de sol y luna.
- **Alcance**:
  1. `src/utils/schedule.ts`: Módulo de utilidad para parsear, formatear a 12h, agrupar días consecutivos y generar resúmenes amigables.
  2. `src/components/HeroSection.tsx`: Encabezado de portada con el resumen agrupado activo.
  3. `src/components/ContactSection.tsx`: Sección «Información práctica» con tarjetas/líneas agrupadas de horarios y sesiones.
  4. `src/pages/MenuPage.tsx`: Encabezado de la página de menú con la franja de horarios agrupados.

---

### 2. Diseño de Experiencia de Usuario (UX) y Estética Visual

- **Estructura de Agrupación**:
  - Días con la misma configuración de apertura y sesiones se agrupan en una sola entrada.
  - Ejemplo: Si de Martes a Viernes se abre de 11:00 a.m. a 4:00 p.m. y de 7:00 p.m. a 11:30 p.m., se muestra como una única fila/tarjeta:
    - **Martes a Viernes**
    - ☀️ *Sesión 1*: 11:00 a. m. – 4:00 p. m.
    - 🌙 *Sesión 2*: 7:00 p. m. – 11:30 p. m.
  - Días cerrados se indican explícitamente con su motivo o "Cerrado".
- **Iconografía**:
  - `Sun` (Lucide) para la primera sesión (comida / día).
  - `Moon` (Lucide) para la segunda sesión (cena / noche).
- **Temática**:
  - Estilo cálido, prémium e impecable sobre fondo claro con acentos dorados/ámbar, consistente con el diseño existente de Doña Gloria.

---

### 3. Arquitectura Técnica y Flujo de Datos

```
┌─────────────────────────────────────────────────────────┐
│              Convex DB: shift_schedules                 │
│         (getPublicOpeningHours / weeklySchedule)        │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│               src/utils/schedule.ts                     │
│  - parseDaySchedule(record)                             │
│  - groupWeeklySchedule(weeklyScheduleArray)             │
│  - formatGroupedScheduleSummary(groups)                 │
└──────────────┬─────────────┬─────────────┬──────────────┘
               │             │             │
               ▼             ▼             ▼
       ┌──────────────┐┌───────────┐┌──────────────┐
       │ HeroSection  ││  Contact  ││  MenuPage    │
       │  (Portada)   ││ (Práctica)││  (Página)    │
       └──────────────┘└───────────┘└──────────────┘
```

---

### 4. Componentes y Funciones de Utilidad

1. **`src/utils/schedule.ts`**:
   - `formatTime12h(timeStr)`: Convierte formatos "HH:mm" de 24h a 12h con sufijo "a. m." / "p. m.".
   - `parseDaySchedule(item)`: Extrae y normaliza las sesiones 1 y 2 considerando campos nativos y de respaldo (`session1OpenTime`, `session2OpenTime`, `openTime`, `openTime2`).
   - `groupWeeklySchedule(schedule)`: Ordena por `dayOfWeek` (1 a 7) y agrupa días adyacentes con coincidencia exacta de estado y sesiones.
   - Genera nombres naturales como "Martes a Viernes" o "Sábado y Domingo".

2. **`ContactSection.tsx`**:
   - Renderiza los grupos obtenidos en lugar de mapear los 7 días individualmente.
   - Cada grupo muestra el rango de días y las líneas de sesión con iconos de sol y luna.

3. **`HeroSection.tsx` & `MenuPage.tsx`**:
   - Muestran el resumen global estilizado de horarios activos agrupados.

---

### 5. Plan de Pruebas y Verificación

- Ejecutar `lint_applet` para asegurar cero errores de TypeScript y sintaxis.
- Ejecutar `compile_applet` para validar que la compilación Vite/React sea 100% limpia.
