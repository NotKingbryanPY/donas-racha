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

Publicar cambios por PR/CI/GitHub main ligado a Vercel; comprobar Ready y HTTP de dominio. El endpoint diario devuelve DAILY_SETUP_REQUIRED si falta SQL y la web anterior sigue funcionando. Confirmar SQL y recorrido autenticado real antes de declarar integración total. No pedir ni imprimir claves privadas; en esta sesión no se pudo controlar Studio: timeouts/Debugger unattached.

## Mantenimiento

Actualizar guías/modelo/diagramas en cada cambio. Ejecutar generate/check, revisar todas las áreas del report, review y check --fresh. CI knowledge verifica vigencia; ningún comando de documentación ejecuta SQL o servicios externos.

## Activar pedidos/avisos2.1

Leer [plan2.1](../DONAS_CONTROL_2_1_PEDIDOS.md). SQL diario ya validado por usuario: no repetir. Para una instalación nueva de avisos ejecutar orders-v2/00_preflight,01_apply completo,02_verify,03_retry_scheduler;04_suspend conserva datos. Crear/configurar cuenta de servicio FCM solo en servidor; FCM_PROJECT_ID/FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY yCRON_SECRET protegidos en Production. El usuario ya autorizó la sesión CLI y se configuraron esas variables; no se leyó un almacén de credenciales.

Estado de esta instalación: el usuario ya confirmó02 ORDER_NOTIFICATIONS_SQL_READY con cuatro controles=true y0 teléfonos, y03 ORDER_RETRY_SUPPORT_INSTALLED. No repetir01/03. Emisor configurado, redespliegue Production Ready y FCM validate_only200 comprobados; seguir con registro del teléfono. Soporte instalado no significa cron activado: el botón ADMIN configura el secreto desde Vercel y programa el job después. Brave no permitió adjuntar el control; la autorización CLI la hizo el usuario. Rotar/revocar la clave privada compartida; la nueva credencial debe transferirse directamente al servidor sin pasar por chat/Git.

Usar scripts/configure-order-notifications.ps1 -ServiceAccountPath <ruta local privada> después de autorizar Vercel CLI. Script valida proyecto y escribe por stdin(--sensitive); rota CRON_SECRET, no modifica variables Supabase. Redesplegar proyecto existente, conectar APK2.1 con cuenta Supabase, permitir canal/permisos, Activar/comprobar avisos, Activar recuperación(ADMIN), Enviar prueba. Comprobar realmente aviso y tap; luego pedido real con app abierta/segundo plano/bloqueada, duplicados/reconexión/estado/stock/puntos. No compartir archivo cuenta servicio o sus valores por chat/Git.

Pruebas nuevas: node tests/staff-notification-api.cjs,staff-notification-provider.cjs,staff-notification-postgres.mjs; unit/native renders, lint/build firmados y emuladores23/35. Aceptación del proveedor no equivale a entrega al teléfono.
