# Compilar, activar e instalar

[APK e informe de mantenimiento2.1.1](../DONAS_CONTROL_2_1_1_AVISOS.md). [Descarga oficial2.1.1](https://www.dracha.store/downloads/Donas-Control-2.1.1-oficial.apk); publicación/hash verificados en ese informe. CI de validación utiliza otra firma temporal y no es una actualización de distribución. El [informe de operación diaria2.0](../DONAS_CONTROL_2_RESULTADOS.md) conserva evidencia histórica.

[Contexto](AI_CONTEXT.md) · [Activación detallada](../DONAS_CONTROL_2_ACTIVACION.md)

## Android

JDK17, SDK35/build-tools35, Gradle wrapper. Desde raíz PowerShell:

```powershell
.\scripts\build-android-official.ps1 -FirebaseConfigPath .\.firebase\android\google-services.json
```

Usa firma oficial existente; genera outputs/Donas-Control-2.1.1-oficial.apk y SHA256. Es distribución privada firmada, no aprobación Google Play. Instalar sobre com.bryan.donas.control existente sin desinstalar; Room7 conserva historia/outbox y2.1.1 no añade migración. No instalar debug sobre firma oficial ni regenerar firma. Si la app era .pilot, no es la misma instalación; conservar copia y revisar traslado antes de importar.

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

Actualización posterior: usuario recibió prueba del sistema en Samsung A23 y confirmó recuperación programada desde ADMIN.2.1.1 corrige solo el estado visible de la comprobación. No reejecutar helper de variables/SQL para actualizar APK; cada ejecución del helper rota CRON_SECRET y obligaría a programar recuperación otra vez. Seguir con prueba de pedido real fuera de app/bloqueado.

Usar scripts/configure-order-notifications.ps1 -ServiceAccountPath <ruta local privada> después de autorizar Vercel CLI. Script valida proyecto y escribe por stdin(--sensitive); rota CRON_SECRET, no modifica variables Supabase. Redesplegar proyecto existente, conectar APK2.1 con cuenta Supabase, permitir canal/permisos, Activar/comprobar avisos, Activar recuperación(ADMIN), Enviar prueba. Comprobar realmente aviso y tap; luego pedido real con app abierta/segundo plano/bloqueada, duplicados/reconexión/estado/stock/puntos. No compartir archivo cuenta servicio o sus valores por chat/Git.

Pruebas nuevas: node tests/staff-notification-api.cjs,staff-notification-provider.cjs,staff-notification-postgres.mjs; unit/native renders, lint/build firmados y emuladores23/35. Aceptación del proveedor no equivale a entrega al teléfono.

Si2.1.1 finaliza con No se completó la comprobación, revisar el código en Avisos externos. La API tenía mínimo20 para refresh, incompatible con tokens Supabase de12; corregido en servidor, sin otro APK/SQL ni cambio de secretos. Después de verificar despliegue, volver a pulsar Activar/comprobar avisos con la sesión existente; si continúa, conservar diagnóstico. No borrar datos ni suponer que toda falla es FCM.

Estado posterior14octubre21:25UTC: CI86b0971 completo PASS (Android/API23/API35, web/API/SQL/browser/concurrencia y conocimiento), PR44 integrado en main a6067d8. Vercel dpl_ZKUMjhaFUVXVKKb5etaNp1DPH6A1 Production Ready y www.dracha.store verificado. Token ficticio de12 ahora alcanza al proveedor (401/INVALID_CREDENTIALS); vacío400, pedidos/avisos/despacho anónimos401, web/catálogo/inventario200 y rutas retiradas410. APK2.1.1 público200, tamaño/hash idénticos. No equivale a renovar la sesión privada del A23 ni entregar pedido bloqueado; se pidió volver a comprobar avisos. Sin nueva SQL ni cambios de secretos.

Investigación de avisos fuera de app: usuario A23 informa pedido sin aviso tras1min y recuperación al abrir. FCM ya usa alta prioridad/data y el worker también genera avisos por consulta; abrir no prueba push. Se corrige el reintento protegido para esperar dispatch/ACK y devolver aceptación/errores agregados; el envío inicial mantiene waitUntil y logs de códigos/contadores sin tokens/IDs. Accepted no significa mostrado. Consulta orders-v2/05_delivery_diagnosis.sql solo SELECT permite distinguir falta de dispositivo/job, intentos/rechazo/aceptación. No se pudo leer la cola real por timeout de Brave y clave protegida no exportable en env run; no se eludió protección. Mantener APK2.1.1/Room7/secretos/stock. Ver docs/DONAS_CONTROL_AVISOS_SEGUNDO_PLANO.md; falta diagnóstico actual del A23 y consulta real, sin solución física afirmada.

Verificación posterior14octubre21:43UTC: CI0b86b8d aprobado (web/API/SQL/browser/concurrencia y conocimiento), PR46 integrado en main6074252. Vercel dpl_HBYZRt4CtzXXeU6q7aTWxeEsN4bw Production Ready y alias www.dracha.store comprobados. Web/productos/inventario200; avisos/despacho/pedidos anónimos401. No se generó un pedido ni se modificó el APK/SQL/secretos. La consulta de logs del nuevo emisor no devolvió eventos correlacionables todavía; no demuestra cola vacía ni entrega. Se pidió SELECT de metadata y diagnóstico/prueba del A23. El fallo físico fuera de app sigue pendiente, no resuelto por esta instrumentación.

## Web Drachas18octubre

No requiere SQL ni recrear variables Firebase/Supabase. Maestro SVG assets/images/drachas-logo.svg; regenerar variantes con node scripts/build-brand-assets.cjs y @resvg/resvg-js2.6.2 (RESVG_MODULE si está fuera de node_modules). Pruebas nuevas API/customer-order-tracking y navegador bajo serve-fixture.cjs. Suite/CI existente y knowledge deben pasar antes de integrar. Publicación mediante PR/main de repositorio ya ligado a Vercel; comprobar Ready, marca/iconos/HTTP y privados401. No afirmar recorrido de cliente autenticado por una lectura pública. [Informe](../DRACHAS_WEB_2026-10-18.md).


## Portada de recompensas — 18 octubre 2026

La imagen de portada ya está en assets/images/drachas-doughnuts-natural-{480,960,1536}.webp. Para reemplazarla, seguir docs/DRACHAS_PORTADA_2026-10-18.md: mantener srcset/sizes, dimensiones3:2, texto alternativo, etiquetas y procedencia. No volver al placeholder. CSS landing?v=2 renueva caché. Revisar ambos productos completos en móvil/escritorio. No editar saldos ni fijar precio de portada: usa catálogo. Comprobaciones: landing-web.cjs, phase7-catalog.cjs, navegación y pedidos; proveedores de prueba simulados. Conservar customer view=shop y beginCustomerOrder.
