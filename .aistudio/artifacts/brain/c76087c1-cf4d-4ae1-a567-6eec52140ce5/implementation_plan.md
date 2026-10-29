# Separación Estricta de Dos Sesiones y Agrupación de Horarios

Corrección de la lógica de extracción, agrupación y presentación visual de los horarios de apertura de Bar Terraza en la web de Doña Gloria (`/src`), garantizando la separación de dos sesiones independientes con iconos de sol y luna, y la correcta separación de días excepcionales según los diseños de referencia.

> [!IMPORTANT] Decisiones Confirmadas por el Usuario
> - **Estilo de capitalización de días**: Minúscula en el segundo día del rango (ej. *Martes a viernes*, *Sábado y domingo*, *Viernes*).
> - **Estilo de colores de iconos**: Icono de sol en ámbar cálido (`text-amber-400`) e icono de luna en azul suave (`text-blue-300`).

---

### 1. Visión General del Cambio

- **Objetivo**: Renderizar de forma independiente la primera y segunda sesión de apertura de Bar Terraza en todos los puntos de la web, agrupando días consecutivos únicamente cuando sus horarios completos y sesiones sean 100% idénticos y separando las excepciones en su propio bloque.
- **Alcance de Modificación**:
  1. `src/utils/schedule.ts`: Lógica estricta de parseo de campos de `session1` y `session2`, formateo de horas a 12h en español (`11:00 a. m. – 3:00 p. m.`) y agrupamiento exacto por secuencia semanal.
  2. `src/components/HeroSection.tsx`: Presentación vertical estructurada con el rango de días arriba y las líneas de sesión abajo en bloques independientes.
  3. `src/components/ContactSection.tsx`: Tarjeta de «Información Práctica» alineada fielmente a las capturas provistas.
  4. `src/pages/MenuPage.tsx`: Franja de horarios del menú ajustada a bloques independientes.

---

### 2. Diseño de Experiencia de Usuario y Estructura Visual

Alineado exactamente con los mockups proporcionados en las imágenes enviadas:

```
Martes a viernes
☀️  11:00 a. m. – 3:00 p. m.
🌙  6:00 p. m. – 12:00 a. m.
──────────────────────────────
Viernes  (si tiene diferencia)
☀️  11:00 a. m. – 2:00 p. m.
🌙  6:00 p. m. – 12:00 a. m.
──────────────────────────────
Sábado y domingo
☀️  11:00 a. m. – 3:00 p. m.
🌙  6:00 p. m. – 2:00 a. m.
```

---

### 3. Arquitectura Técnica y Flujo de Datos

```
┌───────────────────────────────────────────────────────────┐
│        Convex DB: shift_schedules.weeklySchedule          │
│ (session1OpenTime, session1CloseTime, session2Enabled,    │
│  session2OpenTime, session2CloseTime, openTime, etc.)     │
└──────────────────────────────┬────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────┐
│                 src/utils/schedule.ts                     │
│  - parseDayRecord(day) -> { session1, session2 }          │
│  - groupWeeklyScheduleStrict(weeklySchedule)              │
└──────────────┬───────────────┬───────────────┬────────────┘
               │               │               │
               ▼               ▼               ▼
       ┌──────────────┐ ┌─────────────┐ ┌──────────────┐
       │ HeroSection  │ │ ContactCard │ │   MenuPage   │
       │ (Estructura  │ │  (Estructura│ │ (Estructura  │
       │  Vertical)   │ │  Con Iconos)│ │  Vertical)   │
       └──────────────┘ └─────────────┘ └──────────────┘
```

---

### 4. Detalles de Implementación por Archivo

1. **`src/utils/schedule.ts`**:
   - Parsear explícitamente `session1OpenTime` / `openTime` y `session1CloseTime` / `closeTime`.
   - Parsear `session2` sólo si `session2Enabled` es `true` o existen `session2OpenTime`/`openTime2`.
   - Formatear tiempos de 24h a 12h con sufijos `a. m.` / `p. m.`.
   - Agrupar días consecutivos (1 = Lunes a 7 = Domingo) validando igualdad de `enabled`, `session1` y `session2`.
   - Formatear etiquetas de días: `Martes a viernes`, `Sábado y domingo`, `Viernes`.

2. **`ContactSection.tsx`**:
   - Tarjeta con panel oscuro y bordes tenues.
   - Título de grupo en negrita, seguido de líneas con icono de sol (ámbar) y luna (azul) alineados.

3. **`HeroSection.tsx` & `MenuPage.tsx`**:
   - Mapear los bloques agrupados mostrando en primer lugar el rango de días y debajo las dos líneas de sesión de forma clara y limpia.

---

### 5. Plan de Verificación

- Ejecutar `lint_applet` para confirmar la ausencia de errores de sintaxis y tipos en TypeScript.
- Ejecutar `compile_applet` para validar la compilación exitosa de Vite/React.
