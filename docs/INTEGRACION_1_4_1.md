# Donas Control 1.4.1 — Firebase y activación del flujo compartido

## Resultado y alcance

Firebase `donascontrol-1f5df` tiene correo/contraseña y Google habilitados. La app oficial registrada es `com.bryan.donas.control`, App ID `1:476925718096:android:09f47532b8e643b406ab55`. Se registraron las huellas de la firma permanente y se renovó la configuración pública con OAuth web. Firestore `(default)` es Standard, en `us-east1`, nivel gratuito. No se habilitó facturación ni Cloud Functions de pago.

Supabase sigue siendo la autoridad de pedidos, cobros, puntos, sabores y stock. Room mantiene los datos operativos y las colas persistentes offline. Firestore guarda únicamente `userPreferences/{uid}`: `uid`, `schemaVersion=1`, `theme=-1|1|2`, `updatedAt` del servidor. Su caché Android se limita a 20 MB; no hay suscripciones permanentes a preferencias. Las escrituras de preferencias pueden quedar pendientes; no son ventas confirmadas. Entre dispositivos se conserva el último tema confirmado por Firestore.

El diagnóstico y los cambios web/offline anteriores están en [AUDITORIA_INTEGRACION_2026-10-07.md](AUDITORIA_INTEGRACION_2026-10-07.md) e [INTEGRACION_1_4_0.md](INTEGRACION_1_4_0.md). Las pruebas y el artefacto exacto de esta versión se completan en [VALIDACION_1_4_1.md](VALIDACION_1_4_1.md).

## Archivos principales de esta entrega

| Área | Archivos / cambio |
|---|---|
| Android / Firebase | `FirebaseAccountActivity.kt`, `FirebasePreferences.kt`, `FirebaseTasks.kt`, `FirebaseCredentialState.kt`, `BackendClient.kt`, `DonasApp.kt`, manifest y `app/build.gradle.kts`: cuenta opcional, sesión persistente, vínculo autorizado y preferencias. |
| Android / operación | `OrderSync.kt`, `PushRegistration.kt`, `OrderNotifications.kt`, `SyncDao.kt`, entidades de catálogo, `CatalogActivity.kt`, `InventoryActivity.kt` y `OrdersActivity.kt`: copias Room, colas, estados, oferta comercial y pedido concreto desde el aviso. Se reutilizan las operaciones existentes. |
| Backend | `api/_lib/firebase-auth.js`, `auth.js`, `admin_handlers/firebase-identity.js`, `provisioning.js`, `devices.js`, `api/admin/orders/index.js`, `api/products.js`, `api/sync/index.js`: verificación de identidad, permisos, dispositivos, catálogo y sincronización. |
| SQL | `supabase/migrations/202610070001_catalog_operations.sql`, `202610070002_staff_device_provisioning.sql`, `202610070003_push_device_revocation.sql`, `202610080001_firebase_staff_identity.sql` y el paquete revisado `supabase/sql-editor/phase18/`. |
| Web | `index.html`, `assets/css/redesign.css`, `assets/js/order-confirmation.js`, `shared-inventory-refresh.js`, `catalog-realtime.js`, `client-tour.js`, `motion.js`, `staff-devices.js`: navegación, puntos, confirmación, contacto, catálogo y tutorial. SDK oficial público fijado en `assets/vendor/`. |
| Firebase / compilación | `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `scripts/firebase-connect.ps1`, `Get-FirebaseAndroidConfiguration.ps1`, `build-android-official.ps1`, workflows y pruebas de contrato/emulador. La configuración pública descargada y los APK quedan fuera de Git. |

Los archivos Kotlin están bajo `android/donas-control/app/src/main/java/com/bryan/donas/`. La lista incluye el trabajo coordinado anterior y los cambios de Firebase. API/web ya publicada: ver [DESPLIEGUE_PRODUCCION_1_4_1.md](DESPLIEGUE_PRODUCCION_1_4_1.md).

## Acceso administrativo

La app abre Pedidos. La autorización inicial sigue siendo una invitación individual de un uso, o la sesión administrativa Supabase existente. En «Cuenta · Correo o Google» se puede crear una cuenta, entrar con correo/contraseña, entrar con Google y verificar el correo. «Vincular cuenta» exige esa autorización previa; después Firebase conserva la sesión y renueva sus ID tokens sin un login en cada apertura.

El servidor verifica firma, emisor, audiencia y expiración con Firebase Admin SDK. También exige correo verificado, vínculo Firebase UID/dispositivo, `app_devices` activo, credencial original vigente cuando corresponda, y roles actuales de Supabase. `api_resolve_firebase_device` comprueba todo en una consulta consistente, evitando cuatro llamadas REST por autorización. SELLER conserva su límite aunque la cuenta que emitió la invitación sea ADMIN. Registrarse en Firebase o escribir preferencias no concede acceso a pedidos. Al reautorizar un dispositivo con otra invitación válida se puede renovar su vínculo; no se elimina silenciosamente la prueba revocable original.

La revocación del dispositivo es inmediata en la API. Firebase Admin SDK verifica ID tokens sin `checkRevoked`, por lo que deshabilitar una cuenta únicamente en Firebase puede tardar hasta la expiración del ID token (aproximadamente una hora). Para revocación administrativa inmediata se debe revocar también el dispositivo en el flujo de Donas Racha. No se agregó una cuenta de servicio al APK ni una contraseña universal.

Un teléfono sin conexión conserva su copia previamente autorizada: no puede conocer una revocación remota hasta recuperar conectividad. La API rechaza el acceso al volver a comunicarse; no se promete borrado remoto instantáneo de Room mientras el teléfono esté offline. Las copias automáticas y el traslado automático de datos/credenciales entre dispositivos están excluidos en el manifest y sus reglas de backup.

## SQL Editor: archivos exactos y orden

En Supabase Studio, selecciona el proyecto `yopntnzhcfudaabudbld`, abre SQL Editor, crea una consulta, pega **todo el contenido de un archivo**, ejecuta y revisa el resultado antes del siguiente. No mezcles scripts opcionales o de cierre con la activación.

Si 02 produjo `unterminated dollar-quoted string`, seguir [RECUPERAR_SQL_02.md](RECUPERAR_SQL_02.md): comprobar el estado antes de reintentar y copiar el archivo entero con `Get-Content -Raw | Set-Clipboard`. El paquete actualizado usa una variable de transacción para su comparación de inventario, evitando la reescritura RLS de una tabla temporal por Studio. Su última línea es `-- END DONAS_APPLY_02_COMPLETE`.

| Orden / archivo | Objetivo y dependencias | Riesgo / verificación |
|---|---|---|
| `00_preflight_export.sql` | Lectura del esquema real; ya aportado por el usuario. | No modifica datos; sirve de comparación. |
| `01_inventory_cutover_preview.sql` | Lectura del cambio de inventario sobre el esquema actual. | Revisar `availability_delta=0`. Las dos unidades reservadas de chocolate con chispas que exceden el conteo requieren revisión física; no se inventa stock. |
| `02_apply_missing_20261008.sql` | Siete migraciones faltantes, en una transacción, para stock compartido, RPC, eventos/cola push, catálogo e invitaciones. Requiere el esquema exportado. | Puede esperar bloqueos o abortar por diferencias de esquema. Preserva los conteos/puntos/pedidos existentes y no ejecuta seed. Repetirlo falla deliberadamente. Ver `05_verify_export.sql`. |
| `03_firebase_identity_bridge.sql` | Tabla RLS privada y RPC de vínculo Firebase/dispositivo. Requiere 02 y sus credenciales individuales. | No migra ni reasigna usuarios/puntos automáticamente. Solo `service_role` ejecuta el RPC desde el backend; ver privilegios en 05. |
| `04_optional_realtime.sql` | Publicación opcional del catálogo público. Requiere la publicación Supabase existente. | No convierte Realtime en push ni expone pedidos. El refresco de respaldo de la web sigue funcionando. |
| `05_verify_export.sql` | Un resultado de integridad, sabores, permisos, RPC y trigger monotónico. Requiere 02; informa 03 cuando existe. | Anomalías inesperadas deben investigarse antes de operaciones reales. `anonSelect`/`authenticatedSelect` deben ser false en las tablas privadas, y EXECUTE de las RPC críticas solo para service_role. |
| `06_safe_shutdown.sql` | Cierre de invitaciones/catálogo/push, conservando historial. Requiere 02. | Revoca credenciales; no es reversión del inventario después de nuevas operaciones. Reautorizar cada dispositivo tras corregir el problema. |
| `07_disable_firebase_identity.sql` | Cierre reversible del acceso Firebase administrativo. Requiere 03. | Las sesiones Firebase pierden acceso; usar autorización individual/Supabase para volver a vincular. No elimina registros ni toca inventario. |

Los archivos están en `supabase/sql-editor/phase18/`. El paquete 02 se genera con `node scripts/build-supabase-activation.mjs`; 03 corresponde a `supabase/migrations/202610080001_firebase_staff_identity.sql`. El usuario informó aplicación exitosa de 02/03/04 y aportó 05 sin anomalías. El agente no ejecutó SQL de producción. No repetir el paquete ni ejecutar ningún seed de sabores en la base existente; 06/07 son cierres opcionales, no pasos de activación.

## Backend y FCM pendientes de activación

Los cambios de API y web están publicados en el hosting actual, con dependencia Firebase Admin y Node 22. `FIREBASE_AUTH_PROJECT_ID=donascontrol-1f5df` es público y ya tiene ese valor por defecto. La verificación de ID tokens usa certificados públicos de Google y no necesita una clave de cuenta de servicio.

Firebase Cloud Messaging HTTP v1 (`fcm.googleapis.com`) está habilitado: se comprobó `ENABLED` en Service Usage para este proyecto. El envío todavía necesita una cuenta de servicio con permiso FCM y su autorización en el servidor. Configurar únicamente en las variables protegidas del hosting `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`. Nunca pegar claves en el chat, SQL, APK, frontend ni Git. `google-services.json` no reemplaza estas credenciales. No se creó una clave privada sin un destino de servidor disponible. Ver la [configuración oficial del servidor FCM](https://firebase.google.com/docs/cloud-messaging/server-environment).

Tras 02, el trigger persiste los eventos de pedidos y la cola push. El backend confirma el pedido antes de intentar el aviso. El trabajo de reintento usa `CRON_SECRET` y el workflow existente `order-push-retry.yml`; configurar el secreto correspondiente `ORDER_PUSH_CRON_SECRET` del repositorio. Un fallo del envío conserva el pedido y el trabajo pendiente. Un token `UNREGISTERED` se desactiva. La entrega de FCM no equivale a que Android haya mostrado la notificación: comprobar permiso Android 13+, sonido y restricciones del dispositivo.

No es obligatorio contratar Cloud Functions: el emisor existente vive en el backend actual. Realtime solo refresca pantallas activas. No se añadieron servicios Android permanentes ni permisos para excluir globalmente la app del ahorro de batería.

## Compilar e instalar

En PowerShell, desde la carpeta del repositorio:

```powershell
.\scripts\firebase-connect.ps1
.\scripts\build-android-official.ps1 -FirebaseConfigPath .\.firebase\android\google-services.json
```

Necesitas JDK 17 y Android SDK 35 disponibles (`JAVA_HOME`, `ANDROID_HOME`). La configuración descargada es pública; el script rechaza claves de cuenta de servicio y valida proyecto, sender, paquete y cliente OAuth. Conserva el keystore oficial existente y sus credenciales locales; no generes otro para una actualización. El APK queda en `outputs/Donas-Control-1.4.1-oficial.apk`, con SHA-256 aparte.

El script ejecuta pruebas y lint antes de optimizar el APK. Compila Kotlin en el proceso Gradle para evitar otro daemon de aproximadamente 1 GB durante este build; se mantienen dos workers y el límite Gradle de 2 GB. Esta configuración reduce la presión de memoria en el equipo de compilación, no demuestra por sí sola el rendimiento del teléfono.

Se fijó BoM 34.12.0 tras consultar Google Maven e inspeccionar los AAR: Auth 24.1+ exige Kotlin 2.3 y Auth 25 además API 24. La combinación elegida mantiene Kotlin 2.1.20 y API 23. Credential Manager 1.6.0 y Google ID 1.1.1 son compatibles con el SDK actual. Firebase se inicializa con las opciones públicas del flujo existente; se preservan las variantes debug/piloto/oficial sin sustituir su configuración por otro sistema.

Instala sobre la app oficial para conservar Room. No borres datos de la app para resolver problemas de sincronización. Si vienes del paquete piloto, conserva su copia y utiliza el traslado de identidad existente.

## Validación final en dispositivo

Con 02/03, API/web y FCM servidor activados, crear un pedido de prueba identificable y comprobar recepción/estados/stock/puntos en ambos clientes. Probar app abierta, segundo plano y teléfono bloqueado; tocar el aviso y verificar el pedido concreto, incluso si es antiguo. Repetir el envío de la operación y comprobar que no duplica pedido, cobro, puntos ni inventario.

Desconectar el teléfono, consultar datos ya sincronizados, registrar operaciones permitidas y cerrar el proceso. Recuperar conexión y comprobar reintentos, pendientes y conflictos. Confirmar que no aparece una venta pendiente como confirmada y que no se reciben pedidos nuevos sin Internet.

Crear/desactivar un sabor existente y comprobar la web tras el refresco; verificar stock reservado y rechazo de sobreventa. Google/correo deben vincularse con invitación y correo verificado. Revocar el dispositivo y comprobar que la API niega pedidos, sin conceder roles a una cuenta recién creada.

La web ya tiene puntos disponibles destacados, total histórico secundario, navegación Perfil/Pedidos y subnavegación accesibles, tutorial conservado, confirmación tras éxito verificable, recuperación del intento al recargar y WhatsApp `50760887856` con código de pedido. La suscripción pública Realtime del catálogo refresca por API al cambiar un sabor y recupera cambios perdidos al reconectar; mantiene el refresco de stock de respaldo. Las pruebas de navegador usan proveedores simulados, incluido WebSocket con SDK real; no sustituyen este recorrido con producción y un teléfono físico. Seguir [DESPLIEGUE_WEB_1_4_1.md](DESPLIEGUE_WEB_1_4_1.md) para activar el hosting existente.
