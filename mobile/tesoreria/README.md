# Tesorería móvil · Amigos Verdaderos

Primera versión Flutter / Dart enfocada en Tesorería. Usa el mismo proyecto de Supabase que la web: no crea otra base ni copia los movimientos.

## Qué incluye

- Inicio de sesión por correo y contraseña con Supabase Auth; validación de perfiles activos `admin`, `treasurer` y `auditor`.
- Perfil, cierre de sesión local y cambio de contraseña con confirmación.
- Resumen por mes, fondo general y reserva para el local.
- Registro de ingresos y egresos, selección de categoría y fondo, buscador de compañeros para aportes.
- Borradores **guardados en Supabase**, completar, corregir y anular con motivo. Versiones y permisos siguen validados en las RPC existentes.
- Foto desde cámara o galería, reducción al capturar y comprobantes en el bucket privado existente.
- Registrar o corregir fondos iniciales con la misma operación de la web.
- Consulta de aportes del período y de pendientes históricos de actividades.
- Informe PDF con tablas separadas, aportes individuales y fotografías opcionales. La generación se hace en el dispositivo; las imágenes se descargan de Supabase. Fotografías ilegibles, PDF adjuntos o archivos que excedan el límite de memoria se identifican como no incluidos.
- Consulta de los últimos 50 cambios y acceso al panel web del administrador.

Esta versión NO sustituye todavía todas las pantallas web. Crear/bajar usuarios, gestionar integrantes y deudas de actividades, registrar sus pagos, cerrar/reabrir meses y explorar toda la auditoría se hacen en la web desde los enlaces de la aplicación. No tiene sincronización offline: necesita conexión para entrar, guardar y consultar. No incluye todavía el logo como asset ni un icono final: utiliza la identidad azul, el nombre del grupo e iconos de Material.

## Estado de validación

Código inicial, pendiente de compilación, análisis de tipos y prueba en Android real. Se comprobó la sintaxis Dart con un parser y la estructura de las configuraciones. Se añadieron pruebas de centavos, períodos y generación de PDF, pero **no se ejecutaron con Flutter**: la revisión automática del entorno de desarrollo bloqueó su ejecución al intentar consultar el endpoint interno de metadatos de la instancia. No se modificaron datos ni permisos del Supabase de producción.

Las dependencias directas están fijadas. `flutter pub get` generará `pubspec.lock`; debe guardarse en git después de la primera compilación satisfactoria para fijar también las dependencias transitivas. No se entrega un APK ya compilado.

## Preparar en Windows

1. Instala Flutter **stable 3.47.6**, Android Studio con Android SDK y Python 3. Usa `flutter doctor` para comprobar tu computadora. No uses para esta primera prueba una versión antigua de Flutter pre-release.
2. Descarga esta rama o, después de incorporarla, clona el repositorio. Abre PowerShell en `mobile/tesoreria`.
3. Ejecuta:

```powershell
./scripts/prepare.ps1
```

El script genera los archivos Android, agrega el permiso de internet y obtiene las dependencias. Conserva los archivos Dart de esta carpeta. Si PowerShell bloquea el script, ejecuta sus tres comandos de Flutter y Python manualmente; no necesitas cambiar la política de ejecución.

4. Copia la configuración:

```powershell
Copy-Item config.example.json config.local.json
```

Edita `config.local.json` con la URL del Supabase existente y su clave pública `anon` o `publishable`. Están en la configuración de conexión del proyecto; también puedes consultar la configuración pública de la web. **Nunca uses `service_role`, una clave `sb_secret_` ni una contraseña de base de datos.** La clave pública no concede permisos por sí sola; los permisos los valida el backend existente. Este archivo está excluido de git.

5. Conecta un Android con depuración USB, acepta la autorización del teléfono y ejecuta:

```powershell
flutter devices
flutter analyze
flutter test
flutter run --dart-define-from-file=config.local.json
```

6. Para generar una instalación de prueba:

```powershell
flutter build apk --debug --dart-define-from-file=config.local.json
```

El archivo queda en `build/app/outputs/flutter-apk/app-debug.apk`. Es una APK de prueba firmada con la clave de depuración, no una versión para publicar en Play Store. Un lanzamiento público requiere configuración de firma y las revisiones correspondientes.

## Alternativa: preparar APK desde GitHub

El repositorio incluye un workflow manual `Tesorería móvil · comprobar y preparar APK`.

1. Incorpora el cambio a `main` para que el workflow aparezca en Actions.
2. En Settings → Secrets and variables → Actions → Variables agrega:
   - `NA_SUPABASE_URL`: URL del proyecto existente.
   - `NA_SUPABASE_PUBLIC_KEY`: solamente la clave pública `anon`/`publishable`.
3. En Actions ejecuta el workflow con **Run workflow**.
4. Solo si análisis, pruebas y build pasan, descarga el artefacto `tesoreria-android-prueba`. Contiene la APK debug y el `pubspec.lock` generado.
5. Conserva ese lockfile en `mobile/tesoreria/pubspec.lock` y súbelo al repositorio.

El workflow no se ha ejecutado como parte de esta entrega. Usa recursos de GitHub Actions y no requiere desplegar otra web ni cambiar Vercel.

## Cómo probar sin alterar cuentas reales

- Usa una cuenta activa que ya exista en el sistema. Los usuarios no se crean automáticamente desde la app.
- Empieza consultando resúmenes y comparándolos con la web. Consulta no cambia saldos.
- Si vas a probar registros, usa preferentemente un Supabase de pruebas con el mismo esquema. Los registros confirmados contra producción **sí afectan los saldos reales**.
- Comprueba la cámara, guardar/completar borrador, aportar al local, corregir con motivo, PDF y cerrar sesión.
- Comprueba que auditor no puede escribir, que usuario inactivo no puede operar, que un mes cerrado rechaza modificaciones y que una versión antigua de un movimiento se rechaza cuando otro usuario lo ha cambiado.
- No ingreses nuevamente el saldo inicial ni los movimientos históricos para "llenar la app". Son los mismos datos de la web.
- No borres ni reinicies la base; no ejecutes migraciones nuevas para esta primera versión.

## Contrato con el backend actual

Tablas de lectura: `profiles`, `treasury_settings`, `treasury_members`, `treasury_entries`, `treasury_audit`.

RPC: `treasury_companions`, `treasury_report`, `treasury_prepare_report`, `treasury_command`, `treasury_activities`.

Bucket privado: `treasury-receipts`. La app se autentica como el usuario que inicia sesión; nunca usa claves administrativas.

Vercel continúa alojando la web y su panel. La app consulta Supabase directamente; no obliga a que cada movimiento pase por Vercel.
