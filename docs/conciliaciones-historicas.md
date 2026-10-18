# Conciliaciones históricas de cuotas

Cambio pendiente de autorización para aplicar en producción. No se ha ejecutado el SQL.

Permite reconocer un aporte histórico y regularizar una diferencia en un mes concreto sin crear movimientos de caja ni cambiar la cuota ordinaria del compañero. La cuota esperada conserva el importe configurado; el detalle separa lo reconocido y lo regularizado.

La tabla privada `treasury_dues_reconciliations` contiene una fila por compañero/mes, importes en centavos, motivo, movimiento de referencia opcional, autor y fecha. Usuarios con acceso de Tesorería pueden consultarla. No se conceden permisos de escritura al cliente; cualquier conciliación debe aplicarse mediante un procedimiento administrativo autorizado y registrarse en treasury_audit.

El cálculo conserva los movimientos originales. Pagado = movimientos registrados + importe histórico reconocido; pendiente = máximo(0, cuota − pagado − diferencia regularizada). Los meses sin conciliación mantienen el mismo resultado. El PDF privado y el detalle individual muestran la nota, para distinguir este ajuste de un ingreso nuevo.

El cambio de cálculo estará disponible tanto para web como para los clientes móviles que ya usan treasury_dues_history. Las explicaciones visuales se incorporan en esta propuesta a la web y su PDF.

No se incluyen datos reales de compañeros en este cambio de código. La regularización individual debe aplicarse por separado, con autorización y comprobando que movimientos, saldos y cierres conservan sus valores.
