# Validación de Donas Control 1.4.1 — 8 octubre 2026

## Verificado

- Firebase CLI 15.33.0 y MCP oficial autenticados; proyecto/app/paquete verificados sin imprimir credenciales.
- Correo/contraseña y Google desplegados. SHA-1/SHA-256 de la firma oficial registrados; SDK config renovado con OAuth web.
- Firebase Cloud Messaging HTTP v1: Service Usage confirmó `fcm.googleapis.com` en estado `ENABLED`. No es una prueba de envío o de entrega al teléfono.
- Firestore Standard `(default)` en `us-east1`, `freeTier=true`; reglas compiladas y desplegadas por CLI oficial. 36 casos de seguridad pasaron en emulador Standard, con cuentas simuladas.
- Kotlin debug/oficial compila con BoM 34.12.0/Auth 24.0.1/Firestore 26.2.0, Credential Manager 1.6.0 y Google ID 1.1.1; se conserva minSdk 23.
- 99 pruebas Android JUnit/Robolectric, cero fallos/errores: transacciones Room, reapertura, FIFO, reintentos, cola de operaciones, migración catálogo, conflictos, sesiones, navegación, notificaciones y consulta de pedido antiguo. Ejecución con configuración Firebase real importada al build; no son pruebas de login/push reales.
- PostgreSQL/PGlite: paquete 02 sobre el esquema anterior preserva stock, pedidos, cobros y puntos; detecta déficit reservado existente y repara versión monotónica. Migraciones completas, vínculo Firebase, consulta única de autorización, límites SELLER, expiración/revocación, cambio de cuenta y renovación con invitación nueva pasan.
- Recuperación SQL Editor: se reprodujo la consulta truncada en `api_unregister_push_device` y su error 42601; la comprobación de estado pasó. La comparación previa ya usa una variable de transacción, evitando que Studio añada RLS para una tabla temporal. El paquete completo preserva datos; un fallo tardío revierte la instalación y su repetición exitosa está bloqueada. Ver `RECUPERAR_SQL_02.md`.
- Middleware Firebase: token falsificado rechazado por SDK oficial; correo verificado, UID y dispositivo comprobados; rol de servidor limitado; una RPC por autorización. API de vínculo ignora UID/rol aportados por el cliente y rechaza escrituras sin propiedad/verificación. Listado de dispositivos incluye cuentas e invitaciones, sin hashes ni tokens.
- Contratos API existentes: RLS/38 políticas, sesiones de clientes y administradores, puntos, canjes, pedidos, stock, notificaciones, idempotencia. Emisores FCM/APNs probados con proveedores simulados, incluidos tokens inválidos y caídas.
- Navegador Chromium con API simulada: perfil/pedidos en 360/768/1440 px, puntos 150 disponibles/250 históricos, confirmación solamente tras respuesta verificable, fallo antes del commit, respuesta perdida después del commit, recarga, clic doble, mismo intento sin duplicación, WhatsApp codificado. Navegación/URL/historial y tutorial existente en 320/390/1280 px; progreso y versión conservados; movimiento reducido.
- Inspección visual de perfil y confirmación móvil: pestañas distinguibles, cifra disponible principal, cifra histórica secundaria, código/estado/pago legibles y botón de WhatsApp.
- Catálogo Realtime: pruebas unitarias de configuración pública rechazan claves privilegiadas y URLs ajenas; ciclo de suscripción agrupa eventos, desconecta offline/en página oculta y recupera cambios al reconectar. Chromium carga el SDK oficial Supabase 2.117.3 alojado en el propio sitio y prueba renombrar/deshabilitar, ráfagas, carrito conservado y pérdida/recuperación de conexión mediante WebSocket/API simulados. No son eventos de producción.
- SQL de producción informado por el usuario: 02 `APPLIED`, 03 `FIREBASE_BRIDGE_APPLIED`, 04 `REALTIME_CATALOG_READY` y 05 con seis anomalías en cero. Las ocho tablas privadas conservan RLS y niegan SELECT anon/authenticated; once RPC niegan EXECUTE a esos roles; la copia interna del RPC push también niega service_role. El trigger de versión está habilitado. El sabor chocolate con chispas conserva dos reservas y requiere conciliación física (`counted=false`).
- GitHub, head final `7cf4e0a8912cf8f2f21cd531fd4cbf7d13bdf1bb`: [contratos, migraciones, concurrencia PostgreSQL real y navegador](https://github.com/NotKingbryanPY/donas-racha/actions/runs/37850078462), [reglas Firestore](https://github.com/NotKingbryanPY/donas-racha/actions/runs/37850078401), [Android con emuladores API 23/35](https://github.com/NotKingbryanPY/donas-racha/actions/runs/37850078377) y [iOS existente](https://github.com/NotKingbryanPY/donas-racha/actions/runs/37850078482) aprobados. El APK oficial local también pasó las comprobaciones anteriores.
- Vercel: [Preview del mismo código](https://vercel.com/king-entertainment/donas-racha/EvoqogDSEHCvTMS3QwHDstUeqZTL) terminó con estado success. Requiere autenticación Vercel: las consultas externas devolvieron redirección 302, por lo que no se afirmó prueba de sus API ni se deshabilitó su protección.
- Consultas anónimas reales al dominio actual `www.dracha.store`: inventario HTTP 200 con cantidades 18/0/20/0 y reservas 2/2/0/0, coincidentes con 05; `/api/admin/orders` HTTP 401 `AUTH_REQUIRED`. Son consultas de lectura a la producción anterior, no validación del recorrido nuevo.
- Publicación posterior: PR 37 integrado en `main`, Vercel Production success, nuevos assets presentes. Catálogo, inventario y configuración pública Realtime HTTP 200; rutas privadas y creación de pedido sin sesión HTTP 401. Chromium contra la web real estableció suscripción Supabase, desconectó offline y recuperó la suscripción online; 390/768/1440 px sin desbordamiento ni errores JavaScript/consola. Ver [el informe de producción](DESPLIEGUE_PRODUCCION_1_4_1.md) para límites y pruebas manuales.
- Build oficial final: `testDebugUnitTest lintDebug lintOfficial assembleOfficial`, con configuración Firebase real y compilador Kotlin en el proceso Gradle, terminó `BUILD SUCCESSFUL` en 5 min 44 s. Las 99 pruebas volvieron a pasar; ambos reportes lint dicen `No issues found`. Se conservó la excepción local del falso positivo documentado de Google.
- APK final `outputs/Donas-Control-1.4.1-oficial.apk`: 5 366 740 bytes (5,37 MB), paquete `com.bryan.donas.control`, versionCode 13, minSdk 23, targetSdk 35. Apksigner verificó firmas v1/v2 y el certificado oficial permanente; zipalign pasó con alineación de páginas de 16 KB.
- Inspección de las 993 entradas ZIP del APK: los cinco valores públicos Firebase coinciden con la configuración descargada; no se encontraron JWT con rol `service_role` ni bloques PEM de claves privadas. Es una comprobación estática de esos patrones, además de la revisión de los flujos de configuración y del código; no una garantía sobre cualquier secreto posible.

SHA-256 del APK final:

```text
f0213df8560ce646d8faf9c420317af8555aa6db0889182044c25ac6954fd431
```

Certificado SHA-256: `56:81:A1:32:97:40:C4:6B:2C:7A:71:8E:3E:8A:43:19:51:C7:B6:48:6F:C6:25:19:6D:C3:DD:7E:CA:DB:24:9D`. El archivo `.apk.sha256` permite comprobar la transferencia del artefacto. Los avisos de apksigner sobre metadatos `META-INF` se refieren a su cobertura JAR/v1; la firma v2 completa del APK también fue verificada. No se eliminaron metadatos de servicios necesarios de las bibliotecas para ocultar esos avisos.

## Fallos encontrados y corregidos

Auth 24.1/24.2 requiere metadatos Kotlin 2.3; Auth 25 además API 24. Se inspeccionaron AAR y el BoM oficial, y se eligió la combinación compatible. No se ocultó el error con flags que omiten la validación del compilador.

La primera suite completa con configuración Firebase real falló al registrar push durante `Application.onCreate` sin una sesión autorizada y antes de inicializar WorkManager en Robolectric. El registro ahora se agenda solo con sesión administrativa, evitando además un trabajo innecesario al arrancar. La repetición pasó las 99 pruebas.

El primer intento del emulador usaba una ruta de reglas fuera de su raíz; se corrigió la configuración local y el test carga siempre las reglas explícitamente. Las denegaciones registradas en el emulador son resultados esperados de los ataques simulados.

La primera publicación de reglas mediante el puente MCP expiró sin resultado de despliegue. La CLI oficial posterior confirmó compilación, publicación y `Deploy complete`. No se interpretó el timeout como éxito.

Credential Manager exigió manejar `NoCredentialException`; se añadió ese caso y la cancelación. La respuesta Google se valida como `CustomCredential` con el tipo esperado y se convierte mediante `GoogleIdTokenCredential.createFrom`; al salir se limpia también el estado de Credential Manager. Lint de AGP 8.9.2 no reconoce las referencias Kotlin al companion de `GoogleIdTokenCredential`, incluso con el tipo local explícito. Se inspeccionó el detector y se confirmó el falso positivo oficial [385394934, corregido en AGP 8.10](https://developer.android.com/build/releases/agp-8-10-0-release-notes). La excepción es local a `GetGoogleIdOption`, no una desactivación global de lint. Se conserva el toolchain probado del proyecto.

Una ejecución de navegador coincidió con la optimización Android bajo presión de memoria y expiró al cargar la página local. Se cerró esa ejecución y se repitieron las tres suites después del build: todas pasaron. El build oficial compila Kotlin en el proceso Gradle para evitar otro daemon de aproximadamente 1 GB. El rendimiento en un teléfono sigue requiriendo medición física.

## Alcance pendiente

El APK está generado y verificado localmente. No se publicó en Google Play ni se instaló en un teléfono durante esta sesión.

El usuario ejecutó SQL de producción y aportó sus resultados de aplicación y verificación; el agente no ejecutó esas consultas. La API/web está desplegada y sus comprobaciones públicas pasaron; queda el recorrido real desde un pedido autorizado hasta su recepción en Android. No repetir 02 ni ejecutar los scripts de cierre para continuar.

Sin dispositivo conectado según `adb devices`: faltan login Google/correo en el APK firmado, recepción FCM con app abierta/en segundo plano/pantalla bloqueada, sonido, toque del aviso, restricciones reales de Android, cierre del proceso offline y rendimiento en un teléfono de 2 GB.

FCM HTTP v1 del servidor todavía requiere variables protegidas de la cuenta de servicio y reintentos programados. La configuración Android pública no autoriza el envío. No se enviaron avisos reales ni se crearon pedidos/cobros ficticios en producción para aparentar validación.

Las pruebas PGlite no sustituyen la concurrencia entre conexiones en PostgreSQL real; ambas variantes se ejecutaron y el workflow remoto de concurrencia pasó. También pasó el workflow Firestore. Sus proveedores/usuarios son de pruebas: no demuestran entrega FCM ni acceso de una cuenta administrativa real en producción. La edición Enterprise de Firestore, migración completa del negocio a Firebase y login Firebase en la web están fuera de la transición gradual elegida.
