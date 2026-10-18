# Experiencias públicas

## Una pregunta, un mensaje
Cuatro inquietudes abren una respuesta breve y llevan a información o contacto del grupo. Las selecciones se procesan en el navegador y no se registran ni se envían al servidor.

## Tarjetas de esperanza
Seis textos originales del sitio, identificados como tales, con tres estilos: azul, marfil y noche. La tarjeta puede ampliarse, descargarse como PNG 1080×1350 y compartirse mediante un enlace que conserva mensaje y estilo. Se usa el logo original sin modificarlo. El dispositivo genera la imagen; no se suben tarjetas a Supabase. Si el navegador no ofrece compartir, se puede copiar el enlace; si el portapapeles está bloqueado, aparece un campo seleccionable.

## Directorio
La sección consulta `public.public_meetings` una sola vez por visita cuando el usuario se aproxima a ella. Búsqueda y filtros funcionan localmente. «Hoy» utiliza America/Guayaquil. Google Maps se carga al elegir una ubicación. Para direcciones referenciales se advierte que hay que confirmar el lugar con el grupo.

Se inicia con Amigos Verdaderos, martes/jueves/sábado 20:00, según los horarios publicados en este repositorio. No se inventaron datos de otros grupos. El directorio no se presenta como una lista completa.

### Administración
En «Directorio de reuniones», el administrador o editor puede añadir un grupo, editarlo, guardar borradores y publicar u ocultar. Se requieren nombre, ciudad, dirección, días y hora. Para publicar se exige la fuente consultada y la confirmación de revisión. Solo deben colocarse teléfonos autorizados como contacto público. Cada registro reúne días con la misma hora; para horarios diferentes se crea otro registro.

### Base de datos
`sql/06_directorio_publico.sql` ya se ejecutó en el proyecto actual. RLS habilitado: visitantes solo leen publicados; únicamente perfiles autorizados mediante `is_site_editor()` insertan o actualizan. No se cambian políticas existentes ni registros financieros. Los borradores no son accesibles al público. Al cerrar sesión se limpian formularios y resultados del panel nuevo.

### Validación
`node --test tests/community-model.test.cjs` cubre fecha de Ecuador, búsqueda y filtros, enlaces seguros, enlaces compartidos y contenido. Las consultas de prueba de RLS verificaron lectura anónima de publicados, invisibilidad de borradores, rechazo de modificación para usuarios sin permiso y edición del administrador; los registros de prueba se revirtieron.
