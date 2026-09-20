# Invitaciones y calendario · Diseño editorial

Se reemplaza la hoja acumulada de estilos por una composición coherente en azul NA, marfil y acentos dorados. La invitación usa el logo existente del grupo, tipografía Libre Caslon Display / DM Sans, nombre destacado, medallón con años de recuperación, fecha y secciones de mensaje, celebración, ubicación y compartir. No se recrea el logo ni se presenta el diseño como una publicación oficial de NA World Services.

El calendario combina una cabecera del grupo y un conteo real de fechas del mes con accesos a los doce meses, búsqueda y agenda. En teléfonos el calendario y la agenda se apilan. El número de fechas no cambia al buscar; el resultado de la búsqueda se indica en la agenda. La cabecera y el pie del modal se compactan en móvil.

Las animaciones son de entrada y destellos finitos, sin destellos rápidos ni reproducción continua; se desactivan con `prefers-reduced-motion`. El texto de la invitación se escapa antes de insertarlo y conserva saltos de línea.

## Validación realizada

- 11 pruebas de modelo y carga pública: `node --test tests/anniversary-model.test.cjs tests/anniversary-public.test.cjs`.
- Chromium real mediante Playwright, con datos ficticios identificados como ejemplos, a 1280, 390 y 320 px. Capturas revisadas de invitación y calendario; sin desbordamiento horizontal.
- Búsqueda sin distinguir tildes, cambio de mes, volver a hoy, selección de día y navegación a la invitación.
- Modal real de Bootstrap, con su HTML y estilos de aniversarios: apertura y cierre a 1280 y 390 px.
- Preferencia de movimiento reducido comprobada; sin excepciones JavaScript en las vistas de prueba.

La ejecución local se hizo con un servidor de archivos y respuestas de ejemplo, no con escrituras a Supabase. La carga del mapa externo y la publicación de datos reales dependen de la configuración existente. Esta revisión no modifica SQL ni permisos.
