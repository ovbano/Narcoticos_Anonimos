# Calendario e invitaciones de aniversarios

El calendario permite cambiar de mes, volver al mes actual, buscar por nombre (sin distinguir tildes) y seleccionar un día. Muestra separadamente la fecha original y la celebración programada. Cada evento abre `aniversario.html?id=IDENTIFICADOR&year=AÑO_DEL_ANIVERSARIO`.

Las tarjetas del mes incluyen «Ver aniversario» y «Compartir». La página de detalle ofrece compartir con el dispositivo, copiar enlace (con copia manual si el navegador no lo permite) y abrir WhatsApp con el texto preparado. No envía mensajes automáticamente.

## Activación en Supabase

1. Ejecutar `sql/03_invitaciones_aniversarios.sql` en el SQL Editor del proyecto.
2. En el administrador, editar una celebración, indicar su fecha y escribir el mensaje de invitación.
3. Verificar lugar/coordenadas/enlace de Maps y marcar «Lugar de celebración confirmado». Guardar.

La migración añade dos columnas; no modifica datos existentes, RLS, permisos ni políticas. Antes de aplicarla, el calendario y los enlaces funcionan, pero los campos nuevos quedan deshabilitados y los mapas pendientes. La consulta pública mantiene una lista explícita de columnas y el filtro `public_visible = true`. Los permisos de Supabase deben seguir protegiendo las filas no públicas.

El mensaje es texto público editado por los servidores; no es un formulario de comentarios de visitantes. Sin mensaje personalizado aparece un texto original de acompañamiento del grupo. El mapa solo se publica con confirmación explícita. Las coordenadas tienen prioridad; los enlaces externos aceptan únicamente hosts de Google Maps por HTTPS. Los enlaces cortos sin ubicación textual ni coordenadas se abren en Maps, sin inventar una localización para incrustarla.

## Fechas y enlaces

Se usa el día civil de Ecuador (America/Guayaquil). La celebración programada pertenece al aniversario anual más cercano, incluyendo diciembre/enero. El enlace conserva el año del aniversario. El 29 de febrero se representa el 28 en años no bisiestos. Una celebración de un año no se reutiliza automáticamente en otro.

La base actual guarda una celebración por compañero. La invitación muestra el registro público vigente, no una instantánea histórica: si se reemplaza la celebración por la del año siguiente, el enlace del año anterior conserva el aniversario, pero ya no mostrará el mensaje ni el lugar anterior. No se publican vistas previas sociales personalizadas por persona (la página es estática). No se añadió hora ni confirmación de asistencia.

## Verificación

`node --test tests/anniversary-model.test.cjs tests/anniversary-public.test.cjs`

Cubre enlaces directos, visibilidad, contenido escapado, ausencia de migración, errores de conexión, mapas confirmados, fechas bisiestas, cambio de año, búsqueda por tildes y selección de días.

Pendiente de revisión visual en Preview de Vercel: abrir el modal en escritorio y móvil; recorrer meses; abrir una tarjeta; probar compartir/copia; confirmar un lugar de prueba desde el panel y revisar su mapa. El entorno de edición no pudo descargar Chromium, por lo que las pruebas automatizadas usan el modelo y un DOM simulado, no un navegador real.
