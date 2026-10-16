# Deuda individual de todos los compañeros

El listado **Deuda individual del local** parte del registro completo del grupo, no de la lista de personas que han pagado. También conserva compañeros antiguos de Tesorería que ya no estén en el directorio.

Cada compañero aparece con pendiente anterior, pendiente del mes, deuda total y estado. **Ver meses y abonos** abre el desglose individual; el cobro conserva la fecha real y el mes al que se aplica. Los filtros permiten mostrar todos, con deuda, al día o con inicio por configurar.

Si alguien nunca pagó pero ya tiene cuota e inicio registrados, su deuda se calcula igual que la de los demás. Si nunca tuvo una participación de cuota configurada, se muestra **Por calcular**, no $0 ni Al día. **Configurar inicio** abre su formulario con el nombre seleccionado y exige confirmar desde qué mes corresponde la cuota. No se supone una fecha histórica ni se crean cobros automáticamente. Las protecciones de los meses cerrados siguen vigentes.

El anexo individual del PDF incluye también a quienes todavía no tienen pagos. El total calculado excluye los importes desconocidos hasta configurar su inicio. Los cobros históricos globales sin desglose no se reparten automáticamente entre los compañeros.

Esta corrección solo modifica la interfaz y la composición del listado/anexo. No cambia movimientos, saldos, cuotas ni tablas de Supabase. El registro completo se vuelve a consultar al actualizar.

Validación: ocho pruebas Node para acumulados, filtros, escape de nombres, PDF y listado completo (22 compañeros, 16 cuentas y 6 inicios desconocidos), más integración DOM para cobro, consulta histórica, detalle individual y formulario de alta preseleccionado. La comprobación visual en un navegador real sigue pendiente; no se ejecutaron escrituras en producción.
