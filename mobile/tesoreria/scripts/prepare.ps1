$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
flutter create --platforms=android --org ec.amigosverdaderos --project-name amigos_tesoreria --no-pub .
if ($LASTEXITCODE -ne 0) { throw 'Flutter no pudo generar los archivos Android.' }
python scripts/android_setup.py
if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar Android. Comprueba que Python esté instalado.' }
flutter pub get
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron resolver las dependencias.' }
Write-Host 'Proyecto preparado. Crea config.local.json siguiendo README.md.'
