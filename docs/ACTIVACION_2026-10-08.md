# Activación y transición gradual — 8 octubre 2026

Estado actualizado: Firebase Authentication (correo/contraseña y Google) desplegado; Firestore `(default)` creado en `us-east1`, edición Standard, `freeTier=true`. El usuario ejecutó el paquete SQL 02 corregido y aportó `APPLIED`, con disponibilidad/reservas preservadas, un sabor pendiente de conciliación, cero trabajos push y cero credenciales piloto. También informó `FIREBASE_BRIDGE_APPLIED` para 03 y `REALTIME_CATALOG_READY` para 04. La verificación completa 05 recibida confirma seis contadores de anomalías en cero, ocho tablas privadas protegidas, once RPC sin acceso anon/authenticated y el trigger de versión del catálogo habilitado. La API/web 1.4.1 está publicada en dracha.store: ver [DESPLIEGUE_PRODUCCION_1_4_1.md](DESPLIEGUE_PRODUCCION_1_4_1.md) para el commit, CI aprobado, comprobaciones reales y pruebas pendientes. El usuario confirmó las variables Supabase del hosting antes de autorizar la integración de PR 37. Firebase se configuró con la CLI y el MCP oficiales autenticados; no se modificaron las variables privadas Vercel desde esta sesión.

APK 1.4.1 oficial generado y firmado con el certificado existente: 99 pruebas Android y lint debug/oficial pasaron; verificación de firma, alineación, paquete y configuración Firebase completada. FCM HTTP v1 está habilitado en el proyecto; quedan las credenciales protegidas del emisor en el hosting y la prueba física.

## Esquema real recibido

El CSV ghghghgh.csv contiene 117 restricciones de 35 tablas. El resultado completo de `00_preflight_export.sql`, aportado por el usuario, corresponde a PostgreSQL 17.6, capturado a las 10:13:44 UTC, sin ledger `supabase_migrations.schema_migrations`. Proyecto indicado: `https://yopntnzhcfudaabudbld.supabase.co`, NotKingbryanPY project. La URL configurada en Vercel todavía requiere comprobación autenticada.

El preflight inicial confirmó que faltaban `inventory_movements`, `inventory_revision`, `push_devices`, `order_push_jobs`, `catalog_change_receipts`, `staff_device_invitations` y `staff_device_credentials`. Tampoco existían sus RPC, los wrappers `before_lock_order`, `api_restore_device_identity`, `api_push_sync_before_device_ownership`, ni `app_devices.restored_to_official` / `inventory_manual_counts.movement_sequence`. El paquete 02 aportado posteriormente por el usuario instaló estos cambios; 05 confirma las nuevas tablas y RPC.

La vista de inventario sigue siendo la manual anterior: ignora las compras/ventas contables Android y descuenta solamente entregas web posteriores al conteo. Esto explica la divergencia entre Android y web. No existe el trigger `new_order_push` ni el registro/cola push: FCM en el código no basta para notificaciones reales. El catálogo carece del trigger original de `updated_at`; sin reparar ese punto dos ediciones pueden compartir versión y el control de conflictos falla. La migración de catálogo ahora añade un trigger monotónico, sin reescribir filas al instalarlo.

RLS está activo en las tablas recibidas. Las RPC críticas revisadas niegan EXECUTE a anon/authenticated y lo conceden solo a service_role. Las políticas de clientes filtran por propietario; authenticated SELECT por sí solo no implica acceso a todos los pedidos. Realtime publica api_rate_limits, box_purchases y flavor_sales; publicar pedidos no solucionaría las migraciones faltantes ni sustituiría FCM.

Consulta pública de inventario HTTP 200 a las 10:11 UTC: chocolate 18 disponibles/2 reservadas; vainilla 18/0; chocolate con chispas 0/2; vainilla con chispas 0/0. Chocolate con chispas tiene reservas superiores al conteo registrado. No se añadió stock ni se canceló un pedido para corregirlo.

## SQL exacto según el preflight

El usuario mantiene Supabase como centro compartido durante la transición Firebase. Preparar respaldo de base y coordinar una ventana breve sin cambios de conteo/ventas durante la conversión. Revisar las colas locales existentes: un conteo físico que ya incluye ventas aún no enviadas requiere conciliación; la migración no puede conocer el estado de teléfonos desconectados.

| Orden / archivo | Objetivo y dependencias | Riesgo y verificación |
|---|---|---|
| `00_preflight_export.sql` | Solo lectura; todas las secciones en un único resultado exportable. | Ya recibido; volver a ejecutar si cambió el esquema. No contiene clientes, tokens ni hashes de credenciales. |
| `01_inventory_cutover_preview.sql` | Proyecta conversión de conteos manuales antes del ledger compartido. Depende de las tablas/vista confirmadas. | Solo lectura. `availability_delta` debe ser cero; `units_to_reconcile` revela reservas sin unidades físicas. No ejecuta un conteo. |
| `02_apply_missing_20261008.sql` | Paquete generado de las siete migraciones exactas faltantes, una transacción. Comprueba tablas protegidas, funciones/permisos, cuatro sabores y ausencia de instalación parcial. | Convierte conteos descontando entregas ya aplicadas; preserva disponibilidad/reservas mediante comprobación que aborta ante diferencias. Bloqueos limitados a 5 s, ejecución a 60 s. No ejecutar si ya existe alguno de sus objetos. Resultado final `APPLIED`. |
| `05_verify_export.sql` | Integridad, sabores, permisos y trigger de catálogo en un resultado. | Solo lectura. Anomalías cero; tablas privadas con RLS y SELECT anon/authenticated falso; RPC privilegiadas cerradas a esos roles. La función `api_claim_order_push_before_staff_devices` también debe negar service_role. Sabores con counted=false requieren conciliación comercial/física. |
| `06_safe_shutdown.sql` | Desactiva acceso piloto/push piloto y nuevos RPC; conserva historia. | Usar con clientes/API compatibles. No revierte el ledger compartido tras recibir movimientos. No intentar reconstruir conteos históricos automáticamente. |

Archivos en `supabase/sql-editor/phase18`. Copiar cada archivo completo en una consulta nueva de SQL Editor del proyecto indicado. El paquete 02 sustituye la ejecución individual de sus siete fuentes; nunca ejecutar ambas opciones ni repetir una aplicación exitosa. Si falla, no hay éxito confirmado: conservar el error, ejecutar ROLLBACK si la sesión quedó abortada y revisar antes de reintentar. No repetir `seed_donut_flavors.sql`.

Fuentes del paquete, en orden: 202610030001_shared_inventory, 202610030002_order_push, 202610050001_inventory_lock_order, 202610050002_mobile_restore_identity, 202610070001_catalog_operations, 202610070002_staff_device_provisioning y 202610070003_push_device_revocation. Se genera con `node scripts/build-supabase-activation.mjs`; cada fuente incluye SHA-256 para detectar cambios. No modifica el historial de migraciones recibido ni finge que SQL Editor registró versiones.

## Firebase solicitado y autorizado

El usuario eligió explícitamente: Firebase para Android, conservar Supabase como centro compartido durante una transición gradual. Firebase Authentication usará Email/Password y Google Sign-in. Firestore no será un segundo inventario/pedido editable. Room conserva las copias offline y las colas. El vínculo de Firebase UID con autorización ADMIN/SELLER debe establecerse en el servidor; registrarse o iniciar sesión con Google no concede un rol.

Proyecto: `donascontrol-1f5df`, sender `476925718096`; App ID `1:476925718096:android:09f47532b8e643b406ab55`. Paquete registrado y verificado: `com.bryan.donas.control`. Se registraron SHA-1/SHA-256 de la firma oficial existente; la configuración descargada contiene el cliente OAuth web necesario para Google.

Se instalaron 13 habilidades del repositorio oficial firebase/agent-skills en ~/.codex/skills; se usaron firebase-basics, firebase-auth-basics, firebase-firestore, firestore-rules-creation y firebase-security-rules-auditor. AGENTS.md conserva la instrucción del usuario. El MCP oficial se usa mediante su SDK y está configurado globalmente para futuras sesiones. CLI 15.33.0 autenticada; acceso al proyecto comprobado sin imprimir credenciales.

El cliente MCP SDK conectó al servidor oficial Firebase 0.3.0. El proyecto se vincula por `.firebaserc` y `--dir`; `mcp --project` no está soportado. Auth y Firestore terminaron con estado de despliegue `success`. `firestore_get_database` confirmó ubicación, edición y nivel gratuito antes de añadir el SDK/modelo. Los errores previos de autenticación/API deshabilitada se resolvieron; no se usaron para inventar el estado de una base.

Ejecutar en PowerShell, desde este repositorio:

```powershell
.\scripts\firebase-connect.ps1
```

El script inicia autorización Google y, cuando la CLI lo exige, recibe el código oculto en la terminal. No enviar códigos, tokens o claves privadas al chat. Verifica acceso al proyecto, descarga SDK config mediante CLI, valida proyecto/sender/App ID/paquete y guarda `.firebase/android/google-services.json` (ignorado por Git). Reiniciar Codex permite cargar las herramientas MCP recién configuradas.

La ubicación `us-east1` fue elegida expresamente por el usuario. No se habilitó Blaze ni se cambió la facturación. Firestore solo guarda preferencias personales de tema; las reglas niegan pedidos, inventario, puntos y roles. El registro Firebase no otorga permisos administrativos.

Huellas verificadas del certificado del APK oficial existente: SHA-1 `F9:58:06:67:AE:DA:3F:A8:6F:54:33:FF:9B:F5:73:08:09:3A:09:F8`; SHA-256 `56:81:A1:32:97:40:C4:6B:2C:7A:71:8E:3E:8A:43:19:51:C7:B6:48:6F:C6:25:19:6D:C3:DD:7E:CA:DB:24:9D`. Se obtuvieron del reporte apksigner de la compilación anterior, no de una nueva clave. Si Google Play vuelve a firmar la distribución, registrar también el certificado de firma de Play.

La implementación Auth/Firestore comenzó después de verificar la conexión. El emisor FCM privado sigue pendiente en servidor; la configuración pública Android no lo reemplaza. Un fallo nativo al cerrar el servidor localhost de login no anulaba la sesión guardada: el script usa el flujo remoto y comprueba acceso al proyecto. Una comprobación inicial imprimió tokens privados; esa sesión fue revocada y el usuario autorizó otra. El código ahora evita imprimir `login:list --json` y mantiene secretos fuera de registros/Git.

Para compilar una vez descargada la configuración:

```powershell
.\scripts\build-android-official.ps1 -FirebaseConfigPath .\.firebase\android\google-services.json
```

El build conserva firma e importa cinco valores públicos (incluido OAuth web) en variables temporales de proceso; restaura el entorno al terminar y rechaza cuentas de servicio. `firebase-connect.ps1` descarga a un temporal, valida y reemplaza la configuración existente para permitir su renovación.

## Comprobaciones nuevas

- PASS `preflight-cutover-postgres.mjs`: el paquete 02 real detecta el esquema anterior, conserva disponibilidad/pedidos/pagos/puntos, identifica faltante de dos unidades reservadas, repara versión de catálogo aunque falte el trigger original, valida 05 y rechaza repetir el paquete.
- PASS `pilot-catalog-postgres.mjs`: idempotencia/conflictos, sabor deshabilitado, invitación única, revocación/expiración push, tablas privadas.
- PASS `security-contract.cjs`: 38 políticas y contratos existentes.
- PASS `firebase-android-config.ps1`: proyecto/sender/paquete/App ID incorrectos y claves ambiguas rechazados; cuenta de servicio privada rechazada; sintaxis de build válida.
- PASS configuración TOML/MCP, preservando node_repl; 13 SKILL.md y CLI; sesión Firebase autenticada y proyecto verificado.
- Android físico: sin dispositivo conectado. Consultar el informe 1.4.1 para la compilación actual. No se afirmó entrega real FCM.

Pruebas de base en PGlite aislado; no prueban entrega FCM ni IAM Google. El usuario aportó aplicación exitosa de 02, 03 y 04 y la verificación 05 posterior. Esta última confirma permisos reales según los catálogos de PostgreSQL, integridad sin anomalías, chocolate 18 disponibles/2 reservadas, vainilla 20/0 y ambos sabores con chispas en cero. Chocolate con chispas permanece `counted=false`, con dos unidades reservadas que requieren conciliación física. API/web publicada; pendientes FCM servidor y recorrido real con cuenta/dispositivo autorizados. El vínculo de identidades tiene código y SQL comprobados localmente y en CI.

La revisión del cliente web tras 03 encontró únicamente el refresco API de respaldo cada 60 segundos con la página visible y conectividad. Se añadió `assets/js/catalog-realtime.js`: una suscripción pública a `product_variants`, invalidación agrupada, consulta de datos vigentes por la API, recuperación al reconectar y desconexión al ocultar la página o perder Internet. El SDK oficial Supabase 2.117.3 se sirve desde los assets propios y se carga cuando la configuración pública está habilitada. `/api/products?view=realtime` solo devuelve URL y clave pública verificada por tipo; rechaza claves privilegiadas. Se conserva el refresco de respaldo para stock y reservas. Las pruebas unitarias y Chromium con el SDK real y WebSocket/API simulados pasaron, incluido el carrito intacto tras renombrar/deshabilitar. Tras publicar se comprobó la suscripción real y su recuperación offline/online. Falta comprobar la entrega de un evento al editar un sabor autorizado.
