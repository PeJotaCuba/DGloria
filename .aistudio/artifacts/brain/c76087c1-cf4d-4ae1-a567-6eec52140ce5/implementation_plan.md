# Conexión y Verificación de Consulta de Reservaciones

Este plan asegura que el frontend esté perfectamente sincronizado con el backend Convex para permitir la consulta privada de reservaciones mediante código de seguimiento, respetando los protocolos de seguridad y los estados oficiales.

## 1. Verificación de la Ruta y Argumentos
- Se ha confirmado que la consulta pública es `reservations:getPublicReservationStatus`.
- El argumento único requerido es `trackingCode` (string), el cual se procesa mediante hash SHA-256 en el servidor para máxima privacidad.
- Se utiliza la llamada reactiva `useQuery(api.reservations.getPublicReservationStatus, { trackingCode })` en el componente `ReservationSection.tsx`.

## 2. Soporte de los 6 Estados Oficiales
La interfaz mapeará y presentará visualmente los siguientes estados gestionados desde Android:
1.  **Pendiente (`pending`):** Estado inicial de toda solicitud web.
2.  **Negociación (`negotiation`):** Muestra la fecha (`proposedDate`) y hora (`proposedTime`) alternativas sugeridas.
3.  **Confirmado (`confirmed`):** Muestra la mesa asignada (`assignedTable`) junto con la fecha y hora final.
4.  **Rechazado (`rejected`):** Presenta el motivo de la no disponibilidad (`statusReason`).
5.  **Cancelado (`cancelled`):** Indica que la reservación ha sido anulada.
6.  **Consolidado (`consolidated` / `completed`):** Registro final de asistencia en el local.

## 3. Seguridad y Límites
- **Privacidad:** No se devuelven teléfonos, correos ni notas internas al cliente en la consulta pública.
- **Acceso Único:** Solo se puede acceder al registro si se conoce el código privado generado al momento de la solicitud.
- **Registros Antiguos:** Se maneja elegantemente la ausencia de código en registros previos a la implementación, informando al usuario de la limitación sin inventar datos.

## 4. Acciones Finales de Alineación
- Asegurar que el cambio de estado en Android se refleje instantáneamente en la web gracias a las consultas reactivas de Convex.
- Verificar que el formulario de contacto independiente permanezca conectado exclusivamente a WhatsApp.
