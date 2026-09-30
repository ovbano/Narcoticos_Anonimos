# Pendientes por actividades

El apartado **Actividades** muestra cuentas por cobrar de bingos, rifas u otras recaudaciones. Es privado: administración, Tesorería y consulta tienen acceso; solo administración y Tesorería pueden modificarlo.

## Uso

1. Pulsa el menú desplegable, busca por nombre o apellido y selecciona un compañero del registro del grupo y describe la actividad.
2. Registra el valor original y, si corresponde, los abonos **anteriores al sistema**. Son antecedentes informativos y no generan dinero en caja. Deja la fecha vacía cuando sea desconocida.
3. Al recibir dinero, usa **Registrar pago**, con la fecha real y el importe recibido. Puedes registrar abonos parciales.
4. El pago crea automáticamente un ingreso de «Otro ingreso» en el **fondo general**. No lo vuelvas a registrar en Movimientos. Se incluye en el informe mensual y PDF habitual.
5. La sección **Ver pagos y comprobantes** está siempre visible. Si no hay pagos nuevos, explica que los abonos históricos no tienen movimientos individuales. Tras registrar un cobro, pulsa **Adjuntar comprobante** y guarda la corrección. Para consultar, corregir importes o anular con motivo, abre **Ver movimiento**. La deuda se recalcula automáticamente. Se respetan los meses cerrados.

El selector mensual no cambia la lista de deudas: muestra el saldo pendiente **actual**. Los cobros sí pertenecen al mes de la fecha de recepción. Las cuotas del arriendo continúan en **Local**, separadas de las actividades.

**Corregir datos** permite rectificar el compromiso original, los abonos históricos, la actividad y su vínculo con el compañero. Exige motivo y no puede dejar un saldo incompatible con los pagos ya recibidos. No borra ni modifica movimientos de caja. Administración puede revisar estas operaciones en Auditoría.

## Implementación y verificación

- `treasury_activity_accounts` referencia el registro existente `anniversaries`; el nombre se conserva como referencia histórica. Un antecedente importado sin coincidencia queda sin vincular hasta que se identifique al compañero.
- `treasury_entries.activity_account_id` vincula los pagos. Los importes se guardan como centavos enteros.
- Las escrituras pasan por una operación autenticada y atómica con el mismo bloqueo transaccional del libro de caja. El UUID del pago impide duplicados al reintentar. Un trigger también valida las correcciones realizadas desde el editor habitual.
- Las tablas usan RLS; no se permiten escrituras directas del cliente ni acceso anónimo.
- `tests/treasury-activities.sql` prueba separación de caja, abonos, reintentos, sobrepagos, correcciones, anulaciones y permisos dentro de una transacción que termina en ROLLBACK. Requiere una configuración existente y un período actual abierto. No ejecutar scripts de reinicialización del libro de caja.
- `tests/treasury-browser.cjs` comprueba la creación y el cobro desde la interfaz con datos sintéticos y vistas de teléfono y escritorio.

La migración contiene únicamente estructura y funciones. Los listados reales y sus datos personales se cargan de forma privada, nunca en el repositorio público.
