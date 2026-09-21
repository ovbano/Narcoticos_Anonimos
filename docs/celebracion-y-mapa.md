# Celebración y precisión del mapa

Nueva capa visual en `anniversary-celebration.css`: portada azul profunda, medalla marfil con borde dorado y entrada animada, nombre destacado, franja de fecha y tarjetas de contenido. El calendario incorpora controles en un panel, casillas más definidas y fechas protagonistas en la agenda. Conserva texto de mensaje a 18 px en móvil y respeta la preferencia de movimiento reducido.

## Ubicación

El registro público del salón tenía el enlace `https://maps.app.goo.gl/vSJpZkwgiLKxkk6W6` sin coordenadas. El mapa integrado buscaba el nombre del lugar, mientras el botón abría el enlace guardado: podían mostrar puntos diferentes.

Se resolvió el enlace existente de Google Maps. Las coordenadas del marcador del lugar son `-0.4027177, -79.2976599` (campos !3d/!4d del enlace), diferentes del centro de cámara @ del mismo enlace. Se guardaron en el registro público del salón usando una actualización limitada al nombre, enlace y coordenadas previamente vacías, y se verificaron mediante SELECT. No se modificaron visibilidad, fecha ni confirmación del lugar.

El código usa las coordenadas exactas y zoom 18. Si solo existe un enlace Maps, no incrusta una búsqueda distinta por nombre: conserva el botón para abrir ese enlace. Si se quiere ajustar la entrada física del inmueble respecto al marcador registrado en Google Maps, hace falta un punto señalado por el usuario; no se estimó tal desplazamiento.

## Validación

- 14 pruebas de fechas, enlaces, carga pública y mapa aprobadas (`node --test tests/*.test.cjs`).
- Chromium con datos de ejemplo a 320, 390, 768 y 1280 px: sin desbordamientos; mensaje móvil a 18 px; búsqueda, cambio de mes, regreso al mes actual y selección de día.
- Apertura y cierre del modal Bootstrap a 320 y 390 px. Capturas reales revisadas.
- El mapa externo de Google no se evaluó visualmente dentro del navegador de pruebas; se comprobó la URL del mapa generado y la coordenada guardada.
