# Arquitectura nueva y fronteras

La observación de Room se crea una sola vez en onCreate y cambia de propietario mediante StateFlow/collectLatest; no se acumulan observadores en onResume. La metadata del widget retirado se conserva fuera del recurso activo (legacy-res) y se elimina su descripción sin uso. Lint permanece estricto, sin baseline ni supresión global añadida.

La sincronización procesa lotes de hasta 50. Las consultas de proyección solo leen pendientes/conflictos y ACK posteriores al snapshot, con índice propietario/estado/secuencia. La interfaz limita el histórico local confirmado/descartado a 200 entradas y pagina el remoto; conservar historia no obliga a cargarla completa en RAM.

[Contexto](AI_CONTEXT.md) · [Diagrama](diagrams/01-system.md)

Android lee Room, escribe un payload inmutable con UUID y programa WorkManager. La API verifica Supabase Auth y app_user_roles antes de llamar RPC de service_role. PostgreSQL serializa operaciones con el mismo bloqueo de inventario usado por pedidos/conteos, valida saldo libre de reservas y aplica recibo + items + movimiento + costos en una transacción. No existe escritura directa desde el APK a tablas privilegiadas.

| Dato | Autoridad | Copia |
|---|---|---|
| catálogo, disponibilidad comercial | product_variants Supabase | web y snapshot Android |
| unidades/reservas | inventario compartido Supabase | daily_cache y proyección de pendientes |
| compra/venta/consumo/corrección | daily_operations + items Supabase | daily_outbox/recibos locales |
| costos FIFO | daily_cost_lots Supabase | resumen confirmado, sin libro independiente |
| jornadas/cierres | daily_sessions Supabase | snapshot de las 30 jornadas recientes |
| pedidos/pagos/puntos | tablas/RPC existentes Supabase | web y staff_order_cache por propietario Android; operaciones solo online |
| libro anterior | Room v5 conservado | no se reenvía ni se fusiona automáticamente |

DonasApp cancela escritores históricos una sola vez y programa StaffInbox/StaffNotificationRegistration con la identidad Supabase actual. StaffMessagingService se registra en manifest; el widget/servicio antiguos permanecen fuera del runtime. /api/sync, provisioning/firebase-identity/devices siguen410; order-notifications es una ruta nueva del mismo router, sin otro lambda.

Views nativas y Material evitan una WebView o framework nuevo. HTTP usa el cliente existente con redirecciones restringidas, timeouts y refresh cifrado; la API reutiliza el router existente para no añadir funciones Vercel innecesarias. Firebase FCM transporta solo tipo/UUID de pedido/propietario/dispositivo, sin cliente/teléfono/dirección. Firestore no recibe copias comerciales; autorización Supabase existente, sin Firebase Auth piloto nuevo.

Diseño inspirado en el perfil web: oscuro/lavanda/rosa, acciones rápidas y cifras claras. Sin servicio permanente, sin permisos de batería adicionales. Actualización web del resumen cada 60 s solo visible/online; inventario/catálogo mantienen sus mecanismos actuales. FCM es principal fuera de app. Respaldo WorkManager oportunista cada30min y refresco de Pedidos cada60s solo visible; ningún bucle permanente. La alta confirma SQL/cola antes de waitUntil del emisor Vercel; fallos mantienen pedido/jobs. Reintento cron Supabase privado solo invoca si hay trabajos elegibles; no se reactiva cron GitHub.

Los componentes antiguos MainActivity/OrdersActivity son alias privados al launcher nuevo, para que intents anteriores no arranquen escritores retirados. El resto de fuentes históricas/datos se conserva; no representa el flujo de pedidos2.1.
