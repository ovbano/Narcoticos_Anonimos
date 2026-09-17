# Calendario de Solo por hoy

Cobertura editorial: **366 fechas, del 1 de enero al 31 de diciembre,
incluido el 29 de febrero**. Cada entrada se selecciona por MM-DD: el año
no forma parte de la clave. Sirve para 2027, 2028 y los años siguientes
sin recargar contenido anualmente. En años comunes no se consulta 02-29;
en los bisiestos se usa su entrada propia sin desplazar las de marzo.

Cada entrada de assets/data/solo-por-hoy.json contiene un título consultado,
un resumen propio breve, una URL de verificación, el tipo de fuente y la fecha
de revisión. Dieciocho entradas de septiembre se consultaron directamente
en páginas individuales del Foro Zonal Latinoamericano. El título y tema
del 29 de febrero se corroboraron en un resultado indexado del Foro; la
página individual no respondió (se conserva esa limitación en sourceEvidence).
Las otras 347 entradas se consultaron en fuentes secundarias, principalmente
el archivo público de hoysoloporhoy.blogspot.com. El 28 de abril se comprobó
en un resultado indexado del Grupo ATZAN. La fecha del encabezado de cada
meditación determina su día, no la fecha de publicación del blog.

Los títulos de fuentes secundarias no se presentan aquí como cotejados con
la edición impresa ni con una fuente primaria. Cada registro conserva su
procedencia para permitir ese cotejo editorial. Se normalizaron mayúsculas,
acentos y sufijos del blog. No se añadieron títulos inventados para llenar huecos.

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

Para corregir contenido, editar la clave MM-DD correspondiente y conservar
source, sourceType y verifiedOn. No utilizar índices de día del año ni
duplicar un año de datos: eso podría desplazar los temas en años bisiestos.
El sitio carga su propio JSON y no depende de la disponibilidad diaria del
Foro ni del blog. Requiere que el alojamiento siga disponible y que la fecha
del dispositivo sea correcta.

Validación automatizada: node tests/solo-por-hoy.test.cjs.
Comprueba cobertura de 366 fechas y simula 2557 días de los años 2026–2030,
2100 y 2400, además de los límites de medianoche, diciembre/enero y febrero/marzo.
Comprueba audio, ausencia de reproducción automática, eventos tardíos y fallos.
