# Validación de integración — 7 octubre 2026

Estado: implementación local preparada; activación de producción y prueba física pendientes. No se creó ningún pedido real ni se modificó Supabase de producción en esta sesión. Ver `INTEGRACION_1_4_0.md` para SQL, Firebase, despliegue y compilación.

## Evidencia ejecutada

| Área | Pruebas | Resultado / alcance |
|---|---|---|
| Esquema / seguridad | schema-contract, security-contract, full-supabase-backend | PASS. 30 migraciones y contratos locales. No es inspección del proyecto real de Supabase. |
| Inventario | shared-inventory-postgres, manual-inventory-postgres, inventory-revision-api | PASS. Reserva de última unidad, rechazo al exceder stock, ventas offline, reversión, idempotencia, revisiones y locks. PGlite aislado; la prueba con procesos concurrentes PostgreSQL está incluida en CI pero no se ejecutó aquí. |
| Roles | seller-role-postgres, pilot-device-auth, device-restore-api | PASS. SELLER conserva permisos limitados, dispositivos usan hash/expiración/revocación, restauración exige ADMIN y prueba de identidad. |
| Catálogo / dispositivos | pilot-catalog-postgres | PASS. Aplica todas las migraciones y scripts 00/04/05; edición repetida devuelve replay, versión antigua genera conflicto, sabor deshabilitado impide pedido, invitación de uso único y desactivación push por revocación/expiración. Tablas privadas no legibles por anon/authenticated. |
| Notificaciones servidor | order-push | PASS con proveedor HTTP simulado. Firma OAuth/FCM, cola/leases, reintentos, tokens inválidos y ausencia de secretos públicos. NO es envío a Firebase real. |
| Sesiones / pedidos | phase9-sync, session-resilience, customer-order-auth, three-daily-purchases-postgres | PASS. Cursor conserva microsegundos, privacidad, renovación, pedidos/cobro y límite de puntos de tres compras por día. |
| Refresco comercial | shared-inventory-refresh | PASS. Actualiza nombre/oferta/stock, preserva carrito, pausa fuera de pantalla/red, respaldo 60 s. |
| Navegación / tutorial | customer-navigation, customer-tour-motion, customer-onboarding, web-script-syntax | PASS en Chromium/API simulada. Historial, recarga, login/roles, progreso del tutorial y espera de animación; anchos 320/390/1280 en tutorial. |
| Pedido web completo | integration-order-web | PASS en Chromium, 360/768/1440. 150 puntos disponibles frente a 250 históricos; sin desbordamiento; respuesta perdida después del commit no anuncia éxito; recarga conserva payload/clave exactos; doble clic no duplica; replay no anima; nuevo éxito respeta movimiento reducido; WhatsApp con código; recarga recupera sin repetir diálogo; un rechazo nuevo conserva su error aunque exista un pedido anterior confirmado. |
| Android | testDebugUnitTest, lintDebug, lintOfficial, assembleOfficial | 97 pruebas unitarias/Robolectric PASS, cero fallos/errores. Incluyen migración Room 4→5 preservando pedidos/cola, reapertura de cambios pendientes y destinos/deduplicación de notificaciones. lintDebug y lintOfficial PASS, sin incidencias. assembleOfficial PASS. No se ejecutó instrumentación física. |

Las pruebas web utilizan respuestas simuladas: no prueban el dominio ni el inventario de producción. Las capturas se revisaron visualmente en `test-output/integration/`; también hay capturas del tutorial. El flujo PostgreSQL y el navegador se prueban por separado, sin afirmar un recorrido real web → servidor desplegado → teléfono.

## Consulta remota de solo lectura

- https://www.dracha.store/ → HTTP 200.
- /api/products → HTTP 200 y cuatro SKUs compartidos: DR-CHOCOLATE, DR-VAINILLA, DR-CHOCOLATE-CHISPAS, DR-VAINILLA-CHISPAS.
- /api/products?view=inventory → HTTP 200, oferta y conteo presentes para los cuatro.
- /api/admin/orders y /api/sync sin credenciales → HTTP 401 AUTH_REQUIRED.
- /api/orders GET → HTTP 405; la recuperación utiliza la ruta autenticada /api/orders/[publicCode].

No hay prueba de lectura con dispositivo revocado en producción; esa seguridad está probada de forma aislada. Studio no fue accesible debido al error de inicialización del navegador. La exportación adjunta de políticas no contiene las definiciones completas del esquema.

## Comandos reproducibles

```powershell
node tests/schema-contract.cjs
node tests/full-supabase-backend.cjs
node tests/security-contract.cjs
node tests/order-push.cjs
node tests/shared-inventory-refresh.cjs
node tests/pilot-device-auth.cjs
node tests/device-restore-api.cjs
node tests/inventory-revision-api.cjs
node tests/session-resilience.cjs
node tests/customer-order-auth.cjs
node tests/web-script-syntax.cjs
node tests/phase9-sync.cjs
```

Instalar runtime de prueba aislado `@electric-sql/pglite@0.5.8` y configurar PGLITE_MODULE con su ruta `file:///.../dist/index.js`:

```powershell
node tests/shared-inventory-postgres.mjs
node tests/seller-role-postgres.mjs
node tests/manual-inventory-postgres.mjs
node tests/pilot-catalog-postgres.mjs
node tests/three-daily-purchases-postgres.mjs
```

Para browser, instalar Playwright y Chromium, arrancar `node tests/serve-fixture.cjs` en otra consola (solo 127.0.0.1:8765), configurar CHROMIUM_PATH si el runtime no tiene Chromium predeterminado, y ejecutar:

```powershell
node tests/customer-navigation.cjs
node tests/customer-tour-motion.cjs
node tests/customer-onboarding.cjs
node tests/integration-order-web.cjs
```

Android: JDK 17 y SDK 35. Usar `scripts/build-android-official.ps1` con la firma permanente existente; ejecuta unit tests, assembleOfficial y lint debug/oficial. No desinstalar una instalación con datos para actualizarla.

## Matriz manual pendiente antes de activar

| Escenario | Procedimiento / resultado esperado |
|---|---|
| Esquema real | Ejecutar 00_preflight en el proyecto correcto, comparar contratos y aplicar solo migraciones ausentes. Ejecutar 05_verify. No repetir semilla: catálogo público ya existe. |
| Firebase | Registrar com.bryan.donas.control en donascontrol-1f5df; App ID y API key públicos correctos al compilar; cuenta de servicio del emisor solo en Vercel. Comprobar token registrado activo sin imprimirlo. |
| Pedido / FCM | Crear un pedido autorizado desde web; verificar fila, reserva y push job. Probar app visible, en segundo plano y pantalla bloqueada. Cada pedido genera un aviso y tap abre su UUID. Repetir con permiso denegado y red interrumpida; al regresar se recuperan pedidos. |
| Gestión / consistencia | Aceptar, poner en camino, cobrar/entregar una vez. Verificar mismo estado web/Android, una venta/consumo de stock y puntos aplicados una vez. Cancelar otro pedido y verificar liberación de reserva. |
| Offline / proceso | Con datos sincronizados, activar modo avión, consultar pedidos/inventario/sabores y registrar operación ADMIN permitida. Cerrar proceso, reabrir; la cola conserva UUID. Reconectar y comprobar ACK sin repetir stock/cobro. Venta rechazada queda visible para conciliación. |
| Sabores / conflicto | Deshabilitar chocolate desde Android conectado: web deja de aceptarlo al refrescar y SQL lo rechaza inmediatamente. Repetir offline: web conserva versión confirmada hasta ACK. Dos ediciones concurrentes muestran conflicto y no sobrescriben silenciosamente. |
| Autorización | Emitir invitación de uso único y abrir después sin login visible; revocar dispositivo, verificar 401 y ausencia de nuevos push. SELLER no edita catálogo/conteos ni sincroniza libro contable ADMIN. El acceso tradicional por cuenta Supabase sigue existiendo y su revocación se administra a nivel de cuenta/sesión. |
| Tutorial / responsive | Probar con progreso parcial y terminado, Retomar tutorial, perfil/pedidos, teclado y lector de pantalla; validar movimiento reducido y WhatsApp en teléfono real. |
| Rendimiento | Medir inicio, memoria y batería en teléfono cercano a 2 GB. No hay medición física en esta sesión; colas/páginas pequeñas y ausencia de servicio permanente reducen consumo. |

## Límites explícitos

FCM no está activado en una compilación sin App ID/API key. No existe entrega instantánea garantizada. Ningún pedido nuevo llega sin Internet. Varios vendedores offline requieren conciliación si venden físicamente la misma última unidad. Crear un quinto SKU no está habilitado: exige adaptar distribución de cajas y FIFO del negocio. Realtime es opcional; esta entrega conserva actualización al volver/reconectar y respaldo visible, sin una nueva suscripción privada. No se calculan puntos pendientes o gastados ficticios ni se cambian saldos existentes.
## APK oficial verificado

Archivo: `outputs/Donas-Control-1.4.0-oficial.apk`, 3.846.714 bytes. VersionName 1.4.0, versionCode 12, paquete com.bryan.donas.control. Firma válida v1/v2 y alineación zipalign para páginas nativas de 16 KiB comprobadas. Certificado SHA-256 coincide con la firma permanente anterior: `5681a1329740c46b2c7a718e3e8a431951c7b6486fc625196dc3dd7ecadb249d`.

SHA-256 del APK: `9e09e66f4ee83c5df33849d571e2469b9e2056578606a317a261b9e9adfa7c3f`. Archivo de hash al lado del APK.

La configuración pública de Firebase sigue incompleta (App ID/API key): este APK no habilita FCM aún. Revisión de fuente y de las 883 entradas del APK sin marcadores de claves privadas/service role/FCM privadas; las credenciales del emisor están previstas solo en servidor. Preparado para actualizar la instalación oficial conservando datos; primero activar las migraciones/API compatibles según la guía. No hubo dispositivo ADB conectado ni instalación física.
