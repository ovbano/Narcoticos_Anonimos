# Ajuste de lectura y calendario

La invitación mantiene el diseño editorial. En teléfonos, el mensaje pasa a 18 px, interlineado 1.8 y mayor contraste. Los detalles se muestran a 17 px, las etiquetas a 13 px y los botones principales a 15 px con 54 px de altura. El medallón ocupa menos altura para acercar el contenido de la invitación. Se amplían también la firma, los mensajes de ubicación y la información secundaria.

El calendario incorpora una superficie propia para el mes y tarjetas separadas para la agenda. Se amplían nombres, años, estados, números de día y controles. La selección y el día actual se distinguen visualmente, manteniendo los atributos de accesibilidad existentes.

Validación con Chromium real y datos de ejemplo: 320, 390, 768 y 1280 px, sin desbordamiento horizontal. Se comprobó el tamaño calculado del mensaje móvil (18 px), búsqueda sin distinguir tildes, cambio de mes, regreso al mes actual y selección de fecha. Se verificó apertura/cierre del modal Bootstrap a 320 y 390 px. Capturas revisadas. Sin excepciones JavaScript durante las pruebas. No se modificó lógica de datos ni SQL.
