# Integración 1.4.0 — entrega y activación

Fecha: 7 octubre 2026. Primero leer `AUDITORIA_INTEGRACION_2026-10-07.md`. Los cambios están preparados localmente; producción no fue modificada por esta sesión. Studio y el navegador fallaron al inicializar por un error del entorno. El adjunto del usuario solo exporta políticas RLS.

Actualización 8 octubre: el usuario aportó el preflight real y eligió transición gradual a Firebase para Android, conservando Supabase compartido. Leer `ACTIVACION_2026-10-08.md` e `INTEGRACION_1_4_1.md` para el desfase confirmado, SQL revisado, Auth/Firestore activos y APK actual. El plan anterior de ejecutar solamente tres migraciones nuevas no cubre las cuatro migraciones previas faltantes.

## Arquitectura implementada

Web pública → API Vercel del dominio www.dracha.store → RPC transaccional Supabase. Pedido + reservas + evento/cola push se confirman en la base. El emisor HTTP v1 FCM reclama jobs con lease y reintenta; un fallo push no elimina el pedido. Android recibe aviso genérico, actualiza Room y abre el pedido por UUID. WorkManager recupera pedidos si se pierde el aviso.

Android opera sobre Room v5: contabilidad/cola existentes más caché `flavor_cache` y cola `catalog_outbox`. La misma operación conserva UUID y versión esperada. El servidor confirma una sola vez; otra edición produce conflicto visible y requiere revisar/descartar el intento local. La web mantiene oferta comercial separada de stock físico y reserva nuevamente en SQL al pedir.

Sin red se consultan copias y se registran operaciones locales permitidas. No llegan pedidos nuevos. No se confirma globalmente un pago, entrega, conteo o puntos sin servidor. Las ventas locales pendientes NO son ventas aceptadas por el servidor. Varios vendedores completamente desconectados pueden vender físicamente la misma última unidad: al reconectar se detecta y concilia; no se puede prometer prevención física sin una asignación previa de stock por dispositivo.

## Cambios principales y archivos

- `api/_lib/auth.js`: credencial piloto individual opaca, hash SHA-256, expiración/revocación consultada en cada petición y rol limitado por cuenta autorizadora. Se conserva Supabase Auth ADMIN/SELLER como alternativa.
- `api/_lib/admin_handlers/{catalog,provisioning}.js`: catálogo con versión esperada; invitaciones aleatorias de 256 bits, uso único, 15 minutos; dispositivos revocables de 90 días. Rutas en el router administrativo existente, sin duplicar backend.
- `BackendClient.kt`, `OrdersActivity.kt`, manifiesto: launcher de Pedidos; autorizar una vez con invitación; credencial cifrada en Keystore; acceso a Administración y Sabores; selección del UUID recibido en notificación.
- `CatalogActivity.kt`, `CatalogEntities.kt`, `SyncDao.kt`, `AppDatabase.kt`: caché persistente, intención local separada del estado central, pendientes/conflictos, migración 4→5 sin borrado.
- `OrderSync.kt`, `NetworkConnection.kt`: red validada incluida móvil, backoff exponencial, cursor por páginas y continuación; se preservan transacciones/outbox contable. Un único trabajo inmediato y uno periódico sustituyen los trabajos de consulta duplicados.
- `PushRegistration.kt`, `OrderNotifications.kt`: registro de token con WorkManager; notificación con canal, sonido, deduplicación duradera, URI/PendingIntent distinto por pedido. No servicio permanente.
- `index.html`, `redesign.css`: destinos principales con descripción, controles secundarios consistentes, disponibles destacados e históricos secundarios. No cambia saldos, ranking, niveles ni recompensas.
- `order-confirmation.js`: dona rueda hacia marca y aparece check, después de respuesta verificable. Intento exacto guardado antes de POST; recarga/reintento conserva misma clave y payload. Respuesta fallida no muestra éxito; replay no repite animación. WhatsApp `50760887856` con mensaje codificado y código de pedido.
- `shared-inventory-refresh.js`: oferta/nombre/stock actuales, pantalla visible y conectada, intervalo de respaldo de 60 s y actualización al volver/reconectar; no borra cantidades del cliente.
- `client-tour.js` y `motion.js`: IDs, ocho pasos y versión/progreso conservados; texto de puntos adaptado y carrera entre animación de progreso y tutorial corregida.
- Workflow push usa www.dracha.store; workflow Android abre la nueva actividad launcher.

## Orden exacto de SQL Editor

No ejecutar todos los archivos históricos a ciegas. Si una migración ya se aplicó manualmente puede faltar en el ledger. Comparar existencia, columnas, firmas y definiciones con el repositorio.

| Orden / archivo | Objetivo y dependencias | Riesgo / verificación |
|---|---|---|
| 0. `supabase/sql-editor/phase18/00_preflight.sql` | Solo lectura del esquema, RLS, funciones, triggers, publicación y ledger. | No modifica datos. Conservar resultado sin registros privados ni tokens. Deben existir los contratos previos, en especial inventario compartido, push y restauración. |
| Previos faltantes | Migraciones ordenadas de `202609200001` a `202610050002`, SOLO las ausentes tras inspección. `seed_donut_flavors.sql` SOLO si el catálogo aún no existe. | No repetir semillas sobre nombres/precios modificados ni reemplazar stock. El conteo físico es una operación distinta y explícita. |
| 1. `202610070001_catalog_operations.sql` | Añade recibos idempotentes y RPC de nombre/disponibilidad con `updated_at` esperado. Depende de variantes, roles, triggers updated_at y locks de inventario existentes. | No cambia sabores ni stock al aplicarse. Tabla nueva con RLS, RPC solo service_role. Verificar firmas/permisos con 05. |
| 2. `202610070002_staff_device_provisioning.sql` | Invitaciones, credenciales individuales y RPC de issue/claim/revoke. Depende de app_user_roles, app_devices, push_devices, auth.users. | Hashes privados y privilegios cerrados; nuevas credenciales requieren autorización ADMIN. No amplía anon/authenticated. Verificar aislamiento y revocación en 05/pruebas aisladas. |
| 3. `202610070003_push_device_revocation.sql` | Wrapper de reclamación push que desactiva dispositivos revocados/expirados antes del envío. | Renombra implementación previa; comprobar que existe función con firma text[]. Preserva jobs y dispositivos tradicionales. Verificar SELECT de dispositivos sin tokens. |
| 4. `04_optional_realtime.sql` | Publicación opcional de product_variants. No publica nuevos datos privados. | API/Room siguen usando respaldo; esta entrega no introduce un cliente Supabase Realtime ni anuncia actualización instantánea. Se puede omitir. |
| 5. `05_verify.sql` | Integridad de saldos, operaciones/jobs, pagos, oferta versus stock, privilegios y funciones. | Solo lectura. Conteos de anomalías deben ser cero; las filas de sabores se revisan con el negocio. |
| Reversión. `06_safe_shutdown.sql` | Revoca piloto/desactiva push piloto y retira ejecución de nuevos RPC. | No borra historia/tablas. Antes, desplegar clientes sin edición/aprovisionamiento. Para reactivar restaurar grants service_role de migraciones y emitir nuevas invitaciones. No revierte automáticamente ediciones legítimas. |

Los archivos 1–3 están en `supabase/migrations/`. Abrir cada archivo, copiar SU contenido completo en una consulta nueva de SQL Editor del proyecto correcto y ejecutar individualmente en orden. Cada migración tiene BEGIN/COMMIT. No combinar con versiones anteriores ni volver a ejecutarla si sus objetos ya existen. Primero validar en un proyecto de pruebas; confirmar el preflight real antes de producción. No desactivar RLS.

Tablas/RLS/RPC/eventos se agrupan en tres transacciones aditivas para no dejar una función privilegiada publicada sin sus permisos. No hace falta una migración nueva de unidades físicas: se conserva el modelo compartido existente y no se alteran datos de clientes o inventario. Ninguna clave privada pertenece a estos scripts.

## Firebase y servidor: pasos externos, no SQL

Proyecto confirmado por el usuario: `donascontrol-1f5df`, número/Sender ID `476925718096`. Registrar la app oficial Android con paquete exacto `com.bryan.donas.control`. Debug usa `com.bryan.donas`; piloto usa `com.bryan.donas.pilot` y necesita su propio registro si se prueba allí.

1. Descargar google-services.json del registro Android correcto y obtener `mobilesdk_app_id`, API key pública y project_number. El proyecto inicializa FirebaseOptions directamente; no requiere introducir plugin Gradle nuevo. NO usar un ejemplo de package ID ni inventar App ID.
2. Compilar con propiedades Gradle `FIREBASE_APP_ID`, `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_SENDER_ID`. Proyecto y Sender ID tienen defaults públicos confirmados; sin App ID/API key la app deja FCM deshabilitado de manera explícita. En CI usar las variables existentes FIREBASE_ANDROID_APP_ID, FIREBASE_ANDROID_API_KEY, FIREBASE_PROJECT_ID, FIREBASE_SENDER_ID.
3. Habilitar Firebase Cloud Messaging API v1. En Vercel configurar `FCM_PROJECT_ID=donascontrol-1f5df`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` desde una cuenta de servicio con permiso de enviar FCM. La clave privada NO se copia al repo/APK/web. No es necesario desplegar Cloud Functions ni Edge Functions: se reutiliza el emisor Vercel existente.
4. Confirmar que `SUPABASE_URL`, anon key y service role del servidor apuntan al mismo proyecto inspeccionado en Studio. Solo Vercel recibe service role. Web y Android usan www.dracha.store, no un proyecto Supabase separado.
5. Configurar un secreto aleatorio `CRON_SECRET` en Vercel y el mismo valor en GitHub Actions como `ORDER_PUSH_CRON_SECRET`. Workflow de respaldo cada 5 minutos; el pedido también dispara dispatcher después del commit. Los schedules de GitHub pueden retrasarse: no son garantía de entrega. No ejecutar el dispatcher público sin autenticación.
6. Desplegar API/web después de aplicar las migraciones compatibles. Aprovisionar dispositivo desde panel ADMIN → Dispositivos autorizados → Crear invitación, pegarla una vez en Donas Control. SELLER puede consultar/gestionar pedidos según los permisos existentes; la edición del catálogo, conteos y sincronización del libro contable siguen siendo ADMIN. Una venta local pendiente no obtiene autorización por asignarle un rol distinto. Revocar desde el mismo panel; cerrar una cuenta o retirarle rol también corta acceso servidor.
7. Android 13+: permitir notificaciones. Canal Pedidos nuevos usa sonido predeterminado y puede configurarse en ajustes del sistema. No se requieren exclusiones de batería excesivas. La app detenida forzosamente desde ajustes necesita abrirse otra vez; FCM depende de Play Services/red/permisos.

Referencias técnicas: [Recepción FCM Android](https://firebase.google.com/docs/cloud-messaging/android/receive-messages), [Configurar FCM Android](https://firebase.google.com/docs/cloud-messaging/android/get-started), [WorkManager/backoff](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work), [Offline first Android](https://developer.android.com/topic/architecture/data-layer/offline-first).

## Compilar y conservar datos

JDK 17, SDK 35, Build Tools 35.0.0, Gradle wrapper 8.11.1. Versión 1.4.0 / versionCode 12. Room v5 conserva contabilidad y pedidos anteriores; no desinstalar ni borrar datos. Si se traslada backup del piloto, verificar primero su identidad con la cuenta original antes de aprovisionar nueva credencial.

Desde android/donas-control, con JAVA_HOME y ANDROID_HOME configurados:

```powershell
.\gradlew.bat testDebugUnitTest assembleDebug lintDebug
```

Para oficial usar `scripts/build-android-official.ps1` y la clave permanente EXISTENTE. Configurar las propiedades Firebase con variables `ORG_GRADLE_PROJECT_FIREBASE_APP_ID` / `FIREBASE_API_KEY` / `FIREBASE_PROJECT_ID` / `FIREBASE_SENDER_ID` o gradle.properties privado fuera del repo. No generar otra clave para actualizar un APK instalado. APK debug no reemplaza oficial.

## Pruebas y límites

Ver `VALIDACION_INTEGRACION_2026-10-07.md` para resultados finales y comandos. Las pruebas backend son PostgreSQL aislado (PGlite) y proveedores HTTP simulados; no equivalen a permisos/migraciones reales de Supabase. Browser usa API simulada y Chromium real; capturas en `test-output/integration`.

Pendiente en producción/dispositivo: URL real de Supabase y migraciones aplicadas, credenciales Firebase cliente/emisor, despliegue web/API, instalación con firma existente, pedido real autorizado, recepción foreground/background/pantalla bloqueada, tap al pedido, pérdida de conexión y revocación. No había dispositivo ADB conectado. No hay evidencia de entrega FCM real en esta sesión.

Nuevo sabor/SKU: el negocio actual y las transacciones de compra por cajas contienen reglas fijas para cuatro SKUs. Se implementa edición de nombre/oferta de variantes existentes. Crear un quinto sabor requeriría definir distribución de cajas, FIFO por sabor y conteo; no se activa una creación que quedaría desconectada de esas reglas.

Realtime: se mantiene el respaldo visible de 60 segundos y refresh al regresar; se ofrece configuración opcional de publicación. La autorización opaca de dispositivo no se entrega a Supabase Realtime directamente. No se añadió SDK o suscripción privada que rompiera ese modelo de seguridad. Puntos pendientes: no existe un saldo pendiente en el esquema actual; los pedidos sin pago/entrega NO suman puntos disponibles ni históricos. Gastos/reembolsos permanecen en el libro real; no se deriva gasto total como lifetime-available porque existen ajustes/devoluciones.

## Inventario exacto de archivos de esta entrega

El directorio exports/ ya existía y no se modificó. APK, hashes, reportes y capturas son artefactos ignorados por Git.

```text
.github/workflows/android-pilot-build.yml
.github/workflows/mobile-contracts.yml
.github/workflows/order-push-retry.yml
android/donas-control/app/build.gradle.kts
android/donas-control/app/schemas/com.bryan.donas.data.db.AppDatabase/5.json
android/donas-control/app/src/androidTest/java/com/bryan/donas/DatabaseDeviceTest.kt
android/donas-control/app/src/main/AndroidManifest.xml
android/donas-control/app/src/main/java/com/bryan/donas/DonasApp.kt
android/donas-control/app/src/main/java/com/bryan/donas/data/BackendClient.kt
android/donas-control/app/src/main/java/com/bryan/donas/data/NetworkConnection.kt
android/donas-control/app/src/main/java/com/bryan/donas/data/OrderNotifications.kt
android/donas-control/app/src/main/java/com/bryan/donas/data/OrderSync.kt
android/donas-control/app/src/main/java/com/bryan/donas/data/PushRegistration.kt
android/donas-control/app/src/main/java/com/bryan/donas/data/db/AppDatabase.kt
android/donas-control/app/src/main/java/com/bryan/donas/data/db/CatalogEntities.kt
android/donas-control/app/src/main/java/com/bryan/donas/data/db/SyncDao.kt
android/donas-control/app/src/main/java/com/bryan/donas/ui/CatalogActivity.kt
android/donas-control/app/src/main/java/com/bryan/donas/ui/InventoryActivity.kt
android/donas-control/app/src/main/java/com/bryan/donas/ui/MainActivity.kt
android/donas-control/app/src/main/java/com/bryan/donas/ui/OrdersActivity.kt
android/donas-control/app/src/test/java/com/bryan/donas/data/CatalogMigrationTest.kt
android/donas-control/app/src/test/java/com/bryan/donas/data/CatalogQueueTest.kt
android/donas-control/app/src/test/java/com/bryan/donas/data/OrderNotificationsTest.kt
api/_lib/admin_handlers/catalog.js
api/_lib/admin_handlers/devices.js
api/_lib/admin_handlers/provisioning.js
api/_lib/auth.js
api/_lib/order-push.js
api/_lib/supabase.js
api/admin/customers/[route].js
api/products.js
api/sync/index.js
assets/css/redesign.css
assets/js/client-tour.js
assets/js/motion.js
assets/js/order-confirmation.js
assets/js/shared-inventory-refresh.js
assets/js/staff-devices.js
docs/AUDITORIA_INTEGRACION_2026-10-07.md
docs/INTEGRACION_1_4_0.md
docs/VALIDACION_INTEGRACION_2026-10-07.md
index.html
supabase/migrations/202610070001_catalog_operations.sql
supabase/migrations/202610070002_staff_device_provisioning.sql
supabase/migrations/202610070003_push_device_revocation.sql
supabase/sql-editor/phase18/00_preflight.sql
supabase/sql-editor/phase18/04_optional_realtime.sql
supabase/sql-editor/phase18/05_verify.sql
supabase/sql-editor/phase18/06_safe_shutdown.sql
tests/integration-order-web.cjs
tests/phase17-postgres.sql
tests/pilot-catalog-postgres.mjs
tests/pilot-device-auth.cjs
tests/serve-fixture.cjs
tests/shared-inventory-refresh.cjs
tests/three-daily-purchases-postgres.mjs
```
