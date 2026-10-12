# Donas Racha web independiente — 1.5.0

El usuario decidió el 12 de octubre retirar la conexión con Donas Control. La web mantiene Supabase, sus cuentas ADMIN/SELLER, pedidos, cobros, clientes, puntos, ranking, premios y tutorial. Los archivos locales de Android y sus datos existentes no se borran. No se elimina el proyecto Firebase ni sus usuarios.

## Diagnóstico

El correo corresponde al workflow `Retry queued order alerts`. [Run 38219643257](https://github.com/NotKingbryanPY/donas-racha/actions/runs/38219643257) falló con `Missing repository secret ORDER_PUSH_CRON_SECRET. Retry dispatcher is inactive.`. El usuario decidió retirar esa función; se eliminan el workflow y el emisor, en lugar de solicitarle nuevas credenciales FCM. Los correos ya enviados permanecerán en Gmail; dejará de haber ejecuciones nuevas de ese workflow tras integrar el cambio en main.

El Dashboard devolvía «No se pudo completar la operación solicitada.». Ese mensaje oculta el código SQL, por lo que no prueba una causa SQL específica. El guardado usaba una cadena `api_set_shared_inventory` → `api_set_manual_inventory_before_shared`, añadida durante la transición móvil. El formulario tampoco diferenciaba una escritura confirmada con un refresco posterior fallido y permitía volver a guardar con una revisión antigua. Se elimina esa dependencia del helper en el SQL de reparación y se muestran códigos/referencias seguros; se conserva el borrador tras errores y conflictos. No se afirma que el error concreto de producción haya quedado verificado sin ejecutar la reparación y un conteo real autorizado.

## Cambios de código

- Autenticación administrativa por Supabase y sus roles existentes. Se retiran los vínculos Firebase y las credenciales piloto de la API.
- Rutas de dispositivos/aprovisionamiento/Firebase y `/api/sync` devuelven 410 sin consultar ni escribir datos. No queda emisor FCM/APNs ni dependencia `firebase-admin` en el backend desplegado.
- Se retiran CI Android/iOS/Firestore y el cron de alertas. Continúan las pruebas web, API y SQL. Los tests retirados son de servicios que ya no existen; las migraciones históricas y los fixtures necesarios para preservar datos se conservan.
- Se retira la sección Dispositivos autorizados. Inventario funciona desde la web; el nuevo editor usa la API existente de catálogo para nombres/disponibilidad. La disponibilidad comercial no añade stock. No se introducen sabores nuevos con SKU inventado.
- Se conserva el refresco web del catálogo, carrito, confirmación de pedido/WhatsApp y tutorial existente.

## SQL: plan, riesgos y orden

Los scripts están en `supabase/sql-editor/web-only`. Ejecutarlos completos, uno por consulta nueva, en el proyecto `yopntnzhcfudaabudbld`. No repetir el paquete de activación 02 antiguo ni sembrar el catálogo. Preparar respaldo antes de mover objetos y realizarlo sin un conteo concurrente. No hay DROP TABLE, CASCADE, ajustes automáticos de puntos ni stock inventado.

| Orden | Archivo | Propósito, dependencia, riesgo y verificación |
|---|---|---|
| 0 | `00_preflight.sql` | Solo lectura de funciones/columnas e inventario; útil si el esquema cambió. No contiene tokens ni datos personales de clientes. |
| 1 | `01_repair_inventory.sql` | Reemplaza las dos RPC de inventario usando las tablas verificadas existentes. ADMIN, transacción, bloqueo y revisión obligatoria; solo service_role puede ejecutarlas. Instalar el script no cambia los conteos. Un conteo posterior reemplaza las unidades físicas con lo que escriba el administrador. Resultado `WEB_INVENTORY_READY`, server_can_save=true, anon_can_save=false. |
| 2 | `02_archive_mobile.sql` | Después de publicar la API web independiente. Revoca acceso y archiva las cinco tablas de push/provisión/Firebase y sus RPC en `donas_mobile_archive`, privado y fuera de esquemas expuestos. Quita el trigger de nuevos avisos. Conserva filas/FK/historial. Los teléfonos pierden integración; es intencional. Mantiene public.app_devices/sync_operations y el ledger de stock como historial operacional con FK existentes. Resultado `MOBILE_ARCHIVED_WEB_PRESERVED`, indicadores true. No revoca api_update_flavor: la necesita la web. |
| 3 | `03_verify.sql` | Solo lectura; acceso al archivo privado denegado, inventario y reservas conservados, anomalías de pagos/puntos en cero y cero dispositivos push activos. |
| Recuperación | `04_restore_archive_structure.sql` | Recuperación estructural opcional. Devuelve los objetos al esquema público, mantiene credenciales revocadas y no concede EXECUTE, no restaura trigger/cron/emisor. No reactiva dispositivos ni modifica stock. |

Mantener `donas_mobile_archive` fuera de los esquemas expuestos por Supabase. No usar los antiguos `06_safe_shutdown.sql` / `07_disable_firebase_identity.sql`: su objetivo era otro y 06 revoca la RPC de catálogo que ahora necesita la web.

Tras retirar la conexión pueden eliminarse de Vercel las variables FCM_*, APNS_*, FIREBASE_AUTH_PROJECT_ID y CRON_SECRET, y de GitHub ORDER_PUSH_CRON_SECRET. No son necesarias para el código nuevo; no tocar SUPABASE_URL, SUPABASE_ANON_KEY ni SUPABASE_SERVICE_ROLE_KEY. Esta sesión no accede a sus valores privados ni cambia su configuración.

## Validación

Pasaron diez suites de contratos web/API existentes, seis suites SQL de inventario, permisos, pedidos y puntos, la prueba nueva SQL de reparación/archivo con preservación y recorrido posterior web, y los navegadores de pedidos/catálogo. La prueba nueva del Dashboard pasó a 360/768/1440: errores SQL visibles, borrador conservado, doble clic único, revisión inválida bloqueada después de guardado/refresco fallido, conflicto explícito y reintento idempotente de catálogo. Los proveedores están simulados; SQL es PostgreSQL aislado, no producción.

Se detectó un fallo del test de preflight con CRLF en Windows: no inyectaba el fallo tardío previsto. Se normalizó ese texto antes de la inyección y el test pasó. No se cambió el paquete SQL histórico.

Pendiente en Supabase: ejecutar los scripts y comprobar un conteo real de las cuatro cantidades desde la cuenta ADMIN. No se cambian cantidades de producción sin verificar físicamente; reservas sin unidades siguen pendientes de conciliación.

## Integración y publicación

[PR 39](https://github.com/NotKingbryanPY/donas-racha/pull/39) integrado como `73421a0fa9bf90faef7d878c199a9c4adb000a72`. El código `9a8bf0b56bd69e05f3cc4eeffb8dc4be1d2cdb10` pasó [CI 38274329446](https://github.com/NotKingbryanPY/donas-racha/actions/runs/38274329446): contracts, browser y concurrency. El workflow de push ya no existe en main.

A las 16:09 UTC del 12 de octubre, Vercel no informó un estado para el commit integrado. La consulta HTTP 200 a dracha.store todavía contenía staffDevicesPanel y no adminCatalogTitle: seguía sirviendo la versión anterior. No se confirmó publicación. El inventario Supabase no fue modificado por esta sesión. Computer/Browser devolvió inventario vacío y navegadores iab/edge no disponibles; no hubo acceso UI a Vercel/Supabase.

Acción externa necesaria: abrir el proyecto Vercel existente → Deployments → Create Deployment, usar main (que contiene el commit integrado) y elegir su configuración Production. Esperar Ready y comprobar la aparición de Catálogo de sabores y ausencia de Dispositivos autorizados. No redesplegar un commit antiguo. [Procedimiento oficial para desplegar una referencia Git](https://vercel.com/docs/git#creating-a-deployment-from-a-git-reference). Después ejecutar SQL 01/02/03 en orden; no afirmar limpieza de producción hasta recibir sus resultados.
