# Tesorería privada de Amigos Verdaderos

## Acceso y puesta en marcha

1. Incorporar este cambio a `main` y esperar el despliegue de Vercel. La ruta será `/tesoreria/`.
2. Entrar como administrador en `/admin/`. En **Accesos**, crear una cuenta con correo, nombre, contraseña inicial y rol **Tesorería**. Entregar las credenciales de forma privada; se muestran una sola vez en el panel. También existe la opción de invitar por correo. No se comparte la contraseña del administrador. Para revisión sin edición, elegir **Revisión de Tesorería**.
3. La invitación usa el retorno existente `/admin/`, que debe estar permitido en Supabase → Authentication → URL Configuration → Redirect URLs. Después de autenticar, las cuentas de Tesorería pasan a `/tesoreria/`. La persona establece su propia contraseña desde el enlace o desde **Contraseña**.
4. El administrador abre **Tesorería** y registra el primer mes, saldo inicial general, saldo reservado al local y cómo se verificaron. Los saldos se expresan en dólares; no incluyen valores por cobrar. Si se cometió un error, el administrador puede usar **Corregir saldo inicial** e indicar el motivo. Esto reabre los informes cerrados para recalcularlos; debe revisarse antes de volver a cerrarlos.
5. En **Local**, buscar por nombre o apellido y seleccionar al compañero del registro existente. Al guardar su primer aporte se vincula una sola vez a Tesorería. También se pueden registrar personas manualmente; revisar primero para evitar duplicados. La cuota de referencia es $12 mensuales por defecto.
6. Probar el acceso real de la servidora y de un revisor antes de usarlo durante la reunión. La aplicación requiere conexión para guardar. Confirmar siempre el mensaje de guardado.

Las migraciones de Tesorería en `supabase/migrations/` ya fueron aplicadas al proyecto durante la preparación del cambio. No volver a ejecutarlas manualmente. No se cargaron saldos ni movimientos de los informes adjuntos y no se crearon cuentas reales de servidoras: falta elegir el correo destinatario desde Administración.

## Guía para la persona encargada

- **Séptima tradición:** Registrar ingreso → Séptima tradición → fecha, total y concepto. No se registran nombres de donantes.
- **Aporte para el local:** Local → Registrar abono. Elegir el mes al que corresponde el aporte. Si cubre varios meses, crear un abono por mes. El ingreso se contabiliza en caja por la fecha de cobro, una sola vez; el control de aportes usa el mes asignado.
- **Gasto:** registrar fecha real, categoría, fondo, monto y concepto; adjuntar foto/PDF o explicar por qué no existe comprobante.
- **Foto y borrador:** tomar foto o elegir archivo y pulsar Guardar borrador. Es posible guardar sin monto ni concepto. Esperar «Borrador guardado». Se comparte entre los accesos autorizados del grupo y puede completarse desde otro dispositivo. No cuenta en los saldos hasta confirmarlo. Requiere conexión; si falla, se mantiene el formulario para reintentar, pero cerrar la pestaña puede perder los datos sin guardar.
- Se acepta **un comprobante JPG, PNG, WEBP o PDF de hasta 10 MB por registro**. Al corregir, se puede adjuntar otro comprobante. El archivo anterior no se sobrescribe ni elimina y su referencia queda en el historial.
- **Correcciones:** usar **Corregir datos**, completar los valores correctos e indicar el motivo. Se conserva el mismo registro y la auditoría guarda el antes y el después. **Anular** se usa cuando el movimiento no debe contar. Los borradores pueden editarse o descartarse.
- **Cierre:** completar/descartar borradores del mes; contar efectivo y revisar cuenta; indicar dinero contado y observaciones. No se ajusta automáticamente ninguna diferencia. Cerrar después del último día del mes, en orden desde el primer mes configurado.
- Un aporte para un mes cerrado requiere pedir al administrador que reabra ese período; los posteriores se reabren juntos, para no cambiar informes cerrados silenciosamente.
- **Informe:** Informes → Descargar PDF o Imprimir. El informe abierto lleva la etiqueta Provisional. El anexo de aportes individuales se incluye solo si se selecciona. Los comprobantes no se publican ni se insertan como enlaces permanentes en el PDF.
- **Guía impresa:** Guía → Imprimir guía / Guardar como PDF; en el diálogo del navegador elegir impresora o Guardar como PDF.
- **Rotación del servicio:** el administrador crea el acceso del nuevo responsable y marca al anterior como **Inactivo** mediante **Dar de baja**. Puede volver a activarlo. Nunca se borra su historial. Cada usuario puede cambiar su contraseña desde **Contraseña** tantas veces como necesite. La autorización se comprueba contra el perfil activo en cada consulta; no depende únicamente de roles guardados en un token.

## Contabilidad y transparencia

Los importes se almacenan como centavos enteros. Cada fondo conserva saldo inicial + ingresos - egresos. Los pendientes no son efectivo y los borradores/anulados no se suman. Un fondo negativo se señala para revisión; nunca se oculta ni se compensa con un movimiento ficticio. El sistema registra los datos introducidos y su historia; no certifica que un gasto ocurrió ni prueba apropiación de dinero.

Los informes adjuntos se revisaron como referencia de categorías y presentación. Contienen fechas incompletas y mezclan saldo anterior con ingresos; no se importaron automáticamente. El arranque debe acordarse con un conteo verificable. No se incorporan los documentos privados al repositorio público.

## Arquitectura y permisos

- HTML/CSS/JS sin framework, compatible con el sitio existente. La consulta de accesos y los cambios de rol/estado usan RPC autenticadas. La creación de cuentas requiere que el endpoint de Vercel tenga configuradas las variables de Supabase indicadas en `api/admin-users.mjs`; la clave secreta solo debe existir en el servidor. Si falta, se muestra un error en lugar de dejar la página esperando.
- Supabase Auth existente; roles `admin`, `treasurer`, `auditor`; `editor` sigue limitado al sitio público y no recibe acceso financiero.
- Cinco tablas con RLS: `treasury_settings`, `treasury_members`, `treasury_entries`, `treasury_closures`, `treasury_audit`. El cliente solo tiene SELECT autorizado; ninguna tabla admite escritura directa de `anon`/`authenticated`.
- `treasury_command` es SECURITY INVOKER y llama una función interna en el esquema no expuesto `treasury_private`. Esta verifica `auth.uid()` y el perfil activo, serializa escrituras con un bloqueo transaccional, valida importes/fechas/cierres, comprueba versiones y escribe el historial en la misma transacción. EXECUTE revocado a PUBLIC/anon.
- Comprobantes en bucket privado `treasury-receipts`, límites de tipo/tamaño y políticas de lectura/creación según rol. Sin permisos de sobrescritura ni borrado. Descarga autenticada como Blob, sin URLs públicas. Un archivo subido antes de un fallo de guardado puede quedar sin asociar: revisar desde Supabase si requiere mantenimiento, conservando la evidencia.
- Cierre conserva instantánea para informes repetibles y conciliación. Solo administración reabre meses cerrados, incluyendo los posteriores de forma atómica, dejando motivo e historial.
- Supabase JS y jsPDF se sirven localmente con versión fijada y licencia; consultar `assets/vendor/treasury-dependencies.md`.

## Verificación

- `node --test tests/treasury-model.test.cjs`: centavos, importes inválidos, saldos, estados de aportes y escape de texto.
- `tests/treasury-database.sql`: escenarios transaccionales con ROLLBACK, usuarios ficticios sin sesiones, RLS por rol, saldo y arrastre, borradores, confirmación, versión, anulaciones, cierre/reapertura, historial y revocación. Ejecutar preferiblemente en una copia de pruebas sin movimientos de Tesorería; la prueba se detiene si ya existen movimientos. Las fixtures no se conservan.
- `PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... node tests/treasury-browser.cjs`: UI con adaptador en memoria. Prueba móvil 320/360/390 y escritorio 1440, adjunto, fallo/reintento, borrador, confirmación, abono parcial, anulación, PDF y controles de consulta. No es una prueba de autenticación real ni de envío de invitaciones.
- Se revisan visualmente capturas móviles, escritorio y PDF renderizado. El envío de invitaciones reales se deja para que el administrador elija el correo; no se envía durante pruebas.

## Dos fondos, un total

El **fondo general** es dinero disponible para café, azúcar, materiales y otros gastos del grupo. El **fondo reservado para el local** es dinero ya recaudado y separado para el arriendo. Son partes distintas del efectivo disponible: si hay $100 en total y $30 están separados para el local, ingresar $70 en general y $30 en local. No ingresar $100 y $30: contaría dos veces esos $30. No incluir cuotas pendientes ni ingresos futuros. Los aportes para el local se asignan a ese fondo automáticamente; revisar el fondo al registrar cada gasto.

Se pueden transcribir apuntes después de la reunión: usar la fecha real del cobro o gasto. Los cálculos se realizan al guardar. Antes del cierre, comparar el dinero contado con el saldo del sistema y explicar cualquier diferencia.

## Control del administrador y auditoría

El administrador activo tiene acceso a todas las operaciones de Tesorería, correcciones, configuración, cierres, reaperturas y administración de usuarios. La tesorería activa registra y corrige movimientos de períodos abiertos; no administra accesos ni cambia el saldo inicial. Revisión de Tesorería es de consulta. Los controles también se validan en la base de datos.

En **Historial**, el administrador puede filtrar por usuario, fecha y acción. Se registran identidad, fecha, motivo y valores anteriores/nuevos. Preparar un PDF o una impresión registra `report_prepared` con usuario, mes y formato; esto prueba la preparación del informe, no que la persona haya terminado una descarga o impreso físicamente. El cierre también conserva quién lo realizó y la instantánea de los datos.

Pruebas adicionales: `node --test tests/admin-users-api.test.cjs tests/treasury-model.test.cjs` y `tests/admin-users-browser.cjs` (con las mismas variables de Playwright/Chromium). Cubren el contrato Node de Vercel, errores finitos de acceso, reintento, credenciales y cambios Activo/Inactivo. La creación en navegador usa un adaptador de pruebas: no crea cuentas reales ni envía correos.
