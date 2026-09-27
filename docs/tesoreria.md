# Tesorería privada de Amigos Verdaderos

## Acceso y puesta en marcha

1. Incorporar este cambio a `main` y esperar el despliegue de Vercel. La ruta será `/tesoreria/`.
2. Entrar como administrador en `/admin/`. En **Usuarios**, invitar a la persona encargada con su correo, nombre y rol **Tesorería**. No se comparte la contraseña del administrador. Para revisión sin edición, elegir **Revisión de Tesorería**.
3. La invitación usa el retorno existente `/admin/`, que debe estar permitido en Supabase → Authentication → URL Configuration → Redirect URLs. Después de autenticar, las cuentas de Tesorería pasan a `/tesoreria/`. La persona establece su propia contraseña desde el enlace o desde **Contraseña**.
4. El administrador abre **Tesorería** y registra el primer mes, saldo inicial general, saldo reservado al local y cómo se verificaron. Los saldos se expresan en dólares; no incluyen valores por cobrar. La configuración inicial es única.
5. En **Local**, registrar nombre e inicial de cada compañero, primer mes de aporte y cuota de referencia ($12 por defecto). No se cargan miembros de la lista pública de aniversarios automáticamente.
6. Probar el acceso real de la servidora y de un revisor antes de usarlo durante la reunión. La aplicación requiere conexión para guardar. Confirmar siempre el mensaje de guardado.

Las migraciones de Tesorería en `supabase/migrations/` ya fueron aplicadas al proyecto durante la preparación del cambio. No volver a ejecutarlas manualmente. No se cargaron saldos ni movimientos de los informes adjuntos y no se crearon cuentas reales de servidoras: falta elegir el correo destinatario desde Administración.

## Guía para la persona encargada

- **Séptima tradición:** Registrar ingreso → Séptima tradición → fecha, total y concepto. No se registran nombres de donantes.
- **Aporte para el local:** Local → Registrar abono. Elegir el mes al que corresponde el aporte. Si cubre varios meses, crear un abono por mes. El ingreso se contabiliza en caja por la fecha de cobro, una sola vez; el control de aportes usa el mes asignado.
- **Gasto:** registrar fecha real, categoría, fondo, monto y concepto; adjuntar foto/PDF o explicar por qué no existe comprobante.
- **Foto y borrador:** tomar foto o elegir archivo y pulsar Guardar borrador. Es posible guardar sin monto ni concepto. Esperar «Borrador guardado». Se comparte entre los accesos autorizados del grupo y puede completarse desde otro dispositivo. No cuenta en los saldos hasta confirmarlo. Requiere conexión; si falla, se mantiene el formulario para reintentar, pero cerrar la pestaña puede perder los datos sin guardar.
- Se acepta **un comprobante JPG, PNG, WEBP o PDF de hasta 10 MB por registro**. El original queda protegido frente a reemplazo y eliminación desde las cuentas del sitio.
- **Correcciones:** los movimientos confirmados se anulan con motivo y se vuelven a registrar correctamente. No desaparecen; se conserva el historial. Los borradores pueden editarse o descartarse.
- **Cierre:** completar/descartar borradores del mes; contar efectivo y revisar cuenta; indicar dinero contado y observaciones. No se ajusta automáticamente ninguna diferencia. Cerrar después del último día del mes, en orden desde el primer mes configurado.
- Un aporte para un mes cerrado requiere reabrir ese período (y posteriores, en orden inverso) con el administrador, para no cambiar informes cerrados silenciosamente.
- **Informe:** Informes → Descargar PDF o Imprimir. El informe abierto lleva la etiqueta Provisional. El anexo de aportes individuales se incluye solo si se selecciona. Los comprobantes no se publican ni se insertan como enlaces permanentes en el PDF.
- **Guía impresa:** Guía → Imprimir guía / Guardar como PDF; en el diálogo del navegador elegir impresora o Guardar como PDF.
- **Rotación del servicio:** el administrador invita al nuevo responsable y desactiva el anterior. La autorización se comprueba contra el perfil activo en cada consulta; no depende únicamente de roles guardados en un token.

## Contabilidad y transparencia

Los importes se almacenan como centavos enteros. Cada fondo conserva saldo inicial + ingresos - egresos. Los pendientes no son efectivo y los borradores/anulados no se suman. Un fondo negativo se señala para revisión; nunca se oculta ni se compensa con un movimiento ficticio. El sistema registra los datos introducidos y su historia; no certifica que un gasto ocurrió ni prueba apropiación de dinero.

Los informes adjuntos se revisaron como referencia de categorías y presentación. Contienen fechas incompletas y mezclan saldo anterior con ingresos; no se importaron automáticamente. El arranque debe acordarse con un conteo verificable. No se incorporan los documentos privados al repositorio público.

## Arquitectura y permisos

- HTML/CSS/JS sin framework, compatible con el sitio existente. No requiere nuevo servidor ni nuevas variables de entorno.
- Supabase Auth existente; roles `admin`, `treasurer`, `auditor`; `editor` sigue limitado al sitio público y no recibe acceso financiero.
- Cinco tablas con RLS: `treasury_settings`, `treasury_members`, `treasury_entries`, `treasury_closures`, `treasury_audit`. El cliente solo tiene SELECT autorizado; ninguna tabla admite escritura directa de `anon`/`authenticated`.
- `treasury_command` es SECURITY INVOKER y llama una función interna en el esquema no expuesto `treasury_private`. Esta verifica `auth.uid()` y el perfil activo, serializa escrituras con un bloqueo transaccional, valida importes/fechas/cierres, comprueba versiones y escribe el historial en la misma transacción. EXECUTE revocado a PUBLIC/anon.
- Comprobantes en bucket privado `treasury-receipts`, límites de tipo/tamaño y políticas de lectura/creación según rol. Sin permisos de sobrescritura ni borrado. Descarga autenticada como Blob, sin URLs públicas. Un archivo subido antes de un fallo de guardado puede quedar sin asociar: revisar desde Supabase si requiere mantenimiento, conservando la evidencia.
- Cierre conserva instantánea para informes repetibles y conciliación. Solo administración reabre el último mes cerrado, dejando motivo e historial.
- Supabase JS y jsPDF se sirven localmente con versión fijada y licencia; consultar `assets/vendor/treasury-dependencies.md`.

## Verificación

- `node --test tests/treasury-model.test.cjs`: centavos, importes inválidos, saldos, estados de aportes y escape de texto.
- `tests/treasury-database.sql`: escenarios transaccionales con ROLLBACK, usuarios ficticios sin sesiones, RLS por rol, saldo y arrastre, borradores, confirmación, versión, anulaciones, cierre/reapertura, historial y revocación. Ejecutar únicamente en una base sin configuración de Tesorería, preferiblemente una copia de pruebas. Las fixtures no se conservan.
- `PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... node tests/treasury-browser.cjs`: UI con adaptador en memoria. Prueba móvil 320/360/390 y escritorio 1440, adjunto, fallo/reintento, borrador, confirmación, abono parcial, anulación, PDF y controles de consulta. No es una prueba de autenticación real ni de envío de invitaciones.
- Se revisan visualmente capturas móviles, escritorio y PDF renderizado. El envío de invitaciones reales se deja para que el administrador elija el correo; no se envía durante pruebas.
