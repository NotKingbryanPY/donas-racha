# Mapa de entradas

[Contexto](AI_CONTEXT.md) · [Índice de archivos/símbolos](generated/CODE_INDEX.md)

Web: index.html y assets/css/js; perfiles/pedidos/tutorial existentes; daily-business.js añade lectura diaria. API: api/_lib/admin_handlers/daily.js usa router existente api/admin/customers/[route].js; auth/session.js y auth.js autorizan personal. api/sync/index.js conserva 410.

Android: DonasApp → daily/DailyActivity, DailyRepository, DailyEntities/DailyDao, DailySyncWorker/DailySynchronizer. data/BackendClient y RemoteSessionStore transportan la sesión. data/db/AppDatabase añade v6 sin borrar entidades históricas. Activities antiguas quedan sin launcher, widgets/servicio antiguo fuera del manifest.

Supabase: migrations/202610130001_daily_operations.sql; sql-editor/daily-v2 preflight/apply/verify/suspend. El resto de migraciones explica la evolución de catálogo, inventario, pedidos, pagos, usuarios y fidelidad. No reejecutar el catálogo completo sobre producción.

docs/knowledge mantiene guías/modelo/diagramas/índices; scripts/knowledge.py detecta cambios. docs/DONAS_CONTROL_2_AUDITORIA.md y DONAS_CONTROL_2_ACTIVACION.md explican decisión y activación. outputs contiene APK/copia documental local, ignorados por Git. exports y archivos locales ajenos no se incorporan. iOS, Apps Script y android/phase9-overlay permanecen históricos fuera de esta entrega.

2.1: orders/StaffInbox.kt, StaffOrderNotifications.kt y StaffNotificationRegistration.kt; DailyActivity integra navegación/detalles; AppDatabase7. API _lib/order-notification-push.js y admin_handlers/order-notifications.js por router existente. SQL orders-v2(00..04) y migration202610140001. scripts/configure-order-notifications.ps1 recibe JSON local de cuenta servicio y escribe variables protegidas por stdin, sin imprimir secretos.

Investigación de avisos fuera de app: usuario A23 informa pedido sin aviso tras1min y recuperación al abrir. FCM ya usa alta prioridad/data y el worker también genera avisos por consulta; abrir no prueba push. Se corrige el reintento protegido para esperar dispatch/ACK y devolver aceptación/errores agregados; el envío inicial mantiene waitUntil y logs de códigos/contadores sin tokens/IDs. Accepted no significa mostrado. Consulta orders-v2/05_delivery_diagnosis.sql solo SELECT permite distinguir falta de dispositivo/job, intentos/rechazo/aceptación. No se pudo leer la cola real por timeout de Brave y clave protegida no exportable en env run; no se eludió protección. Mantener APK2.1.1/Room7/secretos/stock. Ver docs/DONAS_CONTROL_AVISOS_SEGUNDO_PLANO.md; falta diagnóstico actual del A23 y consulta real, sin solución física afirmada.

## Entradas web Drachas

assets/images/drachas-logo.svg es maestro trazado; scripts/build-brand-assets.cjs genera variantes. CSS drachas-brand.css/customer-orders.css separa identidad/seguimiento. customer-orders.js maneja caché/ciclo/avisos; order-confirmation.js recibo/detalle. API _lib/customer_handlers/orders.js lista por propietario y orders/[publicCode].js protege detalle. Pruebas customer-order-tracking-api.cjs y customer-order-tracking-web.cjs. Sin tocar APK/Room/SQL. [Informe18octubre](../DRACHAS_WEB_2026-10-18.md).


## Portada de recompensas — 18 octubre 2026

assets/css/landing.css y assets/js/landing.js: portada sobria y tarjeta privada de puntos. index.html: nextRewardState compartida con renderProfilePreview y rutas de navegación existentes. tests/landing-web.cjs: responsive, navegación, saldo y aislamiento de identidad. Informe docs/DRACHAS_PORTADA_2026-10-18.md.
