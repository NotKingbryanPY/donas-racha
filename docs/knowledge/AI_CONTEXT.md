# Donas Racha / Donas Control: guía para IA

Revisión: 14 octubre 2026. Leer primero [AGENTS](../../AGENTS.md), esta guía y el [diagnóstico previo](../DONAS_CONTROL_2_AUDITORIA.md). La aclaración del14octubre prioriza Pedidos nativos y notificaciones FCM fuera de la app, además de la operación diaria; sustituye la retirada total del12octubre. La web permanece operativa. No restaurar automáticamente la integración móvil antigua.

## Arquitectura vigente

Web HTML/CSS/JS y API CommonJS en Vercel; Supabase Auth/roles ADMIN y SELLER identifican al personal. Supabase PostgreSQL es la única autoridad comercial. Android2.1.0/código16, Kotlin/Views/Material, Room7 conserva donas.db y los registros anteriores; añade staff_order_cache por usuario a daily_outbox/daily_cache. DailyActivity abre Pedidos y conserva Hoy/Stock/Historial. DailyRepository y DailySyncWorker usan GET/POST /api/admin/customers/daily.

Compras con mix editable y costo total; ventas por sabor/precio y pago dividido; consumo separado; correcciones ADMIN; cierre online conservando inventario e historial. No hay capital, socios ni borrado definitivo en la navegación nueva. El resumen solo incluye operaciones confirmadas; los pendientes locales tienen estado propio.

El ledger nuevo se añade a PostgreSQL. Los pedidos web completados crean un recibo WEB_SALE único, sin repetir stock/pago/puntos. No se importan automáticamente ventas anteriores ni pendientes v5. El costo desconocido de stock anterior no se inventa. Firebase sirve para FCM en el runtime2.1; Supabase Auth/roles siguen autorizando al personal. No es una segunda base comercial. Ver [pedidos y activación2.1](../DONAS_CONTROL_2_1_PEDIDOS.md).

## Entradas de código

| Área | Entrada |
|---|---|
| app nueva | android/donas-control/app/src/main/java/com/bryan/donas/daily/DailyActivity.kt |
| reglas/cola/caché | daily/DailyRepository.kt, daily/DailyEntities.kt |
| reintentos | daily/DailySync.kt; orders/StaffInbox.kt, StaffNotificationRegistration.kt |
| pedidos y avisos | orders/StaffOrderNotifications.kt; API admin_handlers/order-notifications.js, order-notification-push.js; migration202610140001 |
| Room/upgrade | data/db/AppDatabase.kt, schemas v1–7 |
| HTTP/sesión cifrada | data/BackendClient.kt, data/RemoteSessionStore.kt |
| API nueva | api/_lib/admin_handlers/daily.js; router api/admin/customers/[route].js |
| SQL nuevo | supabase/migrations/202610130001_daily_operations.sql |
| web diaria | assets/js/daily-business.js, adminDailyPanel en index.html |
| pedidos/puntos existentes | api/orders, api/admin/orders, api/backend.js; migraciones históricas |
| inventario | inventory_by_flavor; inventory_manual_counts, inventory_movements, inventory_revision |

## Regla de mantenimiento obligatoria

Cada cambio funcional debe actualizar esta documentación en la misma entrega: funciones/modelo/flujos/decisiones/activación/pruebas/límites. Ejecutar `python scripts/knowledge.py report`, revisar código y documentos afectados, actualizar model/diagramas, `generate`, `check`, `review --areas ... --note ...`, `check --fresh`. No declarar revisión para silenciar alertas sin revisar. El [runbook](RUNBOOK.md) contiene compilación/instalación; [DATABASE](DATABASE.md) el contrato SQL; [DATA_FLOWS](DATA_FLOWS.md) conflictos; [VALIDATION](VALIDATION.md) evidencia.

## Evidencia y seguridad

CONFIRMADO_CODIGO = implementación local; INFERIDO = análisis pendiente; PENDIENTE_VERIFICACION = falta recorrido cloud/dispositivo. Prueba SQL aislada no certifica producción. Esta sesión confirmó metadatos Firebase. Brave detectó las pestañas, pero no permitió adjuntar el control para leerlas; Vercel CLI no tiene sesión. No se verificaron ni configuraron secretos del emisor. No copiar tokens, cuentas de servicio, exports ni clientes al grafo/guías. Nunca imprimir login:list JSON o almacenes de credenciales.

Entrega 2.0.0/código15: APK oficial firmado y descarga pública verificados; 113 pruebas locales, lint/build y CI de emuladores API23/35 aprobados. Web desplegada desde PR41/main y acceso anónimo al RPC rechazado. [Informe de resultados](../DONAS_CONTROL_2_RESULTADOS.md). El usuario compartió instalación01 sin error, stock39 y DAILY_V2_READY con todos los controles esperados de jornada/permisos/RLS/trigger/integridad. Activación validada por esa evidencia; falta el recorrido autenticado físico Android→API→Supabase→web. El agente no ejecutó SQL privado.

Antes de SQL real leer [ACTIVACION](../ACTIVACION_2026-10-08.md) y [activación v2](../DONAS_CONTROL_2_ACTIVACION.md). Preservar filas/stock; no repetir seeds ni paquete 02 de octubre 8. No ejecutar el archivo móvil de retirada como parte de v2. FCM alta prioridad entrega un aviso genérico en background, con sonido, dedupe por usuario/pedido y tap autenticado al detalle. Requiere emisor protegido en Vercel y SQL orders-v2; aceptación FCM no prueba pantalla física ni garantiza instante de entrega. No sincronizar pedidos nuevos sin red. iOS se pospone.

Historia recuperable: 1.4.2 d304e46; retirada fe8bcbb; web 1.5.1 70164c4. Los informes fechados anteriores conservan decisiones de esas versiones. No deducir de ellos el estado privado actual ni el costo de stock antiguo.
