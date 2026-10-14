# Mapa de entradas

[Contexto](AI_CONTEXT.md) · [Índice de archivos/símbolos](generated/CODE_INDEX.md)

Web: index.html y assets/css/js; perfiles/pedidos/tutorial existentes; daily-business.js añade lectura diaria. API: api/_lib/admin_handlers/daily.js usa router existente api/admin/customers/[route].js; auth/session.js y auth.js autorizan personal. api/sync/index.js conserva 410.

Android: DonasApp → daily/DailyActivity, DailyRepository, DailyEntities/DailyDao, DailySyncWorker/DailySynchronizer. data/BackendClient y RemoteSessionStore transportan la sesión. data/db/AppDatabase añade v6 sin borrar entidades históricas. Activities antiguas quedan sin launcher, widgets/servicio antiguo fuera del manifest.

Supabase: migrations/202610130001_daily_operations.sql; sql-editor/daily-v2 preflight/apply/verify/suspend. El resto de migraciones explica la evolución de catálogo, inventario, pedidos, pagos, usuarios y fidelidad. No reejecutar el catálogo completo sobre producción.

docs/knowledge mantiene guías/modelo/diagramas/índices; scripts/knowledge.py detecta cambios. docs/DONAS_CONTROL_2_AUDITORIA.md y DONAS_CONTROL_2_ACTIVACION.md explican decisión y activación. outputs contiene APK/copia documental local, ignorados por Git. exports y archivos locales ajenos no se incorporan. iOS, Apps Script y android/phase9-overlay permanecen históricos fuera de esta entrega.
