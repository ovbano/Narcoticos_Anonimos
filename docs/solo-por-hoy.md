# Calendario de Solo por hoy

Cobertura editorial: **los 30 días de septiembre**. Los otros meses, incluido
el 29 de febrero, están pendientes. No se recicla septiembre para otras fechas.

Cada entrada de assets/data/solo-por-hoy.json contiene un título consultado,
un resumen propio breve, una URL de verificación, el tipo de fuente y la fecha
de revisión. Se priorizó el Foro Zonal Latinoamericano. Doce entradas se
contrastaron con publicaciones secundarias porque la página del Foro no respondió.
La fecha del encabezado de la meditación determina su día, no la fecha de
publicación del blog. Es recomendable cotejar esas doce entradas con la edición
impresa o el Foro antes de considerarlas verificadas por una fuente primaria.

Los resúmenes no son citas, introducciones del libro ni literatura oficial.
El enlace público a la lectura completa sigue siendo https://fzla.org/sxh/.
No se incluye el texto íntegro del libro ni se consulta un sitio externo al
abrir la sección. No requiere cambios en Supabase.

La fecha se calcula en America/Guayaquil. Se revisa cada segundo y al volver
a la página. Cuando cambia el día se cancela el audio previo. Fechas ausentes,
datos inválidos o fallo de carga muestran acceso a la fuente oficial.

La voz es síntesis del navegador, solo del título y resumen. Requiere un clic;
permite pausa, continuación, detención y velocidad antes de iniciar. La voz y
la fiabilidad de la pausa dependen del dispositivo. No es una grabación oficial.

Para ampliar la cobertura, añadir claves MM-DD tras verificar la fecha y el
título; redactar resúmenes propios breves y conservar source, sourceType y
verifiedOn. No llenar huecos con títulos inventados.

Validación automatizada: node tests/solo-por-hoy.test.cjs
