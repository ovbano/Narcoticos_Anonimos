# Cuotas pendientes del local

En **Aportes para nuestro local** se muestran los meses anteriores, lo pendiente del mes consultado y el total por cobrar de cada compañero. **Ver meses y abonos** explica de dónde sale ese saldo.

- Cuota de referencia: $12, o la cuota configurada en la participación del compañero.
- Solo se generan cuotas entre el inicio y el final de su participación, desde el comienzo de Tesorería. No se anticipan meses que todavía no han empezado.
- Un mes sin pagar permanece pendiente al cambiar de mes o de año. Un abono parcial deja la diferencia pendiente.
- Terminar la participación detiene nuevas cuotas; no borra los meses anteriores.
- La deuda no aumenta el dinero disponible. Solo un ingreso confirmado lo hace.
- Un excedente asignado a septiembre no cancela automáticamente octubre. Debe verificarse su asignación; no se inventan repartos de pagos.

## Recibir un pago atrasado

1. Consulta **Ver pendientes actuales** y pulsa **Abonar** en el mes pendiente. La pantalla propone el saldo de ese mes, que puedes reducir si recibes un abono parcial.
2. Conserva la **fecha real del cobro**; en **Mes del aporte** debe aparecer el mes que se está pagando.
3. Confirma el movimiento. Se registra una sola vez en el fondo del local y reduce el pendiente del mes asignado.

Ejemplo: se deben $12 de septiembre y $12 de octubre. Si se reciben $6 en octubre para septiembre, el pendiente de septiembre baja a $6; octubre sigue en $12. Total pendiente: $18. El ingreso de caja corresponde a octubre.

Si se pagan varios meses, registra un movimiento por cada parte y mes. Al guardar un aporte, la consulta cambia al mes real del cobro para mostrar su efecto. Al consultar meses anteriores se presenta el estado hasta ese mes: un cobro posterior no reescribe ese estado histórico.

Se puede cobrar una cuota de un mes cerrado desde un período de caja abierto, sin reabrir el cierre. Para modificar el movimiento original de caja de un mes cerrado siguen vigentes las protecciones anteriores.

## Datos históricos

El cálculo usa exclusivamente compañeros registrados en Tesorería, sus fechas y sus cuotas, junto con los ingresos confirmados que tienen compañero y mes de aporte asignados. No crea deudas para todos los aniversarios del directorio. Los ingresos consolidados antiguos sin desglose (por ejemplo una recaudación global de arriendo) no se reparten por suposición: la tesorería debe identificar a quién y a qué meses corresponden. No registres otra vez el mismo dinero para intentar cuadrar el listado.

## Informes y permisos

Al marcar **Incluir anexo individual de aportes**, el informe incorpora el acumulado por compañero y el detalle de los meses pendientes. En un mes cerrado se conserva el resumen financiero original. Administrador y tesorero pueden registrar cobros; auditor consulta. No hay acceso anónimo a los saldos.

## Validación técnica

- Pruebas de centavos, totales, filtros, escape de nombres y anexo HTML.
- PostgreSQL aislado con PGlite: impagos y abonos parciales, baja de participación, excedentes, corte histórico, cobro atrasado, caja, cierre, límite de meses futuros y permisos.
- DOM con datos sintéticos: carga de la web real, botón de abono, mes pendiente preseleccionado, guardado y consulta del mes del cobro.
- La consulta nueva se verificó en Supabase con lectura; los hashes de movimientos, participantes y cierres se conservaron tras la migración.
- La comprobación visual con Chromium no pudo ejecutarse porque su descarga falló. Las pruebas no escribieron movimientos en producción.

Comandos de prueba, instalando las dependencias de desarrollo solo en un entorno local:

```bash
npm install --no-save @electric-sql/pglite jsdom
node --test tests/treasury-model.test.cjs tests/treasury-dues.test.cjs
node tests/treasury-dues-db.cjs
node tests/treasury-dues-dom.cjs
```

La migración `20261016201301_treasury_accumulated_rent_dues.sql` ya se aplicó al proyecto Supabase antes de publicar la interfaz. Es compatible con el informe mensual y la aplicación móvil existentes; esta entrega modifica la presentación web.
