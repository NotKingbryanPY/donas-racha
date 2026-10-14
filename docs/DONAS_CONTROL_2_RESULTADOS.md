# Donas Control 2.0.0 — entrega verificada, 14 octubre 2026

## Resultado implementado

Android nativo con Hoy/Inventario/Historial y acciones Compra/Venta/Consumo. Compra por cajas con mix inicial4/4/2/2 editable, costo total y snapshot histórico. Venta por sabor/precio y efectivo/Yappy/dividido. Consumo separado, corrección ADMIN con motivo y cierre online que conserva inventario/historial. No capital ni socios en la navegación nueva.

Supabase mantiene el libro comercial compartido y FIFO; Room6 añade caché/outbox preservando v5. UUID/payload estables, envío por inserción, backoff, dueño autenticado y conflictos explícitos. Un pendiente no es una venta confirmada. Costo antiguo desconocido no se fabrica ni se convierte en ganancia. Entrega web registra un único WEB_SALE sin otro cobro/stock/puntos.

La web añade resumen confirmado/últimos registros y mantiene clientes, puntos, recompensas, tutorial, catálogo, pedidos y cancelación en camino. Se conservan retirados /api/sync, provisión/Firebase/push antiguo y cron de alertas. iOS se pospone.

## APK oficial

Archivo `downloads/Donas-Control-2.0.0-oficial.apk`, copia del resultado de `scripts/build-android-official.ps1`.

| Propiedad | Verificado |
|---|---|
| paquete | com.bryan.donas.control |
| versión / código | 2.0.0 /15 |
| mínimo / target | Android6(API23) /35 |
| launcher | com.bryan.donas.daily.DailyActivity |
| tamaño | 5,398,339 bytes |
| SHA256 APK | 7e04a545624b43d9e5d61d737fa4a5ad1a1d874d1332dcba434ca09eaff5eb3b |
| certificado SHA256 | 5681a1329740c46b2c7a718e3e8a431951c7b6486fc625196dc3dd7ecadb249d |
| firma | v1 yv2 verificadas, misma firma oficial anterior |
| alineación | zipalign4/16KiB verificada |
| análisis de contenido | cero claves PEM privadas, JWTservice_role, credenciales/keystores/bases locales |

Distribución privada firmada, no aprobación Google Play. Instalar como actualización sobre el paquete oficial; no desinstalar ni borrar datos. CI usa firma temporal y sus APK no sustituyen éste. [Descargar APK oficial](https://www.dracha.store/downloads/Donas-Control-2.0.0-oficial.apk); [checksum](https://www.dracha.store/downloads/Donas-Control-2.0.0-oficial.apk.sha256). La descarga real se verificó contra el hash y tamaño de esta tabla.

## Validación realizada

- **PASS 113 pruebas Android/JUnit/Robolectric**, cero fallos/errores: preservación Room, migraciones, duplicados, cola, respuesta perdida/reapertura, reloj que retrocede, cambio de propietario, sesión y pantallas nuevas; también regresiones del código histórico conservado.
- **PASS lintDebug ylintOfficial**, estrictos, sin errores/avisos. **PASS assembleOfficial/R8**.
- **PASS SQL PostgreSQL aislado:** cajas configurables, pago dividido, consumo, FIFO/costo desconocido, rollback, reservas, pedido web único, cierre/replay/conflicto, RLS y archivo móvil preservado. Exige conteo físico inicial sin crear stock cero.
- **PASS API simulado:** roles/actor servidor, cantidades/pago, hash estable, SQL faltante explícito. Suites existentes de auth/pedidos/seguridad también pasaron.
- **PASS navegador 360/768/1440:** panel diario, responsive/error de activación aislado, conteo cero/borrador/revisión/cancelación, perfil/puntos, confirmación/WhatsApp/reduced-motion y recuperación sin doble envío.
- **PASS ocho pruebas de documentación** e índices/refs/hashes. CI detectó y se corrigió CRLFvendor README/licencia sin modificar el bundle. Guía/modelo/siete diagramas y README actuales reescritos; cada cambio debe acompañar su documentación.
- **PASS CI e0d0d14:** [compilación/lint y emuladores API 23/35](https://github.com/NotKingbryanPY/donas-racha/actions/runs/38521093399), [web/contratos/browser/concurrencia](https://github.com/NotKingbryanPY/donas-racha/actions/runs/38521093465) y [vigencia de documentación](https://github.com/NotKingbryanPY/donas-racha/actions/runs/38521093460). Las pruebas instrumentadas verifican migraciones Room y el inicio de la app optimizada; no certifican un pedido cloud ni restricciones físicas del Honor.

## Publicación comprobada

[PR 41](https://github.com/NotKingbryanPY/donas-racha/pull/41) integrado en main, commit e2a7ff16a51cd72d19a44c752869deba011c0743. [Vercel Production](https://vercel.com/king-entertainment/donas-racha/4KQHErDjdu7ZiMPSQ2Nrtz6kh4PS) informó success. Verificación HTTP real del 14 octubre 2026, 06:24 UTC: página con adminDailyPanel y script 2.0.0; script diario, productos e inventario públicos con HTTP 200; consulta anónima diaria con HTTP 401; descarga APK con HTTP 200, 5,398,339 bytes y SHA256 idéntico. El SQL publicado también coincide con el archivo fuente y contiene el marcador final completo. Estas comprobaciones son de despliegue y acceso público, no de escritura autenticada en Supabase.

Los fallos iniciales de fixtures/qualifiers y WorkManager duplicado, y los problemas de lifecycle/recursos sin uso detectados por lint se corrigieron y el conjunto local final pasó. No se ocultaron mediante baseline o desactivación global de lint.

## Diseño y archivos de entrada

Paleta de perfil dracha.store; tarjetas oscuras, lavanda, cifras grandes y acciones rápidas. [Propuesta generada y prompt](previews/donas-control-2-concept.md); cifras ilustrativas. Renders nativos Robolectric en test-output/android-daily, no capturas de teléfono ni ventas reales.

Entradas: daily/DailyActivity, DailyRepository, DailyEntities, DailySync, AppDatabase/BackendClient, api/_lib/admin_handlers/daily.js yrouter existente; migration202610130001 + sql-editor/daily-v2; index/CSS/daily-business.js. [Guía IA](knowledge/AI_CONTEXT.md), [arquitectura](knowledge/ARCHITECTURE.md), [datos/fórmulas](knowledge/DATABASE.md), [flujos](knowledge/DATA_FLOWS.md), [activación](DONAS_CONTROL_2_ACTIVACION.md).

## Pendiente real y uso

**No se ejecutó SQL de producción:** Browser/Computer no pudo iniciar kernel para Studio, incluido el último reintento. Aplicar [00_preflight](https://www.dracha.store/supabase/sql-editor/daily-v2/00_preflight.sql), [01_apply](https://www.dracha.store/supabase/sql-editor/daily-v2/01_apply.sql) y [02_verify](https://www.dracha.store/supabase/sql-editor/daily-v2/02_verify.sql) en ese orden, siguiendo la guía; conservar cifras y no repetir seeds ni el paquete antiguo. El script 01 termina en END_DONAS_DAILY_V2_COMPLETE. Si falta activación, la API diaria informa DAILY_SETUP_REQUIRED; la web existente sigue operativa. Las credenciales protegidas Supabase de Vercel no se cambian ni se publican.

Una vez activado: entrar con cuenta ADMIN/SELLER del Dashboard, actualizar online, registrar compra real, venta/consumo y comprobar el mismo saldo en web. Cerrar con cola vacía; historia e inventario permanecen. Si falla red, el registro queda pendiente y reintenta el mismo UUID. Jornada/revisión cerradas requieren revisar/descarte explícito, no otro cobro.

Sin dispositivo ADB/emulador local, no se probó instalación/recorrido real en Honor, restricciones físicas ni RAM2GB. No se afirma integración autenticada cloud de extremo a extremo ni push fuera de app; pedidos se gestionan en Dashboard web. Los datos locales históricos están preservados y no se importan automáticamente al libro nuevo. Costos anteriores no verificables quedan pendientes. No hay borrado definitivo ni reversión monetaria automática en esta versión.
