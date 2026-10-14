# Compilar, activar e instalar

[APK e informe verificados](../DONAS_CONTROL_2_RESULTADOS.md). [Descarga oficial 2.0.0](https://www.dracha.store/downloads/Donas-Control-2.0.0-oficial.apk), publicada y comprobada por hash. CI de validación utiliza otra firma temporal y no es una actualización de distribución.

[Contexto](AI_CONTEXT.md) · [Activación detallada](../DONAS_CONTROL_2_ACTIVACION.md)

## Android

JDK17, SDK35/build-tools35, Gradle wrapper. Desde raíz PowerShell:

```powershell
.\scripts\build-android-official.ps1 -FirebaseConfigPath .\.firebase\android\google-services.json
```

Usa firma oficial existente; genera outputs/Donas-Control-2.0.0-oficial.apk y SHA256. Es distribución privada firmada, no aprobación Google Play. Instalar sobre com.bryan.donas.control existente, sin desinstalar; versión15 migra Room5→6 conservando historia/outbox. No instalar debug sobre firma oficial ni regenerar firma. Si la app era .pilot, no es la misma instalación; conservar copia y revisar traslado antes de importar.

Entrar con correo/password de la cuenta Supabase del Dashboard ADMIN/SELLER; no con cuenta Firebase antigua. Actualizar una vez online, registrar compra/costo/mix, venta/precios y efectivo/Yappy, consumo; comprobar estado confirmado. Cerrar jornada con Internet y pendientes vacíos. El inventario restante permanece. Conflictos: revisar historial y reintentar mismo registro o descartar solo rechazo explícito. La contraseña no se guarda.

## SQL

Leer ACTIVACION_2026-10-08 y docs/DONAS_CONTROL_2_ACTIVACION.md. Supabase proyecto yopntnzhcfudaabudbld; respaldar, ejecutar 00_preflight, 01_apply completo, 02_verify; nunca seed ni paquete02antiguo. 03_suspend deshabilita acceso/trigger nuevo y conserva datos. No cambia stock al instalar. No habilitar RLS público para sortear auth.

## Pruebas/despliegue

```sh
node tests/daily-operations-api.cjs
node tests/daily-operations-postgres.mjs
node tests/web-script-syntax.cjs
python tests/knowledge-system.py
python scripts/knowledge.py report
python scripts/knowledge.py generate
python scripts/knowledge.py check
```

SQL usa PGLITE_MODULE para módulo aislado; nunca una base producción de tests. Fixture de assets `node tests/serve-fixture.cjs` no sirve API; navegador prueba con proveedores simulados. Gradle testDebugUnitTest/lintDebug/lintOfficial/assembleOfficial, pruebas instrumentadas requieren dispositivo/emulador.

Publicar cambios por PR/CI/GitHub main ligado a Vercel; comprobar Ready y HTTP de dominio. El endpoint diario devuelve DAILY_SETUP_REQUIRED si falta SQL y la web anterior sigue funcionando. Confirmar SQL y recorrido autenticado real antes de declarar integración total. No pedir ni imprimir claves privadas; en esta sesión no hay acceso UI operativo a Studio.

## Mantenimiento

Actualizar guías/modelo/diagramas en cada cambio. Ejecutar generate/check, revisar todas las áreas del report, review y check --fresh. CI knowledge verifica vigencia; ningún comando de documentación ejecuta SQL o servicios externos.
